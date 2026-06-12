export function HeatmapWidget({ data, config }) {
  const { rows, cols, data: values } = data;

  const max = Math.max(...(values || []), 1);
  const getIntensity = (v) => {
    const ratio = v / max;
    if (ratio < 0.2) return 'bg-text-muted/5';
    if (ratio < 0.4) return 'bg-text-muted/15';
    if (ratio < 0.6) return 'bg-text-muted/25';
    if (ratio < 0.8) return 'bg-text-muted/40';
    return 'bg-text-muted/60';
  };

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="h-full p-4">
      <div className="flex gap-1 h-full">
        {/* Day labels */}
        <div className="flex flex-col justify-around pr-2">
          {days.slice(0, rows).map((day) => (
            <span key={day} className="text-xs text-text-muted w-8 text-right">
              {day}
            </span>
          ))}
        </div>
        {/* Grid */}
        <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {values?.map((v, i) => (
            <div
              key={i}
              className={`rounded-sm ${getIntensity(v)} hover:bg-text-muted/70 transition-colors`}
              title={`Value: ${v}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
