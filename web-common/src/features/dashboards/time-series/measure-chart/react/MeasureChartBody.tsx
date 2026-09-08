import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { get } from "svelte/store";
import { m } from "@statsparrot/web-common/lib/i18n/gen/messages";
import { snapToNearestNonNull } from "@statsparrot/web-common/components/time-series-chart/sparse-data-utils";
import { TimeSeriesChart } from "@statsparrot/web-common/components/time-series-chart/react/TimeSeriesChart";
import { BarChart } from "@statsparrot/web-common/components/time-series-chart/react/BarChart";
import { TDDChart } from "@statsparrot/web-common/features/dashboards/time-dimension-details/types";
import type { Annotation } from "@statsparrot/web-common/features/dashboards/time-series/measure-chart/annotation-utils";
import { qualitativeColorsArray } from "@statsparrot/web-common/features/themes/palette-store";
import { createMeasureValueFormatter } from "@statsparrot/web-common/lib/number-formatting/format-measure-value";
import { formatGrainBucket } from "@statsparrot/web-common/lib/time/ranges/formatter";
import type {
  MetricsViewSpecMeasure,
  V1TimeGrain,
} from "@statsparrot/web-common/runtime-client";
import { useReadable } from "@statsparrot/web-common/features/components/charts/react/useReadable";
import { scaleLinear } from "d3-scale";
import type { Interval } from "luxon";
import { DateTime } from "luxon";
import { measureSelection } from "../../measure-selection/measure-selection";
import { groupAnnotations } from "../annotation-utils";
import { AnnotationPopoverController } from "../AnnotationPopoverController";
import {
  buildChartSeries,
  computeTooltipDelta,
  determineMode,
} from "../chart-series";
import { ComparisonTooltip } from "./ComparisonTooltip";
import { ExplainButton } from "./ExplainButton";
import { hoverIndex } from "../hover-index";
import { EMPTY_HOVER } from "../interactions";
import { MeasureChartAnnotationMarkers } from "./MeasureChartAnnotationMarkers";
import { MeasureChartAnnotationPopover } from "./MeasureChartAnnotationPopover";
import { MeasureChartGrid } from "./MeasureChartGrid";
import { MeasureChartHoverTooltip } from "./MeasureChartHoverTooltip";
import { MeasureChartPointIndicator } from "./MeasureChartPointIndicator";
import { MeasureChartScrub } from "./MeasureChartScrub";
import { MeasureChartTooltip } from "./MeasureChartTooltip";
import { MeasurePan } from "./MeasurePan";
import {
  computeChartConfig,
  computeNiceYExtent,
  computeXTickIndices,
  computeYExtent,
  X_PAD,
} from "../scales";
import { ScrubController } from "../ScrubController";
import type {
  DimensionSeriesData,
  HoverState,
  TimeSeriesPoint,
} from "../types";
import {
  dateToIndex,
  formatUniqueTickLabels,
  snapIndex,
} from "../utils";

const MIN_SNAP_INDICES = 3;
const SNAP_FRACTION = 0.05;
const CLICK_THRESHOLD_PX = 4;

export interface MeasureChartBodyProps {
  measure: MetricsViewSpecMeasure;
  measureName: string;
  data: TimeSeriesPoint[];
  dimensionData: DimensionSeriesData[];
  annotations: Annotation[];
  showComparison: boolean;
  showTimeDimensionDetail: boolean;
  timeGranularity: V1TimeGrain | undefined;
  interval: Interval<true> | undefined;
  comparisonInterval: Interval<true> | undefined;
  chartScrubInterval: Interval<true> | undefined;
  canPanLeft: boolean;
  canPanRight: boolean;
  onPanLeft: (() => void) | undefined;
  onPanRight: (() => void) | undefined;
  onScrub:
    | ((range: {
        start: DateTime;
        end: DateTime;
        isScrubbing: boolean;
      }) => void)
    | undefined;
  onScrubClear: (() => void) | undefined;
  scrubController: ScrubController | undefined;
  metricsViewName: string;
  connectNulls: boolean;
  dynamicYAxis: boolean;
  tddChartType: TDDChart;
  tddChartHeight: number;
}

