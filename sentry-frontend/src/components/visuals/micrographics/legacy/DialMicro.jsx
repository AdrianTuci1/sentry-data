import React from 'react';
import ReactECharts from 'echarts-for-react';

const DialMicro = ({ data }) => {
    const percent = data?.dialPercentage || 85;

    const option = {
        series: [
            {
                type: 'gauge',
                startAngle: 180,
                endAngle: 0,
                min: 0,
                max: 100,
                pointer: { show: false },
                progress: {
                    show: true,
                    overlap: false,
                    roundCap: true,
                    clip: false,
                    itemStyle: { color: '#FBBF24', shadowBlur: 10, shadowColor: 'rgba(251, 191, 36, 0.5)' }
                },
                axisLine: {
                    lineStyle: {
                        width: 8,
                        color: [[1, 'rgba(255,255,255,0.1)']]
                    }
                },
                splitLine: { show: false },
                axisTick: { show: false },
                axisLabel: { show: false },
                data: [{ value: percent }],
                detail: { show: false }
            }
        ]
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ReactECharts option={option} style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }} />
            <div style={{ position: 'relative', marginTop: '20px', zIndex: 10, display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{data?.value}</span>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{data?.unit}</span>
            </div>
        </div>
    );
};

export default DialMicro;
