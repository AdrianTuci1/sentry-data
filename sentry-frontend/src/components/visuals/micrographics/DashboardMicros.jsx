import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import './DashboardMicros.css';

const TONE_MAP = {
    negative: '#ff7676',
    neutral: '#f4c96b',
    positive: '#49d793',
};

const resolveTone = (tone) => TONE_MAP[tone] || TONE_MAP.positive;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const parseNumericValue = (value) => Number.parseFloat(String(value ?? '').replace(/,/g, ''));

const blendColor = (start, end, progress) => start.map((channel, index) => (
    Math.round(channel + (end[index] - channel) * progress)
));

const interpolatePalette = (stops, progress) => {
    const clamped = clamp(progress, 0, 1);

    for (let index = 0; index < stops.length - 1; index += 1) {
        const start = stops[index];
        const end = stops[index + 1];

        if (clamped >= start.at && clamped <= end.at) {
            const localProgress = (clamped - start.at) / Math.max(0.0001, end.at - start.at);
            const color = blendColor(start.color, end.color, localProgress);
            return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        }
    }

    const lastColor = stops[stops.length - 1].color;
    return `rgb(${lastColor[0]}, ${lastColor[1]}, ${lastColor[2]})`;
};

const buildSignalPalette = (goodAtHigh = true) => {
    const colors = goodAtHigh
        ? ['#ff6b7a', '#ff8373', '#ff9b6d', '#ffb567', '#ffcd6b', '#ffe07a', '#d9ef85', '#b8f39a', '#9deeb0', '#8ee9c0', '#8ae8d6', '#92ebf0']
        : ['#92ebf0', '#8ae8d6', '#8ee9c0', '#9deeb0', '#b8f39a', '#d9ef85', '#ffe07a', '#ffcd6b', '#ffb567', '#ff9b6d', '#ff8373', '#ff6b7a'];

    return colors;
};

const buildArcPalette = (goodAtHigh = true) => (
    goodAtHigh
        ? [
            { at: 0, color: [4, 39, 31] },
            { at: 0.35, color: [12, 123, 91] },
            { at: 0.7, color: [28, 212, 155] },
            { at: 1, color: [33, 246, 202] },
        ]
        : [
            { at: 0, color: [40, 13, 15] },
            { at: 0.4, color: [132, 41, 39] },
            { at: 0.75, color: [250, 116, 36] },
            { at: 1, color: [255, 201, 56] },
        ]
);

const buildRingPalette = (goodAtHigh = true) => (
    goodAtHigh
        ? [
            { at: 0, color: [24, 197, 150] },
            { at: 1, color: [42, 247, 208] },
        ]
        : [
            { at: 0, color: [255, 179, 0] },
            { at: 0.6, color: [255, 193, 31] },
            { at: 1, color: [255, 210, 78] },
        ]
);

const ArcSummaryMicro = ({ data }) => {
    const score = Number.isFinite(data?.signalScore) ? data.signalScore : parseNumericValue(data?.value) || 0;
    const goodAtHigh = data?.goodAtHigh !== false;
    const arcPalette = buildArcPalette(goodAtHigh);
    const badgeText = data?.trendValue || data?.summarySymbol || data?.unit || null;
    const scoreGlow = clamp(score / 100, 0.08, 1);
    const buildArcTrack = (count, radiusX, radiusY, yBase, startAngle, endAngle, minDot, maxDot, inset = 0, activeBias = 1) => (
        Array.from({ length: count }, (_, index) => {
            const progress = index / Math.max(1, count - 1);
            const angle = (startAngle + (endAngle - startAngle) * progress) * (Math.PI / 180);
            const emphasis = Math.sin((progress + inset) * Math.PI) ** 1.18;
            const activeCount = Math.max(1, Math.round(count * scoreGlow * activeBias));
            const isActive = index < activeCount;

            return {
                id: `arc-${count}-${index}`,
                cx: 120 + Math.cos(angle) * radiusX,
                cy: yBase - Math.sin(angle) * radiusY,
                radius: minDot + emphasis * (maxDot - minDot),
                fill: interpolatePalette(arcPalette, emphasis),
                opacity: isActive ? 0.28 + emphasis * (0.4 + scoreGlow * 0.32) : 0.08 + emphasis * 0.12,
            };
        })
    );
    const dots = buildArcTrack(21, 108, 108, 176, 188, -8, 5.8, 9.4, 0, 1);

    return (
        <div className={`summary-arc-micro ${goodAtHigh ? 'is-positive' : 'is-alert'}`}>
            {badgeText && <div className="summary-arc-badge">{badgeText}</div>}
            <svg className="summary-arc-svg" viewBox="0 0 240 180" preserveAspectRatio="xMidYMid meet">
                {dots.map((dot) => (
                    <circle
                        key={dot.id}
                        cx={dot.cx}
                        cy={dot.cy}
                        r={dot.radius}
                        fill={dot.fill}
                        opacity={dot.opacity}
                    />
                ))}
            </svg>

            <div className="summary-arc-center">
                <div className="summary-arc-value-line">
                    <span className="summary-arc-value">{data?.value}</span>
                </div>
            </div>
        </div>
    );
};

