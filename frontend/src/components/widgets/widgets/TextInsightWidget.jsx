export function TextInsightWidget({ data, config }) {
  const { text, highlights, actionLabel } = data;
  const compact = Boolean(config?.compact);

  const renderText = () => {
    if (!text) return null;
    if (!highlights?.length) return <span>{text}</span>;

    let result = text;
    highlights.forEach((h) => {
      result = result.replace(
        h.text,
        `__HIGHLIGHT_${h.text}__`
      );
    });

    const parts = result.split(/(__HIGHLIGHT_[^__]+__)/g);
    return parts.map((part, i) => {
      const match = part.match(/__HIGHLIGHT_(.+)__/);
      if (match) {
        return (
          <span key={i} className="highlight">
            {match[1]}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className={`text-insight-widget-container ${actionLabel ? 'has-action' : ''} ${compact ? 'is-compact' : ''}`}>
      {actionLabel ? (
        <div className="text-insight-widget-toolbar">
          <span className="text-insight-widget-action">{actionLabel}</span>
        </div>
      ) : null}
      <p className="leading-relaxed">
        {renderText()}
      </p>
    </div>
  );
}
