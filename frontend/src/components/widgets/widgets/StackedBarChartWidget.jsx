import { useState } from 'react';
import { ArrowUpRight, Clock3 } from 'lucide-react';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function StackedBarChartWidget({ data, config }) {
  const { labels = [], datasets = [], summary } = data;
  const series = datasets.slice(0, 2);

  if (labels.length === 0 || series.length === 0) return null;

  const yesterdayData = series[0]?.data || [];
  const todayData = series[1]?.data || [];
  const revenuePoints = labels.map((label, i) => ({
    label,
    yesterday: yesterdayData[i] || 0,
    today: todayData[i] || 0,
  }));

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const max = Math.max(...revenuePoints.map((p) => p.today + p.yesterday));
  const highlightIndex = hoveredIndex ?? 1;
  const highlightPoint = revenuePoints[highlightIndex];
  const tooltipOffset = ((highlightIndex + 0.5) / revenuePoints.length) * 100;

  return (
    <div className="marketing-revenue-card">
      {summary ? (
        <div className="marketing-revenue-summary">
          <div className="marketing-revenue-summary-group">
            <div className="marketing-revenue-legend">
              <span className="marketing-revenue-dot today" />
              {summary.primaryLabel}
            </div>
            <div className="marketing-revenue-amount">{formatCurrency(summary.primaryValue)}</div>
          </div>

          <div className="marketing-revenue-summary-group">
            <div className="marketing-revenue-legend">
              <span className="marketing-revenue-dot yesterday" />
              {summary.secondaryLabel}
            </div>
            <div className="marketing-revenue-amount">{formatCurrency(summary.secondaryValue)}</div>
          </div>

          {summary.delta !== undefined ? (
            <div className="marketing-revenue-growth">
              <span className="marketing-revenue-growth-pill">
                <ArrowUpRight size={12} />
              </span>
              {summary.delta.toFixed(1)}%
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="marketing-revenue-chart">
        {hoveredIndex !== null ? (
          <div className="marketing-revenue-tooltip" style={{ left: `${tooltipOffset}%` }}>
            <div className="marketing-revenue-tooltip-head">
              <div className="marketing-revenue-tooltip-time">
                <Clock3 size={13} />
                {highlightPoint.label}
              </div>
              <div className="marketing-revenue-tooltip-delta">
                <ArrowUpRight size={13} />
                +${(highlightPoint.today - highlightPoint.yesterday).toFixed(2)}
              </div>
            </div>
            <div className="marketing-revenue-tooltip-row">
              <div className="marketing-revenue-tooltip-label">
                <span className="marketing-revenue-dot yesterday" />
                Yesterday
              </div>
              <span>{formatCurrency(highlightPoint.yesterday)}</span>
            </div>
            <div className="marketing-revenue-tooltip-row">
              <div className="marketing-revenue-tooltip-label">
                <span className="marketing-revenue-dot today" />
                Today
              </div>
              <span>{formatCurrency(highlightPoint.today)}</span>
            </div>
          </div>
        ) : null}

        <div
          className="marketing-revenue-bars-grid"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {revenuePoints.map((point, index) => (
            <button
              key={point.label}
              type="button"
              className={`marketing-revenue-slot ${highlightIndex === index ? "is-active" : ""}`}
              onMouseEnter={() => setHoveredIndex(index)}
              aria-label={`${point.label}: Today ${formatCurrency(point.today)}, Yesterday ${formatCurrency(point.yesterday)}`}
            >
              <div className="marketing-revenue-gridline" />
              <div
                className="marketing-revenue-bar-stack"
                style={{ height: `${((point.today + point.yesterday) / max) * 100}%` }}
              >
                <div
                  className="marketing-revenue-bar yesterday"
                  style={{
                    height: `${(point.yesterday / (point.today + point.yesterday)) * 100}%`,
                  }}
                />
                <div
                  className="marketing-revenue-bar today"
                  style={{
                    height: `${(point.today / (point.today + point.yesterday)) * 100}%`,
                  }}
                />
              </div>
              <span className="marketing-revenue-label">{point.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
