import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import './style.css';

const LiveTrafficChart = ({ data = {} }) => {
    const points = (data.data?.length > 0 ? data.data : null) || 
                   (data.results?.length > 0 ? data.results : null) || 
                   (data.dataPoints?.length > 0 ? data.dataPoints : null) || 
                   [60, 50, 70, 65, 80, 75, 90, 85, 100, 95, 110, 100, 120];

    const value = data.value || data.results?.[0]?.value || data.data?.[0]?.value || points[points.length - 1];
    const unit = data.unit || data.results?.[0]?.unit || data.data?.[0]?.unit || "";

    const option = {
        grid: { left: -10, right: -10, top: '35%', bottom: -10 },
        xAxis: {
            type: 'category',
            show: false,
            data: points.map((_, i) => i)
        },
        tooltip: {
            show: true,
            trigger: 'axis',
            backgroundColor: 'rgba(17, 24, 39, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' },
            formatter: (params) => `${params[0].value} usr`
        },
        yAxis: {
            type: 'value',
            show: false,
            min: 'dataMin'
        },
        series: [{
            type: 'line',
            data: points,
            smooth: true,
            symbol: 'none',
            lineStyle: {
                width: 3,
                color: '#fff'
            },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(255, 255, 255, 0.4)' },
                    { offset: 1, color: 'rgba(255, 255, 255, 0)' }
                ])
            }
        }]
    };

    return (
        <div className="micro-animated-line">
            <div className="line-value-wrapper">
                <span className="line-val">{value}</span>
                {unit && <span className="line-unit">{unit}</span>}
            </div>
            <div className="svg-container">
                <ReactECharts option={option} className="micro-line-chart" style={{ height: '100%', width: '100%' }} />
            </div>
        </div>
    );
};

export default LiveTrafficChart;