const RingSummaryMicro = ({ data }) => {
    const rawScore = Number.isFinite(data?.signalScore) ? data.signalScore : parseNumericValue(data?.value) || 0;
    const normalizedScore = clamp(rawScore, 0, 100);
    const goodAtHigh = data?.goodAtHigh !== false;
    const ringPalette = buildRingPalette(goodAtHigh);
    const symbol = data?.summarySymbol || (data?.unit === '%' ? '%' : goodAtHigh ? '•' : '!');
    const trendText = data?.trendValue || data?.signalLabel;
    const segmentCount = 64;
    const activeCount = Math.max(1, Math.round((normalizedScore / 100) * segmentCount));
    const startAngle = -90;

    const segments = Array.from({ length: segmentCount }, (_, index) => {
        const angle = startAngle + (index / segmentCount) * 360;
        const radians = (angle * Math.PI) / 180;
        const innerRadius = 94;
        const outerRadius = 114;
        const x1 = 110 + Math.cos(radians) * innerRadius;
        const y1 = 110 + Math.sin(radians) * innerRadius;
        const x2 = 110 + Math.cos(radians) * outerRadius;
        const y2 = 110 + Math.sin(radians) * outerRadius;
        const active = index < activeCount;

        return {
            id: `ring-${index}`,
            x1,
            y1,
            x2,
            y2,
            active,
            stroke: active ? interpolatePalette(ringPalette, index / Math.max(1, activeCount - 1 || 1)) : 'rgba(255,255,255,0.12)',
        };
    });

    return (
        <div className={`summary-ring-micro ${goodAtHigh ? 'is-positive' : 'is-alert'}`}>
            <div className="summary-ring-glow" />
            <svg className="summary-ring-svg" viewBox="0 0 220 220" preserveAspectRatio="xMidYMid meet">
                {segments.map((segment) => (
                    <line
                        key={segment.id}
                        x1={segment.x1}
                        y1={segment.y1}
                        x2={segment.x2}
                        y2={segment.y2}
                        stroke={segment.stroke}
                        strokeWidth="6.6"
                        strokeLinecap="round"
                        opacity={segment.active ? 1 : 0.7}
                    />
                ))}
            </svg>

            <div className="summary-ring-center">
                {symbol && <div className="summary-ring-inline-symbol">{symbol}</div>}
                <div className="summary-ring-value-line">
                    <span className="summary-ring-value">{data?.value}</span>
                </div>
                {trendText && <div className="summary-ring-trend summary-ring-trend-inline">{trendText}</div>}
            </div>
        </div>
    );
};

const buildTimeSeries = (points = []) => {
    const anchor = new Date();

    return points.map((point, index) => {
        const date = new Date(anchor);
        date.setDate(anchor.getDate() - (points.length - index - 1));
        return [date.toISOString(), point];
    });
};

const TrendLine = ({ data }) => {
    if (!data?.trendValue) {
        return null;
    }

    const direction = data?.trendDirection === 'down' ? 'down' : data?.trendDirection === 'flat' ? 'flat' : 'up';
    const arrow = direction === 'down' ? '↓' : direction === 'flat' ? '→' : '↑';
    const tone = data?.trendTone || 'positive';

    return (
        <div className={`metric-trend-inline ${tone}`}>
            <span>{arrow}</span>
            <span>{data.trendValue}</span>
            {data?.trendLabel && <span className="metric-trend-inline-label">{data.trendLabel}</span>}
        </div>
    );
};

