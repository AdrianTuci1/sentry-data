import React from 'react';
import './IntensityHeat.css';

const IntensityHeat = ({ data = {} }) => {
    const value = data.value || (data.data?.length > 0 ? data.data[data.data.length - 1] : "0") || "0";
    return (
        <div className="premium-pixel-container">
            <div className="pixel-main-value">{value}</div>

            <div className="pixel-scale">
                {Array.from({ length: 40 }).map((_, i) => (
                    <div
                        key={i}
                        className={`pixel-tick ${i === 20 ? 'active' : ''}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default IntensityHeat;
