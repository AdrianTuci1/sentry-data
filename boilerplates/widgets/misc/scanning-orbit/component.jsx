import React from 'react';
import './style.css';

const ScanningOrbit = ({ data = {}, isMock = false }) => {
    const value = data.value ?? data.data?.value ?? "14,500";
    const unit = data.unit ?? data.data?.unit ?? "ops/sec";

    return (
        <div className="scanning-orbit-container">
            <div className="radar-grid"></div>
            <div className="radar-sweep"></div>
            <div className="central-node shadow-glow"></div>

            <div className="orbit orbit-1">
                <div className="satellite sat-1"></div>
            </div>
            <div className="orbit orbit-2">
                <div className="satellite sat-2"></div>
            </div>

            <div className="orbit-content">
                <span className="orbit-val">{value}</span>
                <span className="orbit-unit">{unit}</span>
            </div>
        </div>
    );
};

export default ScanningOrbit;
