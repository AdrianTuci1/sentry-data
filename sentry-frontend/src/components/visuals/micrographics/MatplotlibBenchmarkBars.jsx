import React from 'react';

const defaultBenchmarks = [
    { label: 'MMLU', score: 73.2, target: 72, delta: '+1.1' },
    { label: 'GSM8K', score: 61.8, target: 60, delta: '+2.8' },
    { label: 'TruthfulQA', score: 54.4, target: 56, delta: '-1.2' },
    { label: 'CodeEval', score: 48.6, target: 47, delta: '+0.9' },
];

const MatplotlibBenchmarkBars = ({ data = {} }) => {
    const benchmarks = data.benchmarks || defaultBenchmarks;
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
                            <div style={{ color: item.delta.startsWith('-') ? '#ff7c7c' : '#27f4a2', fontSize: '0.68rem', fontWeight: 700 }}>{item.delta}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MatplotlibBenchmarkBars;
