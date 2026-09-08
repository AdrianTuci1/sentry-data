import type { AnnotationGroup } from "../annotation-utils";
import { AnnotationWidth, AnnotationHeight } from "../annotation-utils";
import type { PlotBounds } from "../types";
import {
  AnnotationDiamondColor,
  AnnotationHighlightColor,
  AnnotationHighlightBottomColor,
  ScrubBoxColor,
} from "../../chart-colors";

interface MeasureChartAnnotationMarkersProps {
  groups: AnnotationGroup[];
  hoveredGroup: AnnotationGroup | null;
  plotBounds: PlotBounds;
}

/**
 * React translation of MeasureChartAnnotationMarkers.svelte: renders the
 * annotation diamonds and, when a group is hovered, its range highlight.
 */
export function MeasureChartAnnotationMarkers({
  groups,
  hoveredGroup,
  plotBounds,
}: MeasureChartAnnotationMarkersProps) {
  const hasRange = hoveredGroup?.hasRange ?? false;
  const rangeXStart = hoveredGroup?.left ?? 0;
  const rangeXEnd = Math.min(
    hoveredGroup?.right ?? 0,
    plotBounds.left + plotBounds.width,
  );
  const rangeYEnd = hoveredGroup?.top ?? 0;

  const halfSize = (AnnotationWidth / 2) * 0.7;

  return (
    <>
      {groups.map((group) => {
        const hovered = hoveredGroup === group;
        const cx = group.left;
        const cy = group.top + AnnotationHeight / 2;
        return (
          <rect
            key={group.index}
            aria-label="annotation marker"
            x={cx - halfSize}
            y={cy - halfSize}
            width={halfSize * 2}
            height={halfSize * 2}
            fill={AnnotationDiamondColor}
            className="stroke-surface-background"
            strokeWidth={1}
            opacity={hovered ? 1 : 0.7}
            transform={`rotate(45 ${cx} ${cy})`}
          />
        );
      })}

      {hasRange && hoveredGroup ? (
        <>
          <g>
            <line
              x1={rangeXStart}
              x2={rangeXStart}
              y1={plotBounds.top}
              y2={rangeYEnd}
              stroke={ScrubBoxColor}
              strokeWidth={1}
            />
            <line
              x1={rangeXEnd}
              x2={rangeXEnd}
              y1={plotBounds.top}
              y2={rangeYEnd}
              stroke={ScrubBoxColor}
              strokeWidth={1}
            />
            <line
              x1={rangeXStart}
              x2={rangeXEnd}
              y1={rangeYEnd}
              y2={rangeYEnd}
              stroke={AnnotationHighlightBottomColor}
              strokeWidth={2}
            />
          </g>
          <g role="presentation" opacity="0.1">
            <rect
              x={Math.min(rangeXStart, rangeXEnd)}
              y={plotBounds.top}
              width={Math.abs(rangeXStart - rangeXEnd)}
              height={rangeYEnd - plotBounds.top}
              fill={AnnotationHighlightColor}
            />
          </g>
        </>
      ) : null}
    </>
  );
}
