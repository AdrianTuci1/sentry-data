import React from 'react';
import { Sparkles, Orbit } from 'lucide-react';
import './OptimalTimeHeatmap.css';

const defaultGrid = [
    [28, 31, 33, 35, 44, 48, 55, 56],
    [32, 31, 34, 35, 26, 28, 22, 35],
    [36, 35, 35, 35, 35, 21, 36, 36],
    [27, 29, 32, 22, 34, 23, 29, 35],
    [14, 16, 18, 11, 13, 12, 16, 11],
    [32, 32, 32, 1, 31, 31, 11, 32],
    [3, 6, 8, 11, 31, 11, 12, 14],
    [3, 2, 7, 30, 31, 11, 19, 33],
];

const defaultSummaryCards = [
    {
        id: 'weekly-peak',
        icon: 'sparkles',
        label: 'Weekly Peak',
        value: '8,097',
        delta: '+19.6%',
        note: '42,214 engaged sessions',
        tone: 'positive',
    },
    {
        id: 'quarterly-reach',
        icon: 'orbit',
        label: 'Quarter Reach',
        value: '312,134',
        delta: '+2.5%',
        note: '301,002 prior baseline',
        tone: 'positive',
    },
];

const defaultMarketBreakdown = [
    { label: 'Los Angeles', value: '201,192' },
    { label: 'New York', value: '192,054' },
    { label: 'Canada', value: '166,401' },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatCellValue = (value) => String(value).padStart(2, '0');

const getCellStyle = (value) => {
    const normalized = clamp((value - 1) / 55, 0, 1);
    const hue = 252 - normalized * 200;
    const saturation = 70 + normalized * 18;
    const lightness = 38 + normalized * 26;
    const textColor = normalized > 0.72 ? '#15120a' : 'rgba(245, 247, 252, 0.96)';

    return {
        backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
        color: textColor,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,${0.06 + normalized * 0.12})`,
    };
};

const renderSummaryIcon = (icon) => {
    if (icon === 'orbit') {
        return <Orbit size={14} strokeWidth={2.1} />;
    }
};

const OptimalTimeHeatmap = ({ data = {} }) => {
    const engagementMatrix = data.engagementMatrix || defaultGrid;
    const summaryCards = data.summaryCards || defaultSummaryCards;
    const marketBreakdown = data.marketBreakdown || defaultMarketBreakdown;

    return (
        <div className="optimal-time-widget">
            <div className="optimal-time-header">
                <div className="optimal-time-title-block">
                    <span className="optimal-time-kicker">Engagement Matrix</span>
                    <h3>{data.title || 'Peak Engagement'}</h3>
                    <p>{data.subtitle || 'Best Campaign Window'}</p>
                </div>
            </div>

            <div className="optimal-time-grid" aria-label="Peak engagement matrix">
                {engagementMatrix.flatMap((row, rowIndex) => (
                    row.map((value, columnIndex) => (
                        <div
                            key={`${rowIndex}-${columnIndex}`}
                            className="optimal-time-cell"
                            style={getCellStyle(value)}
                        >
                            {formatCellValue(value)}
                        </div>
                    ))
                ))}
            </div>

            <div className="optimal-time-summary">
                {summaryCards.map((card) => (
                    <section key={card.id} className="optimal-time-summary-card">
                        <div className="optimal-time-summary-label">
                            <span className="optimal-time-summary-icon">
                                {renderSummaryIcon(card.icon)}
                            </span>
                            <span>{card.label}</span>
                        </div>

                        <div className="optimal-time-summary-value">{card.value}</div>

                        <div className="optimal-time-summary-meta">
                            <span className={`optimal-time-delta optimal-time-delta-${card.tone || 'positive'}`}>
                                {card.delta}
                            </span>
                            <span className="optimal-time-note">{card.note}</span>
                        </div>
                    </section>
                ))}
            </div>

            <div className="optimal-time-market-list">
                {marketBreakdown.map((market) => (
                    <div key={market.label} className="optimal-time-market-row">
                        <span>{market.label}</span>
                        <strong>{market.value}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OptimalTimeHeatmap;
