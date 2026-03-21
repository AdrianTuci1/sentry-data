import React from 'react';
import './ChronoDial.css';

const ChronoDial = ({ data = {} }) => {
    const sliderValue = data.sliderValue || 
                        (typeof data.value === 'number' ? data.value : null) || 
                        data.data?.[0]?.value || 
                        data.results?.[0]?.value || 50;

    return (
        <div className="premium-glow-container">
            {/* Removed internal glow-header as it conflicts with card header */}
            <div className="glow-center">
                <div className="glow-dot shadow-glow"></div>
                <div className="glow-halo">
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div
                            key={i}
                            className="glow-tick"
                            style={{ transform: `rotate(${i * 15}deg) translateY(-25px)` }}
                        />
                    ))}
                </div>
            </div>

            <div className="glow-slider-track">
                {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="slider-tick" />
                ))}
                <div
                    className="slider-pointer"
                    style={{ left: `${sliderValue}%` }}
                />
            </div>
            {/* Removed internal glow-footer for consistency */}
        </div>
    );
};

export default ChronoDial;
