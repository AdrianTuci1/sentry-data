export function LineChartWidget({ data, config }) {
  const { labels, datasets } = data;
  const allValues = datasets?.flatMap(d => d.data) || [];
  
  if (allValues.length === 0) return null;

  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  const range = max - min || 1;

  const colors = ['#A8C7FA', '#6B7280', '#3F3F46', '#27272A'];

  return (
    <div className="line-chart-widget-container">
      {config?.showLegend && (
        <div className="flex gap-4 mb-3">
          {datasets?.map((ds, i) => (
            <div key={ds.key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ds.color || colors[i % colors.length] }} />
              <span className="text-xs text-text-muted">{ds.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 relative">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {datasets?.map((ds, i) => {
            const points = ds.data.map((v, j) => {
              const x = (j / (ds.data.length - 1)) * 100;
              const y = 100 - ((v - min) / range) * 100;
              return `${x},${y}`;
            }).join(' ');

            return (
              <polyline
                key={ds.key}
                points={points}
                fill="none"
                stroke={ds.color || colors[i % colors.length]}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>
      {labels && (
        <div className="flex justify-between text-xs text-text-muted mt-2">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor(labels.length / 2)]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
