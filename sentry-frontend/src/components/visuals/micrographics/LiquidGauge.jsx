import React from 'react';
import './LiquidGauge.css';

const LiquidGauge = ({ data }) => {
    const percent = data.sliderValue || 50;

    return (
        <div className="liquid-gauge-container">
            <div className="liquid-circle">
                <div className="liquid-wave" style={{ top: `${100 - percent}%` }}></div>
                <div className="liquid-wave-overlay" style={{ top: `${100 - percent}%` }}></div>
                <div className="liquid-content">
                    <span className="liquid-val">{data.value}</span>
                    <span className="liquid-unit">{data.unit}</span>
                </div>
            </div>
        </div>
    );
};

export default LiquidGauge;
