import React from 'react';
import './PulseCircle.css';

const PulseCircle = ({ data }) => {
    return (
        <div className="pulse-circle-container">
            <div className="pulse-main">
                <div className="pulse-ring ring-1"></div>
                <div className="pulse-ring ring-2"></div>
                <div className="pulse-ring ring-3"></div>
                <div className="pulse-center">
                    <span className="pulse-val">{data.value}</span>
                </div>
            </div>
        </div>
    );
};

export default PulseCircle;
