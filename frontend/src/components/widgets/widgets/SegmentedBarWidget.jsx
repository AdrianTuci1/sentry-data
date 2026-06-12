export function SegmentedBarWidget({ data, config }) {
  const { segments, total, summaryValue, summaryLabel, actionLabel } = data;
  const resolvedTotal = total || segments?.reduce((acc, segment) => acc + segment.value, 0) || 0;
  const compact = Boolean(config?.compact);
  let cumulativeOffset = 0;
  const scaleMarkers = segments?.map((segment, index) => {
    const percent = resolvedTotal > 0 ? (segment.value / resolvedTotal) * 100 : 0;
    const marker = {
      key: segment.key,
      label: segment.displayValue || `${Math.round(percent)}%`,
      offset: cumulativeOffset,
      align: index === 0 ? 'start' : 'center',
    };
    cumulativeOffset += percent;
    return marker;
  }) || [];

  return (
    <div className={`segmented-bar-widget-container ${compact ? 'is-compact' : ''}`}>
      {(summaryValue || actionLabel) ? (
        <div className="segmented-bar-widget-toolbar">
          <div className="segmented-bar-widget-summary">
            {summaryValue ? (
              <div className="segmented-bar-widget-value">
                {summaryValue}
                {summaryLabel ? <span>{summaryLabel}</span> : null}
              </div>
            ) : null}
          </div>
          {actionLabel ? <span className="segmented-bar-widget-action">{actionLabel}</span> : null}
        </div>
      ) : null}

      <div className="segmented-bar-widget-scale">
        {scaleMarkers.map((marker) => (
          <div
            key={marker.key}
            className={`segmented-bar-widget-scale-item is-${marker.align}`}
            style={{
              left: `${marker.offset}%`,
              transform: marker.align === 'center' ? 'translateX(-50%)' : 'none',
            }}
          >
            <span>{marker.label}</span>
            <div className="segmented-bar-widget-scale-mark" />
          </div>
        ))}
      </div>

      <div className="segmented-bar-widget-bar">
        {segments?.map((segment, i) => {
          const percent = resolvedTotal > 0 ? (segment.value / resolvedTotal) * 100 : 0;
          return (
            <div
              key={segment.key}
              className="segmented-bar-widget-bar-segment"
              style={{
                width: `${percent}%`,
                backgroundColor: segment.color,
                borderTopLeftRadius: i === 0 ? '16px' : '0',
                borderBottomLeftRadius: i === 0 ? '16px' : '0',
                borderTopRightRadius: i === segments.length - 1 ? '16px' : '0',
                borderBottomRightRadius: i === segments.length - 1 ? '16px' : '0',
              }}
              title={`${segment.label}: ${segment.displayValue || segment.value}`}
            />
          );
        })}
      </div>

      <div className="segmented-bar-widget-legend">
        {segments?.map((segment) => (
          <div key={segment.key} className="segmented-bar-widget-legend-item">
            <div
              className="segmented-bar-widget-legend-dot"
              style={{ backgroundColor: segment.color }}
            />
            <span>{segment.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
