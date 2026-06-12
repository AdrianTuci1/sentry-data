import React from 'react';

export function LeadSourcesWidget({ data }) {
  const { totalLeads = 3521, sources = [] } = data;

  let cumulativePercent = 0;
  const slices = sources.map((src) => {
    const percent = (src.value / totalLeads) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...src, percent, startPercent };
  });

  return (
    <div className="sales-lead-sources-widget">
      <div className="sales-lead-sources-donut-wrap">
        <svg viewBox="-50 -50 100 100" className="sales-lead-sources-donut">
          {slices.map((slice, i) => (
            <circle
              key={i}
              r="40"
              cx="0"
              cy="0"
              fill="none"
              stroke={slice.color}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(slice.percent * 2.33 - 4, 0)} ${251 - slice.percent * 2.33 + 4}`}
              strokeDashoffset={-slice.startPercent * 2.33}
            />
          ))}
          <circle r="31" cx="0" cy="0" fill="#090A0B" />
        </svg>
        <div className="sales-lead-sources-center">
          <span className="sales-lead-sources-total">
            {totalLeads.toLocaleString()}
          </span>
          <span className="sales-lead-sources-total-label">
            total leads
          </span>
        </div>
      </div>

      <div className="sales-lead-sources-list">
        {sources.map((src, i) => (
          <div key={i} className="sales-lead-sources-row">
            <div className="sales-lead-sources-row-left">
              <div className="sales-lead-sources-bar" style={{ backgroundColor: src.color }} />
              <span className="sales-lead-sources-name">
                {src.label}
              </span>
            </div>
            <span className="sales-lead-sources-value">
              {src.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
