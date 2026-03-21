import React from 'react';
import './style.css';

const CohortAnalysis = ({ data = {} }) => {
    const cohorts = (data.cohorts?.length > 0 ? data.cohorts : null) || 
                    (data.data?.length > 0 ? data.data : null) || 
                    (data.results?.length > 0 ? data.results : null) || [
                        { week: 'Feb 01', size: 1200, data: [100, 85, 70, 62, 55, 48] },
                        { week: 'Feb 08', size: 1150, data: [100, 82, 68, 60, 52] },
                        { week: 'Feb 15', size: 1300, data: [100, 88, 72, 65] },
                        { week: 'Feb 22', size: 1250, data: [100, 84, 70] },
                        { week: 'Mar 01', size: 1100, data: [100, 80] },
                        { week: 'Mar 08', size: 1200, data: [100] }
                    ];

    const getIntensity = (val) => {
        if (val === 100) return 'rgba(59, 130, 246, 0.9)';
        if (val > 80) return 'rgba(59, 130, 246, 0.7)';
        if (val > 70) return 'rgba(59, 130, 246, 0.5)';
        if (val > 60) return 'rgba(59, 130, 246, 0.4)';
        return 'rgba(59, 130, 246, 0.2)';
    };

    return (
        <div className="cohort-container">
            <div className="cohort-header">
                <div>Cohort</div>
                {['S', 'W1', 'W2', 'W3', 'W4', 'W5'].map(h => <div key={h} style={{ textAlign: 'center' }}>{h}</div>)}
            </div>
            {cohorts.map((row, i) => (
                <div key={i} className="cohort-row">
                    <div className="cohort-label">{row.week} <span className="cohort-size">({row.size})</span></div>
                    {(Array.isArray(row.data) ? row.data : []).map((val, j) => (
                        <div
                            key={j}
                            className={`cohort-cell ${val > 70 ? 'high-intensity' : 'low-intensity'}`}
                            style={{ backgroundColor: getIntensity(val) }}
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
