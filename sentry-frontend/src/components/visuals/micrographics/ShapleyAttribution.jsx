import React from 'react';
import ReactECharts from 'echarts-for-react';

const COLORS = {
    Direct: '#7CFF5B',
    Meta: '#35C9FF',
    Email: '#8B5CF6',
    Referral: '#FF4D8D',
    Search: '#7A7F87',
};

const fallbackPalette = ['#7CFF5B', '#35C9FF', '#8B5CF6', '#FF4D8D', '#7A7F87', '#FFC533'];

const numberFormat = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
});

const buildPeriods = (rawData, channels) => {
    const groupedByYear = new Map();

    rawData.forEach(([channel, score, year]) => {
        if (!groupedByYear.has(year)) {
            groupedByYear.set(year, new Map());
        }

        const yearMap = groupedByYear.get(year);

        if (!yearMap.has(channel)) {
            yearMap.set(channel, []);
        }

        yearMap.get(channel).push(Number(score) || 0);
    });

    const periods = [];

    Array.from(groupedByYear.keys())
        .sort((left, right) => left - right)
        .forEach((year) => {
            const yearMap = groupedByYear.get(year);
            const sampleCount = Math.max(
                ...channels.map((channel) => yearMap.get(channel)?.length || 0),
                0,
            );

            for (let index = 0; index < sampleCount; index += 1) {
                const values = {};

                channels.forEach((channel) => {
                    values[channel] = yearMap.get(channel)?.[index] ?? 0;
                });

                periods.push({
                    label: `${String(year).slice(-2)}.${index + 1}`,
                    year,
                    slot: index + 1,
                    values,
                    total: channels.reduce((sum, channel) => sum + values[channel], 0),
                });
            }
        });

    return periods;
};

const formatScore = (value) => `${numberFormat.format(value)} pts`;

