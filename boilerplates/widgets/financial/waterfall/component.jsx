import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const FinancialBreakdown = ({ data = {}, isMock = false }) => {
    const steps = (Array.isArray(data.steps) && data.steps.length > 0 ? data.steps : null) || 
                  (Array.isArray(data.data) && data.data.length > 0 ? data.data : null) || 
                  [
                      { name: "Gross Revenue", value: 124000 },
                      { name: "COGS", value: -45000 },
                      { name: "Ad Spend", value: -28000 },
                      { name: "OpEx", value: -8500 },
                      { name: "Net Profit", isTotal: true }
                  ];

    return (
        <div style={{
            height: '100%',
            width: '100%',
            padding: '15px 10px 5px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end'
        }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px' }}>
                {steps.map((step, i) => {
                    const isNeg = step.value && step.value < 0;
                    // Mock logic for determining maxVal in a real scenario
                    const maxVal = Math.max(...steps.map(s => Math.abs(s.value || 0))) || 124000;
                    const heightPercent = step.isTotal ? 100 : (Math.abs(step.value || 0) / maxVal) * 100;

                    return (
                        <div key={i} style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            height: '100%',
                            gap: '4px'
                        }}>
                            <div style={{
                                width: '100%',
                                height: `${Math.max(heightPercent, 5)}%`,
                                backgroundColor: step.isTotal ? '#10B981' : (isNeg ? '#EF4444' : '#3B82F6'),
                                borderRadius: '4px',
                                boxShadow: step.isTotal ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none',
                                opacity: 0.9,
                                transition: 'height 0.5s ease'
                            }} />
                            <span style={{
                                fontSize: '8px',
                                color: '#E5E7EB',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontWeight: '500'
                            }}>
                                {step.name}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FinancialBreakdown;
