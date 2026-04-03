import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import './PredictiveForecast.css';

const defaultLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const defaultSeries = [3120, 2765, 3850, 5750, 5400, 5987, 6320];

const buildSequentialLabels = (length, prefix = 'P') => (
    Array.from({ length }, (_, index) => `${prefix}${index + 1}`)
);

const formatCurrency = (value) => `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value))}`;

const formatMetricDelta = (value, suffix = '%') => `${value >= 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;

const buildLtvMetrics = (historical = [], forecast = []) => {
    const safeHistorical = historical.filter((value) => Number.isFinite(value));
    const safeForecast = forecast.filter((value) => Number.isFinite(value));
    const current = safeHistorical[safeHistorical.length - 1];
    const previous = safeHistorical[safeHistorical.length - 2] ?? current;
    const projected = safeForecast[safeForecast.length - 1] ?? current;
    const lift = previous ? ((current - previous) / previous) * 100 : 0;
    const projectedLift = current ? ((projected - current) / current) * 100 : 0;
    const confidence = 82;

    return [
        {
            label: 'Current LTV',
            value: formatCurrency(current || 1297),
            delta: formatMetricDelta(lift),
            comparison: `Compared to ${formatCurrency(previous || 1194)} last window`,
        },
        {
            label: 'Projected 30D',
            value: formatCurrency(projected || 1450),
            delta: formatMetricDelta(projectedLift),
            comparison: 'Forecast from active cohorts',
        },
        {
            label: 'Confidence',
            value: `${confidence}%`,
            delta: '+4 pts',
            comparison: 'Model stability vs previous run',
        },
    ];
};

const LegacyPredictiveForecast = ({ data }) => {
    const historical = data?.historical || [320, 335, 310, 350, 380, 370, 400];
    const forecast = data?.forecast || [410, 425, 440, 435, 452];
    const labels = [...historical.map((_, index) => `H${index + 1}`), ...forecast.map((_, index) => `F${index + 1}`)];
    const historicalData = [...historical, ...new Array(forecast.length).fill(null)];
    const forecastData = [...new Array(historical.length - 1).fill(null), historical[historical.length - 1], ...forecast];

    const option = {
        grid: { left: '5%', right: '5%', top: '30%', bottom: '20%' },
        xAxis: {
            type: 'category',
            data: labels,
            show: false
        },
        yAxis: {
            type: 'value',
            show: false,
            min: Math.min(...historical, ...forecast) * 0.95
        },
        legend: {
            show: true,
            bottom: '0%',
            left: 'center',
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            textStyle: {
                color: '#9CA3AF',
                fontSize: 10,
                fontFamily: 'Inter'
            },
            data: ['Historical', 'Forecast']
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            textStyle: { color: '#fff' }
        },
        series: [
            {
                name: 'Historical',
                type: 'line',
                data: historicalData,
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 3, color: '#3B82F6' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                        { offset: 1, color: 'rgba(59, 130, 246, 0)' }
                    ])
                }
            },
            {
                name: 'Forecast',
                type: 'line',
                data: forecastData,
                smooth: true,
                showSymbol: true,
                symbolSize: 6,
                lineStyle: { width: 3, type: 'dashed', color: '#10B981' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0)' }
                    ])
                }
            }
        ]
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0 5px',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Current</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>${historical[historical.length - 1]}K</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '10px', color: '#60A5FA', textTransform: 'uppercase' }}>Predicted</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#10B981' }}>${forecast[forecast.length - 1]}K</span>
                </div>
            </div>
            <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
        </div>
    );
};

const PredictiveForecast = ({ data = {} }) => {
    if (data.id !== 'marketing-pclv') {
        return <LegacyPredictiveForecast data={data} />;
    }

    const historical = data.historical || [];
    const forecast = data.forecast || [];
    const derivedSeries = historical.length || forecast.length
        ? [...historical.slice(-Math.max(0, 7 - forecast.length)), ...forecast].slice(0, 7)
        : defaultSeries;
    const values = data.chartSeries || derivedSeries;
    const labels = data.chartLabels || (values.length === defaultLabels.length ? defaultLabels : buildSequentialLabels(values.length, 'P'));
    const metricCards = data.metricCards || buildLtvMetrics(historical, forecast);
    const numericValues = values.filter((value) => Number.isFinite(value));
    const derivedMin = numericValues.length ? Math.max(0, Math.floor(Math.min(...numericValues) * 0.82)) : 0;
    const derivedMax = numericValues.length ? Math.ceil(Math.max(...numericValues) * 1.1) : 7600;
    const chartMin = data.chartMin ?? derivedMin;
    const chartMax = data.chartMax ?? derivedMax;
    const highlightRange = data.highlightRange || [Math.max(0, Math.floor(values.length / 4)), Math.max(0, values.length - 2)];
    const markerLabels = data.markerLabels || [
        { index: highlightRange[0], value: new Intl.NumberFormat('en-US').format(Math.round(values[highlightRange[0]] || 0)) },
        { index: highlightRange[1], value: new Intl.NumberFormat('en-US').format(Math.round(values[highlightRange[1]] || 0)) },
    ];
    const activeValues = values.map((value, index) => (
        index >= highlightRange[0] && index <= highlightRange[1] ? value : null
    ));

    const option = {
        animation: false,
        grid: {
            top: 12,
            right: 0,
            bottom: 28,
            left: 0,
            containLabel: false,
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
                margin: 16,
                color: 'rgba(118, 118, 124, 0.76)',
                fontSize: 11,
            },
            splitLine: { show: false },
        },
        yAxis: {
            type: 'value',
            min: chartMin,
            max: chartMax,
            splitNumber: 4,
            axisLabel: { show: false },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.16)',
                    type: 'dashed',
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
                return `${point.axisValue}<br/>${new Intl.NumberFormat('en-US').format(point.value)}`;
            },
        },
        series: [
            {
                type: 'line',
                data: values,
                smooth: true,
                symbol: 'none',
                z: 1,
                lineStyle: {
                    width: 4,
                    color: 'rgba(126, 126, 132, 0.48)',
                },
            },
            {
                type: 'line',
                data: activeValues,
                smooth: true,
                symbol: 'none',
                z: 3,
                lineStyle: {
                    width: 4.5,
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#17f8d2' },
                        { offset: 1, color: '#19ff87' },
                    ]),
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(57, 226, 255, 0.34)' },
                        { offset: 1, color: 'rgba(56, 255, 76, 0.18)' },
                    ]),
                },
                markLine: {
                    symbol: 'none',
                    silent: true,
                    label: { show: false },
                    lineStyle: {
                        color: 'rgba(255, 255, 255, 0.46)',
                        width: 2,
                    },
                    data: markerLabels.map((marker) => ({ xAxis: labels[marker.index] })),
                },
                markPoint: {
                    symbol: 'circle',
                    symbolSize: 14,
                    itemStyle: {
                        color: '#14f6c0',
                        borderColor: '#090909',
                        borderWidth: 3,
                        shadowBlur: 16,
                        shadowColor: 'rgba(20, 246, 192, 0.32)',
                    },
                    label: {
                        show: true,
                        position: 'top',
                        distance: 16,
                        color: '#f2f4f7',
                        fontSize: 13,
                        fontWeight: 700,
                        formatter: ({ data: pointData }) => pointData.displayValue,
                    },
                    data: markerLabels.map((marker) => ({
                        coord: [labels[marker.index], values[marker.index]],
                        value: values[marker.index],
                        displayValue: marker.value,
                    })),
                },
            },
        ],
    };

    return (
        <div className="predictive-widget">
            <div className="predictive-header">
                <h3>{data.title || 'Predictive LTV'}</h3>
            </div>

            <div className="predictive-metric-grid">
                {metricCards.map((card) => (
                    <section key={card.label} className="predictive-metric-card">
                        <span className="predictive-metric-label">{card.label}</span>
                        <div className="predictive-metric-row">
                            <span className="predictive-metric-value">{card.value}</span>
                            <span className="predictive-metric-delta">{card.delta}</span>
                        </div>
                        <span className="predictive-metric-comparison">{card.comparison}</span>
                    </section>
                ))}
            </div>

            <div className="predictive-divider" />

            <div className="predictive-chart-shell">
                <ReactECharts option={option} notMerge lazyUpdate className="predictive-chart" />
            </div>
        </div>
    );
};

export default PredictiveForecast;
