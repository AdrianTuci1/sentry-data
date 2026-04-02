import React from 'react';
import ReactECharts from 'echarts-for-react';

const SankeyChart = ({ data }) => {
    const option = {
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: {
            type: 'sankey',
            layout: 'none',
            focusNodeAdjacency: 'allEdges',
            data: data?.nodes || [
                { name: 'Targeting' },
                { name: 'Impressions' },
                { name: 'Clicks' },
                { name: 'Conversions' }
            ],
            links: data?.links || [
                { source: 'Targeting', target: 'Impressions', value: 1000 },
                { source: 'Impressions', target: 'Clicks', value: 300 },
                { source: 'Impressions', target: 'Conversions', value: 20 },
                { source: 'Clicks', target: 'Conversions', value: 80 }
            ],
            itemStyle: {
                borderWidth: 0,
                color: '#3B82F6'
            },
            lineStyle: {
                color: 'source',
                curveness: 0.5,
                opacity: 0.2
            },
            label: {
                color: '#E5E7EB',
                fontSize: 10,
                fontFamily: 'system-ui'
            }
        }
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default SankeyChart;
