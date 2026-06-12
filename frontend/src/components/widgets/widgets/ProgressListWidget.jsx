import { WEB_WIDGET_BLUE } from '../webWidgetTheme';

export function ProgressListWidget({ data, config }) {
  const { items = [] } = data;

  return (
    <div className="progress-list-widget-container scrollbar-thin">
      {items.map((item, i) => {
        return (
          <div
            key={i}
            className="flex flex-col gap-1.5 transition-colors"
          >
            {/* Top row: Label on left, Value/Percent on right */}
            <div className="flex items-center justify-between w-full">
              <div className="min-w-0">
                <span className="text-xs font-medium text-text-secondary truncate" title={item.label}>
                  {item.label}
                </span>
              </div>

              <span className="text-xs text-text-muted tabular-nums font-mono font-medium shrink-0 ml-4">
                {config?.showValue && item.value !== undefined
                  ? item.value.toLocaleString()
                  : `${item.percent}%`
                }
              </span>
            </div>

            {/* Bottom row: Full width thin progress bar */}
            <div className="h-1 w-full bg-bg-primary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${item.percent}%`,
                  backgroundColor: WEB_WIDGET_BLUE
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
