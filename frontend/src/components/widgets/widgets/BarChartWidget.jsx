export function BarChartWidget({ data, config }) {
  const { labels, datasets } = data;
  const isHorizontal = config?.orientation === 'horizontal';
  const dataset = datasets?.[0] || { data: [] };
  const values = dataset.data;

  if (values.length === 0) return null;

  const max = Math.max(...values);

  return (
    <div className="bar-chart-widget-container">
      <div className={`flex-1 ${isHorizontal ? 'flex flex-col gap-1.5' : 'flex items-end gap-1.5'}`}>
        {values.map((v, i) => {
          const percent = max > 0 ? (v / max) * 100 : 0;
          const isHighest = v === max;
          const barColor = isHighest ? '#A8C7FA90' : 'rgba(142, 145, 143, 0.25)';

          return (
            <div
              key={i}
              className={`${isHorizontal ? 'flex items-center gap-2' : 'flex-1 flex flex-col justify-end h-full'}`}
            >
              {isHorizontal ? (
                <>
                  <span className="text-xs text-text-muted w-20 truncate">{labels?.[i] || i}</span>
                  <div className="flex-1 h-4 bg-bg-primary rounded overflow-hidden">
                    <div
                      className="h-full transition-colors hover:bg-accent"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: barColor
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-secondary w-12 text-right tabular-nums">
                    {v.toLocaleString()}
                  </span>
                </>
              ) : (
                <>
                  <div className="flex-1 flex flex-col justify-end w-full relative">
                    <div
                      className="w-full transition-colors hover:bg-accent rounded-t"
                      style={{
                        height: `${percent}%`,
                        backgroundColor: barColor
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted text-center mt-1 truncate w-full" title={labels?.[i] || i}>
                    {labels?.[i] || i}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
