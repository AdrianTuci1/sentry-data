import React from 'react';
import './NeuralNexus.css';

const NeuralNexus = ({ data = {} }) => {
    const value = data.value || data.results?.[0]?.value || data.data?.[0]?.value || 0;
    const unit = data.unit || data.results?.[0]?.unit || data.data?.[0]?.unit || '';
    const ticks = Array.from({ length: 60 });
    const percent = data.sliderValue || data.percent || 75;
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
                <span className="dial-sub-val">{unit}</span>
            </div>
            {/* Removed redundant footer label that conflicts with card footer */}
        </div>
    );
};

export default NeuralNexus;
