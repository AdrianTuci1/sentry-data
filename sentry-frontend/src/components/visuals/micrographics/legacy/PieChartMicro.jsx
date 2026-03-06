import React from 'react';
import ReactECharts from 'echarts-for-react';

const PieChartMicro = ({ data }) => {
    const segments = data?.segments || [
        { label: 'A', value: 50, color: '#81E4B5' },
        { label: 'B', value: 30, color: '#AEEA00' },
        { label: 'C', value: 20, color: '#00f2fe' }
    ];

    const option = {
        tooltip: { show: false },
        series: [
            {
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['80%', '50%'],
                avoidLabelOverlap: false,
                label: { show: false },
                data: segments.map(s => ({ value: s.value, name: s.label, itemStyle: { color: s.color } }))
            }
        ]
    };

    return (
        <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 10 }}>
                {segments.map((seg, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#D1D5DB' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: seg.color }}></div>
                        <span>{seg.label}: {seg.value}%</span>
                    </div>
                ))}
            </div>
            <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                <ReactECharts option={option} style={{ height: '100%', width: '150%', position: 'absolute', right: '-20%', top: 0 }} />
            </div>
        </div>
    );
};

export default PieChartMicro;
