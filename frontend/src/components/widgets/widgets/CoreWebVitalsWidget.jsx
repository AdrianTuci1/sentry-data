import { WEB_WIDGET_BLUE, WEB_WIDGET_BLUE_FAINT, WEB_WIDGET_BLUE_MUTED } from '../webWidgetTheme';

export function CoreWebVitalsWidget({ data }) {
  const { metrics = [] } = data;

  const statusColors = {
    good: { label: 'Good', bg: WEB_WIDGET_BLUE_FAINT, border: WEB_WIDGET_BLUE_MUTED },
    needs_improvement: { label: 'Needs Improvement', bg: 'rgba(168, 199, 250, 0.1)', border: 'rgba(168, 199, 250, 0.24)' },
    poor: { label: 'Poor', bg: 'rgba(168, 199, 250, 0.07)', border: 'rgba(168, 199, 250, 0.2)' }
  };

  return (
    <div className="core-web-vitals-widget-container">
      {metrics.map((m, i) => {
        const style = statusColors[m.status] || statusColors.good;
        return (
          <div key={i} className="core-web-vitals-col">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-text-primary tracking-wide">
                  {m.acronym}
                </span>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                  style={{ color: WEB_WIDGET_BLUE, backgroundColor: style.bg, borderColor: style.border }}
                >
                  {style.label}
                </span>
              </div>
              <div className="text-[10px] text-text-muted truncate">
                {m.label}
              </div>
            </div>

            <div className="my-2">
              <span className="text-2xl font-semibold text-text-primary tabular-nums">
                {m.value}
              </span>
            </div>

            <div className="text-[10px] text-text-secondary truncate">
              {m.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}
