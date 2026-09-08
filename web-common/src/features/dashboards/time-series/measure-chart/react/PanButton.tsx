import type { MouseEvent } from "react";

interface PanButtonProps {
  onClick: () => void;
  flip?: boolean;
}

/**
 * React translation of PanButton.svelte: a left/right chevron used by the pan
 * controls. When `flip` is true, the path is mirrored via a scale transform.
 */
export function PanButton({ onClick, flip = false }: PanButtonProps) {
  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    onClick();
  }

  return (
    <g
      className="pan-controls"
      transform={flip ? "translate(32, 0) scale(-1, 1)" : undefined}
    >
      <path
        role="presentation"
        d="M9.335 16.795L21.678 5.756C22.129 5.352 22.844 5.672 22.844 6.277L22.844 27.342C22.844 27.948 22.128 28.268 21.677 27.863L9.335 16.795Z"
        className="pan-button cursor-pointer fill-icon-muted opacity-60 hover:opacity-100"
        onClick={handleClick}
      />
    </g>
  );
}
