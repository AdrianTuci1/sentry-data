import { useCallback, useEffect, useMemo, useRef } from "react";
import { TDDChart } from "@statsparrot/web-common/features/dashboards/time-dimension-details/types";
import { V1TimeGrainToDateTimeUnit } from "@statsparrot/web-common/lib/time/new-grains";
import type { MetricsViewSpecMeasure } from "@statsparrot/web-common/runtime-client";
import {
  createQueryServiceMetricsViewTimeSeries,
  V1TimeGrain,
  type V1Expression,
} from "@statsparrot/web-common/runtime-client";
import { useRuntimeClient } from "@statsparrot/web-common/runtime-client/v2";
import { keepPreviousData } from "@tanstack/svelte-query";
import { DateTime, Interval } from "luxon";
import { createAnnotationsQuery } from "../../annotations-selectors";
import type { Annotation } from "../annotation-utils";
import { adjustTimeInterval, localToTimeZoneOffset } from "../../utils";
import {
  resolveEffectiveChartType,
  usesVegaRenderer,
} from "../chart-series";
import { chartBrushStore, chartHoverStore, hoverIndex } from "../hover-index";
import { createVisibilityObserver } from "../interactions";
import { useReadable } from "@statsparrot/web-common/features/components/charts/react/useReadable";
import { ScrubController } from "../ScrubController";
import type { TimeSeriesPoint } from "../types";
import {
  buildDimensionSeriesData,
  createDimensionAggregationQuery,
} from "../use-dimension-data";
import { transformTimeSeriesData } from "../use-measure-time-series";
import { dateToIndex } from "../utils";
import { MeasureChartBody } from "./MeasureChartBody";
import { MeasureChartVegaNotSupported } from "./MeasureChartVegaNotSupported";

const VISIBILITY_ROOT_MARGIN = "120px";

export interface MeasureChartProps {
  measure: MetricsViewSpecMeasure;
  metricsViewName: string;
  where?: V1Expression | undefined;
  timeDimension?: string | undefined;
  interval?: Interval<true> | undefined;
  comparisonInterval?: Interval<true> | undefined;
  timeGranularity?: V1TimeGrain | undefined;
  timeZone?: string;
  comparisonDimension?: string | undefined;
  dimensionValues?: (string | null)[];
  dimensionWhere?: V1Expression | undefined;
  annotationsEnabled?: boolean;
  showComparison?: boolean;
  showTimeDimensionDetail?: boolean;
  ready?: boolean;
  chartScrubInterval?: Interval<true> | undefined;
  canPanLeft?: boolean;
  canPanRight?: boolean;
  tddChartType?: TDDChart;
  onScrub?:
    | ((range: {
        start: DateTime;
        end: DateTime;
        isScrubbing: boolean;
      }) => void)
    | undefined;
  onScrubClear?: (() => void) | undefined;
  onPanLeft?: (() => void) | undefined;
  onPanRight?: (() => void) | undefined;
  scrubController?: ScrubController | undefined;
  connectNulls?: boolean;
  dynamicYAxis?: boolean;
  tddChartHeight?: number;
}

/**
 * React translation of MeasureChart.svelte (increment: SVG-renderer-only scope).
 *
 * It runs the time-series / comparison / dimension queries (framework-agnostic
 * runtime-client helpers) and renders the SVG MeasureChartBody renderer for the
 * supported chart types (adaptive/line). The Vega-rendered chart types
 * (stacked/grouped bar, stacked area) render an explicit placeholder
 * (MeasureChartVegaNotSupported) because the Vega graphic renderer
 * (TDDMeasureChart) is ported to React in a separate, later increment. Wiring
 * this component into the live Settings host is also a separate increment;
 * the Svelte host (MetricsTimeSeriesCharts) remains the source of truth.
 */
