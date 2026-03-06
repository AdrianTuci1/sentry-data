import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

const BarChartMicro = ({ data }) => {
    const bars = data?.bars || [40, 60, 45, 80, 75, 90, 110];
    const value = data?.value || '$124K';

    const option = {
        grid: { left: 0, right: 0, top: '45%', bottom: '5%' },
        xAxis: { type: 'category', show: false, data: bars.map(() => '') },
        yAxis: { type: 'value', show: false },
        tooltip: {
            show: true,
            trigger: 'axis',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff', fontSize: 10 },
            formatter: (params) => `${params[0].value}`
        },
        series: [{
            type: 'bar',
            data: bars,
            barWidth: '40%',
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#3B82F6' },
                    { offset: 1, color: '#1D4ED8' }
                ]),
                borderRadius: [4, 4, 0, 0]
            },
            emphasis: {
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#60A5FA' },
                        { offset: 1, color: '#3B82F6' }
                    ])
                }
            }
        }]
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div style={{
                position: 'absolute', top: '-15px', right: 0,
                fontSize: '22px', fontWeight: '800',
                color: '#fff', zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                fontFamily: 'Inter, sans-serif'
            }}>
                {value}
            </div>
            <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
        </div>
    );
};

export default BarChartMicro;
