import { TDDChart } from "@statsparrot/web-common/features/dashboards/time-dimension-details/types";

interface MeasureChartVegaNotSupportedProps {
  chartType: TDDChart;
  height: number;
}

const CHART_TYPE_LABELS: Record<TDDChart, string> = {
  [TDDChart.DEFAULT]: "Adaptive",
  [TDDChart.LINE]: "Line",
  [TDDChart.STACKED_BAR]: "Stacked bar",
  [TDDChart.GROUPED_BAR]: "Grouped bar",
  [TDDChart.STACKED_AREA]: "Stacked area",
};

/**
 * Explicit placeholder rendered when MeasureChart is asked to show a
 * Vega-rendered chart type (stacked/grouped bar, stacked area). The Vega
 * graphic renderer (TDDMeasureChart) is ported to React in a later increment,
 * so this component is rendered deliberately to make the pending chart type
 * obvious rather than silently drawing a different (flat) chart.
 */
export function MeasureChartVegaNotSupported({
  chartType,
  height,
}: MeasureChartVegaNotSupportedProps) {
  const label = CHART_TYPE_LABELS[chartType];
  return (
    <div
      className="flex items-center justify-center text-sm text-fg-muted"
      style={{ height: `${height}px` }}
    >
      {label} chart type is not yet supported in the React port.
    </div>
  );
}
