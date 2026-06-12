function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function BudgetGaugeWidget({ data }) {
  const { spent, allowance, percentUsed, leftLabel = 'Used today', rightLabel = "Today's allowance" } = data;
  const clampedPercent = Math.max(0, Math.min(percentUsed, 100));

  return (
    <div className="budget-gauge-widget">
      <div className="budget-gauge-metrics">
        <div className="budget-gauge-metric">
          <span className="budget-gauge-label">{leftLabel}</span>
          <span className="budget-gauge-value">{formatCurrency(spent)}</span>
        </div>

        <div className="budget-gauge-divider" />

        <div className="budget-gauge-metric align-right">
          <span className="budget-gauge-label">{rightLabel}</span>
          <span className="budget-gauge-value">{formatCurrency(allowance)}</span>
        </div>
      </div>

      <div className="budget-gauge-track">
        <div className="budget-gauge-fill" style={{ width: `${clampedPercent}%` }} />
        <div className="budget-gauge-marker" style={{ left: `${clampedPercent}%` }} />
      </div>

      <div className="budget-gauge-progress">
        <span className="budget-gauge-progress-value">{Math.round(clampedPercent)}%</span>
        <span className="budget-gauge-progress-label">used</span>
      </div>
    </div>
  );
}
