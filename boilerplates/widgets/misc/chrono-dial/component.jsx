import React from 'react';
import './style.css';

const ChronoDial = ({ data = {}, isMock = false }) => {
    const sliderValue = data.sliderValue ?? data.data?.sliderValue ?? 50;
    
    return (
        <div className="premium-glow-container">
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
        </div>
    );
};

export default ChronoDial;
