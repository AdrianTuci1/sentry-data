import React from 'react';

export const WeatherMicro = ({ data }) => (
    <div className="micro-weather-card">
        <div className="weather-value-wrapper">
            <span className="weather-val">{data.value}</span>
            <span className="weather-unit">{data.unit}</span>
        </div>
        <div className="weather-lines-card">
            <span></span><span></span><span></span><span></span><span className="active"></span><span></span><span></span><span></span><span></span>
        </div>
    </div>
);

export const NaturalMicro = ({ data }) => (
    <div className="micro-natural-card">
        <div className="natural-value-wrapper">
            <span className="natural-val">{data.value}</span>
            <span className="natural-unit">{data.unit}</span>
        </div>
        <div className="natural-bar-container">
            <div className="natural-slider-card">
                <div className="natural-fill" style={{ width: `${data.sliderValue}%` }}></div>
                <div className="natural-thumb" style={{ left: `${data.sliderValue}%` }}></div>
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

export const ColorSliderMicro = ({ data }) => (
    <div className="micro-color-card">
        <div className="color-indicator">
            <div className="color-dot"></div>
        </div>
        <div className="color-slider-track">
            <div className="color-slider-thumb" style={{ left: `${data.sliderValue}%` }}></div>
            <div className="color-ticks">
                {[...Array(20)].map((_, i) => <span key={i}></span>)}
            </div>
        </div>
    </div>
);

export const CampaignListMicro = ({ data }) => (
    <div className="micro-campaign-list">
        {data.campaigns?.map((camp, i) => (
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

export const RedGradientMicro = ({ data }) => (
    <div className="micro-red-card">
        <div className="red-gauge-track">
            <div className="red-gauge-fill" style={{ width: `${data.sliderValue}%` }}></div>
            <div className="red-gauge-thumb" style={{ left: `${data.sliderValue}%` }}></div>
        </div>
    </div>
);

export const ProductivityMicro = ({ data }) => (
    <div className="micro-productivity">
        <div className="dots-container">
            {data.dataPoints?.map((val, i) => (
                <div
                    key={i}
                    className="prod-dot"
                    style={{
                        height: `${val * 3}px`,
                        opacity: 0.3 + (i / data.dataPoints.length) * 0.7
                    }}
                ></div>
            ))}
        </div>
    </div>
);

export const BarChartWrapper = ({ data }) => (
    <div style={{ width: '30%', alignSelf: 'center', height: '100%' }}>
        {/* This will be resolved from the registry to avoid circular dependecy or needed legacy import */}
        {/* For now we just keep the JSX structure */}
    </div>
);
