import defaults from 'lodash/defaults';

import React, {ChangeEvent, PureComponent} from 'react';
import {LegacyForms} from '@grafana/ui';
import {QueryEditorProps, SelectableValue} from '@grafana/data';
import {DataSource} from './DataSource';
import {defaultQuery, MyDataSourceOptions, MyQuery} from './types';

const {FormField, Select} = LegacyForms;

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

const StateOptions = [
  {value: "", label: "All"},
  {value: "Queued", label: "Queued"},
  {value: "Executing", label: "Executing"},
  {value: "Failed", label: "Failed"},
  {value: "Canceled", label: "Canceled"},
  {value: "TimedOut", label: "TimedOut"},
  {value: "Success", label: "Success"},
  {value: "Cancelling", label: "Cancelling"},
];

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

  onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {onChange, query, onRunQuery} = this.props;
    onChange({...query, name: event.target.value});
    // executes the query
    onRunQuery();
  };

  onStateChange = (event: SelectableValue<string>) => {
    const {onChange, query, onRunQuery} = this.props;
    onChange({...query, state: event.value || ""});
    // executes the query
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const {name, entity, project, environment, space, tenant, channel, state} = query;

    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <FormField
            labelWidth={8}
            value={name}
            onChange={this.onNameChange}
            label="Series Name"
          />
        </div>
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
        <div className="gf-form">
          <div className="gf-form-label width-8">Deployment State</div>
          <Select
            defaultValue={StateOptions.filter(s => s.value == "").pop()}
            value={StateOptions.filter(s => s.value == state).pop()}
            options={StateOptions}
            onChange={this.onStateChange}
            isMulti={false}
          />
        </div>
      </div>
    );
  }
}
