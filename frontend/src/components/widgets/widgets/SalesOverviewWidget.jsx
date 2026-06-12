import React, { useState } from 'react';
import {
  DollarSign,
  ShoppingCart,
  CreditCard,
  Funnel,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const metricIcons = {
  revenue: DollarSign,
  orders: ShoppingCart,
  aov: CreditCard,
  conversion: Funnel,
};

export function SalesOverviewWidget({ data }) {
  const { metrics = {}, timeseries = {}, labels = [], tooltipLabels = [], axisTickIndexes = [] } = data;
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [hoverIndex, setHoverIndex] = useState(null);

  const selectedData = timeseries[selectedMetric] || [];
  const activeMetricInfo = metrics[selectedMetric] || {};
  const activeLabels = labels.length ? labels : selectedData.map((_, index) => `${index + 1}`);
  const activeTooltipLabels = tooltipLabels.length ? tooltipLabels : activeLabels;

  const max = Math.max(...selectedData);
  const min = Math.min(...selectedData);
  const range = max - min || 1;
  const hoverValue = hoverIndex === null ? null : selectedData[hoverIndex];

  const chartPoints = selectedData.map((v, i) => {
    const x = (i / (selectedData.length - 1)) * 100;
    const y = 78 - ((v - min) / range) * 48;
    return { x, y, value: v };
  });

  const points = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const fillPoints = `0,82 ${points} 100,82`;
  const hoverPoint = hoverIndex === null ? null : chartPoints[hoverIndex];
  const tickIndexes = axisTickIndexes.length ? axisTickIndexes : [0, Math.floor(activeLabels.length / 6), Math.floor(activeLabels.length / 3), Math.floor(activeLabels.length / 2), Math.floor((activeLabels.length * 2) / 3), activeLabels.length - 1];

  const formatTooltipValue = (value) => {
    if (selectedMetric === 'revenue') {
      return `$${Math.round(value / 1000)}K`;
    }
    if (selectedMetric === 'orders') {
      return `${Math.round(value)}`;
    }
    if (selectedMetric === 'aov') {
      return `$${value.toFixed(2)}`;
    }
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="sales-overview-widget">
      <div className="sales-overview-metric-strip">
        {Object.entries(metrics).map(([key, m]) => {
          const isSelected = selectedMetric === key;
          const isPositive = parseFloat(m.trend) >= 0;
          const Icon = metricIcons[key] || DollarSign;

          return (
            <button
              key={key}
              onClick={() => setSelectedMetric(key)}
              className={`sales-overview-metric-tab ${isSelected ? 'is-active' : ''}`}
              type="button"
              aria-pressed={isSelected}
            >
              <div className="sales-overview-metric-head">
                <div className="sales-overview-metric-label">
                  <Icon size={14} strokeWidth={1.8} />
                  <span>{m.label}</span>
                </div>
              </div>

              <div className="sales-overview-metric-row">
                <span className="sales-overview-metric-value">
                  {m.value}
                </span>
                <span className={`sales-overview-metric-trend ${isPositive ? 'positive' : 'negative'}`}>
                  {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {Math.abs(parseFloat(m.trend)).toFixed(1)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="sales-overview-chart-area">
        <div className="sales-overview-y-axis">
          {(activeMetricInfo.axisTicks || []).map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="sales-overview-chart-stage">
          <div className="sales-overview-chart-plot">
            <svg className="sales-overview-chart-svg" preserveAspectRatio="none" viewBox="0 0 100 82">
              <defs>
                <linearGradient id="sales-overview-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
                </linearGradient>
              </defs>

              <polygon points={fillPoints} fill="url(#sales-overview-fill)" />
              <polyline
                points={points}
                fill="none"
                stroke="rgba(196, 196, 199, 0.62)"
                strokeWidth="1.15"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {hoverPoint ? (
              <>
                <div className="sales-overview-hover-line" style={{ left: `${hoverPoint.x}%` }} />
                <div
                  className="sales-overview-hover-dot"
                  style={{ left: `${hoverPoint.x}%`, top: `${(hoverPoint.y / 82) * 100}%` }}
                />
                <div
                  className="sales-overview-tooltip"
                  style={{ left: `${hoverPoint.x}%`, top: `${Math.max(((hoverPoint.y - 14) / 82) * 100, 4)}%` }}
                >
                  <div className="sales-overview-tooltip-date">{activeTooltipLabels[hoverIndex]}</div>
                  <div className="sales-overview-tooltip-row">
                    <span className="sales-overview-tooltip-bullet" />
                    <span className="sales-overview-tooltip-label">{activeMetricInfo.label}</span>
                    <span className="sales-overview-tooltip-value">{formatTooltipValue(hoverValue)}</span>
                  </div>
                </div>
              </>
            ) : null}

            <div className="sales-overview-hover-grid" onMouseLeave={() => setHoverIndex(null)}>
              {chartPoints.map((point, index) => (
                <button
                  key={`${selectedMetric}-${index}`}
                  type="button"
                  className="sales-overview-hover-slot"
                  onMouseEnter={() => setHoverIndex(index)}
                  onFocus={() => setHoverIndex(index)}
                  aria-label={`${activeTooltipLabels[index]} ${activeMetricInfo.label} ${formatTooltipValue(point.value)}`}
                />
              ))}
            </div>
          </div>

          <div className="sales-overview-x-axis">
            {tickIndexes.map((index) => (
              <span key={`${activeLabels[index]}-${index}`}>{activeLabels[index]}</span>
            ))}
            {hoverPoint ? (
              <div className="sales-overview-active-date-pill" style={{ left: `${hoverPoint.x}%` }}>
                {activeLabels[hoverIndex]}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
