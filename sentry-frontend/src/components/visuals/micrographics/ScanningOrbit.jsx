import React from 'react';
import './ScanningOrbit.css';

const ScanningOrbit = ({ data }) => {
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
                <span className="orbit-val">{data.value}</span>
                <span className="orbit-unit">{data.unit}</span>
            </div>
        </div>
    );
};

export default ScanningOrbit;
