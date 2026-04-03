import React from 'react';
import ReactECharts from 'echarts-for-react';

const IncrementalLift = ({ data }) => {
    const bars = Array.isArray(data?.bars) && data.bars.length
        ? data.bars
        : [
            { label: 'Organic', value: 4200, color: '#3B82F6' },
            { label: 'Paid', value: 2800, color: '#8B5CF6' },
            { label: 'Incremental', value: 1200, color: '#10B981', deltaLabel: '+22%' },
        ];
    const categories = bars.map((item) => item.label);

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
            data: categories,
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
                data: bars.map((item, index) => ({
                    value: item.value,
                    itemStyle: {
                        color: item.color || (index === bars.length - 1 ? '#10B981' : index === 0 ? '#3B82F6' : '#8B5CF6'),
                        borderRadius: [4, 4, 0, 0],
                    },
                    label: item.deltaLabel ? {
                        show: true,
                        position: 'top',
                        formatter: item.deltaLabel,
                        color: item.color || '#10B981',
                        fontSize: 10,
                        fontWeight: 'bold'
                    } : undefined,
                })),
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
