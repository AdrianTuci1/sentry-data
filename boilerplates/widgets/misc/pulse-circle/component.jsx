import React from 'react';
import './style.css';

const PulseCircle = ({ data = {}, isMock = false }) => {
    const value = data.value ?? data.data?.value ?? "100%";

    return (
        <div className="pulse-circle-container">
            <div className="pulse-main">
                <div className="pulse-ring ring-1"></div>
                <div className="pulse-ring ring-2"></div>
                <div className="pulse-ring ring-3"></div>
                <div className="pulse-center">
                    <span className="pulse-val">{value}</span>
                </div>
            </div>
        </div>
    );
};

export default PulseCircle;
