import {AsyncResultCallback, mapLimit} from "async";
import { SystemJS } from '@grafana/runtime'
const jq = require('jq-web')

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import {MyQuery, MyDataSourceOptions} from './types';
import _ from "lodash";

const TAKE = 30;

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url: string;
  apiKey: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.jsonData.url || "";
    this.apiKey = instanceSettings.jsonData.apiKey || "";
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const {range} = options;
    const from = range!.from.valueOf();
    const to = range!.to.valueOf();
    const intervalMs = (options.intervalMs || 1000);

    const data = (await mapLimit(options.targets, 5, async (target: MyQuery, callback: AsyncResultCallback<MutableDataFrame | null>) => {
      if (target.hide) {
        // if this query is hidden, don't get any data
        callback(null, null);
      } else {
        const spaceId = await this.convertNamesToIds(target.space, "spaces");
        const environmentIds = await this.convertNamesToIds(target.environment, "environments", spaceId);
        const projectIds = await this.convertNamesToIds(target.project, "projects", spaceId);
        const tenantIds = await this.convertNamesToIds(target.tenant, "tenants", spaceId);
        const channelIds = projectIds ?
          await this.convertProjectChildNamesToIds(target.channel, projectIds.split(",")[0], "channels", spaceId)
          : null;


        // The base URL
        const url = this.url +
          "/api/" +
          (spaceId ? spaceId + "/" : "") +
          target.entity +
          "?fromStartTime=" + new Date(from).toISOString() +
          "&toStartTime=" + new Date(to).toISOString() +
          (projectIds ? "&projects=" + projectIds : "") +
          (environmentIds ? "&environments=" + environmentIds : "") +
          (channelIds ? "&channels=" + channelIds : "") +
          (tenantIds ? "&tenants=" + tenantIds : "") +
          (target.state ? "&taskState=" + target.state : "");

        // Get all the items that fit out timeframe
        const items = (await this.getItems(url, 0, from))
          .filter((i: any) => {
            /*
              The REST API request should only return values in the correct range, but if not records outside of the
              requested range will result in an error in the frontend, so double check here just to be sure.
             */
            return i.ParsedEpoch >= from && i.ParsedEpoch <= to;
          })
          .sort(this.itemComparer)

        const enrichedItems = await mapLimit(items, 5, async (item: any, callback: AsyncResultCallback<MutableDataFrame | null>) => {
          item.TaskDetails = await this.getTaskDetails(item.TaskId, spaceId)
          callback(null, item);
        });

        console.log(JSON.stringify(enrichedItems));

        // The frame holds the timeseries data
        const frame = new MutableDataFrame({
          name: target.name,
          refId: target.refId,
          fields: [
            {name: 'time', type: FieldType.time},
            {name: 'value', type: FieldType.number}
          ],
        });

        /*
          This is the magic that allows us to have a queriable dataset without direct access to the database
          or using a real timeseries database. By optionally processing the items returned by the Octopus
          REST API with jq, we can manipulate the data however we want.
         */
        try {
          const processedJson = target.jq
            ? jq.json(enrichedItems, target.jq)
            : enrichedItems;

          // Put the items into the frame
          this.processBucket(from, to, intervalMs, processedJson, frame);

          // return the results
          callback(null, frame);
        } catch (e) {
          SystemJS.load('app/core/app_events').then((appEvents:any) =>
            appEvents.emit('alert-error', 'An exception was thrown while processing the jq query: ' + e.toString()))
          callback(e);
        }
      }
    })).filter((i: any) => i);

    return {data};
  }

  /**
   * Takes a list of names and returns a list of ids
   * @param input The comma separated list of names
   * @param entity The type of entity we are matching
   * @param space The optional space id
   * @return A comma separated list of ids, ignoring any names that didn't match
   */
  async convertNamesToIds(input: string, entity: string, space?: string | null) {
    return !input
      ? null
      : (await mapLimit(input.split(","), 5, async (element: string, callback: AsyncResultCallback<string | null>) => {
          const url = this.url + "/api/" +
            (space ? space + "/" : "") +
            entity +
            "?partialName=" + encodeURI(element);
          await fetch(url, {headers: {'X-Octopus-ApiKey': this.apiKey}})
            .then(response => response.json())
            .then((data: any) => {
              if (data && data.Items) {
                callback(null, data.Items
                  .filter((i: any) => i.Name == element)
                  .map((i: any) => i.Id)
                  .pop() || null);
              } else {
                callback(null, null);
              }
            })
        }
      ))
        .filter(i => i)
        .join(",");
  }

  /**
   * Takes a list of names for project specific entities and returns a list of ids
   * @param input The comma separated list of names
   * @param projectId The project Id that contains the entity
   * @param entity The type of entity we are matching
   * @param space The optional space id
   * @return A comma separated list of ids, ignoring any names that didn't match
   */
  async convertProjectChildNamesToIds(input: string, projectId: string, entity: string, space?: string | null) {
    return !input
      ? null
      : (await mapLimit(input.split(","), 5, async (element: string, callback: AsyncResultCallback<string | null>) => {
          const url = this.url + "/api/" +
            (space ? space + "/" : "") +
            "projects/" + projectId + "/" +
            entity;
          await fetch(url, {headers: {'X-Octopus-ApiKey': this.apiKey}})
            .then(response => response.json())
            .then((data: any) => {
              if (data && data.Items) {
                callback(null, data.Items
                  .filter((i: any) => i.Name == element)
                  .map((i: any) => i.Id)
                  .pop() || null);
              } else {
                callback(null, null);
              }
            })
        }
      ))
        .filter(i => i)
        .join(",");
  }

  async getTaskDetails(taskId: string, space?: string | null) {
    const url = this.url + "/api/" +
      (space ? space + "/" : "") +
      "tasks/" + taskId;

    return await fetch(url, {headers: {'X-Octopus-ApiKey': this.apiKey}})
      .then(response => response.json());
  }

  processBucket(from: number, to: number, interval: number, items: any[], frame: MutableDataFrame) {
    const results = this.getBucketItems(items, 0, null, from + interval);

    // Populate the time series data.
    // Note that we do populate all values, even when the count is 0:
    // https://github.com/grafana/grafana/issues/14130
    frame.add({
      time: from,
      value: !_.isNil(results.value) ? results.value : results.count
    });

    const nextFrom = from + interval;
    if (nextFrom <= to && items.length > results.count) {
      this.processBucket(nextFrom, to, interval, items.slice(results.count), frame);
    }
  }

  getBucketItems(items: any[], count: number, value: number | null, bucketEnd: number): { count: number, value: number | null } {
    // If there is no date, or if the date is before the end of the bucket, add count the item
    if (count < items.length && (_.isNil(items.slice(count)[0].ParsedEpoch) || items.slice(count)[0].ParsedEpoch < bucketEnd)) {
      return this.getBucketItems(
        items,
        count + 1,
        this.getValue(value, items.slice(count)[0].calculatedValue),
        bucketEnd);
    }

    return {count, value};
  }

  /**
   * When building up the values, we have to sanitise the input to account for the fact that the
   * calculatedValue property may not be set to a number.
   * @param valuea The first value
   * @param valueb The second value
   * @return The sum of the numbers if they are both numbers, null if neither are numbers, or the value of the only
   * valid number passed in.
   */
  getValue(valuea: any, valueb: any): number | null {
    if (!_.isNumber(valuea) && !_.isNumber(valueb)) {
      return null;
    }

    if (_.isNumber(valuea) && _.isNumber(valueb)) {
      return valuea + valueb;
    }

    if (_.isNumber(valuea)) {
      return valuea;
    }

    return valueb;
  }

  async getItems(url: string, skip: number, from: number): Promise<any[]> {
    const items = await fetch(
      url + "&skip=" + skip + "&take=" + TAKE,
      {headers: {'X-Octopus-ApiKey': this.apiKey}})
      .then(response => response.json())
      .then((data: any) => {
        // Start by filtering items outside of the range, and sorting in ascending order based on the created time.
        return data.Items
          .map((i: any) => {
            i.ParsedEpoch = Date.parse(i.Created).valueOf();
            return i;
          })
          .sort(this.itemComparer)
      })
      .catch((error) => {
        console.error('Error:', error);
      });

    // If the first item returned is after the from date, assume there are previous records to get
    if (items.length != 0 && items[0].ParsedEpoch > from) {
      return (await this.getItems(url, skip + TAKE, from)).concat(items);
    }

    // There were no items returned, or the first item was before the from date, so we don't need to go back any further
    return items;
  }

  itemComparer(a: any, b: any) {
    if (_.isNil(a.ParsedEpoch) && _.isNil(b.ParsedEpoch)) {
      return 0;
    }

    if (!_.isNil(a.ParsedEpoch) && !_.isNil(b.ParsedEpoch)) {
      return a.ParsedEpoch <= b.ParsedEpoch ? 0 : 1;
    }

    if (_.isNil(a.ParsedEpoch)) {
      return 1;
    }

    return 0;
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
