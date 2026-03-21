import React from 'react';
import './style.css';

export const WeatherMicro = ({ data = {} }) => {
    const value = data.value || data.results?.[0]?.value || data.data?.[0]?.value || "24";
    const unit = data.unit || data.results?.[0]?.unit || data.data?.[0]?.unit || "°C";
    return (
        <div className="micro-weather-card">
            <div className="weather-value-wrapper">
                <span className="weather-val">{value}</span>
                <span className="weather-unit">{unit}</span>
            </div>
            <div className="weather-lines-card">
                {[...Array(9)].map((_, i) => (
                    <span key={i} className={i === 4 ? 'active' : ''}></span>
                ))}
            </div>
        </div>
    );
};

export const NaturalMicro = ({ data = {} }) => {
    const value = data.value || data.results?.[0]?.value || data.data?.[0]?.value || "0.8";
    const unit = data.unit || data.results?.[0]?.unit || data.data?.[0]?.unit || "nm";
    const sliderValue = data.sliderValue || data.percent || 65;
    return (
        <div className="micro-natural-card">
            <div className="natural-value-wrapper">
                <span className="natural-val">{value}</span>
                <span className="natural-unit">{unit}</span>
            </div>
            <div className="natural-bar-container">
                <div className="natural-slider-card">
                    <div className="natural-fill" style={{ width: `${sliderValue}%` }}></div>
                    <div className="natural-thumb" style={{ left: `${sliderValue}%` }}></div>
                </div>
            </div>
            {(data.footerTextLeft || data.footerTextRight) && (
                <div className="natural-labels">
                    <span>{data.footerTextLeft}</span>
                    <span>{data.footerTextRight}</span>
                </div>
            )}
        </div>
    );
};

export const DialMicro = ({ data = {} }) => {
    const value = data.value || data.results?.[0]?.value || data.data?.[0]?.value || "72";
    const unit = data.unit || data.results?.[0]?.unit || data.data?.[0]?.unit || "%";
    const sliderValue = data.sliderValue || data.percent || 72;
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (sliderValue / 100) * circumference;

    return (
        <div className="micro-light-dial">
            <div className="dial-container">
                <svg className="dial-svg" viewBox="0 0 100 100">
                    <circle
                        cx="50" cy="50" r={radius}
                        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * 0.25}
                    />
                    <circle
                        cx="50" cy="50" r={radius}
                        fill="none" stroke="currentColor" strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset + (circumference * 0.25)}
                        strokeLinecap="round"
                        style={{ color: '#FBC02D' }}
                    />
                </svg>
                <div className="dial-content">
                    <span className="dial-val">{value}</span>
                    <span className="dial-unit">{unit}</span>
                </div>
            </div>
        </div>
    );
};

export const ColorSliderMicro = ({ data = {} }) => {
    const sliderValue = data.sliderValue || data.percent || 45;
    const color = data.color || '#81E4B5';
    return (
        <div className="micro-color-card">
            <div className="color-indicator">
                <div className="color-dot" style={{ backgroundColor: color }}></div>
            </div>
            <div className="color-slider-track">
                <div className="color-slider-thumb" style={{ left: `${sliderValue}%`, borderBottomColor: color }}></div>
                <div className="color-ticks">
                    {[...Array(20)].map((_, i) => <span key={i}></span>)}
                </div>
            </div>
        </div>
    );
};

export const CampaignListMicro = ({ data = {} }) => {
    const campaigns = (data.campaigns?.length > 0 ? data.campaigns : null) || 
                      (data.data?.length > 0 ? data.data : null) || 
                      (data.results?.length > 0 ? data.results : null) || [
        { name: 'Google Ads', value: '4.2k', trend: '+' },
        { name: 'Meta Ads', value: '1.8k', trend: '-' },
        { name: 'Organic', value: '850', trend: '+' }
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
    const sliderValue = data.sliderValue || data.percent || 40;
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
    const points = (data.dataPoints?.length > 0 ? data.dataPoints : null) || 
                   (data.data?.length > 0 ? data.data : null) || 
                   (data.results?.length > 0 ? data.results : null) || 
                   [10, 15, 8, 20, 12, 18, 25];
    return (
        <div className="micro-productivity">
            <div className="dots-container">
                {points.map((val, i) => (
                    <div
                        key={i}
                        className="prod-dot"
                        style={{
                            height: `${val * 2}px`,
                            opacity: 0.3 + (i / points.length) * 0.7
                        }}
                    ></div>
                ))}
            </div>
        </div>
    );
};

export const BarChartWrapper = ({ data = {} }) => {
    const bars = (data.bars?.length > 0 ? data.bars : null) || 
                 (data.data?.length > 0 ? data.data : null) || 
                 (data.results?.length > 0 ? data.results : null) || 
                 [40, 70, 45, 90, 65];
    const value = data.value || data.results?.[0]?.value || data.data?.[0]?.value || bars[bars.length - 1];

    return (
        <div className="micro-bar-chart">
            <div className="bar-value">{value}</div>
            <div className="bars-container">
                {bars.map((val, i) => (
                    <div
                        key={i}
                        className="bar-item"
                        style={{ height: `${val}%` }}
                    />
                ))}
            </div>
        </div>
    );
};

// Dispatcher Component for Dynamic Loading
const SimpleGraphicsDispatcher = (props) => {
    const { data = {} } = props;
    
    // Choose component based on data structure
    if (data.campaigns || data.results?.some(r => r.trend)) {
        return <CampaignListMicro {...props} />;
    }
    if (data.bars || data.results?.some(r => typeof r === 'number')) {
        return <BarChartWrapper {...props} />;
    }
    if (data.dataPoints || data.results?.length > 0) {
        return <ProductivityMicro {...props} />;
    }
    if (data.sliderValue || data.percent) {
        // Tie break between different slider/dial types
        if (data.unit === '°C') return <WeatherMicro {...props} />;
        if (data.color) return <ColorSliderMicro {...props} />;
        if (data.unit === '%') return <DialMicro {...props} />;
        return <NaturalMicro {...props} />;
    }

    return <WeatherMicro {...props} />; // Default fallback
};

export default SimpleGraphicsDispatcher;
