import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const MarketSentimentRadar = ({ data }) => {
    const indicators = data?.indicator || [
        { name: 'Trust', max: 100 },
        { name: 'Innovation', max: 100 },
        { name: 'Price', max: 100 },
        { name: 'Service', max: 100 },
        { name: 'Quality', max: 100 },
    ];

    const radarSeries = data?.radarData || [
        {
            value: [90, 75, 60, 85, 80],
            name: 'Current Metric',
            symbol: 'none',
            itemStyle: { color: '#ec4899' },
            areaStyle: {
                color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                    { offset: 0, color: 'rgba(236, 72, 153, 0.1)' },
                    { offset: 1, color: 'rgba(236, 72, 153, 0.4)' },
                ]),
            },
            lineStyle: {
                width: 2,
                type: 'solid',
            },
        },
    ];

    const primarySeries = radarSeries[0] || { value: [] };
    const points = indicators.map((indicator, index) => {
        const rawValue = Number(primarySeries.value?.[index] ?? 0);
        const max = Number(indicator.max ?? 100) || 100;
        const ratio = max > 0 ? rawValue / max : 0;

        return {
            label: indicator.name,
            value: rawValue,
            max,
            ratio,
        };
    });

    const averageScore = points.length
        ? Math.round(points.reduce((sum, point) => sum + (point.ratio * 100), 0) / points.length)
        : 0;
    const strongest = points.reduce((best, point) => (!best || point.ratio > best.ratio ? point : best), null);
    const weakest = points.reduce((best, point) => (!best || point.ratio < best.ratio ? point : best), null);

    const option = {
        animationDuration: 900,
        radar: {
            indicator: indicators,
            shape: 'circle',
            radius: '60%',
            center: ['50%', '50%'],
            splitNumber: 4,
            splitArea: {
                show: false,
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.08)',
                },
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.12)',
                },
            },
            name: {
                formatter: (value) => value.toUpperCase(),
                textStyle: {
                    color: 'rgba(255,255,255,0.46)',
                    fontSize: 9,
                    fontWeight: 600,
                },
            },
        },
        tooltip: {
            backgroundColor: 'rgba(10, 10, 10, 0.95)',
            borderColor: 'rgba(255,255,255,0.08)',
            textStyle: { color: '#fff' },
        },
        series: [
            {
                name: primarySeries.name || 'Sentiment',
                type: 'radar',
                symbol: 'circle',
                symbolSize: 5,
                data: [
                    {
                        ...primarySeries,
                        lineStyle: {
                            width: 2,
                            color: primarySeries.itemStyle?.color || '#ec4899',
                        },
                        itemStyle: {
                            color: primarySeries.itemStyle?.color || '#ec4899',
                            borderColor: '#050505',
                            borderWidth: 1.5,
                        },
                        areaStyle: primarySeries.areaStyle || {
                            color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                                { offset: 0, color: 'rgba(236, 72, 153, 0.12)' },
                                { offset: 1, color: 'rgba(236, 72, 153, 0.36)' },
                            ]),
                        },
                    },
                ],
            },
        ],
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', alignItems: 'stretch', width: '100%', height: '100%', minHeight: 0 }}>
            <div style={{ minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                <ReactECharts
                    option={option}
                    style={{ height: '100%', width: '100%', minHeight: 0 }}
                    notMerge={true}
                    opts={{ renderer: 'svg' }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, minHeight: 0, height: '100%', padding: '2px 0 2px 4px' }}>
                <div style={{ paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Composite
                    </div>
                    <div style={{ color: '#fff', fontSize: '24px', fontWeight: 700, lineHeight: 1 }}>{clamp(averageScore, 0, 100)}</div>
                    <div style={{ color: '#47e59a', fontSize: '10px', fontWeight: 700, marginTop: '4px' }}>
                        {strongest ? `${strongest.label} leads` : 'Stable mix'}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.32)', fontSize: '9px', marginTop: '2px' }}>
                        {weakest ? `${weakest.label} trails` : 'No weak spot'}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, minHeight: 0 }}>
                    {points.map((point) => (
                        <div
                            key={point.label}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1fr) auto',
                                gap: '10px',
                                alignItems: 'center',
                                paddingBottom: '5px',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                            }}
                        >
                            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {point.label}
                            </span>
                            <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>
                                {Math.round(point.value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MarketSentimentRadar;
