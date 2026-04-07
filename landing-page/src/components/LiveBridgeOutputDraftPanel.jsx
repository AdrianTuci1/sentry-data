import { mix, rangeProgress } from './LiveInsightsBridge.model'
import { liveInsightsBridgeContent } from '../content/homePageContent'

export function LiveBridgeOutputDraftPanel({ progress }) {
  const requestContent = liveInsightsBridgeContent.output.request

  return (
    <article
      className="live-output-draft"
      style={{
        opacity: progress,
        '--draft-x': `${mix(-18, 0, progress)}px`,
        '--draft-y': `${mix(24, 0, progress)}px`,
      }}
    >
      <div
        className="live-output-request-bar"
        style={{
          opacity: rangeProgress(progress, 0.02, 0.48),
          transform: `translate3d(0, ${mix(14, 0, progress)}px, 0)`,
        }}
      >
        <div className="live-output-request-method">
          <span>{requestContent.method}</span>
          <span className="live-output-request-caret" aria-hidden="true">
            <span></span>
            <span></span>
          </span>
        </div>

        <div className="live-output-request-url">
          <span className="is-protocol">{requestContent.url.protocol}</span>
          <span className="is-domain">{requestContent.url.domain}</span>
          <span className="is-path">{requestContent.url.path}</span>
        </div>
      </div>

      <div
        className="live-output-request-panel"
        style={{
          opacity: rangeProgress(progress, 0.1, 0.62),
          transform: `translate3d(0, ${mix(18, 0, progress)}px, 0)`,
        }}
      >
        <div className="live-output-request-tabs">
          <div className="live-output-request-tab-list">
            {requestContent.tabs.map((tab) => (
              <span
                key={tab.label}
                className={`live-output-request-tab ${tab.active ? 'is-active' : ''}`}
              >
                {tab.label}
                {tab.badge ? (
                  <span className="live-output-request-tab-badge">{tab.badge}</span>
                ) : null}
                {tab.dot ? <span className="live-output-request-tab-dot" aria-hidden="true" /> : null}
              </span>
            ))}
          </div>

          <span className="live-output-request-code" aria-hidden="true">
            {'</>'}
          </span>
        </div>

        <div className="live-output-request-editor">
          {requestContent.lines.map((line, index) => {
            const lineProgress = rangeProgress(progress, 0.18 + index * 0.04, 0.72 + index * 0.04)

            return (
              <div
                key={`request-line-${index + 1}`}
                className="live-output-request-line"
                style={{
                  opacity: lineProgress,
                  transform: `translate3d(0, ${mix(10, 0, lineProgress)}px, 0)`,
                }}
              >
                <span className="live-output-request-line-number">{index + 1}</span>

                <span className="live-output-request-line-content">
                  {index === 0 ? (
                    <span className="live-output-request-fold" aria-hidden="true">
                      ▼
                    </span>
                  ) : null}

                  {line.map((token, tokenIndex) => (
                    <span
                      key={`${index + 1}-${token.type}-${tokenIndex}`}
                      className={`live-output-request-token is-${token.type}`}
                    >
                      {token.text}
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}
