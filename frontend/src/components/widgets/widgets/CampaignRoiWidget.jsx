import React from 'react';

export function CampaignRoiWidget({ data }) {
  const { spend = 43000, revenue = 212000, roas = 4.94, spendPercent = 20, returnPercent = 80, retained = 169000 } = data;

  return (
    <div className="sales-campaign-roi-widget">
      <div className="sales-campaign-roi-top">
        <div className="sales-campaign-roi-metric">
          <span className="sales-campaign-roi-label">Spend</span>
          <span className="sales-campaign-roi-value">${(spend / 1000).toFixed(0)}K</span>
        </div>
        <div className="sales-campaign-roi-separator" />
        <div className="sales-campaign-roi-metric">
          <span className="sales-campaign-roi-label">Revenue</span>
          <span className="sales-campaign-roi-value">${(revenue / 1000).toFixed(0)}K</span>
        </div>
        <div className="sales-campaign-roi-separator" />
        <div className="sales-campaign-roi-metric">
          <span className="sales-campaign-roi-label">ROAS</span>
          <span className="sales-campaign-roi-value">{roas.toFixed(2)}x</span>
        </div>
      </div>

      <div className="sales-campaign-roi-mix">
        <div className="sales-campaign-roi-mix-head">
          <span>Spend vs return mix</span>
          <span>{spendPercent}% / {returnPercent}%</span>
        </div>
        <div className="sales-campaign-roi-mix-bar">
          <div className="sales-campaign-roi-mix-segment spend" style={{ width: `${spendPercent}%` }} />
          <div className="sales-campaign-roi-mix-segment return" style={{ width: `${returnPercent}%` }} />
        </div>
      </div>

      <div className="sales-campaign-roi-bottom">
        <div className="sales-campaign-roi-bottom-item">
          <div className="sales-campaign-roi-bottom-label">
            <span className="sales-campaign-roi-bottom-dot spend" />
            <span>Ad spend</span>
          </div>
          <span className="sales-campaign-roi-bottom-value">${(spend / 1000).toFixed(0)}K</span>
        </div>
        <div className="sales-campaign-roi-bottom-item">
          <div className="sales-campaign-roi-bottom-label">
            <span className="sales-campaign-roi-bottom-dot return" />
            <span>Revenue retained</span>
          </div>
          <span className="sales-campaign-roi-bottom-value">${(retained / 1000).toFixed(0)}K</span>
        </div>
      </div>
    </div>
  );
}
