import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

const ScatterPlot = ({ data }) => {
    const scatterData = data?.scatterData || [
        [40, 426], [45, 450], [50, 568], [55, 520], [60, 724], [65, 680], [70, 482], [75, 550],
        [80, 695], [85, 720], [90, 881], [95, 840], [100, 804], [105, 860], [110, 833], [115, 900],
        [120, 1084], [125, 1020], [130, 758], [135, 820], [140, 996], [145, 1050], [150, 1100],
        [155, 1150], [160, 1200], [165, 1180], [170, 1250], [175, 1300], [180, 1280], [185, 1350]
    ];
    const periodLabels = data?.periodLabels || scatterData.map((_, index) => `C${String(index + 1).padStart(2, '0')}`);
    const cacSeries = scatterData.map(([cac]) => cac);
    const ltvSeries = scatterData.map(([, ltv]) => ltv);
    const currency = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    });
    const ltvColor = '#7CFF5B';
    const ratioSeries = scatterData.map(([cac, ltv]) => Number((ltv / Math.max(cac, 1)).toFixed(1)));

    const option = {
        animation: true,
        animationDuration: 900,
        animationEasing: 'cubicOut',
        legend: {
            top: 0,
            right: 0,
            itemWidth: 12,
            itemHeight: 12,
            selectedMode: false,
            textStyle: { color: 'rgba(255, 255, 255, 0.72)', fontSize: 11 },
            data: ['LTV', 'CAC', 'LTV:CAC'],
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(13, 16, 22, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            textStyle: { color: '#fff' },
            axisPointer: {
                type: 'line',
                lineStyle: {
                    color: 'rgba(255,255,255,0.2)',
                },
            },
            formatter: (params) => {
                const label = params?.[0]?.axisValueLabel || '';
                const lines = params.map((item) => {
                    const value = Array.isArray(item.value) ? item.value[1] : item.value;
                    const formattedValue = item.seriesName === 'LTV:CAC' ? `${value}x` : currency.format(value);

                    return `${item.marker}${item.seriesName}: ${formattedValue}`;
                });
                return [label, ...lines].join('<br/>');
            },
        },
        grid: { left: 54, right: 72, top: 42, bottom: 38 },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: periodLabels,
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
            axisTick: { show: false },
            axisLabel: {
                color: 'rgba(255,255,255,0.52)',
                fontSize: 11,
                margin: 14,
            },
        },
        yAxis: [
            {
                type: 'value',
                name: 'LTV',
                min: (value) => Math.floor(value.min * 0.85),
                max: (value) => Math.ceil(value.max * 1.1),
                nameTextStyle: {
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 11,
                    padding: [0, 0, 6, 0],
                },
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: 'rgba(255,255,255,0.42)',
                    fontSize: 10,
                    formatter: (value) => `$${Math.round(value)}`,
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(255,255,255,0.12)',
                    },
                },
            },
            {
                type: 'value',
                name: 'CAC',
                position: 'right',
                min: (value) => Math.floor(value.min * 0.8),
                max: (value) => Math.ceil(value.max * 1.2),
                nameTextStyle: {
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 11,
                    padding: [0, 0, 6, 0],
                },
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: 'rgba(255,255,255,0.42)',
                    fontSize: 10,
                    formatter: (value) => `$${Math.round(value)}`,
                },
                splitLine: { show: false },
            },
            {
                type: 'value',
                name: 'ratio',
                min: 0,
                max: (value) => Math.ceil(value.max + 1),
                show: false,
            },
        ],
        series: [
            {
                name: 'CAC',
                type: 'bar',
                data: cacSeries,
                yAxisIndex: 1,
                barMaxWidth: 16,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(53, 201, 255, 0.82)' },
                        { offset: 1, color: 'rgba(53, 201, 255, 0.18)' },
                    ]),
                    borderRadius: [3, 3, 0, 0],
                },
                emphasis: {
                    focus: 'series',
                },
            },
            {
                name: 'LTV:CAC',
                type: 'line',
                smooth: 0.5,
                showSymbol: false,
                data: ratioSeries,
                yAxisIndex: 2,
                lineStyle: {
                    color: 'rgba(255, 200, 87, 0.92)',
                    width: 2,
                    type: 'dashed',
                },
                itemStyle: {
                    color: '#ffc857',
                },
                endLabel: {
                    show: true,
                    color: 'rgba(255,255,255,0.78)',
                    fontSize: 12,
                    fontWeight: 600,
                    formatter: ({ value }) => `${value}x`,
                },
                emphasis: {
                    focus: 'series',
                },
            },
            {
                name: 'LTV',
                type: 'line',
                smooth: 0.5,
                symbol: 'circle',
                showSymbol: false,
                symbolSize: 9,
                data: ltvSeries,
                yAxisIndex: 0,
                lineStyle: {
                    color: ltvColor,
                    width: 4,
                },
                itemStyle: {
                    color: '#0d0e13',
                    borderColor: ltvColor,
                    borderWidth: 4,
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(124, 255, 91, 0.28)' },
                        { offset: 1, color: 'rgba(124, 255, 91, 0)' },
                    ]),
                },
                endLabel: {
                    show: true,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    formatter: ({ value }) => `LTV ${currency.format(value)}`,
                },
                emphasis: {
                    focus: 'series',
                },
            },
        ],
    };

    return (
        <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
        />
    );
};

export default ScatterPlot;
