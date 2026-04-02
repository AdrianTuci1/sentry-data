import React from 'react';
import './IntensityHeat.css';

const IntensityHeat = ({ data }) => {
    return (
        <div className="premium-pixel-container">
            {/* Removed redundant title here as it's already in the card header */}
            <div className="pixel-main-value">{data.value}</div>

            <div className="pixel-scale">
                {Array.from({ length: 40 }).map((_, i) => (
                    <div
                        key={i}
                        className={`pixel-tick ${i === 20 ? 'active' : ''}`}
                    />
                ))}
            </div>

            {/* Removed redundant footer as it's already in the card footer */}
        </div>
    );
};

export default IntensityHeat;
