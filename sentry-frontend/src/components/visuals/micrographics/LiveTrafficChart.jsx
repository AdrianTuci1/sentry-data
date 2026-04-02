import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

const LiveTrafficChart = ({ data }) => {
    const points = data?.dataPoints || [60, 50, 70, 65, 80, 75, 90, 85, 100, 95, 110, 100, 120];

    const option = {
        grid: { left: -10, right: -10, top: '35%', bottom: -10 },
        xAxis: {
            type: 'category',
            show: false,
            data: points.map((_, i) => i)
        },
        tooltip: {
            show: true,
            trigger: 'axis',
            backgroundColor: 'rgba(17, 24, 39, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' },
            formatter: (params) => `${params[0].value} usr`
        },
        yAxis: {
            type: 'value',
            show: false,
            min: 'dataMin'
        },
        series: [{
            type: 'line',
            data: points,
            smooth: true,
            symbol: 'none',
            lineStyle: {
                width: 3,
                color: '#fff'
            },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(255, 255, 255, 0.4)' },
                    { offset: 1, color: 'rgba(255, 255, 255, 0)' }
                ])
            }
        }]
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div style={{ position: 'absolute', top: '-10px', left: 0, zIndex: 10, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{data?.value}</span>
                <span style={{ fontSize: '12px', color: '#E5E7EB' }}>{data?.unit}</span>
            </div>
            <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
        </div>
    );
};

export default LiveTrafficChart;
