import React from 'react';
import ReactECharts from 'echarts-for-react';

const compactCurrency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
});

const fullCurrency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});

const AttributionModels = ({ data }) => {
    const allocations = Array.isArray(data?.models) ? data.models : [];
    const monthlySeries = allocations.map((row) => ({
        name: row.channel,
        value: row.monthly ?? 0,
        itemStyle: { color: row.monthlyColor || '#FFC533' },
    }));
    const yearlySeries = allocations.map((row) => ({
        name: row.channel,
        value: row.yearly ?? row.budget ?? 0,
        itemStyle: { color: row.yearlyColor || '#35C9FF' },
    }));
    const frameSegments = new Array(10).fill(null).map((_, index) => ({
        name: `frame-${index}`,
        value: 1,
        itemStyle: {
            color: index % 2 === 0 ? 'rgba(157, 152, 164, 0.84)' : 'rgba(120, 117, 128, 0.78)',
        },
        label: { show: false },
        tooltip: { show: false },
    }));
    const periodMetrics = data?.periodMetrics || [];
    const totalMonthly = monthlySeries.reduce((sum, row) => sum + row.value, 0);
    const totalYearly = yearlySeries.reduce((sum, row) => sum + row.value, 0);
    const summaryValue = data?.summaryValue || compactCurrency.format(totalMonthly);
    const summaryLabel = data?.summaryLabel || 'Monthly Budget';
    const footerMetrics = data?.footerMetrics || [];
    const listRows = allocations.map((row) => ({
        label: row.channel,
        value: row.yearly ?? row.budget ?? 0,
    }));

    const option = {
        animation: true,
        animationDuration: 900,
        animationEasing: 'cubicOut',
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(17, 24, 39, 0.92)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            textStyle: { color: '#fff' },
            formatter: ({ seriesName, name, value, percent }) => `${seriesName}<br/>${name}: ${fullCurrency.format(value)} · ${percent}%`,
        },
        series: [
            {
                name: 'Frame',
                type: 'pie',
                radius: ['74%', '86%'],
                center: ['42%', '45%'],
                startAngle: 110,
                clockwise: false,
                avoidLabelOverlap: true,
                padAngle: 2,
                itemStyle: {
                    borderColor: '#0a0a0a',
                    borderWidth: 4,
                    borderRadius: 8,
                },
                label: { show: false },
                labelLine: { show: false },
                silent: true,
                data: frameSegments,
            },
            {
                name: 'Yearly',
                type: 'pie',
                radius: ['52%', '70%'],
                center: ['42%', '45%'],
                startAngle: 110,
                clockwise: false,
                avoidLabelOverlap: true,
                padAngle: 2,
                itemStyle: {
                    borderColor: '#0a0a0a',
                    borderWidth: 4,
                    borderRadius: 8,
                },
                label: { show: false },
                labelLine: { show: false },
                data: yearlySeries,
            },
            {
                name: 'Monthly',
                type: 'pie',
                radius: ['31%', '48%'],
                center: ['42%', '45%'],
                startAngle: 110,
                clockwise: false,
                avoidLabelOverlap: true,
                padAngle: 2,
                itemStyle: {
                    borderColor: '#0a0a0a',
                    borderWidth: 4,
                    borderRadius: 8,
                },
                label: { show: false },
                labelLine: { show: false },
                data: monthlySeries,
            },
        ],
        graphic: [
            {
                type: 'text',
                left: '42%',
                top: '38%',
                style: {
                    text: summaryValue,
                    fill: '#fff',
                    fontSize: 22,
                    fontWeight: 700,
                    textAlign: 'center',
                    textVerticalAlign: 'middle',
                },
            },
            {
                type: 'text',
                left: '42%',
                top: '45%',
                style: {
                    text: summaryLabel.toUpperCase(),
                    fill: 'rgba(255,255,255,0.38)',
                    fontSize: 10,
                    fontWeight: 600,
                    textAlign: 'center',
                    textVerticalAlign: 'middle',
                    letterSpacing: 2,
                },
            },
        ],
    };

    return (
        <div style={{ height: '100%', width: '100%', display: 'grid', gridTemplateColumns: 'minmax(320px, 1.05fr) minmax(240px, 0.95fr)', gridTemplateRows: 'auto 1fr auto', gap: '16px', alignItems: 'stretch' }}>
            <div style={{ gridColumn: '1 / 2', gridRow: '1 / 3', minHeight: '360px' }}>
                <ReactECharts
                    option={option}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>

            <div style={{ gridColumn: '2 / 3', gridRow: '1 / 2', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' }}>
                {(periodMetrics.length ? periodMetrics : [
                    { label: 'Monthly', value: compactCurrency.format(totalMonthly), delta: '+19.6%', note: `${compactCurrency.format(totalMonthly * 0.82)} baseline`, tone: '#7CFF5B' },
                    { label: 'Yearly', value: compactCurrency.format(totalYearly), delta: '+2.5%', note: `${compactCurrency.format(totalYearly * 0.96)} baseline`, tone: '#FFC533' },
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
                        <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.label}
                        </span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{fullCurrency.format(row.value)}</span>
                    </div>
                ))}
            </div>

            {footerMetrics.length > 0 && (
                <div style={{ gridColumn: '1 / 3', gridRow: '3 / 4', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px', paddingTop: '8px' }}>
                    {footerMetrics.map((metric) => (
                        <div key={metric.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '52px', height: '52px', borderRadius: '18px', background: metric.iconBg || 'linear-gradient(180deg, #5b47e8 0%, #4338ca 100%)', boxShadow: '0 12px 28px rgba(0,0,0,0.28)' }} />
                            <div>
                                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', marginBottom: '2px' }}>{metric.label}</div>
                                <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{metric.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AttributionModels;