export function MeasureChart(props: MeasureChartProps) {
  const {
    measure,
    metricsViewName,
    where = undefined,
    timeDimension = undefined,
    interval = undefined,
    comparisonInterval = undefined,
    timeGranularity = undefined,
    timeZone = "UTC",
    comparisonDimension = undefined,
    dimensionValues = [],
    dimensionWhere = undefined,
    annotationsEnabled = false,
    showComparison = false,
    showTimeDimensionDetail = false,
    ready = true,
    chartScrubInterval = undefined,
    canPanLeft = false,
    canPanRight = false,
    tddChartType = TDDChart.DEFAULT,
    onScrub = undefined,
    onScrubClear = undefined,
    onPanLeft = undefined,
    onPanRight = undefined,
    scrubController = undefined,
    connectNulls = true,
    dynamicYAxis = false,
    tddChartHeight = 245,
  } = props;

  const client = useRuntimeClient();
  const visibility = useRef(createVisibilityObserver(VISIBILITY_ROOT_MARGIN)).current;
  const { visible, observe } = visibility;
  const isVisible = useReadable(visible);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    return observe(el);
  }, [observe]);

  const measureName = measure.name ?? "";
  const height = showTimeDimensionDetail ? tddChartHeight : 145;

  // Dimension comparison data
  const hasDimensionComparison = useMemo(
    () =>
      !!comparisonDimension && dimensionValues.length > 0 && !!timeDimension,
    [comparisonDimension, dimensionValues, timeDimension],
  );

  const effectiveChartType = useMemo(
    () => resolveEffectiveChartType(tddChartType, hasDimensionComparison),
    [tddChartType, hasDimensionComparison],
  );
  const vegaChart = usesVegaRenderer(effectiveChartType);

  // Seed the shared brush store from the persisted scrub interval so TDD Vega
  // charts can render the brush on mount, chart-type switch, or page refresh.
  const brushState = useReadable(chartBrushStore);
  useEffect(() => {
    const brushStoreEmpty = brushState?.startMs === undefined;
    if (
      vegaChart &&
      brushStoreEmpty &&
      chartScrubInterval?.start &&
      chartScrubInterval?.end
    ) {
      const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const vegaStartMs = chartScrubInterval.start
        .setZone(systemTimeZone, { keepLocalTime: true })
        .toMillis();
      const vegaEndMs = chartScrubInterval.end
        .setZone(systemTimeZone, { keepLocalTime: true })
        .toMillis();
      chartBrushStore.set({ startMs: vegaStartMs, endMs: vegaEndMs });
    }
  }, [vegaChart, brushState?.startMs, chartScrubInterval]);

  // Extract ISO strings for API calls (must be UTC for protobuf Timestamp parsing)
  const timeStart = interval?.start?.toUTC().toISO() ?? undefined;
  const timeEnd = interval?.end?.toUTC().toISO() ?? undefined;
  const comparisonTimeStart = comparisonInterval?.start?.toUTC().toISO() ?? undefined;
  const comparisonTimeEnd = comparisonInterval?.end?.toUTC().toISO() ?? undefined;

  const timeSeriesQuery = useMemo(
    () =>
      createQueryServiceMetricsViewTimeSeries(
        client,
        {
          metricsViewName,
          measureNames: [measureName],
          where,
          timeDimension,
          timeStart,
          timeEnd,
          timeGranularity,
          timeZone,
        },
        {
          query: {
            enabled: isVisible && ready && !!timeStart,
            placeholderData: keepPreviousData,
            refetchOnMount: false,
          },
        },
      ),
    [client, metricsViewName, measureName, where, timeDimension, timeStart, timeEnd, timeGranularity, timeZone, isVisible, ready],
  );
  const timeSeriesResult = useReadable(timeSeriesQuery);

  const comparisonTimeSeriesQuery = useMemo(
    () =>
      createQueryServiceMetricsViewTimeSeries(
        client,
        {
          metricsViewName,
          measureNames: [measureName],
          where,
          timeDimension,
          timeStart: comparisonTimeStart,
          timeEnd: comparisonTimeEnd,
          timeGranularity,
          timeZone,
        },
        {
          query: {
            enabled: isVisible && ready && showComparison && !!comparisonTimeStart,
            placeholderData: keepPreviousData,
            refetchOnMount: false,
          },
        },
      ),
    [client, metricsViewName, measureName, where, timeDimension, comparisonTimeStart, comparisonTimeEnd, timeGranularity, timeZone, isVisible, ready, showComparison],
  );
  const comparisonTimeSeriesResult = useReadable(comparisonTimeSeriesQuery);

  const comparisonData = useMemo(
    () =>
      showComparison && !comparisonTimeSeriesResult?.isFetching
        ? comparisonTimeSeriesResult?.data?.data
        : undefined,
    [showComparison, comparisonTimeSeriesResult],
  );

  const data = useMemo(
    () =>
      timeSeriesResult?.isFetching || !timeSeriesResult?.data?.data
        ? ([] as TimeSeriesPoint[])
        : transformTimeSeriesData(
            timeSeriesResult.data.data,
            comparisonData,
            measureName,
            timeZone,
          ),
    [timeSeriesResult, comparisonData, measureName, timeZone],
  );

  const isError = timeSeriesResult?.isError;
  const error = timeSeriesResult?.error?.message;

  const dimAggQuery = useMemo(
    () =>
      hasDimensionComparison
        ? createDimensionAggregationQuery(
            client,
            metricsViewName,
            measureName,
            comparisonDimension!,
            dimensionValues,
            dimensionWhere,
            timeDimension!,
            timeStart,
            timeEnd,
            timeGranularity!,
            timeZone,
            isVisible && ready && !!timeStart,
          )
        : undefined,
    [client, metricsViewName, measureName, comparisonDimension, dimensionValues, dimensionWhere, timeDimension, timeStart, timeEnd, timeGranularity, timeZone, isVisible, ready, hasDimensionComparison],
  );
  const dimAggResult = useReadable(dimAggQuery);

  const dimCompAggQuery = useMemo(
    () =>
      hasDimensionComparison && showComparison && !!comparisonTimeStart
        ? createDimensionAggregationQuery(
            client,
            metricsViewName,
            measureName,
            comparisonDimension!,
            dimensionValues,
            dimensionWhere,
            timeDimension!,
            comparisonTimeStart,
            comparisonTimeEnd,
            timeGranularity!,
            timeZone,
            isVisible && ready && !!comparisonTimeStart,
          )
        : undefined,
    [client, metricsViewName, measureName, comparisonDimension, dimensionValues, dimensionWhere, timeDimension, comparisonTimeStart, comparisonTimeEnd, timeGranularity, timeZone, isVisible, ready, showComparison, hasDimensionComparison],
  );
  const dimCompAggResult = useReadable(dimCompAggQuery);

  const dimIsFetching =
    (dimAggQuery ? dimAggResult?.isFetching : false) ||
    (dimCompAggQuery ? dimCompAggResult?.isFetching : false);

  const dimensionData = useMemo(
    () =>
      hasDimensionComparison && timeDimension && timeGranularity
        ? buildDimensionSeriesData(
            measureName,
            comparisonDimension!,
            dimensionValues,
            timeDimension,
            timeGranularity,
            timeZone,
            timeSeriesResult?.data?.data,
            dimAggQuery ? dimAggResult?.data?.data : undefined,
            showComparison ? comparisonTimeSeriesResult?.data?.data : undefined,
            dimCompAggQuery ? dimCompAggResult?.data?.data : undefined,
            !!dimIsFetching,
          )
        : [],
    [hasDimensionComparison, timeDimension, timeGranularity, measureName, comparisonDimension, dimensionValues, timeZone, timeSeriesResult, dimAggQuery, dimAggResult, showComparison, comparisonTimeSeriesResult, dimCompAggQuery, dimCompAggResult, dimIsFetching],
  );

  const isFetching =
    timeSeriesResult?.isFetching ||
    (showComparison && comparisonTimeSeriesResult?.isFetching) ||
    !!dimIsFetching;

  // Annotations query
  const annotationsQuery = useMemo(
    () =>
      createAnnotationsQuery(
        client,
        metricsViewName,
        measureName,
        timeDimension,
        timeStart,
        timeEnd,
        timeGranularity,
        timeZone,
        annotationsEnabled && !!timeStart && !!timeEnd && !!timeGranularity,
      ),
    [client, metricsViewName, measureName, timeDimension, timeStart, timeEnd, timeGranularity, timeZone, annotationsEnabled],
  );
  const annotationsResult = useReadable(annotationsQuery);

  // TDD handlers
  const handleTddHover = useCallback(
    (dimension: undefined | string | null, ts: Date | undefined) => {
      if (ts && !isNaN(ts.getTime())) {
        // The component chart applies adjustDataForTimeZone which shifts epochs
        // so Vega displays correct wall-clock times in the browser's local timezone.
        // Reverse that shift before comparing against the UTC-based data array.
        const adjustedTs = localToTimeZoneOffset(ts, timeZone);
        const idx = dateToIndex(data, adjustedTs.getTime());
        if (idx !== null) hoverIndex.set(idx, "tddChart");
        // Propagate to sibling TDD Vega charts in Explore
        chartHoverStore.set({ dimensionValue: dimension ?? undefined, time: ts });
      } else {
        hoverIndex.clear("tddChart");
        chartHoverStore.set({ dimensionValue: undefined, time: undefined });
      }
    },
    [data, timeZone],
  );

  const handleTddBrushEnd = useCallback(
    (interval: { start: Date; end: Date }) => {
      // Write raw Vega epoch values to shared brush store for visual sync across
      // sibling charts. These are unsnapped so drags don't progressively shrink.
      chartBrushStore.set({
        startMs: interval.start.getTime(),
        endMs: interval.end.getTime(),
      });

      // Snap to grain boundaries for the dashboard store
      const { start, end } = adjustTimeInterval(interval, timeZone);
      let startDt = DateTime.fromJSDate(start, { zone: timeZone });
      let endDt = DateTime.fromJSDate(end, { zone: timeZone });

      if (timeGranularity) {
        const unit = V1TimeGrainToDateTimeUnit[timeGranularity];
        const startFloor = startDt.startOf(unit);
        startDt = +startFloor < +startDt ? startFloor.plus({ [unit]: 1 }) : startDt;
        endDt = endDt.startOf(unit);
      }

      // Guard: if brush was within a single grain, snapping can invert the range
      if (+endDt <= +startDt) return;

      onScrub?.({
        start: startDt,
        end: endDt,
        isScrubbing: false,
      });
    },
    [timeZone, timeGranularity, onScrub],
  );

  const handleTddBrushClear = useCallback(() => {
    chartBrushStore.set({ startMs: undefined, endMs: undefined });
    onScrubClear?.();
  }, [onScrubClear]);

  const needsLoading = !isVisible || (isFetching && data.length === 0);
  const annotations: Annotation[] = annotationsResult?.data ?? [];

  return (
    <div ref={containerRef} className="size-full relative">
      {needsLoading ? (
        <div
          className="flex items-center justify-center"
          style={{ height: `${height}px` }}
        >
          <div
            className="bg-gradient-to-b from-primary-500 to-secondary-500 animate-spin"
            style={{ width: "24px", height: "24px", borderRadius: "1px" }}
          />
        </div>
      ) : isError ? (
        <div
          className="flex items-center justify-center text-xs text-red-500"
          style={{ height: `${height}px` }}
        >
          {error}
        </div>
      ) : vegaChart && data.length > 0 ? (
        <div className="w-full" style={{ height: `${height}px` }}>
          {/* Vega-rendered chart types (stacked/grouped bar, stacked area)
              render an explicit placeholder because the Vega graphic renderer
              (TDDMeasureChart) is ported to React in a later increment.
              Rendering MeasureChartBody here would silently draw a flat
              line/bar chart instead of the real stacked/grouped/area chart. */}
          <MeasureChartVegaNotSupported
            chartType={effectiveChartType}
            height={height}
          />
        </div>
      ) : data.length > 0 ? (
        <MeasureChartBody
          measure={measure}
          measureName={measureName}
          data={data}
          dimensionData={dimensionData}
          annotations={annotations}
          showComparison={showComparison}
          showTimeDimensionDetail={showTimeDimensionDetail}
          timeGranularity={timeGranularity}
          interval={interval}
          comparisonInterval={showComparison ? comparisonInterval : undefined}
          chartScrubInterval={chartScrubInterval}
          canPanLeft={canPanLeft}
          canPanRight={canPanRight}
          onPanLeft={onPanLeft}
          onPanRight={onPanRight}
          onScrub={onScrub}
          onScrubClear={onScrubClear}
          scrubController={scrubController}
          metricsViewName={metricsViewName}
          connectNulls={connectNulls}
          dynamicYAxis={dynamicYAxis}
          tddChartType={tddChartType}
          tddChartHeight={tddChartHeight}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          No data available
        </div>
      )}
    </div>
  );
}
