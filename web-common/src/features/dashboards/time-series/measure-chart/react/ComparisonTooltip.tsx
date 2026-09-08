import { m } from "@statsparrot/web-common/lib/i18n/gen/messages";

interface ComparisonTooltipProps {
  valueFormatter: (value: number | null) => string;
  tooltipCurrentValue: number | null;
  tooltipComparisonValue: number | null;
  showDelta: boolean;
  tooltipDeltaLabel: string | null;
  tooltipDeltaPositive?: boolean;
  /** When true, an increase in value is rendered as the negative (red) color. */
  lowerIsBetter?: boolean;
  x: number;
  y: number;
}

/**
 * React translation of ComparisonTooltip.svelte: the "current vs previous"
 * inline readout shown in the chart's top-left corner on non-hovered charts.
 */
export function ComparisonTooltip({
  valueFormatter,
  tooltipCurrentValue,
  tooltipComparisonValue,
  showDelta,
  tooltipDeltaLabel,
  tooltipDeltaPositive = false,
  lowerIsBetter = false,
  x,
  y,
}: ComparisonTooltipProps) {
  // Sign tracks the actual value change; color tracks whether it's favorable.
  const deltaIsFavorable = lowerIsBetter
    ? !tooltipDeltaPositive
    : tooltipDeltaPositive;

  return (
    <text className="text-outline text-[12px]" x={x} y={y}>
      <tspan
        className="fill-theme-700 font-semibold"
        style={{ fontStyle: tooltipCurrentValue === null ? "italic" : "normal" }}
      >
        {valueFormatter(tooltipCurrentValue)}
      </tspan>
      <tspan
        className="fill-fg-muted"
        style={{ fontStyle: tooltipComparisonValue === null ? "italic" : "normal" }}
      >
        {m.chart_vs()}
        {valueFormatter(tooltipComparisonValue)}
      </tspan>
      {showDelta ? (
        <tspan className={deltaIsFavorable ? "fill-green-600" : "fill-red-600"}>
          ({tooltipDeltaPositive ? "+" : ""}
          {tooltipDeltaLabel})
        </tspan>
      ) : null}
    </text>
  );
}
