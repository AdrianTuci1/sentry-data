import React from 'react';
import { Medal, Sparkles } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import './LiveTrafficChart.css';

const defaultMetricCards = [
    { icon: 'sparkles', label: 'Active now', value: '462', delta: '+7.0%', note: 'users online' },
    { icon: 'medal', label: 'Peak today', value: '512', delta: '+12.4%', note: 'highest concurrent users' },
];

const defaultSeries = [280, 310, 395, 382, 462, null, null];

const renderMetricIcon = (icon) => {
    if (icon === 'medal') {
        return <Medal size={15} strokeWidth={2.1} />;
    }

    return <Sparkles size={15} strokeWidth={2.1} />;
};

const formatCompactNumber = (value) => new Intl.NumberFormat('en-US').format(Math.round(value));

const formatSignedPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const buildTrafficMetrics = (series = []) => {
    const numericSeries = series.filter((value) => Number.isFinite(value));
    if (!numericSeries.length) {
        return defaultMetricCards;
    }

    const latest = numericSeries[numericSeries.length - 1];
    const previous = numericSeries[Math.max(0, numericSeries.length - 2)] || latest;
    const peak = Math.max(...numericSeries);
    const average = numericSeries.reduce((sum, value) => sum + value, 0) / numericSeries.length;
    const liveDelta = previous === 0 ? 0 : ((latest - previous) / previous) * 100;
    const peakDelta = average === 0 ? 0 : ((peak - average) / average) * 100;

    return [
        {
            icon: 'sparkles',
            label: 'Active now',
            value: formatCompactNumber(latest),
            delta: formatSignedPercent(liveDelta),
            note: 'users online',
        },
        {
            icon: 'medal',
            label: 'Peak today',
            value: formatCompactNumber(peak),
            delta: formatSignedPercent(peakDelta),
            note: `${formatCompactNumber(average)} avg users`,
        },
    ];
};

const buildTrafficTicks = (series = [], minOverride, maxOverride) => {
    const numericSeries = series.filter((value) => Number.isFinite(value));
    const maxValue = Number.isFinite(maxOverride) ? maxOverride : Math.max(...numericSeries, 1);
    const minValue = Number.isFinite(minOverride) ? minOverride : Math.max(0, Math.min(...numericSeries, 0));
    const roughStep = Math.max(10, Math.ceil((maxValue - minValue) / 5 / 10) * 10);
    const safeMax = Math.ceil(maxValue / roughStep) * roughStep;
    const safeMin = Math.max(0, Math.floor(minValue / roughStep) * roughStep);

    return Array.from({ length: Math.round((safeMax - safeMin) / roughStep) + 1 }, (_, index) => safeMin + index * roughStep);
};

const buildSequentialLabels = (length, prefix = 'T') => (
    Array.from({ length }, (_, index) => `${prefix}${index + 1}`)
);

const LiveTrafficChart = ({ data = {} }) => {
    const values = data.chartSeries || defaultSeries;
    const labels = data.chartLabels || buildSequentialLabels(values.length, 'D');
    const metricCards = data.metricCards || buildTrafficMetrics(values);
    const ticks = buildTrafficTicks(values, data.chartMin, data.chartMax);
    const chartMin = data.chartMin ?? ticks[0];
    const chartMax = data.chartMax ?? ticks[ticks.length - 1];
    const lastVisibleIndex = values.reduce((accumulator, value, index) => (Number.isFinite(value) ? index : accumulator), 0);
    const annotation = data.annotation || {
        index: lastVisibleIndex,
        label: 'ACTIVE USERS',
        value: formatCompactNumber(values[lastVisibleIndex] || 0),
    };

    const option = {
        animation: false,
        grid: {
            top: 8,
            left: 32,
            right: 18,
            bottom: 22,
            containLabel: false,
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
                margin: 12,
                color: 'rgba(247, 248, 251, 0.9)',
                fontSize: 10,
            },
            splitLine: { show: false },
        },
        yAxis: {
            type: 'value',
            min: chartMin,
            max: chartMax,
            interval: ticks.length > 1 ? ticks[1] - ticks[0] : undefined,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
                color: 'rgba(245, 247, 251, 0.88)',
                fontSize: 9,
                margin: 10,
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.14)',
                },
            },
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(8, 10, 12, 0.94)',
            borderColor: 'rgba(255,255,255,0.08)',
            textStyle: { color: '#f5f7fb' },
            formatter: (params) => {
                const point = params.find((item) => item.value !== null) || params[0];
                return `${point.axisValue}<br/>${formatCompactNumber(point.value)} users`;
            },
        },
        series: [
            {
                type: 'line',
                data: values,
                smooth: false,
                symbol: 'none',
                z: 2,
                lineStyle: {
                    width: 5,
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#ef8b43' },
                        { offset: 1, color: '#db3e93' },
                    ]),
                    shadowBlur: 18,
                    shadowColor: 'rgba(242, 94, 120, 0.28)',
                },
                markPoint: {
                    symbol: 'circle',
                    symbolSize: 18,
                    data: [{
                        coord: [labels[annotation.index], values[annotation.index]],
                        value: values[annotation.index],
                    }],
                    itemStyle: {
                        color: '#090909',
                        borderColor: '#f08154',
                        borderWidth: 5,
                        shadowBlur: 14,
                        shadowColor: 'rgba(219, 62, 147, 0.28)',
                    },
                    label: {
                        show: true,
                        position: 'right',
                        distance: 16,
                        formatter: () => `{label|${annotation.label}}\n{value|${annotation.value}}`,
                        rich: {
                            label: {
                                fontSize: 9,
                                fontWeight: 700,
                                color: 'rgba(214, 210, 220, 0.76)',
                                letterSpacing: 1.2,
                                padding: [0, 0, 3, 0],
                            },
                            value: {
                                fontSize: 18,
                                fontWeight: 700,
                                color: '#f6f6f8',
                            },
                        },
                    },
                },
            },
        ],
    };

    return (
        <div className="live-pulse-widget">
            <div className="live-pulse-metrics">
                {metricCards.map((card) => (
                    <section key={card.label} className="live-pulse-metric-card">
                        <div className="live-pulse-metric-label">
                            <span className={`live-pulse-metric-icon ${card.icon === 'medal' ? 'is-gold' : ''}`}>
                                {renderMetricIcon(card.icon)}
                            </span>
                            <span>{card.label}</span>
                        </div>

                        <div className="live-pulse-metric-value">{card.value}</div>

                        <div className="live-pulse-metric-meta">
                            <span className="live-pulse-metric-delta">{card.delta}</span>
                            <span className="live-pulse-metric-note">{card.note}</span>
                        </div>
                    </section>
                ))}
            </div>

            <div className="live-pulse-chart-shell">
                <div className="live-pulse-glow" />
                <ReactECharts option={option} notMerge lazyUpdate className="live-pulse-chart" />
            </div>
        </div>
    );
};

export default LiveTrafficChart;
