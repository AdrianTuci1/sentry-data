import type { ChartSeries } from "@statsparrot/web-common/features/dashboards/time-series/measure-chart/types";
import {
  clampToRange,
  computeBarSlotGeometry,
} from "@statsparrot/web-common/features/dashboards/time-series/measure-chart/utils";
import type { ScaleLinear } from "d3-scale";

interface BarChartProps {
  series: ChartSeries[];
  yScale: ScaleLinear<number, number>;
  stacked?: boolean;
  plotLeft: number;
  plotWidth: number;
  visibleStart: number;
  visibleEnd: number;
  scrubStartIndex?: number | null;
  scrubEndIndex?: number | null;
}

const BAR_RADIUS = 3;

/**
 * React translation of BarChart.svelte: renders grouped (or stacked) bars for
 * the measure chart's bar mode, with scrub-range dimming.
 */
export function BarChart({
  series,
  yScale,
  stacked = false,
  plotLeft,
  plotWidth,
  visibleStart,
  visibleEnd,
  scrubStartIndex = null,
  scrubEndIndex = null,
}: BarChartProps) {
  const hasScrub = scrubStartIndex !== null && scrubEndIndex !== null;
  const scrubMin = hasScrub ? Math.min(scrubStartIndex!, scrubEndIndex!) : 0;
  const scrubMax = hasScrub ? Math.max(scrubStartIndex!, scrubEndIndex!) : 0;

  const visibleCount = Math.max(1, visibleEnd - visibleStart + 1);
  const geo = computeBarSlotGeometry(plotWidth, visibleCount, series.length);
  // With a dynamic y-axis the domain can exclude zero, putting yScale(0) outside the plot.
  // Clamp the baseline to the scale's range so bars stay inside the plot area.
  const zeroY = clampToRange(yScale(0), yScale.range());

  function isInScrub(ptIdx: number): boolean {
    if (!hasScrub) return true;
    return ptIdx >= Math.round(scrubMin) && ptIdx <= Math.round(scrubMax);
  }

  const slots = Array.from({ length: visibleCount }, (_, i) => i);

  if (stacked) {
    return (
      <>
        {slots.map((slot) => {
          const ptIdx = visibleStart + slot;
          const cx = plotLeft + (slot + 0.5) * geo.slotWidth;
          const bx = cx - geo.bandWidth / 2;
          const stackValues = series.map((s) => ({
            value: s.values[ptIdx] ?? 0,
            color: s.color,
            id: s.id,
          }));
          return (
            <g key={slot}>
              {stackValues.map((seg, segIdx) => {
                if (seg.value === 0) return null;
                const yBottom = yScale(
                  stackValues.slice(0, segIdx).reduce((sum, sv) => sum + sv.value, 0),
                );
                const yTop = yScale(
                  stackValues.slice(0, segIdx + 1).reduce((sum, sv) => sum + sv.value, 0),
                );
                return (
                  <rect
                    key={seg.id}
                    x={bx}
                    y={Math.min(yBottom, yTop)}
                    width={geo.bandWidth}
                    height={Math.abs(yBottom - yTop)}
                    fill={isInScrub(ptIdx) ? seg.color : "var(--color-gray-400)"}
                    opacity={1}
                    rx={1}
                  />
                );
              })}
            </g>
          );
        })}
      </>
    );
  }

  return (
    <>
      {slots.map((slot) => {
        const ptIdx = visibleStart + slot;
        const cx = plotLeft + (slot + 0.5) * geo.slotWidth;
        return (
          <g key={slot}>
            {series.map((s, sIdx) => {
              const v = s.values[ptIdx] ?? null;
              if (v === null) return null;
              const bx =
                cx - geo.bandWidth / 2 + sIdx * (geo.singleBarWidth + geo.barGap);
              const by = Math.min(zeroY, yScale(v));
              const bh = Math.abs(zeroY - yScale(v));
              const r = Math.min(BAR_RADIUS, geo.singleBarWidth / 2, bh / 2);
              const isPositive = v >= 0;
              const d = isPositive
                ? `M${bx},${by + bh}
                   V${by + r}
                   Q${bx},${by} ${bx + r},${by}
                   H${bx + geo.singleBarWidth - r}
                   Q${bx + geo.singleBarWidth},${by} ${bx + geo.singleBarWidth},${by + r}
                   V${by + bh}
                   Z`
                : `M${bx},${by}
                   V${by + bh - r}
                   Q${bx},${by + bh} ${bx + r},${by + bh}
                   H${bx + geo.singleBarWidth - r}
                   Q${bx + geo.singleBarWidth},${by + bh} ${bx + geo.singleBarWidth},${by + bh - r}
                   V${by}
                   Z`;
              return (
                <path
                  key={s.id}
                  d={d}
                  fill={isInScrub(ptIdx) ? s.color : "var(--color-gray-400)"}
                  opacity={isInScrub(ptIdx) ? (s.opacity ?? 1) : 0.5}
                />
              );
            })}
          </g>
        );
      })}
    </>
  );
}
