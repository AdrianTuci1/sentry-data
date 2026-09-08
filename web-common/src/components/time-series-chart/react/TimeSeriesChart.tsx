import { useId, useMemo } from "react";
import {
  createAreaGenerator,
  createLineGenerator,
} from "@statsparrot/web-common/components/data-graphic/utils";
import type {
  ChartScales,
  ChartSeries,
} from "@statsparrot/web-common/features/dashboards/time-series/measure-chart/types";
import { clampToRange } from "@statsparrot/web-common/features/dashboards/time-series/measure-chart/utils";
import { bridgeGaps } from "../sparse-data-utils";

interface TimeSeriesChartProps {
  series: ChartSeries[];
  scales: ChartScales;
  hasScrubSelection?: boolean;
  scrubStartIndex?: number | null;
  scrubEndIndex?: number | null;
  connectNulls?: boolean;
}

const numAccessor = (d: number | null) => d;
const numClone = (_d: number | null, v: number): number | null => v;

/**
 * React translation of TimeSeriesChart.svelte: renders line/area series with
 * sparse-data gap bridging and scrub highlighting via clip paths.
 */
export function TimeSeriesChart({
  series,
  scales,
  hasScrubSelection = false,
  scrubStartIndex = null,
  scrubEndIndex = null,
  connectNulls = true,
}: TimeSeriesChartProps) {
  const chartId = useId().replace(/:/g, "");

  const lineGen = useMemo(
    () =>
      createLineGenerator<number | null>({
        x: (_d, i) => scales.x(i),
        y: (d) => scales.y(d ?? 0),
        defined: (d) => d !== null,
      }),
    [scales],
  );

  // With a dynamic y-axis the domain can exclude zero, putting scales.y(0) outside the plot.
  // Clamp the area's baseline to the scale's range so the fill stays inside the plot area.
  const areaGen = useMemo(
    () =>
      createAreaGenerator<number | null>({
        x: (_d, i) => scales.x(i),
        y0: clampToRange(scales.y(0), scales.y.range()),
        y1: (d) => scales.y(d ?? 0),
        defined: (d) => d !== null,
      }),
    [scales],
  );

  const primarySeries = series[0];

  const primaryBridgeResult = useMemo(
    () =>
      primarySeries
        ? bridgeGaps(primarySeries.values, numAccessor, numClone, connectNulls)
        : {
            values: [] as (number | null)[],
            inputSegments: [],
            bridgedSegments: [],
          },
    [primarySeries, connectNulls],
  );
  const primaryBridged = primaryBridgeResult.values;

  const primaryLinePath = primarySeries ? (lineGen(primaryBridged) ?? "") : "";
  const primaryAreaPath = primarySeries ? (areaGen(primaryBridged) ?? "") : "";

  const primaryRealSegments = primaryBridgeResult.inputSegments;
  const primarySegments = primaryBridgeResult.bridgedSegments;
  const primarySingletons = useMemo(
    () =>
      primarySeries
        ? primarySegments
            .filter((s) => s.startIndex === s.endIndex)
            .map((s) => s.startIndex)
        : [],
    [primarySeries, primarySegments],
  );

  const secondarySeries = useMemo(
    () =>
      series.slice(1).map((s) => {
        const bridged = bridgeGaps(s.values, numAccessor, numClone, connectNulls);
        const singletons = bridged.bridgedSegments
          .filter((seg) => seg.startIndex === seg.endIndex)
          .map((seg) => seg.startIndex);
        return { ...s, bridgedValues: bridged.values, singletons };
      }),
    [series, connectNulls],
  );

  const scrubClipX =
    scrubStartIndex !== null && scrubEndIndex !== null
      ? Math.min(scales.x(scrubStartIndex), scales.x(scrubEndIndex))
      : 0;
  const scrubClipWidth =
    scrubStartIndex !== null && scrubEndIndex !== null
      ? Math.abs(scales.x(scrubEndIndex) - scales.x(scrubStartIndex))
      : 0;

  const primaryLineColor = primarySeries
    ? hasScrubSelection
      ? "var(--color-gray-500)"
      : primarySeries.color
    : "var(--color-gray-500)";

  const primaryAreaStart = primarySeries?.areaGradient
    ? hasScrubSelection
      ? "var(--color-gray-300)"
      : primarySeries.areaGradient.dark
    : "transparent";
  const primaryAreaEnd = primarySeries?.areaGradient
    ? hasScrubSelection
      ? "var(--color-gray-50)"
      : primarySeries.areaGradient.light
    : "transparent";

  const yRangeTop = scales.y.range()[0];
  const hasScrub = hasScrubSelection && scrubStartIndex !== null && scrubEndIndex !== null;

  return (
    <>
      <defs>
        {primarySeries?.areaGradient ? (
          <>
            <linearGradient id={`area-grad-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={primaryAreaStart} stopOpacity="0.3" />
              <stop offset="95%" stopColor={primaryAreaEnd} stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id={`scrub-area-grad-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={primarySeries.areaGradient.dark} stopOpacity="0.3" />
              <stop offset="95%" stopColor={primarySeries.areaGradient.light} stopOpacity="0.3" />
            </linearGradient>
          </>
        ) : null}

        {primarySeries ? (
          <>
            {/* seg-clip: real data segments only (connectNulls off) */}
            <clipPath id={`seg-clip-${chartId}`}>
              {primaryRealSegments.map((seg) => {
                const x = scales.x(seg.startIndex);
                const width = scales.x(seg.endIndex) - x;
                return <rect key={seg.startIndex} x={x} y={0} height={yRangeTop} width={width} />;
              })}
            </clipPath>
            {/* full-clip: real + bridged segments (connectNulls on, area fill) */}
            <clipPath id={`full-clip-${chartId}`}>
              {primarySegments.map((seg) => {
                const x = scales.x(seg.startIndex);
                const width = scales.x(seg.endIndex) - x;
                return <rect key={seg.startIndex} x={x} y={0} height={yRangeTop} width={width} />;
              })}
            </clipPath>
          </>
        ) : null}

        {hasScrub ? (
          <clipPath id={`scrub-clip-${chartId}`}>
            <rect x={scrubClipX} y={0} width={scrubClipWidth} height={yRangeTop} />
          </clipPath>
        ) : null}
      </defs>

      {/* Primary area fill (clipped to full-clip to avoid filling across large gaps) */}
      {primarySeries?.areaGradient ? (
        <path
          d={primaryAreaPath}
          fill={`url(#area-grad-${chartId})`}
          style={{ clipPath: `url(#full-clip-${chartId})` }}
        />
      ) : null}

      {/* Secondary series (no clip paths — line breaks handled by `defined` callback) */}
      {secondarySeries.map((s) => (
        <g key={s.id}>
          <path
            d={lineGen(s.bridgedValues) ?? ""}
            stroke={hasScrubSelection ? "var(--color-gray-400)" : s.color}
            strokeWidth={s.strokeWidth ?? 1}
            strokeDasharray={s.strokeDasharray ?? "none"}
            fill="none"
            opacity={s.opacity ?? 1}
          />
          {s.singletons.map((idx) => {
            const v = s.values[idx] ?? 0;
            return (
              <circle
                key={idx}
                cx={scales.x(idx)}
                cy={scales.y(v)}
                r={1.5}
                fill={hasScrubSelection ? "var(--color-gray-400)" : s.color}
                opacity={s.opacity ?? 1}
              />
            );
          })}
          {hasScrub ? (
            <g style={{ clipPath: `url(#scrub-clip-${chartId})` }}>
              <path
                d={lineGen(s.bridgedValues) ?? ""}
                stroke={s.color}
                strokeWidth={s.strokeWidth ?? 1}
                strokeDasharray={s.strokeDasharray ?? "none"}
                fill="none"
                opacity={s.opacity ?? 1}
              />
              {s.singletons.map((idx) => {
                const v = s.values[idx] ?? 0;
                return (
                  <circle
                    key={idx}
                    cx={scales.x(idx)}
                    cy={scales.y(v)}
                    r={1.5}
                    fill={s.color}
                    opacity={s.opacity ?? 1}
                  />
                );
              })}
            </g>
          ) : null}
        </g>
      ))}

      {/* Primary line (clipped to seg-clip or full-clip depending on connectNulls) */}
      {primarySeries ? (
        <>
          <path
            d={primaryLinePath}
            stroke={primaryLineColor}
            strokeWidth={primarySeries.strokeWidth ?? 1}
            fill="none"
            style={{ clipPath: `url(#${connectNulls ? "full-clip" : "seg-clip"}-${chartId})` }}
          />
          {primarySingletons.map((idx) => {
            const v = primarySeries.values[idx] ?? 0;
            return (
              <circle
                key={idx}
                cx={scales.x(idx)}
                cy={scales.y(v)}
                r={1.5}
                fill={primaryLineColor}
              />
            );
          })}
        </>
      ) : null}

      {/* Scrub highlight: re-draws primary series with original colors, clipped to scrub-clip */}
      {hasScrub && primarySeries ? (
        <g style={{ clipPath: `url(#scrub-clip-${chartId})` }}>
          {primarySeries.areaGradient ? (
            <path d={areaGen(primaryBridged) ?? ""} fill={`url(#scrub-area-grad-${chartId})`} />
          ) : null}
          <path
            d={lineGen(primaryBridged) ?? ""}
            stroke={primarySeries.color}
            strokeWidth={1}
            fill="none"
          />
          {primarySingletons.map((idx) => {
            const v = primarySeries.values[idx] ?? 0;
            return (
              <circle
                key={idx}
                cx={scales.x(idx)}
                cy={scales.y(v)}
                r={1.5}
                fill={primarySeries.color}
              />
            );
          })}
        </g>
      ) : null}
    </>
  );
}
