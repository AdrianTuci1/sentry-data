import { LiveDomainWidgetCard } from './LiveDomainWidgetCard'
import { LiveBridgeDock } from './LiveBridgeDock'
import { useLiveInsightsBridgeStore } from './LiveInsightsBridgeStore'

function DomainWidgetGrid({ domain, className = '' }) {
  return (
    <div className={`live-widget-grid ${className}`}>
      {domain.widgets.map((widget, index) => (
        <div
          key={`${domain.label}-${widget.id}`}
          className={`live-widget-item ${widget.gridSpan ? `is-${widget.gridSpan.replace(/\s+/g, ' is-')}` : ''}`}
          style={{ '--widget-index': index }}
        >
          <LiveDomainWidgetCard widget={widget} />
        </div>
      ))}
    </div>
  )
}

export function LiveBridgeDomainWindow({
  onTransitionEnd,
  signalOpacity,
  signalTop,
  dockProgress,
  retreatProgress,
  collapseProgress,
  widgetPaneStyle,
  widgetSignalRef,
}) {
  const { displayedDomain, transitionState } = useLiveInsightsBridgeStore()

  return (
    <div className="live-widget-pane" style={widgetPaneStyle}>
      <div className="live-domain-window">
        <span
          ref={widgetSignalRef}
          className="live-domain-signal-dot"
          style={{
            top: `${signalTop}%`,
            opacity: signalOpacity,
          }}
          aria-hidden="true"
        />
        <div className="live-domain-window-rim" />

        <div
          className={`live-widget-stack is-${transitionState}`}
          onTransitionEnd={onTransitionEnd}
        >
          <DomainWidgetGrid
            key={displayedDomain.label}
            domain={displayedDomain}
            className={transitionState === 'fading-in' ? 'is-entering' : ''}
          />
        </div>

        <div className="live-domain-window-dock">
          <LiveBridgeDock
            progress={dockProgress}
            retreatProgress={retreatProgress}
            collapseProgress={collapseProgress}
          />
        </div>
      </div>
    </div>
  )
}
