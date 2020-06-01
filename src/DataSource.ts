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
      const url = this.url + "/api/" + target.entity + "?fromStartTime=" + new Date(from).toISOString() + "&toStartTime=" + new Date(to).toISOString();
      const items = (await this.getItems(url, 0, from))
        .filter((i: any) => {
          /*
            The REST API request should only return values in the correct range, but if not records outside of the
            requested range will result in an error in the frontend, so double check here just to be sure.
           */
          return i.ParsedEpoch >= from && i.ParsedEpoch <= to;
        })
        .sort(this.itemComparer)

      const frame = new MutableDataFrame({
        refId: target.refId,
        fields: [
          {name: 'time', type: FieldType.time},
          {name: 'value', type: FieldType.number},
        ],
      });

      // Find out how many items fit in each interval
      let lastIndex = 0;
      for (let x = from; x <= to; x += intervalMs) {
        let count = 0;
        // Starting from the last item we "consumed", count how many items fall into the next bucket
        while (lastIndex < items.length && items.slice(lastIndex)[0].ParsedEpoch < x + intervalMs) {
          // Each item that falls into the bucket is "consumed" by incrementing the index that we start looking at
          ++lastIndex;
          // This item falls into this bucket, so increase the count
          ++count;
        }

        // Populate the time series data
        if (count != 0) {
          frame.add({
            time: x,
            value: count
          });
        }
      }

      callback(null, frame);
    });

    return {data};
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
    return a.ParsedEpoch < b.ParsedEpoch ? 0 : 1;
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