function offsetOf(e: ReactMouseEvent<SVGSVGElement>): { x: number; y: number } {
  const rect = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/**
 * React translation of MeasureChartBody.svelte: the SVG renderer for the
 * per-measure time-series chart with scrub/brush, hover tooltips, annotations,
 * pan controls and the explain CTA. All framework-agnostic helpers (scales,
 * chart-series, annotation-utils, sparse-data-utils, ScrubController,
 * AnnotationPopoverController, measure-selection) are imported verbatim.
 * Svelte `$store` values are bridged via useReadable().
 */
export function MeasureChartBody(props: MeasureChartBodyProps) {
  const {
    measure,
    measureName,
    data,
    dimensionData,
    annotations,
    showComparison,
    showTimeDimensionDetail,
    timeGranularity,
    interval,
    comparisonInterval,
    chartScrubInterval,
    canPanLeft,
    canPanRight,
    onPanLeft,
    onPanRight,
    onScrub,
    onScrubClear,
    scrubController,
    metricsViewName,
    connectNulls,
    dynamicYAxis,
    tddChartType,
    tddChartHeight,
  } = props;

  const chartId = useMemo(() => Math.random().toString(36).slice(2, 11), []);

  // Controller / store bridges.
  const annotationPopoverRef = useRef<AnnotationPopoverController | null>(null);
  if (!annotationPopoverRef.current) {
    annotationPopoverRef.current = new AnnotationPopoverController();
  }
  const annotationPopover = annotationPopoverRef.current;
  const hoveredAnnotationGroup = useReadable(annotationPopover.hoveredGroup);

  const explainEnabledStore = useMemo(() => measureSelection.getEnabledStore(), []);
  const explainEnabled = useReadable(explainEnabledStore);
  const selMeasure = useReadable(measureSelection.measure);
  const selStart = useReadable(measureSelection.start);
  const selEnd = useReadable(measureSelection.end);
  const currentScrubState = useReadable(scrubController?.state);
  const hoveredStore = useReadable(hoverIndex);
  const qualitativeColors = useReadable(qualitativeColorsArray);

  // Mutable interaction state.
  const [clientWidth, setClientWidth] = useState(425);
  const [mousePageX, setMousePageX] = useState<number | null>(null);
  const [mousePageY, setMousePageY] = useState<number | null>(null);
  const [hoverState, setHoverState] = useState<HoverState>(EMPTY_HOVER);
  const mouseDownX = useRef<number | null>(null);
  const mouseDownY = useRef<number | null>(null);
  const wasDragging = useRef(false);

  // Measure container width (mirrors `bind:clientWidth`).
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setClientWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Cleanup subscriptions on destroy.
  useEffect(() => {
    return () => {
      hoverIndex.clear(chartId);
      annotationPopover.destroy();
    };
  }, [chartId, annotationPopover]);

  const lowerIsBetter = measure?.lowerIsBetter ?? false;
  const height = showTimeDimensionDetail ? tddChartHeight : 145;
  const config = useMemo(
    () => computeChartConfig(clientWidth, height, showTimeDimensionDetail),
    [clientWidth, height, showTimeDimensionDetail],
  );
  const pb = config.plotBounds;

  const mode = useMemo(
    () => determineMode(tddChartType, data),
    [tddChartType, data],
  );
  const chartSeries = useMemo(
    () => buildChartSeries(data, dimensionData, showComparison),
    [data, dimensionData, showComparison],
  );
  const barSeries = useMemo(
    () =>
      mode === "bar" && showComparison && chartSeries.length === 2
        ? [chartSeries[1], chartSeries[0]]
        : chartSeries,
    [mode, showComparison, chartSeries],
  );

  // Y extent & scales
  const yRawExtent = useMemo(
    () => computeYExtent(data, dimensionData, showComparison),
    [data, dimensionData, showComparison],
  );
  const [yMin, yMax] = useMemo(
    () =>
      computeNiceYExtent(
        yRawExtent[0],
        yRawExtent[1],
        dynamicYAxis ? { includeZero: false, paddingFactor: 1.2 } : undefined,
      ),
    [yRawExtent, dynamicYAxis],
  );

  const dataLastIndex = Math.max(0, data.length - 1);
  const barSlotWidth = pb.width / Math.max(1, data.length);
  const xRangeStart =
    mode === "line" ? pb.left + X_PAD : pb.left + barSlotWidth / 2;
  const xRangeEnd =
    mode === "line"
      ? pb.left + pb.width - X_PAD
      : pb.left + pb.width - barSlotWidth / 2;
  const xScale = useMemo(
    () => scaleLinear<number>().domain([0, dataLastIndex]).range([xRangeStart, xRangeEnd]),
    [dataLastIndex, xRangeStart, xRangeEnd],
  );
  const yScale = useMemo(
    () => scaleLinear<number>().domain([yMin, yMax]).range([pb.top + pb.height, pb.top]),
    [yMin, yMax, pb.top, pb.height],
  );
  const scales = useMemo(() => ({ x: xScale, y: yScale }), [xScale, yScale]);
  const yTicks = useMemo(() => yScale.ticks(3), [yScale]);
  const xTickIndices = useMemo(
    () => computeXTickIndices(mode, data.length),
    [mode, data.length],
  );

  // Keep scrub controller in sync with data length.
  useEffect(() => {
    scrubController?.setDataLength(data.length);
  }, [scrubController, data.length]);

  // Register the x-scale for cross-chart hover snapping.
  useEffect(() => {
    hoverIndex.registerScale(xScale);
  }, [xScale]);

  const isScrubbing = Boolean(currentScrubState?.isScrubbing);

  // Scrub indices: local (active) while scrubbing, external (URL) otherwise.
  const externalScrubStartIndex = useMemo(
    () =>
      chartScrubInterval ? dateToIndex(data, chartScrubInterval.start.toMillis()) : null,
    [chartScrubInterval, data],
  );
  const externalScrubEndIndex = useMemo(
    () =>
      chartScrubInterval ? dateToIndex(data, chartScrubInterval.end.toMillis()) : null,
    [chartScrubInterval, data],
  );
  const scrubStartIndex = currentScrubState?.startIndex ?? externalScrubStartIndex;
  const scrubEndIndex = currentScrubState?.endIndex ?? externalScrubEndIndex;
  const hasScrubSelection = scrubStartIndex !== null && scrubEndIndex !== null;

  // Hover state
  const maxSnapDistance = Math.max(MIN_SNAP_INDICES, data.length * SNAP_FRACTION);
  const isLocallyHovered =
    hoverState.isHovered && hoverState.index !== null && data.length > 0;
  const snapSeries = useMemo(
    () => [
      data.map((d) => d.value),
      ...(showComparison ? [data.map((d) => d.comparisonValue ?? null)] : []),
      ...dimensionData.map((dim) => dim.data.map((d) => d.value)),
      ...(showComparison
        ? dimensionData.map((dim) => dim.data.map((d) => d.comparisonValue ?? null))
        : []),
    ],
    [data, showComparison, dimensionData],
  );
  const snappedHoverIndex = useMemo(
    () =>
      isLocallyHovered && hoverState.index !== null
        ? snapToNearestNonNull(
            hoverState.index,
            snapSeries,
            (v) => v,
            maxSnapDistance,
          )
        : null,
    [isLocallyHovered, hoverState.index, snapSeries, maxSnapDistance, data.length],
  );

  // Sync the shared hoverIndex store with local snapping / scrub highlight.
  useEffect(() => {
    if (snappedHoverIndex !== null) {
      hoverIndex.set(snappedHoverIndex, chartId);
    } else if (
      hasScrubSelection &&
      scrubStartIndex !== null &&
      scrubEndIndex !== null
    ) {
      hoverIndex.setRange(scrubStartIndex, scrubEndIndex, chartId);
    } else {
      hoverIndex.clear(chartId);
    }
  }, [snappedHoverIndex, hasScrubSelection, scrubStartIndex, scrubEndIndex, chartId]);

  const hoveredIndex = hoveredStore?.start ?? -1;
  const hoveredPoint = data[hoveredIndex] ?? null;
  const cursorStyle = useMemo(
    () => scrubController?.getCursorStyle(hoverState.screenX, xScale),
    [scrubController, hoverState.screenX, xScale],
  );

  // Formatters
  const measureFormatter = useMemo(
    () => createMeasureValueFormatter(measure, "tooltip"),
    [measure],
  );
  const valueFormatter = useCallback(
    (value: number | null): string => {
      if (value === null) return "no data";
      return measureFormatter(value);
    },
    [measureFormatter],
  );
  const axisFormatter = useMemo(
    () => createMeasureValueFormatter(measure, "axis"),
    [measure],
  );
  const defaultFormatter = useMemo(
    () => createMeasureValueFormatter(measure, "table"),
    [measure],
  );
  const yTickLabels = useMemo(
    () => formatUniqueTickLabels(yTicks, axisFormatter, defaultFormatter),
    [yTicks, axisFormatter, defaultFormatter],
  );

  // Annotations
  const annotationGroups = useMemo(
    () => groupAnnotations(annotations, scales, data, config, timeGranularity),
    [annotations, scales, data, config, timeGranularity],
  );

  // Tooltip data
  const isComparingDimension = dimensionData.length > 0;
  const dimTooltipEntries = useMemo(() => {
    if (!isComparingDimension || hoveredIndex < 0) return [];
    const colors = qualitativeColors ?? [];
    return dimensionData
      .map((dim, i) => ({
        label: dim.dimensionValue ?? "null",
        value: dim.data[hoveredIndex]?.value ?? null,
        color: colors[i % colors.length] || dim.color,
      }))
      .filter((e) => e.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  }, [isComparingDimension, hoveredIndex, dimensionData, qualitativeColors]);

  // Time comparison delta
  const tooltipDelta = useMemo(() => computeTooltipDelta(hoveredPoint), [hoveredPoint]);
  const {
    currentValue: tooltipCurrentValue,
    comparisonValue: tooltipComparisonValue,
    deltaLabel: tooltipDeltaLabel,
    deltaPositive: tooltipDeltaPositive,
  } = tooltipDelta;

  // Explain CTA positioning
  const isThisMeasureSelected = selMeasure === measureName;
  const singleSelectIdx = useMemo(
    () =>
      isThisMeasureSelected && selStart && !selEnd
        ? dateToIndex(data, selStart.getTime())
        : null,
    [isThisMeasureSelected, selStart, selEnd, data],
  );
  const singleSelectX = singleSelectIdx !== null ? scales.x(singleSelectIdx) : null;
  const explainX = useMemo(() => {
    if (!isThisMeasureSelected) return null;
    if (
      selEnd &&
      hasScrubSelection &&
      scrubStartIndex !== null &&
      scrubEndIndex !== null
    ) {
      return Math.round((scales.x(scrubStartIndex) + scales.x(scrubEndIndex)) / 2);
    }
    if (singleSelectX !== null) return singleSelectX;
    return null;
  }, [isThisMeasureSelected, selEnd, hasScrubSelection, scrubStartIndex, scrubEndIndex, scales, singleSelectX]);

  // Single-point selection marker data (rendered when this measure is selected).
  const singleSelectPt = singleSelectIdx !== null ? data[singleSelectIdx] : undefined;
  const showSingleSelect =
    singleSelectIdx !== null &&
    singleSelectX !== null &&
    isThisMeasureSelected &&
    singleSelectPt?.value !== null &&
    singleSelectPt?.value !== undefined;

  function indexToDateTime(idx: number | null): DateTime | null {
    if (idx === null || data.length === 0) return null;
    const dt = data[snapIndex(idx, data.length)]?.ts;
    return dt?.isValid ? dt : null;
  }

  function clampX(offsetX: number) {
    return Math.max(pb.left, Math.min(pb.left + pb.width, offsetX));
  }

  function handleReset() {
    onScrubClear?.();
    scrubController?.reset();
  }

  function handleSvgMouseLeave() {
    setHoverState(EMPTY_HOVER);
    setMousePageX(null);
    setMousePageY(null);
    annotationPopover.scheduleClear();
  }

  function handleSvgMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    const { x, y } = offsetOf(e);
    const clamped = clampX(x);
    const fractionalIndex = xScale.invert(clamped);

    setHoverState({
      index: fractionalIndex,
      screenX: clamped,
      screenY: y,
      isHovered: true,
    });

    // Update scrub if dragging
    if (scrubController && get(scrubController.state).isScrubbing) {
      scrubController.update(clamped, xScale);
    }

    // The controller is framework-agnostic and expects a native MouseEvent;
    // it only reads clientX/clientY/currentTarget, which React's event also has.
    annotationPopover.checkHover(e as unknown as MouseEvent, annotationGroups, isScrubbing);
    setMousePageX(e.pageX);
    setMousePageY(e.pageY);
  }

  function handleMouseDown(e: ReactMouseEvent<SVGSVGElement>) {
    if (!scrubController || e.button !== 0) return;
    mouseDownX.current = e.clientX;
    mouseDownY.current = e.clientY;
    const x = clampX(offsetOf(e).x);

    // If there's a visual selection from external scrubRange but controller is empty,
    // initialize the controller so edge-resize and move detection work
    const controllerState = get(scrubController.state);
    if (
      controllerState.startIndex === null &&
      externalScrubStartIndex !== null &&
      externalScrubEndIndex !== null
    ) {
      scrubController.initFromExternal(externalScrubStartIndex, externalScrubEndIndex);
    }

    scrubController.start(x, xScale);
  }

  function finalizeScrubSelection(startIndex: number, endIndex: number) {
    const startDt = indexToDateTime(startIndex);
    const endDt = indexToDateTime(endIndex);
    if (!startDt || !endDt) return;
    onScrub?.({ start: startDt, end: endDt, isScrubbing: false });
    if (measureName) {
      const s = startDt.toJSDate();
      const e = endDt.toJSDate();
      const [start, end] = s < e ? [s, e] : [e, s];
      measureSelection.setRange(measureName, start, end);
    }
    scrubController?.reset();
  }

  function handlePointClick(offsetX: number) {
    const clickedIndex = Math.max(
      0,
      Math.min(data.length - 1, Math.round(xScale.invert(clampX(offsetX)))),
    );
    const pt = data[clickedIndex];
    if (pt?.ts?.isValid && measureName) {
      onScrubClear?.();
      measureSelection.setStart(measureName, pt.ts.toJSDate());
    }
  }

  function handleMouseUp(e: ReactMouseEvent<SVGSVGElement>) {
    if (!scrubController) return;

    const wasClick =
      mouseDownX.current !== null &&
      mouseDownY.current !== null &&
      Math.abs(e.clientX - mouseDownX.current) < CLICK_THRESHOLD_PX &&
      Math.abs(e.clientY - mouseDownY.current) < CLICK_THRESHOLD_PX;

    wasDragging.current = !wasClick;

    // Capture scrub state BEFORE end() which may reset it
    const scrubState = get(scrubController.state);
    const { startIndex, endIndex } = scrubState;
    const selectionKept = scrubController.end();
    mouseDownX.current = null;
    mouseDownY.current = null;

    if (!scrubState.isScrubbing) return;

    if (selectionKept && startIndex !== null && endIndex !== null) {
      finalizeScrubSelection(startIndex, endIndex);
    } else if (wasClick) {
      // Check external scrub (from store/URL), not the reactive hasScrubSelection
      // which includes transient controller state from mousedown
      const hasExternalScrub =
        externalScrubStartIndex !== null && externalScrubEndIndex !== null;
      if (!hasExternalScrub) {
        handlePointClick(offsetOf(e).x);
      } else {
        onScrubClear?.();
      }
    } else {
      onScrubClear?.();
    }
  }

  function handleChartClick(e: ReactMouseEvent<SVGSVGElement>) {
    e.stopPropagation();
    e.preventDefault();

    // Skip if we just finished a drag - only handle actual clicks
    if (wasDragging.current) {
      wasDragging.current = false;
      return;
    }

    // Use visual scrub indices (controller OR external scrubRange)
    if (scrubStartIndex === null || scrubEndIndex === null || isScrubbing) {
      return;
    }

    const x = clampX(offsetOf(e).x);
    const clickIndex = xScale.invert(x);
    const [minIdx, maxIdx] =
      scrubStartIndex < scrubEndIndex
        ? [scrubStartIndex, scrubEndIndex]
        : [scrubEndIndex, scrubStartIndex];
    const isOutside = clickIndex < minIdx || clickIndex > maxIdx;

    if (isOutside) {
      scrubController?.reset();
      onScrubClear?.();
      measureSelection.clear();
    } else if (measureName) {
      const startDt = indexToDateTime(scrubStartIndex);
      const endDt = indexToDateTime(scrubEndIndex);
      if (startDt && endDt) {
        const s = startDt.toJSDate();
        const e2 = endDt.toJSDate();
        const [start, end] = s < e2 ? [s, e2] : [e2, s];
        measureSelection.setRange(measureName, start, end);
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`measure-chart ${cursorStyle} select-none size-full relative overflow-visible`}
    >
      <svg
        role="presentation"
        aria-label={m.dashboard_measure_chart_aria({ name: measureName })}
        className="size w-full overflow-visible"
        height={`${height}px`}
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={handleSvgMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleChartClick}
      >
        <defs>
          <clipPath id={`chart-body-${chartId}`}>
            <rect x={pb.left} y={pb.top} width={pb.width} height={pb.height} />
          </clipPath>
        </defs>

        <MeasureChartGrid
          yTicks={yTicks}
          xTickIndices={xTickIndices}
          yScale={yScale}
          xScale={xScale}
          plotLeft={pb.left}
          plotWidth={pb.width}
          plotTop={pb.top}
          plotHeight={pb.height}
          yTickLabels={yTickLabels}
        />

        <g clipPath={`url(#chart-body-${chartId})`}>
          {mode === "line" ? (
            <TimeSeriesChart
              series={chartSeries}
              scales={scales}
              hasScrubSelection={hasScrubSelection}
              scrubStartIndex={scrubStartIndex}
              scrubEndIndex={scrubEndIndex}
              connectNulls={connectNulls}
            />
          ) : (
            <BarChart
              series={barSeries}
              yScale={scales.y}
              stacked={false}
              plotLeft={pb.left}
              plotWidth={pb.width}
              visibleStart={0}
              visibleEnd={dataLastIndex}
              scrubStartIndex={scrubStartIndex}
              scrubEndIndex={scrubEndIndex}
            />
          )}
        </g>

        {!isScrubbing && hoveredPoint ? (
          <MeasureChartTooltip
            scales={scales}
            config={config}
            hoveredIndex={hoveredIndex}
            hoveredPoint={hoveredPoint}
            dimensionData={dimensionData}
            showComparison={showComparison}
            isComparingDimension={dimensionData.length > 0}
            isBarMode={mode === "bar"}
            visibleStart={0}
            visibleEnd={dataLastIndex}
          />
        ) : null}

        {/* Date label in top-left corner */}
        {!isScrubbing && hoveredPoint && !isComparingDimension ? (
          <g className="data-readout">
            <text
              className="fill-fg-muted text-outline text-[11px]"
              aria-label={m.dashboard_measure_chart_primary_time_label_aria({
                name: measureName,
              })}
              x={pb.left + 6}
              y={pb.top + 10}
            >
              {formatGrainBucket(hoveredPoint.ts, timeGranularity, interval)}
            </text>

            {/* Comparison values only on non-hovered charts (hovered chart shows floating tooltip) */}
            {showComparison && !isLocallyHovered ? (
              <ComparisonTooltip
                x={pb.left + 6}
                y={pb.top + 22}
                tooltipCurrentValue={tooltipCurrentValue}
                tooltipComparisonValue={tooltipComparisonValue}
                tooltipDeltaLabel={tooltipDeltaLabel}
                tooltipDeltaPositive={tooltipDeltaPositive}
                lowerIsBetter={lowerIsBetter}
                showDelta={tooltipComparisonValue !== null && !!tooltipDeltaLabel}
                valueFormatter={valueFormatter}
              />
            ) : null}
          </g>
        ) : null}

        {/* Single-point selection indicator */}
        {showSingleSelect && singleSelectPt ? (
          <MeasureChartPointIndicator
            x={singleSelectX!}
            y={scales.y(singleSelectPt.value!)}
            zeroY={Math.max(
              Math.min(scales.y(0), pb.top + pb.height),
              pb.top,
            )}
            selected
          />
        ) : null}

        <MeasureChartScrub
          scales={scales}
          config={config}
          startIndex={scrubStartIndex}
          endIndex={scrubEndIndex}
          isScrubbing={isScrubbing}
          onReset={handleReset}
        />

        {isLocallyHovered ? (
          <MeasurePan
            plotBounds={pb}
            canPanLeft={canPanLeft}
            canPanRight={canPanRight}
            onPanLeft={onPanLeft}
            onPanRight={onPanRight}
          />
        ) : null}

        {annotationGroups.length > 0 ? (
          <MeasureChartAnnotationMarkers
            groups={annotationGroups}
            hoveredGroup={hoveredAnnotationGroup ?? null}
            plotBounds={pb}
          />
        ) : null}
      </svg>

      {/* Floating tooltip */}
      {!isScrubbing && isLocallyHovered && hoveredPoint && mousePageX !== null && mousePageY !== null ? (
        <MeasureChartHoverTooltip
          mouseX={mousePageX}
          mouseY={mousePageY}
          currentValue={tooltipCurrentValue}
          comparisonValue={tooltipComparisonValue}
          currentTs={hoveredPoint.ts}
          comparisonTs={hoveredPoint.comparisonTs}
          timeGranularity={timeGranularity}
          interval={interval}
          comparisonInterval={comparisonInterval}
          showComparison={showComparison}
          isComparingDimension={isComparingDimension}
          dimTooltipEntries={dimTooltipEntries}
          deltaLabel={tooltipDeltaLabel}
          deltaPositive={tooltipDeltaPositive}
          lowerIsBetter={lowerIsBetter}
          formatter={valueFormatter}
        />
      ) : null}

      {annotationGroups.length > 0 ? (
        <MeasureChartAnnotationPopover
          hoveredGroup={hoveredAnnotationGroup ?? null}
          onHover={(h) => annotationPopover.setPopoverHovered(h)}
        />
      ) : null}

      {/* Explain CTA */}
      {explainEnabled && !isScrubbing && explainX !== null ? (
        <ExplainButton
          x={explainX}
          plotBounds={pb}
          onClick={() => measureSelection.startAnomalyExplanationChat(metricsViewName)}
        />
      ) : null}
    </div>
  );
}
