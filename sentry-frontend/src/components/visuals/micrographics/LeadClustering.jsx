import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import ecStat from 'echarts-stat';

// Register the clustering transform
echarts.registerTransform(ecStat.transform.clustering);

const LeadClustering = ({ data: componentData }) => {
    // Domain data: [Engagement Score (0-100), Conversion Probability (0.1-1.0), Name]
    const data = [
        [85, 0.92, 'TechFlow Corp'], [78, 0.85, 'Maria S.'], [95, 0.98, 'Visionary Ltd'],
        [45, 0.32, 'Nexus Digital'], [22, 0.15, 'Andrei I.'], [65, 0.68, 'Optima Systems'],
        [12, 0.05, 'Skybridge Inc'], [30, 0.22, 'Global Solutions'], [55, 0.45, 'SoftLink'],
        [88, 0.90, 'DataPulse'], [15, 0.08, 'E. Popa'], [60, 0.55, 'Creative Hub'],
        [35, 0.28, 'FastTrack'], [72, 0.75, 'LevelUp'], [92, 0.96, 'C. Radu'],
        [25, 0.18, 'M. Georgescu'], [58, 0.52, 'Quantum Soft'], [42, 0.38, 'EcoSystem'],
        [82, 0.88, 'V. Marin'], [18, 0.11, 'SoftLink'], [68, 0.72, 'Nexus Digital'],
        [48, 0.42, 'Global Solutions'], [32, 0.25, 'Optima Systems'], [75, 0.82, 'TechFlow Corp'],
        [98, 0.99, 'Visionary Ltd'], [10, 0.04, 'Skybridge Inc']
    ];

    const CLUSTER_COUNT = 4;
    const DIENSIION_CLUSTER_INDEX = 3;
    const COLOR_ALL = ['#10B981', '#3B82F6', '#F59E0B', '#6B7280'];

    const pieces = [
        { value: 0, label: 'VIP', color: COLOR_ALL[0] },
        { value: 1, label: 'Promising', color: COLOR_ALL[1] },
        { value: 2, label: 'Window', color: COLOR_ALL[2] },
        { value: 3, label: 'Cold', color: COLOR_ALL[3] }
    ];

    const option = {
        dataset: [
            { source: data },
            {
                transform: {
                    type: 'ecStat:clustering',
                    config: {
                        clusterCount: CLUSTER_COUNT,
                        dimensions: [0, 1],
                        outputType: 'single',
                        outputClusterIndexDimension: DIENSIION_CLUSTER_INDEX
                    }
                }
            }
        ],
        tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                const [eng, prob, name] = params.data;
                return `
                    <div style="padding: 4px;">
                        <div style="font-weight: bold; color: #9CA3AF; margin-bottom: 4px;">${name}</div>
                        <div style="font-size: 11px;">Engage: <span style="color: #10B981;">${eng}%</span></div>
                        <div style="font-size: 11px;">Prob: <span style="color: #3B82F6;">${(prob * 100).toFixed(1)}%</span></div>
                    </div>
                `;
            }
        },
        visualMap: {
            show: false,
            dimension: DIENSIION_CLUSTER_INDEX,
            pieces: pieces
        },
        grid: { left: 40, right: 20, top: 20, bottom: 40 },
        xAxis: {
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
            axisLabel: { color: '#4B5563', fontSize: 8 }
        },
        yAxis: {
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
            axisLabel: { color: '#4B5563', fontSize: 8 }
        },
        series: {
            type: 'scatter',
            encode: { tooltip: [0, 1, 2] },
            symbolSize: 8,
            itemStyle: { borderColor: 'rgba(0, 0, 0, 0.2)', borderWidth: 1 },
            datasetIndex: 1
        },
        animationDuration: 1500
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: '10px' }}>
            {/* Shrunken Chart */}
            <div style={{ flex: '0 0 60%', width: '100%' }}>
                <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
            </div>

            {/* Latest Leads List below */}
            <div style={{
                flex: '1',
                width: '100%',
                overflowY: 'auto',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255,255,255,0.05)'
            }}>
                <h4 style={{
                    color: '#9CA3AF',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                    letterSpacing: '0.05em'
                }}>Latest Leads</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                    {data.slice(0, 12).map((lead, i) => {
                        const prob = lead[1];
                        let statusColor = '#6B7280';
                        let statusLabel = 'Cold';
                        if (prob > 0.9) { statusColor = '#10B981'; statusLabel = 'VIP'; }
                        else if (prob > 0.7) { statusColor = '#3B82F6'; statusLabel = 'Warm'; }
                        else if (prob > 0.4) { statusColor = '#F59E0B'; statusLabel = 'Mid'; }

                        return (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255,255,255,0.02)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                borderLeft: `2px solid ${statusColor}`
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: '#E5E7EB', fontSize: '10px', fontWeight: '500' }}>{lead[2]}</span>
                                    <span style={{ color: '#6B7280', fontSize: '8px' }}>{lead[0]}% Eng.</span>
                                </div>
                                <span style={{
                                    fontSize: '8px',
                                    color: statusColor,
                                    background: `${statusColor}15`,
                                    padding: '1px 3px',
                                    borderRadius: '2px',
                                    fontWeight: '600'
                                }}>{statusLabel}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>
                {`
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }
                `}
            </style>
        </div>
    );
};

export default LeadClustering;
