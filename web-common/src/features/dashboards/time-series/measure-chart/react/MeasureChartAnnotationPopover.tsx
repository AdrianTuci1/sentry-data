import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AnnotationGroup } from "../annotation-utils";
import { m } from "@statsparrot/web-common/lib/i18n/gen/messages";

interface MeasureChartAnnotationPopoverProps {
  hoveredGroup: AnnotationGroup | null;
  onHover: (hovered: boolean) => void;
}

const MaxAnnotationCount = 7;
const PopoverOpenTimeout = 50;

/**
 * React translation of MeasureChartAnnotationPopover.svelte. The original uses
 * the Svelte `components/popover` primitives; here the popover content is
 * rendered as an absolutely-positioned panel anchored to the hovered
 * annotation marker, preserving the open delay, "see more" expansion, and
 * hover-in/hover-out forwarding to the controller.
 */
export function MeasureChartAnnotationPopover({
  hoveredGroup,
  onHover,
}: MeasureChartAnnotationPopoverProps) {
  const [open, setOpen] = useState(false);
  const [showingMore, setShowingMore] = useState(false);
  const [textOverflow, setTextOverflow] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGroupRef = useRef<AnnotationGroup | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Reset state on group change; open after a short delay.
  useEffect(() => {
    if (lastGroupRef.current === hoveredGroup) return;
    lastGroupRef.current = hoveredGroup;
    setShowingMore(false);
    setTextOverflow(false);
    setOpen(false);
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (hoveredGroup) {
      openTimerRef.current = setTimeout(() => {
        setOpen(true);
        openTimerRef.current = null;
      }, PopoverOpenTimeout);
    }
  }, [hoveredGroup]);

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, []);

  const hasMoreAnnotations =
    !!hoveredGroup &&
    (hoveredGroup.items.length > MaxAnnotationCount || textOverflow);

  const annotationsToShow = (
    showingMore
      ? hoveredGroup?.items
      : hoveredGroup?.items.slice(0, MaxAnnotationCount)
  ) ?? [];

  // Measure which annotations overflow their single-line container.
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    let overflow = false;
    rootRef.current
      .querySelectorAll("[data-annotation-desc]")
      .forEach((node) => {
        const el = node as HTMLElement;
        if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
          overflow = true;
        }
      });
    setTextOverflow(overflow);
  }, [open, showingMore, hoveredGroup]);

  if (!hoveredGroup) return null;

  return (
    <div className="relative" ref={rootRef}>
      {/* Invisible trigger anchored to the marker (mirrors Popover.Trigger). */}
      <div
        className="absolute bottom-2 w-0 h-0"
        style={{ left: `${hoveredGroup.left}px` }}
      />
      {open ? (
        <div
          className="absolute w-80"
          style={{
            left: `${hoveredGroup.left + 12}px`,
            bottom: "2px",
          }}
          role="menu"
          tabIndex={-1}
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
        >
          <div className="flex flex-col gap-y-1 p-2 max-h-[600px] overflow-y-auto bg-surface-subtle border rounded shadow-md">
            {annotationsToShow.map((annotation, i) => (
              <div key={i} className="flex flex-col gap-y-1 p-2">
                <div
                  data-annotation-desc
                  className={`text-popover-foreground font-medium text-sm w-full ${showingMore ? "text-wrap break-words" : "h-5 truncate"}`}
                >
                  {annotation.description}
                </div>
                <div className="text-fg-secondary font-normal text-sm">
                  {annotation.formattedTimeOrRange}
                </div>
              </div>
            ))}
            {hasMoreAnnotations && !showingMore ? (
              <button
                onClick={() => setShowingMore(true)}
                className="flex flex-row items-center gap-x-1 mb-1 p-1 text-sm text-fg-secondary hover:bg-popover-accent hover:rounded-sm outline-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="rotate-90"
                >
                  <path d="M5.99999 10.0001C4.9 10.0001 4 10.9001 4 12.0001C4 13.1001 4.9 14.0001 5.99999 14.0001C7.09999 14.0001 7.99999 13.1001 7.99999 12.0001C7.99999 10.9001 7.09999 10.0001 5.99999 10.0001ZM18.0001 10.0001C16.9 10.0001 16 10.9001 16 12.0001C16 13.1001 16.9 14.0001 18.0001 14.0001C19.1 14.0001 20 13.1001 20 12.0001C20 10.9001 19.1 10.0001 18.0001 10.0001ZM12 10.0001C10.9 10.0001 10 10.9001 10 12.0001C10 13.1001 10.9 14.0001 12 14.0001C13.1 14.0001 14 13.1001 14 12.0001C14 10.9001 13.1 10.0001 12 10.0001Z" />
                </svg>
                <span>{m.dashboard_see_more()}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
