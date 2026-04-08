export function PlaceholderVisual({ kind }) {
  if (kind === 'impact') {
    return (
      <div className="home-feature-visual-shell is-impact">
        <div className="home-metric-card">
          <div className="home-metric-card-header">Automated resolution rate</div>
          <div className="home-metric-card-grid">
            <div>
              <strong>78%</strong>
              <span>Containment rate</span>
            </div>
            <div>
              <strong>82%</strong>
              <span>Automated resolution rate</span>
            </div>
          </div>
          <div className="home-metric-table">
            <div><span>Automation opportunities</span><span>6.4x</span></div>
            <div><span>Conversations</span><span>648</span></div>
            <div><span>Resolution rate</span><span>54%</span></div>
            <div><span>Contained</span><span>64%</span></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="home-feature-visual-shell is-preview">
      <div className="home-preview-card">
        <div className="home-preview-card-top">
          <span>Scenario preview</span>
          <span>Live</span>
        </div>
        <div className="home-preview-map">
          <span className="node node-a" />
          <span className="node node-b" />
          <span className="node node-c" />
          <span className="node node-d" />
          <span className="link link-ab" />
          <span className="link link-bc" />
          <span className="link link-cd" />
        </div>
        <div className="home-preview-card-footer">
          <div>
            <strong>3 routes</strong>
            <span>candidate directions</span>
          </div>
          <div>
            <strong>12s</strong>
            <span>to compare outcomes</span>
          </div>
        </div>
      </div>
    </div>
  )
}
