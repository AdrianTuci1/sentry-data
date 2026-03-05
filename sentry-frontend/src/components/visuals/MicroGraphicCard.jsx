import React from 'react';
import './MicroGraphicCard.css';

const MicroGraphicCard = ({ data, isExpanded, onClick }) => {
    // Generate class names for grid span
    const spanClass = data.gridSpan && data.gridSpan !== 'default' ? data.gridSpan : '';

    // Render specific graphic based on type
    const renderGraphic = () => {
        switch (data.type) {
            case 'weather':
                return (
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
            case 'natural':
                return (
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
            case 'light-dial':
                return (
                    <div className="micro-light-dial">
                        <div className="dial-container">
                            <svg viewBox="0 0 100 100" className="dial-svg">
                                {/* Background arc */}
                                <path
                                    d="M 20 80 A 45 45 0 1 1 80 80"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                />
                                {/* Value arc */}
                                <path
                                    d="M 20 80 A 45 45 0 1 1 80 80"
                                    fill="none"
                                    stroke="#FFD700"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray="200"
                                    strokeDashoffset={200 - (200 * data.dialPercentage) / 100}
                                />
                            </svg>
                            <div className="dial-content">
                                <span className="dial-val">{data.value}</span>
                                <span className="dial-unit">{data.unit}</span>
                            </div>
                        </div>
                    </div>
                );
            case 'color-slider':
                return (
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
            case 'animated-line':
                {
                    const maxVal = Math.max(...(data.dataPoints || [100]));
                    const points = (data.dataPoints || []).map(
                        (val, i) => `${(i / Math.max(1, data.dataPoints.length - 1)) * 100},${100 - (val / maxVal) * 100}`
                    ).join(" ");
                    return (
                        <div className="micro-animated-line">
                            <div className="line-value-wrapper">
                                <span className="line-val">{data.value}</span>
                                <span className="line-unit">{data.unit}</span>
                            </div>
                            <div className="svg-container">
                                <svg viewBox="0 -10 100 120" preserveAspectRatio="none" className="moving-line-svg">
                                    <polyline
                                        points={points}
                                        fill="none"
                                        stroke="url(#lineGradient)"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="path-animate"
                                    />
                                    <defs>
                                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                                            <stop offset="50%" stopColor="#fff" />
                                            <stop offset="100%" stopColor="#00E5FF" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                    );
                }
            case 'campaign-list':
                return (
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
            case 'red-gradient':
                return (
                    <div className="micro-red-card">
                        <div className="red-gauge-track">
                            <div className="red-gauge-fill" style={{ width: `${data.sliderValue}%` }}></div>
                            <div className="red-gauge-thumb" style={{ left: `${data.sliderValue}%` }}></div>
                        </div>
                    </div>
                );
            case 'productivity-chart':
                return (
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
            case 'pie-chart':
                return (
                    <div className="micro-pie-chart">
                        {data.segments?.map((seg, i) => (
                            <div key={i} className="pie-legend">
                                <div className="pie-legend-color" style={{ backgroundColor: seg.color }}></div>
                                <span>{seg.label}: {seg.value}%</span>
                            </div>
                        ))}
                    </div>
                );
            case 'bar-chart':
                return (
                    <div className="micro-bar-chart">
                        <div className="bar-value">{data.value}</div>
                        <div className="bars-container">
                            {data.bars?.map((val, i) => (
                                <div key={i} className="bar-item" style={{ height: `${val}%` }}></div>
                            ))}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div
            className={`micro-card ${data.colorTheme} ${spanClass} ${isExpanded ? 'expanded' : ''}`}
            onClick={() => onClick(data.id)}
        >
            <div className="micro-card-header">
                {data.title && <h3 className="micro-title">{data.title}</h3>}
                {data.subtitle && <span className="micro-subtitle">{data.subtitle}</span>}
            </div>

            <div className="micro-card-body">
                {renderGraphic()}
            </div>

            <div className="micro-card-footer">
                {data.footerText && <span className="footer-main">{data.footerText}</span>}
                {data.footerBottom && <span className="footer-bottom">{data.footerBottom}</span>}
            </div>

            {/* Expand indicator icon */}
            {!isExpanded && (
                <div className="expand-indicator">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                </div>
            )}

            {/* Close indicator when expanded */}
            {isExpanded && (
                <div className="close-indicator" onClick={(e) => { e.stopPropagation(); onClick(null); }}>
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
            )}
        </div>
    );
};

export default MicroGraphicCard;