const ShapleyAttribution = ({ data: componentData }) => {
    const rawData = Array.isArray(componentData?.rawData) ? componentData.rawData : [];
    const channels = Array.from(new Set(rawData.map(([channel]) => channel)));
    const periods = buildPeriods(rawData, channels);

    const rows = channels
        .map((channel, index) => {
            const values = periods.map((period) => period.values[channel] ?? 0);
            const latest = values.at(-1) ?? 0;
            const average = values.length
                ? values.reduce((sum, value) => sum + value, 0) / values.length
                : 0;
            const total = values.reduce((sum, value) => sum + value, 0);

            return {
                channel,
                latest,
                average,
                total,
                color: COLORS[channel] || fallbackPalette[index % fallbackPalette.length],
            };
        })
        .sort((left, right) => right.total - left.total);

    const totalByPeriod = periods.map((period) => period.total);
    const maxTotal = Math.max(...totalByPeriod, 0);
    const latestTotal = totalByPeriod.at(-1) ?? 0;
    const averageTotal = totalByPeriod.length
        ? totalByPeriod.reduce((sum, value) => sum + value, 0) / totalByPeriod.length
        : 0;
    const cumulativeTotal = rows.reduce((sum, row) => sum + row.total, 0);
    const leader = rows[0];
    const peakPeriod = periods.reduce((best, period) => (
        !best || period.total > best.total ? period : best
    ), null);
    const deltaFromAverage = averageTotal > 0
        ? ((latestTotal - averageTotal) / averageTotal) * 100
        : 0;
    const chartChannels = rows.map((row) => row.channel);

    const metrics = [
        {
            label: 'Latest',
            value: formatScore(latestTotal),
            accent: '#7CFF5B',
            delta: `${deltaFromAverage >= 0 ? '+' : ''}${numberFormat.format(deltaFromAverage)}%`,
            note: `vs ${formatScore(averageTotal)} average`,
        },
        {
            label: 'Top Avg',
            value: leader ? formatScore(leader.average) : '0 pts',
            accent: leader?.color || '#35C9FF',
            delta: leader ? leader.channel : 'N/A',
            note: 'strongest channel',
        },
        {
            label: 'Cumulative',
            value: formatScore(cumulativeTotal),
            accent: '#FFC533',
            delta: peakPeriod ? peakPeriod.label : 'N/A',
            note: 'best stacked period',
        },
    ];

    const option = {
        animation: true,
        animationDuration: 800,
        animationEasing: 'cubicOut',
        grid: {
            top: 10,
            right: 12,
            bottom: 34,
            left: 12,
            containLabel: false,
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow',
                shadowStyle: { color: 'rgba(255,255,255,0.04)' },
            },
            backgroundColor: 'rgba(10, 10, 10, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                const [background, ...bars] = params;
                const period = periods[background?.dataIndex ?? 0];

                const lines = bars
                    .slice()
                    .reverse()
                    .filter((entry) => entry.value > 0)
                    .map((entry) => {
                        const color = entry.color || '#fff';
                        return `<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:2px;"><span style="display:flex; align-items:center; gap:8px;"><span style="width:8px; height:8px; border-radius:50%; background:${color};"></span>${entry.seriesName}</span><strong>${formatScore(entry.value)}</strong></div>`;
                    })
                    .join('');

                return `
                    <div style="padding:2px 4px; min-width:180px;">
                        <div style="font-weight:700; margin-bottom:4px;">Period ${period?.label || ''}</div>
                        <div style="font-size:11px; color:rgba(255,255,255,0.68); margin-bottom:6px;">Total ${formatScore(period?.total || 0)}</div>
                        ${lines}
                    </div>
                `;
            },
        },
        xAxis: {
            type: 'category',
            data: periods.map((period) => period.label),
            axisTick: { show: false },
            axisLine: {
                lineStyle: { color: 'rgba(255,255,255,0.08)' },
            },
            axisLabel: {
                color: 'rgba(255,255,255,0.48)',
                fontSize: 10,
                margin: 10,
            },
        },
        yAxis: {
            type: 'value',
            show: false,
            max: maxTotal > 0 ? maxTotal * 1.12 : 100,
        },
        series: [
            {
                name: 'Track',
                type: 'bar',
                silent: true,
                barWidth: 18,
                barGap: '-100%',
                data: periods.map(() => maxTotal * 1.05),
                itemStyle: {
                    color: 'rgba(255,255,255,0.07)',
                    borderRadius: 10,
                },
                z: 0,
                tooltip: { show: false },
            },
            ...chartChannels.map((channel, index) => {
                const color = COLORS[channel] || fallbackPalette[index % fallbackPalette.length];

                return {
                    name: channel,
                    type: 'bar',
                    stack: 'mix',
                    barWidth: 18,
                    data: periods.map((period) => ({
                        value: period.values[channel] ?? 0,
                        itemStyle: {
                            color,
                            borderColor: '#070707',
                            borderWidth: 3,
                            borderRadius: 8,
                            shadowBlur: 18,
                            shadowColor: `${color}55`,
                        },
                    })),
                    emphasis: { focus: 'series' },
                    z: 2,
                };
            }),
        ],
    };

    return (
        <div style={{ display: 'grid', gridTemplateRows: 'auto 220px auto', gap: '18px', height: '100%', minHeight: '430px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
                {metrics.map((metric) => (
                    <div key={metric.label}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                            <span
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: metric.accent,
                                    boxShadow: `0 0 18px ${metric.accent}55`,
                                    flexShrink: 0,
                                }}
                            />
                            <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', fontWeight: 600 }}>{metric.label}</span>
                        </div>
                        <div style={{ color: '#fff', fontSize: '28px', fontWeight: 700, lineHeight: 1.05 }}>{metric.value}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                            <span style={{ color: '#47e59a', fontSize: '11px', fontWeight: 700 }}>{metric.delta}</span>
                            <span style={{ color: 'rgba(255,255,255,0.34)', fontSize: '11px' }}>{metric.note}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ minHeight: 0 }}>
                <ReactECharts
                    option={option}
                    style={{ height: '100%', width: '100%' }}
                    notMerge={true}
                    opts={{ renderer: 'svg' }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', gap: '12px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Channel</span>
                    <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'right' }}>Latest</span>
                    <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'right' }}>Avg</span>
                    <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'right' }}>Total</span>
                </div>

                {rows.map((row) => (
                    <div
                        key={row.channel}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
                            gap: '12px',
                            alignItems: 'center',
                            padding: '9px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                            <span
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: row.color,
                                    boxShadow: `0 0 14px ${row.color}55`,
                                    flexShrink: 0,
                                }}
                            />
                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {row.channel}
                            </span>
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.84)', fontSize: '13px', textAlign: 'right' }}>{numberFormat.format(row.latest)}</span>
                        <span style={{ color: 'rgba(255,255,255,0.84)', fontSize: '13px', textAlign: 'right' }}>{numberFormat.format(row.average)}</span>
                        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700, textAlign: 'right' }}>{numberFormat.format(row.total)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ShapleyAttribution;
