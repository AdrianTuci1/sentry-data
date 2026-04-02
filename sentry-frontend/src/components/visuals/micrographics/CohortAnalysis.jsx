import React from 'react';

const CohortAnalysis = ({ data }) => {
    const cohorts = data?.cohorts || [];

    const getIntensity = (val) => {
        if (val === 100) return 'rgba(59, 130, 246, 0.9)';
        if (val > 80) return 'rgba(59, 130, 246, 0.7)';
        if (val > 70) return 'rgba(59, 130, 246, 0.5)';
        if (val > 60) return 'rgba(59, 130, 246, 0.4)';
        return 'rgba(59, 130, 246, 0.2)';
    };

    return (
        <div className="cohort-container" style={{
            padding: '10px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            fontSize: '10px',
            color: '#9CA3AF',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(6, 1fr)', gap: '2px', marginBottom: '4px', fontWeight: 'bold' }}>
                <div>Cohort</div>
                {['S', 'W1', 'W2', 'W3', 'W4', 'W5'].map(h => <div key={h} style={{ textAlign: 'center' }}>{h}</div>)}
            </div>
            {cohorts.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px repeat(6, 1fr)', gap: '2px', marginBottom: '2px' }}>
                    <div style={{ whiteSpace: 'nowrap' }}>{row.week} <span style={{ fontSize: '8px', opacity: 0.6 }}>({row.size})</span></div>
                    {row.data.map((val, j) => (
                        <div
                            key={j}
                            style={{
                                backgroundColor: getIntensity(val),
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '2px',
                                color: val > 70 ? '#fff' : '#9CA3AF',
                                fontWeight: val > 70 ? '600' : '400'
                            }}
                        >
                            {val}%
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default CohortAnalysis;
