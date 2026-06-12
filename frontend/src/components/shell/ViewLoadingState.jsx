export function ViewLoadingState() {
  return (
    <div className="view-loading-state" aria-live="polite" aria-busy="true">
      <div className="view-loading-spinner" />
      <div className="view-loading-text">Loading</div>
    </div>
  );
}
