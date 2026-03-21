import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const ScatterPlot = ({ data = {} }) => {
    const scatterData = (data.scatterData?.length > 0 ? data.scatterData : null) || 
                        (data.data?.length > 0 ? data.data : null) || 
                        (data.results?.length > 0 && Array.isArray(data.results[0]) ? data.results : null) || 
                        [
                            [40, 426], [45, 450], [50, 568], [55, 520], [60, 724], [65, 680], [70, 482], [75, 550],
                            [80, 695], [85, 720], [90, 881], [95, 840], [100, 804], [105, 860], [110, 833], [115, 900],
                            [120, 1084], [125, 1020], [130, 758], [135, 820], [140, 996], [145, 1050], [150, 1100],
                            [155, 1150], [160, 1200], [165, 1180], [170, 1250], [175, 1300], [180, 1280], [185, 1350]
                        ];

    // Simple linear interpolation points for a visual trend line
    const xVals = scatterData.map(d => d[0]);
    const yVals = scatterData.map(d => d[1]);
    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals);
    const maxY = Math.max(...yVals);

    const option = {
        legend: {
            data: ['Clients', 'Trend'],
            bottom: 0,
            textStyle: { color: '#9CA3AF', fontSize: 10 }
        },
        tooltip: {
            trigger: 'item',
            axisPointer: { type: 'cross', label: { backgroundColor: '#374151' } }
        },
        grid: { left: '15%', right: '5%', top: '15%', bottom: '25%' },
        xAxis: {
            name: 'CAC ($)',
            nameLocation: 'middle',
            nameGap: 25,
            nameTextStyle: { color: '#6B7280', fontSize: 10 },
            type: 'value',
            splitLine: { show: false },
            axisLine: { lineStyle: { color: '#4B5563' } },
            axisLabel: { color: '#9CA3AF', fontSize: 10 }
        },
        yAxis: {
            name: 'LTV ($)',
            nameLocation: 'middle',
            nameGap: 35,
            nameTextStyle: { color: '#6B7280', fontSize: 10 },
            type: 'value',
            splitLine: { lineStyle: { color: '#1F2937', type: 'dashed' } },
            axisLabel: { color: '#9CA3AF', fontSize: 10 }
        },
        series: [
            {
                name: 'Clients',
                type: 'scatter',
                symbolSize: 8,
                data: scatterData,
                itemStyle: {
                    color: '#A78BFA',
                    opacity: 0.8,
                    shadowBlur: 10,
                    shadowColor: 'rgba(167, 139, 250, 0.5)'
                }
            },
            {
                name: 'Trend',
                type: 'line',
                data: [
                    [minX, minY * 1.05],
                    [maxX * 0.95, maxY * 0.95]
                ],
                symbol: 'none',
                lineStyle: {
                    color: '#10B981',
                    type: 'solid',
                    width: 3,
                    shadowBlur: 10,
                    shadowColor: 'rgba(16, 185, 129, 0.4)'
                }
            }
        ]
    };

    return (
        <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
        />
    );
};

export default ScatterPlot;
