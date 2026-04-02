import React from 'react';

const TechnicalHealth = ({ data }) => {
    const metrics = data?.metrics || [];

    return (
        <div style={{
            height: '100%',
            width: '100%',
            padding: '12px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            fontFamily: 'Inter, sans-serif'
        }}>
            {metrics.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{m.name}</span>
                        <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: m.status === 'good' ? '#10B981' : '#F59E0B'
                        }} />
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>{m.value}</span>
                    <div style={{ height: '4px', width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: '70%',
                            backgroundColor: m.status === 'good' ? '#10B981' : '#F59E0B',
                            opacity: 0.5
                        }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TechnicalHealth;
