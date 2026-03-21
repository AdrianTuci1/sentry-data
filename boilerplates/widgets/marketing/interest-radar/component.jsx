import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const InterestRadar = ({ data = {}, isMock = false }) => {
    const defaultIndicator = [
        { name: 'Technology', max: 100 },
        { name: 'Fashion', max: 100 },
        { name: 'Finance', max: 100 },
        { name: 'Food', max: 100 },
        { name: 'Travel', max: 100 },
        { name: 'Sports', max: 100 }
    ];

    const radarData = (Array.isArray(data.radarData) && data.radarData.length > 0 ? data.radarData : null) || 
                      (Array.isArray(data.data) && data.data.length > 0 && Array.isArray(data.data[0].value) ? data.data : null) || 
                      [
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
                      ];

    const option = {
        radar: {
            indicator: data.indicator || defaultIndicator,
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
                data: radarData
            }
        ],
        animationDuration: 2000
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default InterestRadar;
