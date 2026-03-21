import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const SemiCircleDonut = ({ data = {}, isMock = false }) => {
    const platforms = (Array.isArray(data.platforms) && data.platforms.length > 0 ? data.platforms : null) || 
                      (Array.isArray(data.data?.platforms) && data.data?.platforms.length > 0 ? data.data.platforms : null) || 
                      [
                          { name: 'Google', value: 45, color: '#4285F4' },
                          { name: 'Meta', value: 30, color: '#0668E1' },
                          { name: 'LinkedIn', value: 15, color: '#0A66C2' },
                          { name: 'TikTok', value: 10, color: '#EE1D52' }
                      ];

    const chartData = [
        ...platforms.map(p => ({ value: p.value, name: p.name, itemStyle: { color: p.color } })),
        { value: platforms.reduce((acc, curr) => acc + curr.value, 0), itemStyle: { color: 'transparent' }, label: { show: false }, tooltip: { show: false } }
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
        <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ReactECharts option={option} style={{ height: '140px', width: '100%' }} />
            </div>
            <div style={{
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
                gap: '8px', padding: '4px', marginTop: '-5px'
            }}>
                {platforms.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#E5E7EB' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: p.color }} />
                        <span>{p.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SemiCircleDonut;
