import React from 'react';
import ReactECharts from 'echarts-for-react';

const FinancialBreakdown = ({ data = {} }) => {
    const steps = (Array.isArray(data.steps) && data.steps.length > 0 ? data.steps : null) || 
                  (Array.isArray(data.data) && data.data.length > 0 ? data.data : null) || 
                  (Array.isArray(data.results) && data.results.length > 0 ? data.results : null) || [
        { name: 'Revenue', value: 124000, isTotal: true },
        { name: 'Ad Spend', value: -45000 },
        { name: 'SaaS Fees', value: -12000 },
        { name: 'Logistics', value: -28000 },
        { name: 'Net Margin', value: 39000, isTotal: true }
    ];

    // Calculate values for waterfall
    let current = 0;
    const chartData = steps.map(step => {
        if (step.isTotal) {
            return {
                name: step.name,
                value: current,
                itemStyle: { color: '#10B981' }
            };
        }
        const val = step.value;
        const start = current;
        current += val;
        return {
            name: step.name,
            value: [start, current],
            itemStyle: { color: val >= 0 ? '#3B82F6' : '#EF4444' }
        };
    });

    const option = {
        grid: { left: '15%', right: '5%', top: '10%', bottom: '25%' },
        xAxis: {
            type: 'category',
            data: steps.map(s => s.name),
            axisLabel: { color: '#9CA3AF', fontSize: 9, rotate: 15 },
            axisLine: { show: false },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            show: false
        },
        series: [{
            type: 'bar',
            stack: 'total',
            data: chartData.map(d => Array.isArray(d.value) ? d.value[1] - d.value[0] : d.value),
            // This is a simplified waterfall implementation for micro-view
            itemStyle: {
                borderRadius: [2, 2, 0, 0]
            }
        }]
    };

    // Since a true waterfall in ECharts micro might be complex, let's use a simpler custom layout
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
                    const isNeg = step.value < 0;
                    const maxVal = 124000;
                    const heightPercent = step.isTotal ? 100 : (Math.abs(step.value) / maxVal) * 100;

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
