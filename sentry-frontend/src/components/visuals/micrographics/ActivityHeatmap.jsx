import React from 'react';
import ReactECharts from 'echarts-for-react';

const ActivityHeatmap = ({ data }) => {
    const hours = ['12a', '1a', '2a', '3a', '4a', '5a', '6a', '7a', '8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p', '11p'];
    const days = ['Sat', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon', 'Sun'];

    // Mock data: [dayIndex, hourIndex, value]
    const heatmapData = [];
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 24; j++) {
            const val = Math.floor(Math.random() * 10);
            heatmapData.push([j, i, val === 0 ? '-' : val]);
        }
    }

    const option = {
        tooltip: { position: 'top' },
        grid: { height: '70%', top: '10%', right: '5%' },
        xAxis: {
            type: 'category',
            data: hours,
            splitArea: { show: true },
            axisLabel: { color: '#9CA3AF', fontSize: 8 }
        },
        yAxis: {
            type: 'category',
            data: days,
            splitArea: { show: true },
            axisLabel: { color: '#9CA3AF', fontSize: 8 }
        },
        visualMap: {
            min: 0,
            max: 10,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '0%',
            show: false,
            inRange: {
                color: ['rgba(56, 189, 248, 0.1)', 'rgba(56, 189, 248, 0.4)', 'rgba(56, 189, 248, 0.8)', '#38BDF8']
            }
        },
        series: [{
            name: 'Activity',
            type: 'heatmap',
            data: heatmapData,
            label: { show: false },
            emphasis: {
                itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
            }
        }],
        animationDuration: 1500
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default ActivityHeatmap;
