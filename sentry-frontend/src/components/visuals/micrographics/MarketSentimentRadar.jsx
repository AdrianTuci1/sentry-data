import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

const MarketSentimentRadar = ({ data }) => {
    const option = {
        radar: {
            indicator: [
                { name: 'Trust', max: 100 },
                { name: 'Innovation', max: 100 },
                { name: 'Price', max: 100 },
                { name: 'Service', max: 100 },
                { name: 'Quality', max: 100 }
            ],
            shape: 'circle',
            splitNumber: 4,
            splitArea: {
                show: false
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.1)'
                }
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.2)'
                }
            },
            name: {
                textStyle: {
                    color: '#9CA3AF',
                    fontSize: 10
                }
            }
        },
        series: [
            {
                name: 'Brand Health',
                type: 'radar',
                data: [
                    {
                        value: [90, 75, 60, 85, 80],
                        name: 'Current Metric',
                        symbol: 'none',
                        itemStyle: { color: '#ec4899' },
                        areaStyle: {
                            color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                                { offset: 0, color: 'rgba(236, 72, 153, 0.1)' },
                                { offset: 1, color: 'rgba(236, 72, 153, 0.4)' }
                            ])
                        },
                        lineStyle: {
                            width: 2,
                            type: 'solid'
                        }
                    }
                ]
            }
        ],
        animationDuration: 2500
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default MarketSentimentRadar;
