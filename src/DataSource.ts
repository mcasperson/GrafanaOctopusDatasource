import {AsyncResultCallback, mapLimit} from "async";

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions } from './types';

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

    const data = await mapLimit(options.targets, 5, async (target: MyQuery, callback: AsyncResultCallback<MutableDataFrame>) => {

      const environmentIds = await this.convertNamesToIds(target.environment, "environments");
      const projectIds = await this.convertNamesToIds(target.project, "projects");
      const channelIds = await this.convertNamesToIds(target.channel, "channels");
      const tenantIds = await this.convertNamesToIds(target.tenant, "tenants");

      // The base URL
      const url = this.url + "/api/" + target.entity +
        "?fromStartTime=" + new Date(from).toISOString() +
        "&toStartTime=" + new Date(to).toISOString() +
        (projectIds ? "&projectIds=" + projectIds : "") +
        (environmentIds ? "&environments=" + environmentIds : "") +
        (channelIds ? "&channels=" + channelIds : "") +
        (tenantIds ? "&tenants=" + tenantIds : "");

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

      // The frame holds the timeseries data
      const frame = new MutableDataFrame({
        refId: target.refId,
        fields: [
          {name: 'time', type: FieldType.time},
          {name: 'count', type: FieldType.number},
        ],
      });

      // Put the items into the frame
      this.processBucket(from, to, intervalMs, items, frame);

      // return the results
      callback(null, frame);
    });

    return {data};
  }

  /**
   * Takes a list of names and returns a list of ids
   * @param input The comma separated list of names
   * @param entity The type of entity we are matching
   * @return A comma separated list of ids, ignoring any names that didn't match
   */
  async convertNamesToIds(input: string, entity: string) {
    return !input
      ? null
      : (await mapLimit(input.split(","), 5, async (element: string, callback: AsyncResultCallback<string | null>) => {
          const environmentName = this.url + "/api/" + entity + "?partialName=" + encodeURI(element);
          return (await fetch(environmentName, {headers: {'X-Octopus-ApiKey': this.apiKey}})
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
          )}
        ))
        .filter(i => i)
        .join(",");
  }

  processBucket(from: number, to: number, interval: number, items: any[], frame: MutableDataFrame) {
    const count = this.getBucketItems(items, 0, from + interval);

    // Populate the time series data
    if (count != 0) {
      frame.add({
        time: from,
        count: count
      });
    }

    const nextFrom = from + interval;
    if (nextFrom <= to) {
      this.processBucket(nextFrom, to, interval, items.slice(count), frame);
    }
  }

  getBucketItems(items: any[], count: number, bucketEnd: number): number {
    if (count < items.length && items.slice(count)[0].ParsedEpoch < bucketEnd) {
      return this.getBucketItems(items, count + 1, bucketEnd);
    }

    return count;
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
    return a.ParsedEpoch <= b.ParsedEpoch ? 0 : 1;
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
