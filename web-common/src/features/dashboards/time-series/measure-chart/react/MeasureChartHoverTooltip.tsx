import { useLayoutEffect, useRef, useState } from "react";
import { m } from "@statsparrot/web-common/lib/i18n/gen/messages";
import { formatGrainBucket } from "@statsparrot/web-common/lib/time/ranges/formatter";
import type { V1TimeGrain } from "@statsparrot/web-common/runtime-client";
import type { DateTime, Interval } from "luxon";

interface DimTooltipEntry {
  label: string;
  value: number | null;
  color: string;
}

interface MeasureChartHoverTooltipProps {
  mouseX: number;
  mouseY: number;
  currentValue: number | null;
  comparisonValue: number | null;
  currentTs: DateTime;
  comparisonTs?: DateTime;
  timeGranularity?: V1TimeGrain;
  interval?: Interval<true>;
  comparisonInterval?: Interval<true>;
  showComparison: boolean;
  isComparingDimension: boolean;
  dimTooltipEntries: DimTooltipEntry[];
  deltaLabel: string | null;
  deltaPositive: boolean;
  /** When true, an increase in value is rendered as the negative (red) color. */
  lowerIsBetter?: boolean;
  formatter: (value: number | null) => string;
}

const GAP = 8;

/**
 * React translation of MeasureChartHoverTooltip.svelte: the floating tooltip
 * that follows the cursor. Rendered with `position: fixed` (the Svelte
 * `use:portal` equivalent) and positioned to stay within the viewport.
 */
export function MeasureChartHoverTooltip({
  mouseX,
  mouseY,
  currentValue,
  comparisonValue,
  currentTs,
  comparisonTs,
  timeGranularity,
  interval,
  comparisonInterval,
  showComparison,
  isComparingDimension,
  dimTooltipEntries,
  deltaLabel,
  deltaPositive,
  lowerIsBetter = false,
  formatter,
}: MeasureChartHoverTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  // Arrow direction and sign track the actual value change. Color tracks
  // whether the change is favorable, which `lowerIsBetter` flips.
  const deltaIsFavorable = lowerIsBetter ? !deltaPositive : deltaPositive;
  const absoluteDelta =
    currentValue !== null && comparisonValue !== null
      ? currentValue - comparisonValue
      : null;

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      left: mouseX + GAP + rect.width > vw ? mouseX - GAP - rect.width : mouseX + GAP,
      top: mouseY + GAP + rect.height > vh ? mouseY - GAP - rect.height : mouseY + GAP,
    });
  }, [mouseX, mouseY]);

  return (
    <div
      ref={tooltipRef}
      className="tooltip-container z-50 shadow-md bg-surface-subtle border rounded fixed pointer-events-none overflow-hidden"
      style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
    >
      {isComparingDimension ? (
        <div className="dimension-tooltip px-2 py-1.5 text-[11px]">
          <div className="dimension-date text-fg-muted text-[10px] mb-1">
            {formatGrainBucket(currentTs, timeGranularity, interval)}
          </div>
          {dimTooltipEntries.map((entry) => (
            <div key={entry.label} className="dimension-entry flex gap-x-1.5 items-center">
              <span
                className="dimension-dot size-[7px] rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="dimension-label text-fg-muted truncate max-w-[120px]">
                {entry.label}
              </span>
              <span
                className={`dimension-value font-semibold text-fg-secondary ml-auto${entry.value === null ? " italic" : ""}`}
              >
                {formatter(entry.value)}
              </span>
            </div>
          ))}
        </div>
      ) : showComparison ? (
        <>
          <div className="time-comparison flex items-center">
            <div className="period flex flex-col items-center px-2.5 py-1.5">
              <span
                className={`value primary-value text-[12px] font-semibold text-theme-700${currentValue === null ? " italic" : ""}`}
                aria-label={m.chart_main_value_aria()}
              >
                {formatter(currentValue)}
              </span>
              <span className="date text-[9px] text-fg-muted">
                {formatGrainBucket(currentTs, timeGranularity, interval)}
              </span>
            </div>

            <div className="divider relative flex items-center justify-center self-stretch">
              <div className="divider-line absolute inset-y-0 w-px bg-gray-200" />
              <span className="vs-badge relative size-5 rounded-full border border-gray-300 flex items-center justify-center text-[8px] text-fg-muted font-medium bg-surface-background">
                {m.chart_vs()}
              </span>
            </div>

            <div className="period comparison flex flex-col items-center px-2.5 py-1.5">
              <span
                className={`value text-[12px] font-medium text-fg-muted${comparisonValue === null ? " italic" : ""}`}
              >
                {formatter(comparisonValue)}
              </span>
              <span className="date text-[9px] text-fg-muted">
                {comparisonTs
                  ? formatGrainBucket(comparisonTs, timeGranularity, comparisonInterval)
                  : null}
              </span>
            </div>
          </div>

          {absoluteDelta !== null && deltaLabel ? (
            <div
              className={`delta-footer flex items-center justify-center gap-x-1.5 px-2 py-1 border-t text-[10px] ${deltaIsFavorable ? "bg-green-50" : "bg-red-50"}`}
            >
              <span
                className={`delta-arrow ${deltaIsFavorable ? "text-green-600" : "text-red-600"}`}
              >
                {deltaPositive ? "▲" : "▼"}
              </span>
              <span className={`delta-absolute ${deltaIsFavorable ? "text-green-600" : "text-red-600"}`}>
                {deltaPositive ? "+" : ""}
                {formatter(absoluteDelta)}
              </span>
              <span className={`delta-percent ${deltaIsFavorable ? "text-green-600" : "text-red-600"}`}>
                ({deltaLabel})
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="simple-tooltip flex flex-col items-center px-2.5 py-1.5">
          <span
            className="simple-value text-[12px] font-semibold text-theme-700"
            aria-label={m.chart_main_value_aria()}
          >
            {formatter(currentValue)}
          </span>
          <span className="simple-date text-[9px] text-fg-muted">
            {formatGrainBucket(currentTs, timeGranularity, interval)}
          </span>
        </div>
      )}
    </div>
  );
}
