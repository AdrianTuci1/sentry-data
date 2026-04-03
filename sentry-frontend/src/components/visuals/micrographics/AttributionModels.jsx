import React from 'react';
import ReactECharts from 'echarts-for-react';

const formatMetricValue = (value, options = {}) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    if (typeof value === 'string') {
        return value;
    }

    const {
        format = 'currency',
        currency = 'USD',
        compact = format === 'currency' || format === 'compact-number',
        maximumFractionDigits,
        minimumFractionDigits,
        prefix = '',
        suffix = '',
    } = options;

    let formatterOptions;

    switch (format) {
    case 'number':
        formatterOptions = {
            style: 'decimal',
            notation: compact ? 'compact' : 'standard',
            maximumFractionDigits: maximumFractionDigits ?? (compact ? 1 : 0),
            minimumFractionDigits,
        };
        break;
    case 'compact-number':
        formatterOptions = {
            style: 'decimal',
            notation: 'compact',
            maximumFractionDigits: maximumFractionDigits ?? 1,
            minimumFractionDigits,
        };
        break;
    case 'percent':
        formatterOptions = {
            style: 'percent',
            maximumFractionDigits: maximumFractionDigits ?? 1,
            minimumFractionDigits,
        };
        break;
    case 'currency':
    default:
        formatterOptions = {
            style: 'currency',
            currency,
            notation: compact ? 'compact' : 'standard',
            maximumFractionDigits: maximumFractionDigits ?? (compact ? 1 : 0),
            minimumFractionDigits,
        };
        break;
    }

    return `${prefix}${new Intl.NumberFormat('en-US', formatterOptions).format(value)}${suffix}`;
};

const AttributionModels = ({ data }) => {
    const allocations = Array.isArray(data?.models) ? data.models : [];
    const primaryMetricLabel = data?.primaryMetricLabel || 'yearly';
    const secondaryMetricLabel = data?.secondaryMetricLabel || 'monthly';
    const valueFormat = {
        format: data?.valueFormat || 'currency',
        currency: data?.valueCurrency || 'USD',
        compact: data?.valueCompact ?? true,
        maximumFractionDigits: data?.valueMaximumFractionDigits,
        minimumFractionDigits: data?.valueMinimumFractionDigits,
        prefix: data?.valuePrefix || '',
        suffix: data?.valueSuffix || '',
    };
    const tooltipValueFormat = {
        ...valueFormat,
        compact: false,
    };
    const secondaryValueFormat = {
        format: data?.secondaryValueFormat || valueFormat.format,
        currency: data?.secondaryValueCurrency || valueFormat.currency,
        compact: data?.secondaryValueCompact ?? valueFormat.compact,
        maximumFractionDigits: data?.secondaryValueMaximumFractionDigits ?? valueFormat.maximumFractionDigits,
        minimumFractionDigits: data?.secondaryValueMinimumFractionDigits ?? valueFormat.minimumFractionDigits,
        prefix: data?.secondaryValuePrefix || valueFormat.prefix,
        suffix: data?.secondaryValueSuffix || valueFormat.suffix,
    };
    const seriesData = allocations.map((row) => ({
        name: row.channel,
        value: row.yearly ?? row.budget ?? 0,
        monthly: row.monthly ?? 0,
        itemStyle: { color: row.yearlyColor || row.monthlyColor || '#35C9FF' },
    }));
    const periodMetrics = data?.periodMetrics || [];
    const totalMonthly = allocations.reduce((sum, row) => sum + (row.monthly ?? 0), 0);
    const totalYearly = allocations.reduce((sum, row) => sum + (row.yearly ?? row.budget ?? 0), 0);
    const summaryValue = data?.summaryValue || formatMetricValue(totalMonthly, secondaryValueFormat);
    const summaryLabel = data?.summaryLabel || 'Monthly Budget';
    const listRows = allocations.map((row) => ({
        label: row.channel,
        value: row.yearly ?? row.budget ?? 0,
        monthly: row.monthly ?? 0,
        color: row.yearlyColor || row.monthlyColor || '#35C9FF',
    }));

    const option = {
        animation: true,
        animationDuration: 700,
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(17, 24, 39, 0.92)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            textStyle: { color: '#fff' },
            formatter: ({ name, value, percent }) => `${name}<br/>${formatMetricValue(value, tooltipValueFormat)} ${primaryMetricLabel} · ${percent}%`,
        },
        title: {
            text: summaryValue,
            subtext: summaryLabel.toUpperCase(),
            left: 'center',
            top: '37%',
            textStyle: {
                color: '#fff',
                fontSize: 26,
                fontWeight: 700,
            },
            subtextStyle: {
                color: 'rgba(255,255,255,0.42)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 2,
            },
            itemGap: 8,
        },
        series: [
            {
                name: data?.seriesName || 'Channel Mix',
                type: 'pie',
                radius: ['56%', '77%'],
                center: ['50%', '48%'],
                startAngle: 90,
                itemStyle: {
                    borderColor: '#09090a',
                    borderWidth: 5,
                    borderRadius: 16,
                },
                label: { show: false },
                labelLine: { show: false },
                data: seriesData,
            },
        ],
    };

    return (
        <div style={{ height: '100%', width: '100%', display: 'grid', gridTemplateColumns: 'minmax(320px, 1.02fr) minmax(240px, 0.98fr)', gridTemplateRows: 'auto 1fr', gap: '16px', alignItems: 'stretch' }}>
            <div style={{ gridColumn: '1 / 2', gridRow: '1 / 3', minHeight: '360px' }}>
                <ReactECharts
                    option={option}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>

            <div style={{ gridColumn: '2 / 3', gridRow: '1 / 2', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' }}>
                {(periodMetrics.length ? periodMetrics : [
                    { label: secondaryMetricLabel, value: formatMetricValue(totalMonthly, secondaryValueFormat), delta: '+19.6%', note: `${formatMetricValue(totalMonthly * 0.82, secondaryValueFormat)} baseline`, tone: '#7CFF5B' },
                    { label: primaryMetricLabel, value: formatMetricValue(totalYearly, valueFormat), delta: '+2.5%', note: `${formatMetricValue(totalYearly * 0.96, valueFormat)} baseline`, tone: '#FFC533' },
                ]).map((metric) => (
                    <div key={metric.label}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: metric.tone || '#7CFF5B', boxShadow: `0 0 18px ${metric.tone || '#7CFF5B'}55` }} />
                            <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: '12px', fontWeight: 500 }}>{metric.label}</span>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{metric.value}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                            <span style={{ color: '#47e59a', fontSize: '11px', fontWeight: 700 }}>{metric.delta}</span>
                            <span style={{ color: 'rgba(255,255,255,0.34)', fontSize: '11px' }}>{metric.note}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ gridColumn: '2 / 3', gridRow: '2 / 3', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                {listRows.map((row, index) => (
                    <div
                        key={row.label}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            gap: '12px',
                            alignItems: 'center',
                            padding: '12px 0',
                            borderBottom: index === listRows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: row.color, boxShadow: `0 0 14px ${row.color}55`, flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {row.label}
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.32)', marginTop: '3px' }}>
                                    {`${formatMetricValue(row.monthly, secondaryValueFormat)} ${secondaryMetricLabel}`.trim()}
                                </div>
                            </div>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{formatMetricValue(row.value, tooltipValueFormat)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AttributionModels;
