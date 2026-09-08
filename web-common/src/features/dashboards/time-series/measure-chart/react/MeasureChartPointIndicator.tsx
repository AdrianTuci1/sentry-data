interface MeasureChartPointIndicatorProps {
  x: number;
  y: number;
  zeroY: number;
  selected?: boolean;
}

/**
 * React translation of MeasureChartPointIndicator.svelte: a vertical guide line
 * from the zero baseline to the point value plus a point circle.
 */
export function MeasureChartPointIndicator({
  x,
  y,
  zeroY,
  selected = false,
}: MeasureChartPointIndicatorProps) {
  return (
    <>
      <line
        className={selected ? "stroke-theme-500" : "stroke-fg-muted"}
        strokeWidth={selected ? 2 : 1.5}
        x1={x}
        x2={x}
        y1={zeroY}
        y2={y}
      />
      <circle
        className={selected ? "stroke-[3px] stroke-surface-background fill-theme-500" : "stroke-[3px] stroke-surface-background fill-theme-600"}
        cx={x}
        cy={y}
        r={4}
        style={{ paintOrder: "stroke" }}
      />
    </>
  );
}
