import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import './style.css';

const MarketSentimentRadar = ({ data = {}, isMock = false }) => {
    const indicator = (Array.isArray(data.indicator) && data.indicator.length > 0 ? data.indicator : null) || 
                      (Array.isArray(data.data?.indicator) && data.data?.indicator.length > 0 ? data.data.indicator : null) || 
                      [
                          { name: 'Trust', max: 100 },
                          { name: 'Innovation', max: 100 },
                          { name: 'Price', max: 100 },
                          { name: 'Service', max: 100 },
                          { name: 'Quality', max: 100 }
                      ];

    const radarData = (Array.isArray(data.radarData) && data.radarData.length > 0 ? data.radarData : null) || 
                      (Array.isArray(data.data?.radarData) && data.data?.radarData.length > 0 ? data.data.radarData : null) || 
                      (Array.isArray(data.data) && data.data.length > 0 && Array.isArray(data.data[0].value) ? data.data : null) || 
                      [
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
                      ];

    const option = {
        radar: {
            indicator: indicator,
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
                data: radarData
            }
        ],
        animationDuration: 2500
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default MarketSentimentRadar;
