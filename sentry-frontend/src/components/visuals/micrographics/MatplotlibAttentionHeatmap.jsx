import React from 'react';

const defaultXLabels = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'];
const defaultYLabels = ['L0', 'L8', 'L16', 'L24', 'L32', 'L40'];
const defaultMatrix = [
    [0.19, 0.24, 0.28, 0.32, 0.36, 0.39],
    [0.22, 0.26, 0.31, 0.37, 0.44, 0.48],
    [0.24, 0.3, 0.35, 0.42, 0.49, 0.53],
    [0.21, 0.28, 0.34, 0.46, 0.55, 0.62],
    [0.18, 0.24, 0.33, 0.41, 0.52, 0.65],
    [0.14, 0.18, 0.25, 0.34, 0.45, 0.58],
];

const MatplotlibAttentionHeatmap = ({ data = {} }) => {
    const xLabels = data.xLabels || defaultXLabels;
    const yLabels = data.yLabels || defaultYLabels;
    const matrix = data.matrix || defaultMatrix;
    const maxValue = Math.max(...matrix.flat(), 0.7);
    const sideNotes = data.sideNotes || [
        { label: 'drift peak', value: 'L32 / B6' },
        { label: 'memory headroom', value: '14%' },
        { label: 'seq len', value: '8,192' },
    ];
    const strongestLayerIndex = matrix.reduce((bestIndex, row, index, rows) => {
        const rowMax = Math.max(...row);
        const bestMax = Math.max(...rows[bestIndex]);
        return rowMax > bestMax ? index : bestIndex;
    }, 0);
    const strongestLayer = yLabels[strongestLayerIndex];
    const average = matrix.flat().reduce((sum, value) => sum + value, 0) / matrix.flat().length;
    const getCellColor = (value) => {
        const ratio = maxValue > 0 ? value / maxValue : 0;
        if (ratio > 0.82) return '#fff11f';
        if (ratio > 0.62) return '#6ef0a8';
        if (ratio > 0.42) return '#22d3ee';
        if (ratio > 0.24) return '#2563eb';
        return '#111827';
    };

    return (
        <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(220px, 0.65fr)', gap: '18px', color: '#f4f5f8' }}>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                    <div style={{ fontSize: '0.92rem', lineHeight: 1.1, color: 'rgba(255, 255, 255, 0.86)' }}>{data.title || 'Attention Drift'}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.35rem' }}>
                        <span style={{ fontSize: 'clamp(1.8rem, 3.1vw, 2.7rem)', lineHeight: 0.95, letterSpacing: '-0.09em', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {average.toFixed(2)}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#27f4a2' }}>{strongestLayer} most active</span>
                    </div>
                    <div style={{ marginTop: '0.4rem', fontSize: '0.74rem', color: 'rgba(162, 160, 175, 0.72)' }}>
                        Drift intensity by layer and block during finetune.
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: `3.2rem repeat(${xLabels.length}, minmax(0, 1fr))`, gap: '0.38rem', alignItems: 'stretch', minHeight: 0 }}>
                    <div />
                    {xLabels.map((label) => (
                        <div key={label} style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)', textAlign: 'center' }}>{label}</div>
                    ))}
                    {matrix.map((row, rowIndex) => (
                        <React.Fragment key={yLabels[rowIndex]}>
                            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.92)' }}>
                                {yLabels[rowIndex]}
                            </div>
                            {row.map((value, columnIndex) => (
                                <div
                                    key={`${rowIndex}-${columnIndex}`}
                                    style={{
                                        minHeight: '42px',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: getCellColor(value),
                                        color: value / maxValue > 0.72 ? '#091014' : '#f7f8fc',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                                    }}
                                >
                                    {value.toFixed(2)}
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '0.8rem', minWidth: 0 }}>
                {sideNotes.map((note) => (
                    <div key={note.label} style={{ paddingBottom: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)' }}>{note.label}</div>
                        <div style={{ color: '#fff', fontSize: '1.15rem', fontWeight: 700, lineHeight: 1, marginTop: '0.45rem' }}>{note.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MatplotlibAttentionHeatmap;
