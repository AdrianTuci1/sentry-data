import React from 'react';
import './style.css';

const IntensityHeat = ({ data = {}, isMock = false }) => {
    const val = data.value ?? data.data?.value ?? "29";
    const numericVal = parseInt(val);
    const scaleLen = 40;
    const activeIndex = !isNaN(numericVal) ? Math.min(Math.floor((numericVal / 100) * scaleLen), scaleLen - 1) : 20;

    return (
        <div className="premium-pixel-container">
            <div className="pixel-main-value">{val}</div>
            <div className="pixel-scale">
                {Array.from({ length: scaleLen }).map((_, i) => (
                    <div
                        key={i}
                        className={`pixel-tick ${i === activeIndex ? 'active' : ''}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default IntensityHeat;
