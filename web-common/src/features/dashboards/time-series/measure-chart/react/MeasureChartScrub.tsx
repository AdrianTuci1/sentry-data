import { useId, type MouseEvent } from "react";
import type { ChartScales, ChartConfig } from "../types";
import {
  ScrubArea0Color,
  ScrubArea1Color,
  ScrubArea2Color,
  ScrubBoxColor,
} from "../../chart-colors";

interface MeasureChartScrubProps {
  scales: ChartScales;
  config: ChartConfig;
  /** Scrub start/end as fractional indices */
  startIndex: number | null;
  endIndex: number | null;
  isScrubbing: boolean;
  onReset: () => void;
}

const strokeWidth = 1;

/**
 * React translation of MeasureChartScrub.svelte: renders the brushed/scrubbed
 * selection as a gradient-filled rect with draggable edge handles. Right-click
 * (context menu) resets the selection.
 */
export function MeasureChartScrub(props: MeasureChartScrubProps) {
  const { scales, config, startIndex, endIndex, isScrubbing, onReset } = props;

  const gradientId = useId().replace(/:/g, "");
  const y1 = config.plotBounds.top + 5;
  const y2 = config.plotBounds.bottom - 5;

  const hasSelection = startIndex !== null && endIndex !== null;

  const orderedStartIdx =
    startIndex !== null && endIndex !== null
      ? Math.min(startIndex, endIndex)
      : null;
  const orderedEndIdx =
    startIndex !== null && endIndex !== null
      ? Math.max(startIndex, endIndex)
      : null;

  const xStart = orderedStartIdx !== null ? scales.x(orderedStartIdx) : 0;
  const xEnd = orderedEndIdx !== null ? scales.x(orderedEndIdx) : 0;
  const selectionWidth = Math.abs(xEnd - xStart);

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (hasSelection) onReset();
  }

  if (!hasSelection || orderedStartIdx === null || orderedEndIdx === null) {
    return null;
  }

  return (
    <>
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={gradientId}>
          <stop stopColor={ScrubArea0Color} />
          <stop offset="0.36" stopColor={ScrubArea1Color} />
          <stop offset="1" stopColor={ScrubArea2Color} />
        </linearGradient>
      </defs>

      <g
        className="scrub-group"
        onContextMenu={handleContextMenu}
        role="presentation"
      >
        <rect
          className={`selection-rect${isScrubbing ? " scrubbing" : ""}`}
          x={xStart}
          y={y1}
          width={selectionWidth}
          height={y2 - y1}
          fill={`url(#${gradientId})`}
          opacity={isScrubbing ? 0.4 : 0.2}
        />

        <line
          x1={xStart}
          x2={xStart}
          y1={y1}
          y2={y2}
          stroke={ScrubBoxColor}
          strokeWidth={strokeWidth}
        />
        <line
          x1={xEnd}
          x2={xEnd}
          y1={y1}
          y2={y2}
          stroke={ScrubBoxColor}
          strokeWidth={strokeWidth}
        />

        <rect
          className="resize-handle"
          x={xStart - 5}
          y={y1}
          width={10}
          height={y2 - y1}
          fill="transparent"
        />
        <rect
          className="resize-handle"
          x={xEnd - 5}
          y={y1}
          width={10}
          height={y2 - y1}
          fill="transparent"
        />
      </g>
    </>
  );
}
