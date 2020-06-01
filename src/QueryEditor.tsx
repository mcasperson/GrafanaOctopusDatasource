import defaults from 'lodash/defaults';

import React, {ChangeEvent, PureComponent} from 'react';
import {LegacyForms} from '@grafana/ui';
import {QueryEditorProps} from '@grafana/data';
import {DataSource} from './DataSource';
import {defaultQuery, MyDataSourceOptions, MyQuery} from './types';

const {FormField} = LegacyForms;

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  onEntityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {onChange, query, onRunQuery} = this.props;
    onChange({...query, entity: event.target.value});
    // executes the query
    onRunQuery();
  };

  onProjectChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {onChange, query, onRunQuery} = this.props;
    onChange({...query, project: event.target.value});
    // executes the query
    onRunQuery();
  };

  onEnvironmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {onChange, query, onRunQuery} = this.props;
    onChange({...query, environment: event.target.value});
    // executes the query
    onRunQuery();
  };

  onTenantChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {onChange, query, onRunQuery} = this.props;
    onChange({...query, tenant: event.target.value});
    // executes the query
    onRunQuery();
  };

  onChannelChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {onChange, query, onRunQuery} = this.props;
    onChange({...query, channel: event.target.value});
    // executes the query
    onRunQuery();
  };

  onSpaceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {onChange, query, onRunQuery} = this.props;
    onChange({...query, space: event.target.value});
    // executes the query
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const {entity, project, environment, space, tenant, channel} = query;

    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <FormField
            labelWidth={8}
            value={entity}
            onChange={this.onEntityChange}
            label="Entity"
          />
        </div>
        <div className="gf-form">
          <FormField
            labelWidth={8}
            value={project}
            onChange={this.onProjectChange}
            label="Project"
          />
        </div>
        <div className="gf-form">
          <FormField
            labelWidth={8}
            value={environment}
            onChange={this.onEnvironmentChange}
            label="Environment"
          />
        </div>
        <div className="gf-form">
          <FormField
            labelWidth={8}
            value={tenant}
            onChange={this.onTenantChange}
            label="Tenant"
          />
        </div>
        <div className="gf-form">
          <FormField
            labelWidth={8}
            value={channel}
            onChange={this.onChannelChange}
            label="Channel"
          />
        </div>
        <div className="gf-form">
          <FormField
            labelWidth={8}
            value={space}
            onChange={this.onSpaceChange}
            label="Space"
          />
        </div>
      </div>
    );
  }
}
