import React from 'react';
import './NeuralNexus.css';

const NeuralNexus = ({ data }) => {
    const value = data.value || 0;
    const ticks = Array.from({ length: 60 });
    const percent = data.sliderValue || 75;
    const activeTicks = Math.floor((percent / 100) * ticks.length);

    return (
        <div className="premium-dial-container">
            <div className="dial-ticks">
                {ticks.map((_, i) => (
                    <div
                        key={i}
                        className={`dial-tick ${i < activeTicks ? 'active' : ''}`}
                        style={{ transform: `rotate(${i * 6}deg)` }}
                    />
                ))}
            </div>
            <div className="dial-value-mask">
                <span className="dial-main-val">{value}</span>
                <span className="dial-sub-val">{data.unit}</span>
            </div>
            {/* Removed redundant footer label that conflicts with card footer */}
        </div>
    );
};

export default NeuralNexus;
