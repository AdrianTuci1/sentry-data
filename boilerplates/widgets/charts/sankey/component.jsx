import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const SankeyChart = ({ data = {}, isMock = false }) => {
    const nodes = (Array.isArray(data.nodes) && data.nodes.length > 0 ? data.nodes : null) || 
                  (Array.isArray(data.data?.nodes) && data.data?.nodes.length > 0 ? data.data.nodes : null) || 
                  [
                      { name: 'Targeting' },
                      { name: 'Impressions' },
                      { name: 'Clicks' },
                      { name: 'Conversions' }
                  ];

    const links = (Array.isArray(data.links) && data.links.length > 0 ? data.links : null) || 
                  (Array.isArray(data.data?.links) && data.data?.links.length > 0 ? data.data.links : null) || 
                  [
                      { source: 'Targeting', target: 'Impressions', value: 1000 },
                      { source: 'Impressions', target: 'Clicks', value: 300 },
                      { source: 'Impressions', target: 'Conversions', value: 20 },
                      { source: 'Clicks', target: 'Conversions', value: 80 }
                  ];

    const option = {
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: {
            type: 'sankey',
            layout: 'none',
            emphasis: {
                focus: 'adjacency'
            },
            data: nodes,
            links: links,
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
