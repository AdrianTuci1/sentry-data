import { WEB_WIDGET_BLUE, WEB_WIDGET_BLUE_MUTED } from '../webWidgetTheme';

export function VisitorsOnlineWidget({ data }) {
  const { totalOnline = 0, devices = [] } = data;

  return (
    <div className="visitors-online-widget-container">
      {/* Left Column: Big Stats */}
      <div className="flex flex-col justify-center shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: WEB_WIDGET_BLUE_MUTED }}
            ></span>
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: WEB_WIDGET_BLUE }}
            ></span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: WEB_WIDGET_BLUE }}>Live</span>
        </div>
        <span className="text-3xl font-semibold text-text-primary tabular-nums">
          {totalOnline.toLocaleString()}
        </span>
        <span className="text-xs text-text-muted mt-1">Active visitors online</span>
      </div>

      {/* Right Column: Device Breakdown */}
      <div className="flex-1 flex flex-col justify-center gap-2.5 max-w-[200px]">
        {devices.map((device, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{device.label}</span>
              <span className="text-text-muted tabular-nums font-medium">
                {device.value} ({device.percent}%)
              </span>
            </div>
            <div className="h-1 bg-bg-primary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${device.percent}%`,
                  backgroundColor: device.color || WEB_WIDGET_BLUE
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
