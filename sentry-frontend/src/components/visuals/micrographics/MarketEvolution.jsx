import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

const MarketEvolution = ({ data: componentData }) => {
    const channels = componentData?.channels || [
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
            // Removed glowing shadows
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

    const links = componentData?.links || [
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
            roam: false, // Disabled zoom/pan
            draggable: false, // Disabled node drag
            silent: false, // Enable tooltips only
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: '10px' }}>
            {/* Main Synergy Force Graph */}
            <div style={{ flex: '0 0 70%', width: '100%', position: 'relative' }}>
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <span style={{
                        fontSize: '9px',
                        color: '#9CA3AF',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#3B82F6' }} />
                        Channel Convergence Model
                    </span>
                </div>
                <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
            </div>


            <style>
                {`
                ::-webkit-scrollbar { width: 3px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); borderRadius: 10px; }
                `}
            </style>
        </div>
    );
};

export default MarketEvolution;
