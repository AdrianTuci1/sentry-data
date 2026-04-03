import React from 'react';
import ReactECharts from 'echarts-for-react';

const AnomalyStream = ({ data }) => {
    const defaultServices = ['Service A', 'Service B', 'Service C', 'Service D', 'Service E', 'Service F', 'Service G'];
    const dispersionData = Array.isArray(data?.dispersionData) && data.dispersionData.length
        ? data.dispersionData
        : defaultServices.flatMap((service, index) => ([
            [120 + (index * 90), 32000 + (index * 9500), service],
            [160 + (index * 90), 41000 + (index * 12000), service],
        ]));
    const xAxisLabel = data?.xAxisLabel || 'Frequency';
    const yAxisLabel = data?.yAxisLabel || 'Variance';
    const valueLabel = data?.valueLabel || 'score';
    const yValues = dispersionData.map((point) => Number(point?.[1]) || 0);
    const minValue = Math.min(...yValues, 0);
    const maxValue = Math.max(...yValues, 1);

    const option = {
        grid: {
            top: '15%',
            bottom: '15%',
            left: '10%',
            right: '15%',
            containLabel: true
        },
        visualMap: {
            min: minValue,
            max: maxValue,
            dimension: 1,
            orient: 'vertical',
            right: 0,
            top: 'center',
            text: ['HIGH', 'LOW'],
            calculable: true,
            itemWidth: 10,
            itemHeight: 80,
            textStyle: { color: '#6B7280', fontSize: 10 },
            inRange: {
                color: ['#f2c31a', '#24b7f2']
            }
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                const [x, y, service] = params.data;
                return `
                    <div style="padding: 4px;">
                        <div style="font-weight: bold; color: #9CA3AF; margin-bottom: 4px;">${service}</div>
                        <div style="font-size: 12px;">${valueLabel}: <span style="color: #24b7f2;">${y.toLocaleString()}</span></div>
                        <div style="font-size: 12px; opacity: 0.7;">${xAxisLabel}: ${x.toFixed(0)}</div>
                    </div>
                `;
            },
            axisPointer: {
                type: 'cross'
            }
        },
        xAxis: [
            {
                type: 'value',
                name: xAxisLabel,
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
                axisLabel: { color: '#6B7280', fontSize: 9 }
            }
        ],
        yAxis: [
            {
                type: 'value',
                name: yAxisLabel,
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
                axisLabel: { color: '#6B7280', fontSize: 9 }
            }
        ],
        series: [
            {
                name: 'service-dispersion',
                type: 'scatter',
                symbolSize: (data) => {
                    const magnitude = Number(data?.[1]) || 0;
                    const ratio = maxValue > minValue ? (magnitude - minValue) / (maxValue - minValue) : 0.5;
                    return 4 + (ratio * 5);
                },
                data: dispersionData,
                itemStyle: {
                    opacity: 0.8
                }
            }
        ],
        animationDuration: 2000
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default AnomalyStream;
