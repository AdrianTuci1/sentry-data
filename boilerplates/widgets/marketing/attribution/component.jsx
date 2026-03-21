import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const AttributionModels = ({ data = {} }) => {
    const models = (data.models?.length > 0 ? data.models : null) || 
                   (data.data?.length > 0 ? data.data : null) || 
                   (data.results?.length > 0 ? data.results : null) || [
                       { channel: 'Google', first: 40, last: 30, linear: 35 },
                       { channel: 'Meta', first: 30, last: 45, linear: 38 },
                       { channel: 'Direct', first: 20, last: 15, linear: 18 },
                       { channel: 'Other', first: 10, last: 10, linear: 9 }
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
        <div className="attribution-container">
            <div className="model-switcher">
                {['first', 'last', 'linear'].map(m => (
                    <button
                        key={m}
                        onClick={() => setActiveModel(m)}
                        className={`model-btn ${activeModel === m ? 'active' : ''}`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            <div className="chart-wrapper">
                <ReactECharts
                    option={option}
                    style={{ height: '180px', width: '100%', marginTop: '-30px' }}
                    opts={{ renderer: 'svg' }}
                />

                <div className="chart-overlay">
                    <span className="overlay-label">Attribution</span>
                    <span className="overlay-val">{activeModel}</span>
                </div>
            </div>

            <div className="legend-container">
                {models.map((row, i) => (
                    <div key={i} className="legend-item">
                        <div className="legend-dot" style={{ backgroundColor: colors[row.channel] || '#9CA3AF' }} />
                        <span>{row.channel}</span>
                        <span className="legend-val">{row[activeModel]}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AttributionModels;
