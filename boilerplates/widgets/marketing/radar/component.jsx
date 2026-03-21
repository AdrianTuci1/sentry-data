import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const InterestRadar = ({ data = {} }) => {
    const indicator = (data.indicator?.length > 0 ? data.indicator : null) || 
                      (data.labels?.length > 0 ? data.labels.map(l => ({ name: l, max: 100 })) : null) || 
                      [
                          { name: 'Technology', max: 100 },
                          { name: 'Fashion', max: 100 },
                          { name: 'Finance', max: 100 },
                          { name: 'Food', max: 100 },
                          { name: 'Travel', max: 100 },
                          { name: 'Sports', max: 100 }
                      ];

    const radarData = (data.radarData?.length > 0 ? data.radarData : null) || 
                      (data.data?.length > 0 ? data.data : null) || 
                      (data.results?.length > 0 ? data.results : null) || [
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
            indicator: indicator,
            splitArea: { show: false },
            splitLine: {
                lineStyle: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            axisLine: {
                lineStyle: { color: 'rgba(255, 255, 255, 0.2)' }
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

    return <ReactECharts option={option} className="micro-radar" style={{ height: '100%', width: '100%' }} />;
};

export default InterestRadar;
