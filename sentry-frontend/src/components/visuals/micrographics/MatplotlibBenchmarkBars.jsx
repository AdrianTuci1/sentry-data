import React from 'react';

const defaultBenchmarks = [
    { label: 'MMLU', score: 73.2, target: 72, delta: '+1.1' },
    { label: 'GSM8K', score: 61.8, target: 60, delta: '+2.8' },
    { label: 'TruthfulQA', score: 54.4, target: 56, delta: '-1.2' },
    { label: 'CodeEval', score: 48.6, target: 47, delta: '+0.9' },
];

const toFiniteNumber = (value, fallback = 0) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : fallback;
    }

    if (typeof value === 'string') {
        const numericValue = Number(value.trim());
        return Number.isFinite(numericValue) ? numericValue : fallback;
    }

    return fallback;
};

const coerceArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (Array.isArray(value?.items)) {
        return value.items;
    }

    if (Array.isArray(value?.values)) {
        return value.values;
    }

    if (value && typeof value === 'object') {
        return [value];
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }

        try {
            const parsed = JSON.parse(trimmed);
            return coerceArray(parsed);
        } catch {
            return trimmed
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
                .map((entry, index) => ({ label: `Benchmark ${index + 1}`, value: entry }));
        }
    }

    return [];
};

const normalizeDelta = (value, score, target) => {
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }

    const difference = score - target;
    if (!Number.isFinite(difference) || difference === 0) {
        return '0.0';
    }

    return `${difference >= 0 ? '+' : ''}${difference.toFixed(1)}`;
};

const normalizeBenchmarks = (value) => {
    const normalized = coerceArray(value)
        .map((entry, index) => {
            const score = toFiniteNumber(entry?.score ?? entry?.value ?? entry?.metric, NaN);
            if (!Number.isFinite(score)) {
                return null;
            }

            const target = toFiniteNumber(entry?.target ?? entry?.goal ?? entry?.threshold, score);
            return {
                label: entry?.label || entry?.name || entry?.benchmark || `Benchmark ${index + 1}`,
                score,
                target,
                delta: normalizeDelta(entry?.delta, score, target),
            };
        })
        .filter(Boolean);

    return normalized.length > 0 ? normalized : defaultBenchmarks;
};

const MatplotlibBenchmarkBars = ({ data = {} }) => {
    const benchmarks = normalizeBenchmarks(data.benchmarks);
    const passed = benchmarks.filter((item) => item.score >= item.target).length;

    return (
        <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.95rem', color: '#f4f5f8', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                    <div style={{ fontSize: '0.92rem', lineHeight: 1.1, color: 'rgba(255, 255, 255, 0.86)' }}>{data.title || 'Eval Guardrails'}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.35rem' }}>
                        <span style={{ fontSize: 'clamp(1.8rem, 3.1vw, 2.7rem)', lineHeight: 0.95, letterSpacing: '-0.09em', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {passed}/{benchmarks.length}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#27f4a2' }}>ready for promote</span>
                    </div>
                    <div style={{ marginTop: '0.4rem', fontSize: '0.74rem', color: 'rgba(162, 160, 175, 0.72)' }}>
                        Threshold markers show the minimum score for checkpoint promotion.
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '0.8rem', marginTop: '0.1rem' }}>
                {benchmarks.map((item) => (
                    <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '3.8rem minmax(0, 1fr) auto', alignItems: 'center', columnGap: '0.8rem' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.05em', color: 'rgba(255, 255, 255, 0.92)' }}>{item.label}</span>
                        <div style={{ position: 'relative', height: '0.78rem', borderRadius: '0.1rem', background: '#252325', overflow: 'hidden' }}>
                            <span
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: `${item.score}%`,
                                    background: 'linear-gradient(90deg, #35C9FF 0%, #7BD3FF 100%)',
                                }}
                            />
                            <span
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: `${item.target}%`,
                                    width: '0.11rem',
                                    height: '0.62rem',
                                    borderRadius: '999px',
                                    background: '#fff11f',
                                    transform: 'translate(-50%, -50%)',
                                }}
                            />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 700 }}>{item.score.toFixed(1)}</div>
                            <div style={{ color: String(item.delta).startsWith('-') ? '#ff7c7c' : '#27f4a2', fontSize: '0.68rem', fontWeight: 700 }}>{item.delta}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MatplotlibBenchmarkBars;
