import type {
  TimeSeriesPoint,
  DimensionSeriesData,
  ChartScales,
  ChartConfig,
} from "../types";
import { MeasureChartPointIndicator } from "./MeasureChartPointIndicator";
import { computeBarSlotGeometry, barCenterX } from "../utils";

interface MeasureChartTooltipProps {
  scales: ChartScales;
  config: ChartConfig;
  hoveredIndex: number;
  hoveredPoint: TimeSeriesPoint | null;
  dimensionData: DimensionSeriesData[];
  showComparison: boolean;
  isComparingDimension: boolean;
  isBarMode: boolean;
  visibleStart: number;
  visibleEnd: number;
}

/**
 * React translation of MeasureChartTooltip.svelte: the in-SVG point markers
 * for the hovered bucket (primary, comparison, or per-dimension circles).
 * The Svelte tweened motion (25ms/60ms) is dropped in favor of direct
 * positioning — purely cosmetic, no data semantics change.
 */
export function MeasureChartTooltip({
  scales,
  config,
  hoveredIndex,
  hoveredPoint,
  dimensionData,
  showComparison,
  isComparingDimension,
  isBarMode,
  visibleStart,
  visibleEnd,
}: MeasureChartTooltipProps) {
  if (!hoveredPoint) return null;

  // Bar count: dimension comparison uses dimensionData.length, time comparison uses 2
  const barCount = isComparingDimension
    ? dimensionData.length
    : showComparison
      ? 2
      : 1;
  const visibleCount = Math.max(1, visibleEnd - visibleStart + 1);
  const geo = computeBarSlotGeometry(
    config.plotBounds.width,
    visibleCount,
    barCount,
  );

  const slot = hoveredIndex - visibleStart;
  const slotCenterX = config.plotBounds.left + (slot + 0.5) * geo.slotWidth;

  const y = hoveredPoint?.value ?? null;
  const comparisonY = hoveredPoint?.comparisonValue ?? null;
  const currentPointIsNull = y === null;
  const hasValidComparisonPoint =
    comparisonY !== undefined && comparisonY !== null;

  const tweenedX = scales.x(hoveredIndex);
  const tweenedY =
    hoveredPoint?.value != null ? scales.y(hoveredPoint.value) : 0;
  const tweenedComparisonY =
    hoveredPoint?.comparisonValue != null
      ? scales.y(hoveredPoint.comparisonValue)
      : 0;

  const primaryBarX = isBarMode
    ? barCenterX(
        slotCenterX,
        geo.bandWidth,
        geo.singleBarWidth,
        geo.barGap,
        1,
      )
    : tweenedX;
  const compBarX = isBarMode
    ? barCenterX(
        slotCenterX,
        geo.bandWidth,
        geo.singleBarWidth,
        geo.barGap,
        0,
      )
    : tweenedX;

  return (
    <>
      {/* Primary point indicator (hidden in comparison modes) */}
      {!isComparingDimension && !showComparison ? (
        <MeasureChartPointIndicator
          x={tweenedX}
          y={currentPointIsNull ? scales.y(0) : tweenedY}
          zeroY={Math.max(
            Math.min(scales.y(0), config.plotBounds.top + config.plotBounds.height),
            config.plotBounds.top,
          )}
        />
      ) : null}

      {/* Time comparison: primary point circle (right bar, index 1) */}
      {!isComparingDimension && showComparison && !currentPointIsNull ? (
        <circle
          cx={primaryBarX}
          cy={tweenedY}
          r={4}
          className="fill-theme-500 stroke-surface-background stroke-[1.5px]"
        />
      ) : null}

      {/* Dimension comparison: guideline + per-series point circles */}
      {isComparingDimension ? (
        <>
          <line
            x1={tweenedX}
            x2={tweenedX}
            y1={config.plotBounds.top}
            y2={config.plotBounds.top + config.plotBounds.height}
            className="stroke-gray-300"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
          {dimensionData.map((dim, i) => {
            const pt = dim.data[hoveredIndex];
            const bx = isBarMode
              ? barCenterX(
                  slotCenterX,
                  geo.bandWidth,
                  geo.singleBarWidth,
                  geo.barGap,
                  i,
                )
              : tweenedX;
            if (pt?.value === null || pt?.value === undefined) return null;
            return (
              <circle
                key={i}
                cx={bx}
                cy={scales.y(pt.value)}
                r={4}
                fill={dim.color}
                className="stroke-surface-background stroke-[1.5px]"
              />
            );
          })}
        </>
      ) : null}

      {/* Time comparison: comparison point circle (left bar, index 0) */}
      {!isComparingDimension && showComparison && hasValidComparisonPoint ? (
        <circle
          cx={compBarX}
          cy={tweenedComparisonY}
          r={4}
          className="fill-gray-500 stroke-surface-background stroke-[1.5px]"
        />
      ) : null}
    </>
  );
}
