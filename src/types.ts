import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  name: string;
  entity: string;
  environment: string;
  tenant: string;
  channel: string;
  project: string;
  space: string;
}

export const defaultQuery: Partial<MyQuery> = {
  entity: "deployments",
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url?: string;
  apiKey?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
