import React from 'react';
import ReactECharts from 'echarts-for-react';

const InterestRadar = ({ data }) => {
    const option = {
        radar: {
            indicator: [
                { name: 'Technology', max: 100 },
                { name: 'Fashion', max: 100 },
                { name: 'Finance', max: 100 },
                { name: 'Food', max: 100 },
                { name: 'Travel', max: 100 },
                { name: 'Sports', max: 100 }
            ],
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
            }
        },
        series: [
            {
                name: 'Interest Clusters',
                type: 'radar',
                data: [
                    {
                        value: [85, 30, 70, 45, 60, 20],
                        name: 'High Intent',
                        itemStyle: { color: '#34D399' },
                        areaStyle: { color: 'rgba(52, 211, 153, 0.3)' }
                    },
                    {
                        value: [40, 90, 20, 80, 50, 70],
                        name: 'Casual Browsers',
                        itemStyle: { color: '#818CF8' },
                        areaStyle: { color: 'rgba(129, 140, 248, 0.3)' }
                    }
                ]
            }
        ],
        animationDuration: 2000
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default InterestRadar;
