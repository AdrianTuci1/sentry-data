import React from 'react';
import ReactECharts from 'echarts-for-react';

const StreamGraph = ({ data }) => {
    const streamData = data?.streamData || [
        ['2026/03/01', 10, 'Search'], ['2026/03/02', 15, 'Search'], ['2026/03/03', 20, 'Search'], ['2026/03/04', 18, 'Search'], ['2026/03/05', 25, 'Search'],
        ['2026/03/01', 5, 'Direct'], ['2026/03/02', 8, 'Direct'], ['2026/03/03', 12, 'Direct'], ['2026/03/04', 10, 'Direct'], ['2026/03/05', 15, 'Direct'],
        ['2026/03/01', 8, 'Social'], ['2026/03/02', 14, 'Social'], ['2026/03/03', 18, 'Social'], ['2026/03/04', 22, 'Social'], ['2026/03/05', 20, 'Social']
    ];

    const option = {
        animation: true,
        tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
        grid: { left: '5%', right: '5%', top: '10%', bottom: '15%' },
        singleAxis: {
            type: 'time',
            axisTick: { show: false },
            axisLabel: { color: '#9ca3af', fontSize: 10 },
            splitLine: { show: false },
            axisLine: { show: false }
        },
        series: [
            {
                type: 'themeRiver',
                emphasis: {
                    itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0, 0, 0, 0.8)' }
                },
                data: streamData,
                label: { show: false }
            }
        ],
        color: ['#818CF8', '#34D399', '#F472B6', '#FBBF24']
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default StreamGraph;
