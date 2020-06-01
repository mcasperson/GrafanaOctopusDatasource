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
    const { range } = options;
    const from = range!.from.valueOf();
    const to = range!.to.valueOf();

    const data = await mapLimit(options.targets, 5, async (target: MyQuery, callback: AsyncResultCallback<MutableDataFrame>) => {
      const query = defaults(target, defaultQuery);

      const frame = new MutableDataFrame({
        refId: query.refId,
        fields: [
          { name: 'time', type: FieldType.time },
          { name: 'value', type: FieldType.number },
        ],
      });

      const url = this.url + "/api/" + target.entity + "?fromStartTime=" + new Date(from).toISOString() + "&toStartTime=" + new Date(to).toISOString();

      console.log("Opening: " + url);

      fetch(
        url,
        {headers: {'X-Octopus-ApiKey': this.apiKey}})
        .then(response => response.json())
        .then( data => {
          data.Items.forEach((i :any) => {
            frame.add({time: Date.parse(i.Created).valueOf(), value: 1});
          });
          callback(null, frame);
        })
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
