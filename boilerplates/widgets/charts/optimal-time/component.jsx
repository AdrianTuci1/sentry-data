import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const OptimalTimeHeatmap = ({ data = {}, isMock = false }) => {
    const hours = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22'];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    let heatmapData = (Array.isArray(data.heatmapData) && data.heatmapData.length > 0 ? data.heatmapData : null) || 
                      (Array.isArray(data.data) && data.data.length > 0 && Array.isArray(data.data[0]) ? data.data : null);

    if (!heatmapData || heatmapData.length === 0) {
        heatmapData = [];
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 12; j++) {
                let val = Math.floor(Math.random() * 50);
                if (j >= 8 && j <= 10) val += 50;
                heatmapData.push([j, i, val]);
            }
        }
    }

    const option = {
        tooltip: { position: 'top' },
        grid: {
            top: '5%',
            bottom: '15%',
            left: '12%',
            right: '5%'
        },
        xAxis: {
            type: 'category',
            data: hours,
            splitArea: { show: true },
            axisLabel: { color: '#6B7280', fontSize: 9 },
            axisLine: { show: false },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'category',
            data: days,
            splitArea: { show: true },
            axisLabel: { color: '#6B7280', fontSize: 9 },
            axisLine: { show: false },
            axisTick: { show: false }
        },
        visualMap: {
            min: 0,
            max: 100,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '0%',
            show: false,
            inRange: {
                color: ['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.8)', '#3B82F6']
            }
        },
        series: [{
            name: 'Engagement',
            type: 'heatmap',
            data: heatmapData,
            label: { show: false },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }],
        animationDuration: 2000
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default OptimalTimeHeatmap;
