// Barrel export for the MeasureChart React port.
//
// Increment scope: SVG-renderer-only. The React MeasureChart renders the SVG
// MeasureChartBody renderer for adaptive/line chart types and an explicit
// placeholder (MeasureChartVegaNotSupported) for the Vega-rendered chart types
// (stacked/grouped bar, stacked area); the Vega graphic renderer
// (TDDMeasureChart) is ported in a later increment.
//
// Wiring note: this module is not yet consumed by the live host. Wiring it into
// the Settings host (replacing the Svelte MeasureChart in MetricsTimeSeriesCharts)
// is a separate increment and must wait until the Vega-rendered chart types are
// supported so no chart type silently regresses.
export { MeasureChart } from "./MeasureChart";
export { MeasureChartBody } from "./MeasureChartBody";
export { MeasureChartVegaNotSupported } from "./MeasureChartVegaNotSupported";
