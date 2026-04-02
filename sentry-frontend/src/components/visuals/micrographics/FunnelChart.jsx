import React from 'react';
import ReactECharts from 'echarts-for-react';

const FunnelChart = ({ data }) => {
    const funnelData = data?.funnel || [
        { value: 100, name: 'Visits' },
        { value: 80, name: 'Inquiry' },
        { value: 60, name: 'Lead' },
        { value: 30, name: 'Cart' },
        { value: 10, name: 'Purchase' }
    ];

    const gridSpan = data?.gridSpan || '';
    const isHorizontal = gridSpan.includes('col-span-2');

    const option = {
        tooltip: { trigger: 'item', formatter: '{b} : {c}%' },
        series: [
            {
                name: 'Funnel',
                type: 'funnel',
                orient: isHorizontal ? 'horizontal' : 'vertical',
                left: isHorizontal ? '5%' : '10%',
                top: isHorizontal ? '15%' : '10%',
                bottom: isHorizontal ? '15%' : '10%',
                width: isHorizontal ? '90%' : '80%',
                height: isHorizontal ? '70%' : '80%',
                label: {
                    position: 'inside',
                    formatter: '{c}%',
                    color: '#fff',
                    fontSize: 10
                },
                itemStyle: {
                    borderColor: '#111827',
                    borderWidth: 2,
                    borderRadius: 10
                },
                emphasis: {
                    label: { fontSize: 14 }
                },
                data: funnelData
            }
        ],
        color: ['#34D399', '#38BDF8', '#818CF8', '#A78BFA', '#F472B6']
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default FunnelChart;
