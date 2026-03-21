import React from 'react';
import './style.css';

const NeuralNexus = ({ data = {}, isMock = false }) => {
    const value = data.value ?? data.data?.value ?? 0;
    const unit = data.unit ?? data.data?.unit ?? "";
    const percent = data.sliderValue ?? data.data?.sliderValue ?? 75;
    
    const ticks = Array.from({ length: 60 });
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
        </div>
    );
};

export default NeuralNexus;
