import React from 'react';
import './style.css';

export const WeatherMicro = ({ data = {} }) => (
    <div className="micro-weather-card">
        <div className="weather-value-wrapper">
            <span className="weather-val">{data.value || '24°'}</span>
            <span className="weather-unit">{data.unit || 'C'}</span>
        </div>
        <div className="weather-lines-card">
            <span></span><span></span><span></span><span></span><span className="active"></span><span></span><span></span><span></span><span></span>
        </div>
    </div>
);

export const NaturalMicro = ({ data = {} }) => {
    const sliderValue = data.sliderValue ?? data.data?.sliderValue ?? 50;
    return (
        <div className="micro-natural-card">
            <div className="natural-value-wrapper">
                <span className="natural-val">{data.value || 50}</span>
                <span className="natural-unit">{data.unit || '%'}</span>
            </div>
            <div className="natural-bar-container">
                <div className="natural-slider-card">
                    <div className="natural-fill" style={{ width: `${sliderValue}%` }}></div>
                    <div className="natural-thumb" style={{ left: `${sliderValue}%` }}></div>
                </div>
            </div>
            {data.footerTextLeft && (
                <div className="natural-labels">
                    <span>{data.footerTextLeft}</span>
                    <span>{data.footerTextRight}</span>
                </div>
            )}
        </div>
    );
};

export const ColorSliderMicro = ({ data = {} }) => {
    const sliderValue = data.sliderValue ?? data.data?.sliderValue ?? 30;
    return (
        <div className="micro-color-card">
            <div className="color-indicator">
                <div className="color-dot"></div>
            </div>
            <div className="color-slider-track">
                <div className="color-slider-thumb" style={{ left: `${sliderValue}%` }}></div>
                <div className="color-ticks">
                    {[...Array(20)].map((_, i) => <span key={i}></span>)}
                </div>
            </div>
        </div>
    );
};

export const CampaignListMicro = ({ data = {} }) => {
    const campaigns = data.campaigns || data.data?.campaigns || [
        { name: 'Summer Promo', trend: '+', value: '45%' },
        { name: 'Black Friday', trend: '-', value: '12%' }
    ];
    return (
        <div className="micro-campaign-list">
            {campaigns.map((camp, i) => (
                <div key={i} className="campaign-item">
                    <div className="camp-info">
                        <span className="camp-name">{camp.name}</span>
                        <span className={`camp-trend ${camp.trend === '+' ? 'positive' : 'negative'}`}>
                            {camp.trend === '+' ? '▲' : '▼'}
                        </span>
                    </div>
                    <div className="camp-val">{camp.value}</div>
                </div>
            ))}
        </div>
    );
};

export const RedGradientMicro = ({ data = {} }) => {
    const sliderValue = data.sliderValue ?? data.data?.sliderValue ?? 80;
    return (
        <div className="micro-red-card">
            <div className="red-gauge-track">
                <div className="red-gauge-fill" style={{ width: `${sliderValue}%` }}></div>
                <div className="red-gauge-thumb" style={{ left: `${sliderValue}%` }}></div>
            </div>
        </div>
    );
};

export const ProductivityMicro = ({ data = {} }) => {
    const points = data.dataPoints || data.data?.dataPoints || [1, 3, 5, 2, 8, 4, 9, 6];
    return (
        <div className="micro-productivity">
            <div className="dots-container">
                {points.map((val, i) => (
                    <div
                        key={i}
                        className="prod-dot"
                        style={{
                            height: `${val * 3}px`,
                            opacity: 0.3 + (i / points.length) * 0.7
                        }}
                    ></div>
                ))}
            </div>
        </div>
    );
};

// Default export wrapper to make it a generic widget entry point if needed
const SimpleMicroGraphics = ({ data = {} }) => {
    const view = data.view || data.data?.view || 'color';

    switch (view) {
        case 'weather': return <WeatherMicro data={data} />;
        case 'natural': return <NaturalMicro data={data} />;
        case 'campaign': return <CampaignListMicro data={data} />;
        case 'red': return <RedGradientMicro data={data} />;
        case 'productivity': return <ProductivityMicro data={data} />;
        case 'color':
        default: return <ColorSliderMicro data={data} />;
    }
};

export default SimpleMicroGraphics;
