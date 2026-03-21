import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const SankeyChart = ({ data = {} }) => {
    const nodes = (data.nodes?.length > 0 ? data.nodes : null) || 
                  (data.results?.length > 0 ? data.results.map(r => ({ name: r.source || r.label || Object.values(r)[0] })) : null) || 
                  (data.data?.length > 0 ? data.data.map(r => ({ name: r.label || 'Step' })) : null) || 
                  [
                      { name: 'Targeting' },
                      { name: 'Impressions' },
                      { name: 'Clicks' },
                      { name: 'Conversions' }
                  ];

    const links = (data.links?.length > 0 ? data.links : null) || 
                  (data.results?.length > 0 && data.results[0].target ? data.results.map(r => ({
                      source: r.source,
                      target: r.target,
                      value: r.value || 100
                  })) : null) ||
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
            emphasis: { focus: 'adjacency' },
            data: nodes,
            links: links,
            itemStyle: { borderWidth: 0, color: '#3B82F6' },
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

    return <ReactECharts option={option} className="micro-sankey" style={{ height: '100%', width: '100%' }} />;
};

export default SankeyChart;
