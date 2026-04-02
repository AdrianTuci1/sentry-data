import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

const PredictiveForecast = ({ data }) => {
    const historical = data?.historical || [320, 335, 310, 350, 380, 370, 400];
    const forecast = data?.forecast || [410, 425, 440, 435, 452];

    // Combine for X-axis labels (generic)
    const labels = [...historical.map((_, i) => `H${i + 1}`), ...forecast.map((_, i) => `F${i + 1}`)];

    // Create combined data with nulls for separate series
    const historicalData = [...historical, ...new Array(forecast.length).fill(null)];
    const forecastData = [...new Array(historical.length - 1).fill(null), historical[historical.length - 1], ...forecast];

    const option = {
        grid: { left: '5%', right: '5%', top: '30%', bottom: '20%' },
        xAxis: {
            type: 'category',
            data: labels,
            show: false
        },
        yAxis: {
            type: 'value',
            show: false,
            min: Math.min(...historical, ...forecast) * 0.95
        },
        legend: {
            show: true,
            bottom: '0%',
            left: 'center',
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            textStyle: {
                color: '#9CA3AF',
                fontSize: 10,
                fontFamily: 'Inter'
            },
            data: ['Historical', 'Forecast']
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            textStyle: { color: '#fff' }
        },
        series: [
            {
                name: 'Historical',
                type: 'line',
                data: historicalData,
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 3, color: '#3B82F6' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                        { offset: 1, color: 'rgba(59, 130, 246, 0)' }
                    ])
                }
            },
            {
                name: 'Forecast',
                type: 'line',
                data: forecastData,
                smooth: true,
                showSymbol: true,
                symbolSize: 6,
                lineStyle: { width: 3, type: 'dashed', color: '#10B981' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0)' }
                    ])
                }
            }
        ]
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0 5px',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Current</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>${historical[historical.length - 1]}K</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '10px', color: '#60A5FA', textTransform: 'uppercase' }}>Predicted</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#10B981' }}>${forecast[forecast.length - 1]}K</span>
                </div>
            </div>
            <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
        </div>
    );
};

export default PredictiveForecast;
