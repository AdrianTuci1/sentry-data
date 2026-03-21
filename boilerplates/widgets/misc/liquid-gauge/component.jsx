import React from 'react';
import './style.css';

const LiquidGauge = ({ data = {} }) => {
    const percent = data.sliderValue || data.percent || 
                    (typeof data.value === 'number' ? data.value : null) || 
                    data.data?.[0]?.value || 50;

    const value = data.value || data.results?.[0]?.value || data.data?.[0]?.value || percent;
    const unit = data.unit || data.results?.[0]?.unit || data.data?.[0]?.unit || '%';

    return (
        <div className="liquid-gauge-container">
            <div className="liquid-circle">
                <div className="liquid-wave" style={{ top: `${100 - percent}%` }}></div>
                <div className="liquid-wave-overlay" style={{ top: `${100 - percent}%` }}></div>
                <div className="liquid-content">
                    <span className="liquid-val">{value}</span>
                    <span className="liquid-unit">{unit}</span>
                </div>
            </div>
        </div>
    );
};

export default LiquidGauge;
