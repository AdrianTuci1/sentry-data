import React from 'react';
import ReactECharts from 'echarts-for-react';

const defaultSteps = ['80', '160', '240', '320', '400', '480', '560', '640'];
const defaultTrainLoss = [2.84, 2.41, 2.02, 1.78, 1.59, 1.42, 1.34, 1.29];
const defaultValLoss = [2.95, 2.58, 2.19, 1.96, 1.84, 1.73, 1.76, 1.81];
const defaultPerplexity = [18.3, 14.8, 11.7, 9.4, 8.2, 7.3, 7.6, 8.1];

const formatFloat = (value, digits = 2) => Number(value).toFixed(digits);

const MatplotlibTrainingPanel = ({ data = {} }) => {
    const steps = data.steps || defaultSteps;
    const trainLoss = data.trainLoss || defaultTrainLoss;
    const valLoss = data.valLoss || defaultValLoss;
    const perplexity = data.perplexity || defaultPerplexity;
    const stats = data.stats || [
        { label: 'Best val loss', value: formatFloat(Math.min(...valLoss)), accent: '#7cff5b', meta: 'checkpoint 480' },
        { label: 'Grad norm', value: '0.92', accent: '#7bd3ff', meta: 'stable window' },
        { label: 'Tokens / sec', value: '38.4k', accent: '#ffc857', meta: '8x H100' },
    ];
    const bestValIndex = valLoss.reduce((best, value, index, values) => (value < values[best] ? index : best), 0);

    const option = {
        animation: false,
        grid: { left: 40, right: 46, top: 18, bottom: 34 },
        legend: {
            top: 0,
            right: 0,
            textStyle: { color: 'rgba(234, 236, 244, 0.78)', fontSize: 11 },
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(14, 18, 24, 0.96)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#f7f8fc' },
        },
        xAxis: {
            type: 'category',
            data: steps,
            name: 'step x100',
            nameTextStyle: { color: 'rgba(214,218,229,0.45)', padding: [18, 0, 0, 0] },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.18)' } },
            axisTick: { show: false },
            axisLabel: { color: 'rgba(228, 231, 241, 0.68)', fontSize: 10 },
        },
        yAxis: [
            {
                type: 'value',
                name: 'loss',
                min: 1.1,
                max: 3.2,
                splitNumber: 4,
                nameTextStyle: { color: 'rgba(214,218,229,0.45)', padding: [0, 0, 6, 0] },
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: 'rgba(228, 231, 241, 0.68)', fontSize: 10 },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.09)' } },
            },
            {
                type: 'value',
                name: 'ppl',
                min: 6,
                max: 20,
                splitNumber: 4,
                nameTextStyle: { color: 'rgba(214,218,229,0.45)', padding: [0, 0, 6, 0] },
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: 'rgba(228, 231, 241, 0.52)', fontSize: 10 },
                splitLine: { show: false },
            },
        ],
        series: [
            {
                name: 'train_loss',
                type: 'line',
                smooth: true,
                showSymbol: false,
                data: trainLoss,
                lineStyle: { width: 2.2, color: '#7cff5b' },
                itemStyle: { color: '#7cff5b' },
            },
            {
                name: 'val_loss',
                type: 'line',
                smooth: true,
                showSymbol: false,
                data: valLoss,
                lineStyle: { width: 2.2, color: '#7bd3ff' },
                itemStyle: { color: '#7bd3ff' },
                markPoint: {
                    symbolSize: 34,
                    data: [{
                        coord: [steps[bestValIndex], valLoss[bestValIndex]],
                        value: formatFloat(valLoss[bestValIndex]),
                    }],
                    itemStyle: {
                        color: '#0b1016',
                        borderColor: '#7bd3ff',
                        borderWidth: 2,
                    },
                    label: {
                        color: '#f7f8fc',
                        fontSize: 10,
                        formatter: ({ value }) => `best\n${value}`,
                    },
                },
            },
            {
                name: 'val_ppl',
                type: 'line',
                yAxisIndex: 1,
                smooth: true,
                showSymbol: false,
                data: perplexity,
                lineStyle: { width: 1.6, type: 'dashed', color: '#ffc857' },
                itemStyle: { color: '#ffc857' },
            },
        ],
    };

    return (
        <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                {stats.map((stat) => (
                    <div key={stat.label} style={{ padding: '4px 0' }}>
                        <div style={{ color: 'rgba(231,234,243,0.54)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{stat.label}</div>
                        <div style={{ color: stat.accent || '#fff', fontSize: '24px', fontWeight: 700, lineHeight: 1, marginTop: '6px' }}>{stat.value}</div>
                        <div style={{ color: 'rgba(231,234,243,0.38)', fontSize: '10px', marginTop: '4px' }}>{stat.meta}</div>
                    </div>
                ))}
            </div>

            <ReactECharts option={option} style={{ height: '100%', width: '100%', minHeight: 0 }} opts={{ renderer: 'svg' }} />
        </div>
    );
};

export default MatplotlibTrainingPanel;
