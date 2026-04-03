import React from 'react';

const FinancialBreakdown = ({ data }) => {
    const steps = data?.steps || [];
    const totalPositive = steps.filter((step) => (step.value || 0) > 0).reduce((sum, step) => sum + step.value, 0);
    const totalNegative = Math.abs(steps.filter((step) => (step.value || 0) < 0).reduce((sum, step) => sum + step.value, 0));
    const netValue = steps.find((step) => step.isTotal)?.value || (totalPositive - totalNegative);
    const maxAbs = Math.max(...steps.map((step) => Math.abs(step.isTotal ? netValue : (step.value || 0))), 1);
    const segmentCount = 9;
    const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);

    return (
        <div style={{
            height: '100%',
            width: '100%',
            padding: '6px 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
        }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '18px' }}>
                {[
                    { label: 'Gross', value: formatCurrency(totalPositive), note: 'Top-line inflow', color: '#7CFF5B' },
                    { label: 'Costs', value: formatCurrency(totalNegative), note: 'COGS + spend + OpEx', color: '#FF8373' },
                    { label: 'Net', value: formatCurrency(netValue), note: 'Remaining contribution', color: '#35C9FF' },
                ].map((metric) => (
                    <div key={metric.label}>
                        <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>{metric.label}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ color: '#fff', fontSize: '22px', fontWeight: 700, lineHeight: 1 }}>{metric.value}</span>
                            <span style={{ color: metric.color, fontSize: '11px', fontWeight: 700 }}>bridge</span>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.34)', fontSize: '11px' }}>{metric.note}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '2px' }}>
                {steps.map((step, index) => {
                    const rawValue = step.isTotal ? netValue : (step.value || 0);
                    const fillCount = Math.max(1, Math.round((Math.abs(rawValue) / maxAbs) * segmentCount));
                    const tint = step.isTotal ? '#7CFF5B' : rawValue >= 0 ? '#35C9FF' : '#FF8373';
                    const shadow = step.isTotal ? '0 0 24px rgba(124,255,91,0.32)' : rawValue >= 0 ? '0 0 18px rgba(53,201,255,0.2)' : '0 0 18px rgba(255,131,115,0.18)';

                    return (
                        <div key={`${step.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1.2fr) minmax(0, 6fr) auto', gap: '12px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.name}</span>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))`, gap: '4px' }}>
                                {Array.from({ length: segmentCount }).map((_, segmentIndex) => (
                                    <span
                                        key={segmentIndex}
                                        style={{
                                            height: '10px',
                                            borderRadius: '999px',
                                            background: segmentIndex < fillCount ? tint : 'rgba(255,255,255,0.22)',
                                            boxShadow: segmentIndex < fillCount ? shadow : 'none',
                                            opacity: segmentIndex < fillCount ? 1 : 0.34,
                                        }}
                                    />
                                ))}
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                                {rawValue < 0 ? '-' : ''}
                                {formatCurrency(Math.abs(rawValue))}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FinancialBreakdown;
