import React from 'react';
import ReactECharts from 'echarts-for-react';

const IncrementalLift = ({ data }) => {
    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: ['Organic', 'Paid', 'Incremental'],
            axisLabel: { color: '#9CA3AF', fontSize: 10 },
            axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
            axisLabel: { color: '#6B7280', fontSize: 9 }
        },
        series: [
            {
                data: [
                    { value: 4200, itemStyle: { color: '#3B82F6' } },
                    { value: 2800, itemStyle: { color: '#8B5CF6' } },
                    {
                        value: 1200,
                        itemStyle: {
                            color: '#10B981',
                            borderRadius: [4, 4, 0, 0]
                        },
                        label: {
                            show: true,
                            position: 'top',
                            formatter: '+22%',
                            color: '#10B981',
                            fontSize: 10,
                            fontWeight: 'bold'
                        }
                    }
                ],
                type: 'bar',
                barWidth: '40%',
                showBackground: true,
                backgroundStyle: {
                    color: 'rgba(255, 255, 255, 0.02)'
                }
            }
        ],
        animationDuration: 1500
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default IncrementalLift;
