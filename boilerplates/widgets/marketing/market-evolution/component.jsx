import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const MarketEvolution = ({ data = {}, isMock = false }) => {
    const channels = (Array.isArray(data.channels) && data.channels.length > 0 ? data.channels : null) || 
                     (Array.isArray(data.data?.channels) && data.data?.channels.length > 0 ? data.data.channels : null) || 
                     [
                         { name: 'Paid Search', color: '#3B82F6', value: 85, synergy: 'High' },
                         { name: 'Social Ads', color: '#10B981', value: 72, synergy: 'High' },
                         { name: 'Retargeting', color: '#F59E0B', value: 94, synergy: 'Critical' },
                         { name: 'Email Flow', color: '#EF4444', value: 58, synergy: 'Mid' },
                         { name: 'Organic SEO', color: '#8B5CF6', value: 88, synergy: 'High' },
                         { name: 'Referral', color: '#EC4899', value: 45, synergy: 'Mid' },
                         { name: 'Influencer', color: '#06B6D4', value: 65, synergy: 'High' }
                     ];

    const nodes = channels.map((c) => ({
        name: c.name,
        symbolSize: c.value / 1.5,
        value: c.value,
        itemStyle: {
            color: c.color,
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1
        },
        label: {
            show: true,
            position: 'inside',
            fontSize: 10,
            color: '#fff',
            fontWeight: '600'
        }
    }));

    const links = (Array.isArray(data.links) && data.links.length > 0 ? data.links : null) || 
                  (Array.isArray(data.data?.links) && data.data?.links.length > 0 ? data.data.links : null) || 
                  [
                      { source: 'Paid Search', target: 'Organic SEO', value: 5 },
                      { source: 'Social Ads', target: 'Retargeting', value: 8 },
                      { source: 'Email Flow', target: 'Retargeting', value: 6 },
                      { source: 'Organic SEO', target: 'Direct', value: 4 },
                      { source: 'Influencer', target: 'Social Ads', value: 9 },
                      { source: 'Paid Search', target: 'Retargeting', value: 7 },
                      { source: 'Organic SEO', target: 'Social Ads', value: 5 }
                  ];

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                if (params.dataType === 'node') {
                    return `<b>${params.name}</b><br/>Influence: ${params.value}%`;
                }
                return `Synergy Strength: ${params.value}/10`;
            }
        },
        series: [{
            type: 'graph',
            layout: 'force',
            data: nodes,
            links: links,
            force: {
                repulsion: 350,
                edgeLength: 100,
                gravity: 0.2
            },
            roam: false,
            draggable: false,
            silent: false,
            lineStyle: {
                color: 'rgba(255, 255, 255, 0.05)',
                width: 1.5,
                curveness: 0.1
            },
            emphasis: {
                focus: 'adjacency',
                lineStyle: {
                    width: 3,
                    color: '#3B82F6',
                    opacity: 0.6
                }
            }
        }],
        animationDuration: 2000,
        animationEasing: 'cubicOut'
    };

    return (
        <div className="market-evol-container">
            <div className="market-evol-chart">
                <div className="market-evol-legend">
                    <span className="market-evol-badge">
                        <div className="market-evol-dot" />
                        Channel Convergence Model
                    </span>
                </div>
                <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
            </div>
        </div>
    );
};

export default MarketEvolution;
