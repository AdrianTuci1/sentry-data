import React from 'react';
import './style.css';

const LiquidGauge = ({ data = {}, isMock = false }) => {
    // Handling multiple possible shapes
    const percent = data.sliderValue ?? data.data?.sliderValue ?? data.value ?? data.data?.value ?? 50;
    const unit = data.unit ?? data.data?.unit ?? "%";

    return (
        <div className="liquid-gauge-container">
            <div className="liquid-circle">
                <div className="liquid-wave" style={{ top: `${100 - percent}%` }}></div>
                <div className="liquid-wave-overlay" style={{ top: `${100 - percent}%` }}></div>
                <div className="liquid-content">
                    <span className="liquid-val">{percent}</span>
                    <span className="liquid-unit">{unit}</span>
                </div>
            </div>
        </div>
    );
};

export default LiquidGauge;
