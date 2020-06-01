import defaults from 'lodash/defaults';
import {AsyncResultCallback, mapLimit} from "async";

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions, defaultQuery } from './types';
import _ from "lodash";

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
      const query = defaults(target, defaultQuery);

      const frame = new MutableDataFrame({
        refId: query.refId,
        fields: [
          {name: 'time', type: FieldType.time},
          {name: 'value', type: FieldType.number},
        ],
      });

      const url = this.url + "/api/" + target.entity + "?fromStartTime=" + new Date(from).toISOString() + "&toStartTime=" + new Date(to).toISOString();

      await fetch(
        url,
        {headers: {'X-Octopus-ApiKey': this.apiKey}})
        .then(response => response.json())
        .then(data => {
          // Start by filtering items outside of the range, and sorting in ascending order based on the created time.
          const filteredItems = data.Items
            .map((i: any) => {
              i.ParsedEpoch = Date.parse(i.Created).valueOf();
              return i;
            })
            .filter((i: any) => {
              /*
                The REST API request should only return values in the correct range, but if not records outside of the
                requested range will result in an error in the frontend, so double check here just to be sure.
               */

              return i.ParsedEpoch >= from && i.ParsedEpoch <= to;
            })
            .sort((i:any) => i.ParsedEpoch)

          // Find out how many items fit in each interval
          let lastIndex = 0;
          for (let x = from; x <= to; x += intervalMs) {
            let count = 0;
            // Starting from the last item we "consumed", count how many items fall into the next bucket
            while (lastIndex < filteredItems.length && filteredItems.slice(lastIndex)[0].ParsedEpoch < x + intervalMs)
            {
              // Each item that falls into the bucket is "consumed" by incrementing the index that we start looking at
              ++lastIndex;
              // This item falls into this bucket, so increase the count
              ++count;
            }
            // Populate the time series data
            frame.add({
              time: x,
              value: count
            });
          }
        })
        .catch((error) => {
          console.error('Error:', error);
        });
      callback(null, frame);
    });

    return { data };
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
