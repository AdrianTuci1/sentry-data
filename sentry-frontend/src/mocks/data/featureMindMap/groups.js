import { buildFinding, buildSuggestion, buildValidation } from './builders';
import { contactsGoldViews, contactsSourceId } from './contacts';
import { marketingGoldViews, marketingSourceId } from './marketing';
import { ordersGoldViews, ordersSourceId } from './orders';
import { warehouseGoldViews, warehouseSourceId } from './warehouse';

export const groups = [
    {
        id: 'grp-operational',
        name: 'operational',
        title: 'Operational Intelligence',
        status: 'active',
        color: 'default',
        activationMode: 'automatic',
        sourceIds: [ordersSourceId, contactsSourceId, marketingSourceId, warehouseSourceId],
        adjusted_data_ids: ordersGoldViews.concat(contactsGoldViews, marketingGoldViews, warehouseGoldViews).map((view) => view.id),
        editMode: 'intent',
        logic: {
            intent: 'Combine validated gold views into the default operational lens for the project.'
        },
        suggestions: [
            buildSuggestion(
                'mock-group-operational',
                'pne',
                'intent',
                'Keep operational lane always visible',
                'The first layer should expose useful live analytics as soon as discovery succeeds.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'lineage', status: 'passed', message: 'Operational group only references validated gold views.' },
            { name: 'safety', status: 'passed', message: 'Outputs are analytical and non-destructive.' }
        ])
    },
    {
        id: 'grp-revenue-ops',
        name: 'revenue-ops',
        title: 'Revenue Ops',
        status: 'active',
        color: 'default',
        activationMode: 'automatic',
        sourceIds: [ordersSourceId, marketingSourceId, warehouseSourceId],
        adjusted_data_ids: [
            ordersGoldViews[1].id,
            marketingGoldViews[0].id,
            warehouseGoldViews[0].id
        ],
        editMode: 'intent',
        logic: {
            intent: 'Blend demand generation, revenue quality, and warehouse finance signals into a revenue operations lane.'
        },
        suggestions: [
            buildSuggestion(
                'mock-group-revenue-ops',
                'pne',
                'intent',
                'Keep growth and finance context adjacent',
                'Revenue operators should see campaign, conversion, and MRR context in one lane.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'lineage', status: 'passed', message: 'Revenue Ops group only references validated views.' },
            { name: 'widget_contract', status: 'passed', message: 'Revenue and campaign widgets have enough fields to render.' }
        ])
    },
    {
        id: 'grp-ml-recommended',
        name: 'ml-recommended',
        title: 'ML Recommended',
        status: 'recommended',
        color: 'blue',
        activationMode: 'manual',
        sourceIds: [ordersSourceId, contactsSourceId, warehouseSourceId],
        adjusted_data_ids: [ordersGoldViews[1].id, contactsGoldViews[0].id, warehouseGoldViews[0].id],
        editMode: 'intent',
        logic: {
            intent: 'Recommend candidate ML workloads but keep launch manual.'
        },
        suggestions: [
            buildSuggestion(
                'mock-group-ml',
                'sentinel',
                'intent',
                'Require reviewed objective before launch',
                'Models should only run after the user reviews target, features, and expected metrics.'
            )
        ],
        validation: buildValidation('draft', [
            { name: 'schema', status: 'passed', message: 'Enough metric and entity signals exist for model recommendations.' },
            { name: 'safety', status: 'passed', message: 'Training remains manual.' }
        ])
    },
    {
        id: 'grp-reverse-etl-recommended',
        name: 'reverse-etl-recommended',
        title: 'Reverse ETL Recommended',
        status: 'recommended',
        color: 'blue',
        activationMode: 'manual',
        sourceIds: [ordersSourceId],
        adjusted_data_ids: [ordersGoldViews[1].id],
        editMode: 'intent',
        logic: {
            intent: 'Recommend output streams only after DNS ownership and rate-limit checks pass.'
        },
        sentinelFindings: [
            buildFinding(
                'finding-group-reverse-etl-dns',
                'warning',
                'open',
                'DNS ownership not verified',
                'Reverse ETL launch is blocked until the customer publishes the TXT record for the owned domain.',
                {
                    resolution: 'Sentinel will only allow the recommendation to move forward after DNS proof and VM guardrails pass.'
                }
            )
        ],
        suggestions: [
            buildSuggestion(
                'mock-group-reverse-etl',
                'sentinel',
                'intent',
                'Block activation until ownership is verified',
                'Reverse ETL should wait for DNS TXT verification, VM limits, and delivery safety checks.'
            )
        ],
        validation: buildValidation('draft', [
            { name: 'safety', status: 'passed', message: 'Reverse ETL remains blocked until DNS TXT verification succeeds.' }
        ])
    }
];