const SparklineChart = ({ points = [], color = '#49d793' }) => {
    const seriesData = buildTimeSeries(points);

    const option = {
        animation: false,
        grid: { left: -12, right: -12, top: '26%', bottom: -12 },
        tooltip: {
            trigger: 'axis',
            axisPointer: { animation: false },
            backgroundColor: 'rgba(17, 24, 39, 0.82)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                const current = params?.[0];
                if (!current) {
                    return '';
                }

                const date = new Date(current.value[0]);
                return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} : ${current.value[1]}`;
            },
        },
        xAxis: {
            type: 'time',
            show: false,
            splitLine: { show: false },
        },
        yAxis: {
            type: 'value',
            show: false,
            boundaryGap: [0, '100%'],
            splitLine: { show: false },
        },
        series: [
            {
                type: 'line',
                showSymbol: false,
                smooth: true,
                data: seriesData,
                lineStyle: {
                    width: 3,
                    color,
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: `${color}66` },
                        { offset: 1, color: `${color}00` },
                    ]),
                },
            },
        ],
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export const MetricTrendMicro = ({ data }) => (
    <div className="metric-trend-micro">
        <div className="metric-trend-value-line">
            <span className="metric-trend-value">{data?.value}</span>
            {data?.unit && <span className="metric-trend-unit">{data.unit}</span>}
        </div>
        <TrendLine data={data} />
    </div>
);

const SignalScaleChart = ({ orientation = 'vertical', score = 50, goodAtHigh = true, colorRamp }) => {
    const segmentCount = 12;
    const palette = colorRamp || buildSignalPalette(goodAtHigh);
    const activeCount = Math.max(1, Math.round((Math.max(0, Math.min(score, 100)) / 100) * segmentCount));
    const data = palette.map((color, index) => ({
        value: 1,
        itemStyle: {
            color,
            opacity: index < activeCount ? 1 : 0.18,
            borderRadius: orientation === 'vertical' ? 4 : 999,
            shadowBlur: index < activeCount ? 12 : 0,
            shadowColor: index < activeCount ? color : 'transparent',
        },
    }));

    const option = orientation === 'vertical'
        ? {
            animation: false,
            grid: { left: 0, right: 0, top: 2, bottom: 2 },
            xAxis: {
                type: 'value',
                max: 1.1,
                show: false,
            },
            yAxis: {
                type: 'category',
                inverse: true,
                show: false,
                data: data.map((_, index) => index),
            },
            series: [
                {
                    type: 'bar',
                    data,
                    barWidth: 6,
                    showBackground: false,
                },
            ],
        }
        : {
            animation: false,
            grid: { left: 0, right: 0, top: 0, bottom: 0 },
            xAxis: {
                type: 'category',
                show: false,
                data: data.map((_, index) => index),
            },
            yAxis: {
                type: 'value',
                max: 1.1,
                show: false,
            },
            series: [
                {
                    type: 'bar',
                    data,
                    barWidth: 8,
                    barCategoryGap: '18%',
                    showBackground: false,
                },
            ],
        };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export const SignalScaleMicro = ({ data }) => {
    const orientation = data?.signalOrientation === 'horizontal' ? 'horizontal' : 'vertical';
    const score = Number.isFinite(data?.signalScore) ? data.signalScore : Number.parseFloat(data?.value) || 0;
    const goodAtHigh = data?.goodAtHigh !== false;
    const label = data?.signalLabel;
    const note = data?.signalNote;

    if (orientation === 'horizontal') {
        return (
            <div className="signal-scale-micro horizontal">
                <div className="signal-scale-horizontal-chart">
                    <SignalScaleChart orientation="horizontal" score={score} goodAtHigh={goodAtHigh} colorRamp={data?.signalPalette} />
                </div>
                <div className="signal-scale-horizontal-copy">
                    <div className="signal-scale-value-line">
                        <span className="signal-scale-value">{data?.value}</span>
                        {data?.unit && <span className="signal-scale-unit">{data.unit}</span>}
                    </div>
                    {label && <div className="signal-scale-label">{label}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="signal-scale-micro vertical">
            <div className="signal-scale-vertical">
                <div className="signal-scale-axis">
                    <span>100%</span>
                    <span>0%</span>
                </div>
                <div className="signal-scale-chart">
                    <SignalScaleChart orientation="vertical" score={score} goodAtHigh={goodAtHigh} colorRamp={data?.signalPalette} />
                </div>
            </div>
            <div className="signal-scale-side">
                <div className="signal-scale-value-line">
                    <span className="signal-scale-value">{data?.value}</span>
                    {data?.unit && <span className="signal-scale-unit">{data.unit}</span>}
                </div>
                {label && <div className="signal-scale-label">{label}</div>}
                {note && <div className="signal-scale-note">{note}</div>}
            </div>
        </div>
    );
};

export const GaugePanelMicro = ({ data }) => {
    const gaugeColor = data?.gaugeColor || resolveTone(data?.trendTone);
    const gaugeValue = Number.isFinite(data?.sliderValue) ? data.sliderValue : Number.parseFloat(data?.value) || 0;
    const gaugeUnit = data?.gaugeUnit || '%';

    const option = {
        animation: false,
        series: [
            {
                type: 'gauge',
                progress: {
                    show: true,
                    width: 14,
                    itemStyle: {
                        color: gaugeColor,
                    },
                },
                axisLine: {
                    lineStyle: {
                        width: 14,
                        color: [[1, 'rgba(255,255,255,0.12)']],
                    },
                },
                axisTick: {
                    show: false,
                },
                splitLine: {
                    length: 10,
                    lineStyle: {
                        width: 2,
                        color: 'rgba(255,255,255,0.28)',
                    },
                },
                axisLabel: {
                    show: false,
                },
                anchor: {
                    show: true,
                    showAbove: true,
                    size: 16,
                    itemStyle: {
                        color: gaugeColor,
                        borderWidth: 5,
                        borderColor: 'rgba(255,255,255,0.18)',
                    },
                },
                title: {
                    show: false,
                },
                detail: {
                    valueAnimation: true,
                    fontSize: 24,
                    color: '#fff',
                    offsetCenter: [0, '70%'],
                    formatter: (value) => `${Math.round(value)}${gaugeUnit}`,
                },
                data: [
                    {
                        value: gaugeValue,
                    },
                ],
            },
        ],
    };

    return (
        <div className="gauge-micro">
            <div className="gauge-micro-chart">
                <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
            </div>
        </div>
    );
};

export const SparklineStatMicro = ({ data }) => (
    <div className="sparkline-stat-micro">
        <div className="sparkline-stat-value-line">
            <span className="sparkline-stat-value">{data?.value}</span>
            {data?.unit && <span className="sparkline-stat-unit">{data.unit}</span>}
        </div>
        <div className="sparkline-stat-chart">
            <SparklineChart points={data?.dataPoints || []} color={data?.sparklineColor || resolveTone(data?.trendTone)} />
        </div>
    </div>
);

const defaultUptimeBars = [
    'good', 'good', 'good', 'good', 'good', 'good', 'good', 'good',
    'good', 'good', 'good', 'warn', 'good', 'good', 'good', 'good',
    'good', 'good', 'good', 'good', 'good', 'good', 'good', 'good',
    'good', 'good', 'good', 'good', 'good', 'good', 'warn', 'good',
    'good', 'good', 'good', 'down', 'good', 'good', 'good', 'good',
    'good', 'good', 'good', 'good', 'good', 'good', 'good', 'good',
];

export const UptimeStripMicro = ({ data }) => {
    const bars = Array.isArray(data?.uptimeBars) && data.uptimeBars.length ? data.uptimeBars : defaultUptimeBars;

    return (
        <div className="uptime-strip-micro">
            <div className="uptime-strip-value-line">
                <span className="uptime-strip-value">{data?.value}</span>
                {data?.unit && <span className="uptime-strip-unit">{data.unit}</span>}
            </div>
            <div className="uptime-strip-bars">
                {bars.map((status, index) => (
                    <span
                        key={`${status}-${index}`}
                        className={`uptime-strip-bar ${status}`}
                        style={{ height: '28px' }}
                    />
                ))}
            </div>
        </div>
    );
};

export { ArcSummaryMicro, RingSummaryMicro };
