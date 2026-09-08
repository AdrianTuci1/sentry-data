import { Fragment } from "react";
import type { ScaleLinear } from "d3-scale";

interface MeasureChartGridProps {
  yTicks: number[];
  xTickIndices: number[];
  yScale: ScaleLinear<number, number>;
  xScale: ScaleLinear<number, number>;
  plotLeft: number;
  plotWidth: number;
  plotTop: number;
  plotHeight: number;
  yTickLabels: string[];
}

const DASH = "1,1.5";

/**
 * React translation of MeasureChartGrid.svelte: renders the Y-axis tick labels
 * with horizontal gridlines, X-axis vertical gridlines, and either a zero line
 * (when zero is within the Y domain) or the plot's bottom border.
 */
export function MeasureChartGrid(props: MeasureChartGridProps) {
  const {
    yTicks,
    xTickIndices,
    yScale,
    xScale,
    plotLeft,
    plotWidth,
    plotTop,
    plotHeight,
    yTickLabels,
  } = props;

  const domain = yScale.domain();
  const showZero = domain[0] <= 0 && domain[1] >= 0;

  return (
    <>
      <g className="y-axis">
        {yTicks.map((tick, i) => (
          <Fragment key={tick}>
            <text
              className="fill-fg-muted text-[11px]"
              textAnchor="start"
              x={plotLeft + plotWidth + 4}
              y={yScale(tick) + 4}
            >
              {yTickLabels[i]}
            </text>
            <line
              className="stroke-gray-300"
              x1={plotLeft}
              x2={plotLeft + plotWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              strokeWidth="0.75"
              strokeDasharray={DASH}
            />
          </Fragment>
        ))}
      </g>

      <g className="x-axis">
        {xTickIndices.map((idx) => (
          <line
            key={idx}
            className="stroke-border"
            x1={xScale(idx)}
            x2={xScale(idx)}
            y1={plotTop}
            y2={plotTop + plotHeight}
            strokeWidth="0.75"
            strokeDasharray={DASH}
          />
        ))}
      </g>

      {/* Zero line or bottom border */}
      <line
        className="stroke-gray-300"
        x1={plotLeft}
        x2={plotLeft + plotWidth}
        y1={showZero ? yScale(0) : plotTop + plotHeight}
        y2={showZero ? yScale(0) : plotTop + plotHeight}
      />
    </>
  );
}
