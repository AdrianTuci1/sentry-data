import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import './style.css';

const RangeAreaChart = ({ data = {} }) => {
    const dates = (data.labels?.length > 0 ? data.labels : null) || 
                  (data.dates?.length > 0 ? data.dates : null) || 
                  ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
    
    const rawValues = (data.results?.length > 0 ? data.results : null) || 
                      (data.data?.length > 0 ? data.data : null) || 
                      (data.dataPoints?.length > 0 ? data.dataPoints : null) || [];

    const maxData = (data.maxData?.length > 0 ? data.maxData : null) || 
                    (rawValues.length > 0 ? rawValues.map(v => (typeof v === 'number' ? v : parseFloat(v || 0)) * 1.2) : [120, 150, 200, 180, 220, 250, 210]);
    
    const avgData = (data.avgData?.length > 0 ? data.avgData : null) || 
                    (rawValues.length > 0 ? rawValues : [80, 110, 150, 130, 180, 190, 160]);
    
    const minData = (data.minData?.length > 0 ? data.minData : null) || 
                    (rawValues.length > 0 ? rawValues.map(v => (typeof v === 'number' ? v : parseFloat(v || 0)) * 0.8) : [40, 70, 100, 80, 140, 130, 110]);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross', label: { backgroundColor: '#374151' } }
        },
        grid: { left: '8%', right: '5%', top: '10%', bottom: '15%' },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: dates,
            axisLine: { lineStyle: { color: '#4B5563' } },
            axisLabel: { color: '#9CA3AF', fontSize: 10 }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: '#1F2937', type: 'dashed' } },
            axisLabel: { color: '#9CA3AF', fontSize: 10 }
        },
        series: [
            {
                name: 'Minimum',
                type: 'line',
                data: minData,
                lineStyle: { opacity: 0 },
                stack: 'confidence-band',
                symbol: 'none'
            },
            {
                name: 'Range',
                type: 'line',
                // We subtract minData from maxData to get the band height relative to minData
                data: maxData.map((val, i) => val - minData[i]),
                lineStyle: { opacity: 0 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(56, 189, 248, 0.3)' },
                        { offset: 1, color: 'rgba(56, 189, 248, 0.05)' }
                    ])
                },
                stack: 'confidence-band',
                symbol: 'none'
            },
            {
                name: 'Average',
                type: 'line',
                data: avgData,
                itemStyle: { color: '#38BDF8' },
                symbolSize: 6,
                symbol: 'circle',
                smooth: true,
                lineStyle: { width: 3, shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 10 }
            }
        ]
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default RangeAreaChart;
