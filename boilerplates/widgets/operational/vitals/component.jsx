import React from 'react';
import './style.css';

const TechnicalHealth = ({ data = {} }) => {
    const metrics = (data.metrics?.length > 0 ? data.metrics : null) || 
                    (data.data?.length > 0 ? data.data : null) || 
                    (data.results?.length > 0 ? data.results : null) || [
                        { name: 'API Latency', value: '45ms', status: 'good' },
                        { name: 'Error Rate', value: '0.12%', status: 'good' },
                        { name: 'CPU Load', value: '78%', status: 'warning' },
                        { name: 'Uptime', value: '99.9%', status: 'good' }
                    ];

    return (
        <div className="vitals-container">
            {metrics.map((m, i) => (
                <div key={i} className="vital-item">
                    <div className="vital-header">
                        <span className="vital-name">{m.name}</span>
                        <div className="vital-dot" style={{ backgroundColor: m.status === 'good' ? '#10B981' : '#F59E0B' }} />
                    </div>
                    <span className="vital-value">{m.value}</span>
                    <div className="vital-progress-bg">
                        <div 
                            className="vital-progress-fill"
                            style={{ 
                                width: m.value.includes('%') ? m.value : '70%',
                                backgroundColor: m.status === 'good' ? '#10B981' : '#F59E0B'
                            }} 
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TechnicalHealth;
