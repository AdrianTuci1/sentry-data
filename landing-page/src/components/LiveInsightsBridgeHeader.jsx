import { DOMAINS, mix, rangeProgress } from './LiveInsightsBridge.model'
import { liveInsightsBridgeContent } from '../content/homePageContent'
import { useLiveInsightsBridgeStore } from './LiveInsightsBridgeStore'

export function LiveInsightsBridgeHeader() {
  const { activeDomain, scrollProgress } = useLiveInsightsBridgeStore()
  const introExitProgress = rangeProgress(scrollProgress, 0.12, 0.26)

  return (
    <header
      className="live-bridge-header"
      style={{
        opacity: 1 - introExitProgress,
        transform: `translate3d(0, ${mix(0, -72, introExitProgress)}px, 0)`,
      }}
    >
      <div className="live-bridge-header-copy">
        {/* <span className="live-bridge-kicker">{liveInsightsBridgeContent.header.kicker}</span> */}
        <h2>{liveInsightsBridgeContent.header.title}</h2>
        {/* <p>{liveInsightsBridgeContent.header.description}</p> */}
      </div>

      <div
        className="live-bridge-tabs"
        aria-label={liveInsightsBridgeContent.header.tabsAriaLabel}
      >
        {DOMAINS.map((domain) => (
          <span key={domain.label} className={domain.label === activeDomain ? 'is-active' : ''}>
            {domain.label}
          </span>
        ))}
      </div>
    </header>
  )
}
