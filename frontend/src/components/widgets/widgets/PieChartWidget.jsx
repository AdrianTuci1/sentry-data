import { WEB_WIDGET_BLUE, WEB_WIDGET_BLUE_MUTED } from '../webWidgetTheme';

export function PieChartWidget({ data, config }) {
  const { segments } = data;
  const total = segments?.reduce((sum, s) => sum + s.value, 0) || 1;

  let cumulativePercent = 0;
  const slices = segments?.map((segment, i) => {
    const percent = (segment.value / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return {
      ...segment,
      color: segment.color || (i === 0 ? WEB_WIDGET_BLUE : WEB_WIDGET_BLUE_MUTED),
      percent,
      startPercent,
    };
  }) || [];

  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * percent) * 50;
    const y = Math.sin(2 * Math.PI * percent) * 50;
    return [x, y];
  };

  return (
    <div className="pie-chart-widget-container">
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="-50 -50 100 100" className="w-full h-full -rotate-90">
          {config?.donut ? (
            <>
              {slices.map((slice, i) => {
                return (
                  <circle
                    key={i}
                    r="40"
                    cx="0"
                    cy="0"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="20"
                    strokeDasharray={`${slice.percent * 2.51} ${251 - slice.percent * 2.51}`}
                    strokeDashoffset={-slice.startPercent * 2.51}
                  />
                );
              })}
              <circle r="25" cx="0" cy="0" fill="#131314" />
            </>
          ) : (
            <>
              {slices.map((slice, i) => {
                const [startX, startY] = getCoordinatesForPercent(slice.startPercent / 100);
                const [endX, endY] = getCoordinatesForPercent((slice.startPercent + slice.percent) / 100);
                const largeArc = slice.percent > 50 ? 1 : 0;
                return (
                  <path
                    key={i}
                    d={`M 0 0 L ${startX} ${startY} A 50 50 0 ${largeArc} 1 ${endX} ${endY} Z`}
                    fill={slice.color}
                  />
                );
              })}
            </>
          )}
        </svg>
      </div>
      <div className="flex-1 space-y-2">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="text-xs text-text-secondary">{slice.label}</span>
            </div>
            <span className="text-xs text-text-muted tabular-nums">{Math.round(slice.percent)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
