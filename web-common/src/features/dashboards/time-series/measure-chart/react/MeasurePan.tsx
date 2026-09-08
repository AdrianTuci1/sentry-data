import { PanButton } from "./PanButton";
import type { PlotBounds } from "../types";

interface MeasurePanProps {
  plotBounds: PlotBounds;
  canPanLeft: boolean;
  canPanRight: boolean;
  onPanLeft?: (() => void) | undefined;
  onPanRight?: (() => void) | undefined;
}

/**
 * React translation of MeasurePan.svelte: shows left/right pan chevrons at the
 * vertical center of the plot when panning in that direction is available.
 */
export function MeasurePan({
  plotBounds,
  canPanLeft,
  canPanRight,
  onPanLeft,
  onPanRight,
}: MeasurePanProps) {
  const midY = plotBounds.top + plotBounds.height / 2;
  const leftX = plotBounds.left - 20;
  const rightX = plotBounds.left + plotBounds.width - 14;

  return (
    <>
      {canPanLeft && onPanLeft ? (
        <g transform={`translate(${leftX}, ${midY})`}>
          <PanButton onClick={onPanLeft} />
        </g>
      ) : null}
      {canPanRight && onPanRight ? (
        <g transform={`translate(${rightX}, ${midY})`}>
          <PanButton onClick={onPanRight} flip />
        </g>
      ) : null}
    </>
  );
}
