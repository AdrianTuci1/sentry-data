import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const SemiCircleDonut = ({ data = {} }) => {
    const platforms = (data.platforms?.length > 0 ? data.platforms : null) || 
                      (data.data?.length > 0 ? data.data : null) || 
                      (data.results?.length > 0 ? data.results : null) || [
        { name: 'Google', value: 45, color: '#4285F4' },
        { name: 'Meta', value: 30, color: '#0668E1' },
        { name: 'LinkedIn', value: 15, color: '#0A66C2' },
        { name: 'TikTok', value: 10, color: '#EE1D52' }
    ];

    const chartData = [
        ...platforms.map(p => ({ value: p.value, name: p.name, itemStyle: { color: p.color } })),
        { value: 100, itemStyle: { color: 'transparent' }, label: { show: false } }
    ];

    const option = {
        animation: true,
        animationDuration: 1500,
        animationEasing: 'cubicOut',
        tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
        series: [
            {
                type: 'pie',
                radius: ['70%', '100%'],
                center: ['50%', '85%'],
                startAngle: 180,
                avoidLabelOverlap: false,
                label: { show: false },
                emphasis: { label: { show: false } },
                data: chartData
            }
        ]
    };

    return (
        <div className="micro-pie-chart">
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ReactECharts option={option} style={{ height: '140px', width: '100%' }} />
            </div>
            <div className="pie-legend" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                {platforms.map((p, i) => (
                    <div key={i} className="pie-legend">
                        <div className="pie-legend-color" style={{ backgroundColor: p.color }} />
                        <span style={{ fontSize: '11px', color: '#E5E7EB' }}>{p.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SemiCircleDonut;
