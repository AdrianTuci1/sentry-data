import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

const BudgetSensitivity = ({ data = {} }) => {
    const curvePoints = (Array.isArray(data.results) && data.results.length > 0 ? data.results : null) || 
                        (Array.isArray(data.data) && data.data.length > 0 ? data.data : null) || 
                        (Array.isArray(data.curvePoints) && data.curvePoints.length > 0 ? data.curvePoints : null) || (() => {
                            const points = [];
                            for (let x = 0; x <= 100; x += 2) {
                                const y = 100 / (1 + Math.exp(-0.1 * (x - 50)));
                                points.push([x, y]);
                            }
                            return points;
                        })();

    const option = {
        grid: {
            top: '15%',
            bottom: '15%',
            left: '10%',
            right: '10%',
            containLabel: true
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                const [x, y] = params[0].data;
                return `Budget: $${x}k<br/>Est. Revenue: $${y.toFixed(1)}k`;
            }
        },
        xAxis: {
            name: 'Budget ($k)',
            nameLocation: 'middle',
            nameGap: 25,
            nameTextStyle: { color: '#6B7280', fontSize: 10 },
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
            axisLabel: { color: '#4B5563', fontSize: 9 }
        },
        yAxis: {
            name: 'Returns',
            nameTextStyle: { color: '#6B7280', fontSize: 10 },
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
            axisLabel: { color: '#4B5563', fontSize: 9 }
        },
        series: [
            {
                type: 'line',
                smooth: true,
                symbol: 'none',
                data: curvePoints,
                lineStyle: {
                    width: 3,
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#3B82F6' },
                        { offset: 0.5, color: '#10B981' },
                        { offset: 1, color: '#F59E0B' }
                    ])
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0)' }
                    ])
                },
                markPoint: {
                    data: [
                        {
                            coord: [65, 81.7],
                            name: 'Optimal Point',
                            symbol: 'pin',
                            symbolSize: 30,
                            itemStyle: { color: '#EF4444' },
                            label: { show: false }
                        }
                    ],
                    emphasis: {
                        label: { show: true, formatter: 'Sweet Spot', color: '#fff', fontSize: 10 }
                    }
                }
            }
        ],
        animationDuration: 2000
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default BudgetSensitivity;
