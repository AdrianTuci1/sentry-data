import React from 'react';
import './ScanningOrbit.css';

const ScanningOrbit = ({ data = {} }) => {
    const value = data.value || data.results?.[0]?.value || data.data?.[0]?.value || 0;
    const unit = data.unit || data.results?.[0]?.unit || data.data?.[0]?.unit || '';

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
