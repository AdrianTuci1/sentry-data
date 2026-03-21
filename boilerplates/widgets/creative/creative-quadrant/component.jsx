import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import './style.css';

const CreativeQuadrant = ({ data = {}, isMock = false }) => {
    // Top-tier marketing creatives: [CTR (%), Conv. Rate (%), Name, Type]
    const creatives = (Array.isArray(data.creatives) && data.creatives.length > 0 ? data.creatives : null) ||
                      (Array.isArray(data.data) && data.data.length > 0 ? data.data : null) || [
                          [4.2, 5.8, 'Video: Summer Lifestyle', 'Video'],
                          [3.8, 6.2, 'Static: Product Hero', 'Static'],
                          [1.2, 8.5, 'Testimonial: Andrei P.', 'Review'],
                          [5.5, 1.2, 'Clickbait: Huge Sale', 'Static'],
                          [2.1, 4.2, 'Video: Feature Walkthrough', 'Video'],
                          [0.8, 1.5, 'Static: Legacy Banner', 'Static'],
                          [4.8, 4.5, 'Video: User Story', 'Video'],
                          [3.2, 2.8, 'Static: Discount Code', 'Static'],
                          [1.5, 7.2, 'Review: Maria I.', 'Review'],
                          [6.2, 6.8, 'Hiring: Creative Lead', 'Static'],
                          [7.5, 0.5, 'Meme: Monday Coffee', 'Social']
                      ];

    const pieces = [
        { label: 'Heroes', color: '#10B981', note: 'Scale Now' },
        { label: 'Seekers', color: '#3B82F6', note: 'Optimize Landing' },
        { label: 'Intent', color: '#F59E0B', note: 'Optimize Visual' },
        { label: 'Burners', color: '#EF4444', note: 'Stop Budget' }
    ];

    const option = {
        grid: {
            top: 40,
            right: 40,
            bottom: 50,
            left: 50,
            containLabel: true
        },
        tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                if (params.seriesType === 'scatter') {
                    const [ctr, conv, name] = params.data;
                    return `
                        <div style="padding: 2px;">
                            <div style="font-weight: bold; margin-bottom: 2px;">${name}</div>
                            <div style="font-size: 11px;">CTR: ${ctr}% | Conv: ${conv}%</div>
                        </div>
                    `;
                }
            }
        },
        xAxis: {
            type: 'value',
            min: 0,
            max: 10,
            name: 'CTR %',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: '#6B7280', fontSize: 10 },
            splitLine: { show: false },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
            axisLabel: { color: '#4B5563', fontSize: 9 }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 10,
            name: 'Conv %',
            nameLocation: 'middle',
            nameGap: 35,
            nameTextStyle: { color: '#6B7280', fontSize: 10 },
            splitLine: { show: false },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
            axisLabel: { color: '#4B5563', fontSize: 9 }
        },
        series: [
            {
                type: 'scatter',
                data: creatives,
                symbolSize: 14,
                itemStyle: {
                    color: (params) => {
                        const [ctr, conv] = params.data;
                        if (ctr >= 5 && conv >= 5) return '#10B981';
                        if (ctr >= 5 && conv < 5) return '#3B82F6';
                        if (ctr < 5 && conv >= 5) return '#F59E0B';
                        return '#EF4444';
                    },
                    borderColor: 'rgba(0,0,0,0.4)',
                    borderWidth: 1.5
                },
                markArea: {
                    silent: true,
                    data: [
                        [
                            { name: 'HEROES', coord: [5, 5], itemStyle: { color: 'rgba(16, 185, 129, 0.05)' } },
                            { coord: [10, 10] }
                        ],
                        [
                            { name: 'SEEKERS', coord: [5, 0], itemStyle: { color: 'rgba(59, 130, 246, 0.05)' } },
                            { coord: [10, 5] }
                        ],
                        [
                            { name: 'INTENT', coord: [0, 5], itemStyle: { color: 'rgba(245, 158, 11, 0.05)' } },
                            { coord: [5, 10] }
                        ],
                        [
                            { name: 'BURNERS', coord: [0, 0], itemStyle: { color: 'rgba(239, 68, 68, 0.05)' } },
                            { coord: [5, 5] }
                        ]
                    ],
                    label: {
                        show: true,
                        position: 'inside',
                        color: 'rgba(255,255,255,0.05)',
                        fontSize: 22,
                        fontWeight: '900'
                    }
                }
            }
        ]
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: '380px' }}>
            {/* Main Quadrant Plot */}
            <div style={{ flex: 1, width: '100%', position: 'relative' }}>
                <ReactECharts
                    option={option}
                    style={{ height: '100%', width: '100%' }}
                    notMerge={true}
                />
            </div>

            {/* Simple Minimalist Legend */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                padding: '10px 0',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                marginTop: '5px'
            }}>
                {pieces.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: '#E5E7EB', fontSize: '9px', fontWeight: 'bold', lineHeight: 1 }}>{p.label}</span>
                            <span style={{ color: '#4B5563', fontSize: '7px' }}>{p.note}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CreativeQuadrant;
