import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const AttributionModels = ({ data = {}, isMock = false }) => {
    const models = (Array.isArray(data.models) && data.models.length > 0 ? data.models : null) || 
                   (Array.isArray(data.data) && data.data.length > 0 ? data.data : null) || 
                   [
                       { channel: 'Google', first: 35, last: 45, linear: 40 },
                       { channel: 'Meta', first: 40, last: 28, linear: 35 },
                       { channel: 'Direct', first: 15, last: 20, linear: 18 },
                       { channel: 'Other', first: 10, last: 7, linear: 7 }
                   ];

    const [activeModel, setActiveModel] = useState('linear');

    const colors = {
        'Google': '#3B82F6',
        'Meta': '#10B981',
        'Direct': '#8B5CF6',
        'Other': '#F59E0B'
    };

    const chartData = [
        ...models.map(row => ({
            name: row.channel,
            value: row[activeModel],
            itemStyle: { color: colors[row.channel] || '#9CA3AF' }
        })),
        {
            value: 100,
            itemStyle: { color: 'transparent' },
            label: { show: false }
        }
    ];

    const option = {
        animation: true,
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}%',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' }
        },
        series: [
            {
                name: 'Attribution',
                type: 'pie',
                radius: ['70%', '100%'],
                center: ['50%', '85%'],
                startAngle: 180,
                avoidLabelOverlap: false,
                label: { show: false },
                emphasis: {
                    scale: true,
                    scaleSize: 5
                },
                data: chartData
            }
        ]
    };

    return (
        <div style={{ height: '100%', width: '100%', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', justifyContent: 'center' }}>
                {['first', 'last', 'linear'].map(m => (
                    <button
                        key={m}
                        onClick={() => setActiveModel(m)}
                        style={{
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontWeight: '500',
                            borderRadius: '12px',
                            border: activeModel === m ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                            backgroundColor: activeModel === m ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: activeModel === m ? '#fff' : '#9CA3AF',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {m}
                    </button>
                ))}
            </div>

            <div style={{ flex: 1, position: 'relative', minHeight: '120px' }}>
                <ReactECharts
                    option={option}
                    style={{ height: '180px', width: '100%', marginTop: '-30px' }}
                    opts={{ renderer: 'svg' }}
                />

                <div style={{
                    position: 'absolute',
                    top: '65%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center'
                }}>
                    <span style={{ fontSize: '10px', color: '#6B7280', display: 'block' }}>Attribution</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#fff', textTransform: 'capitalize' }}>{activeModel}</span>
                </div>
            </div>

            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '12px',
                paddingBottom: '4px',
                marginTop: '-10px'
            }}>
                {models.map((row, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#9CA3AF' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors[row.channel] || '#9CA3AF' }} />
                        <span>{row.channel}</span>
                        <span style={{ color: '#fff', fontWeight: '500' }}>{row[activeModel]}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AttributionModels;
