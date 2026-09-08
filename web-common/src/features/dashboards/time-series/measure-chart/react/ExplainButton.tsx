import type { MouseEvent } from "react";
import type { PlotBounds } from "../types";

interface ExplainButtonProps {
  x: number;
  plotBounds: PlotBounds;
  onClick: () => void;
}

/**
 * React translation of ExplainButton.svelte: the floating "Explain" CTA that
 * opens the anomaly explanation chat for the selected measure. The `Bot` icon
 * is inlined here because lucide-react is not a dependency of web-common.
 */
export function ExplainButton({ x, plotBounds, onClick }: ExplainButtonProps) {
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onClick();
  }

  return (
    <button
      className="absolute flex items-center gap-x-1 cursor-pointer hover:underline text-primary text-xs bg-transparent border-none p-0"
      style={{
        left: `${x - 35}px`,
        top: `${plotBounds.top + plotBounds.height + 2}px`,
      }}
      onClick={handleClick}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary -mt-0.5"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
      <span>Explain (E)</span>
    </button>
  );
}
