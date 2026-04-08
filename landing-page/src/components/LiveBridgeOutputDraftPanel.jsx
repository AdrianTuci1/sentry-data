import { mix, rangeProgress } from './LiveInsightsBridge.model'
import { liveInsightsBridgeContent } from '../content/homePageContent'

export function LiveBridgeOutputDraftPanel({ progress }) {
  const requestContent = liveInsightsBridgeContent.output.request
  const cardProgress = rangeProgress(progress, 0.08, 0.62)
  const detailProgress = rangeProgress(progress, 0.18, 0.76)

  return (
    <article
      className="live-output-draft"
      style={{
        opacity: progress,
        '--draft-x': `${mix(-18, 0, progress)}px`,
        '--draft-y': `${mix(12, 0, progress)}px`,
      }}
    >
      <div
        className="live-output-ai-card"
        style={{
          opacity: cardProgress,
          transform: `translate3d(0, ${mix(16, 0, cardProgress)}px, 0)`,
        }}
      >
        <div className="live-output-ai-card-meta">
          <span className="live-output-ai-badge">AI Generated</span>
          <span className="live-output-ai-status">Ready to route</span>
        </div>

        <div className="live-output-ai-card-main">
          <h4>AI Generated</h4>
          <p>Editable payload before routing.</p>
        </div>

        <div
          className="live-output-ai-json"
          style={{
            opacity: detailProgress,
            transform: `translate3d(0, ${mix(10, 0, detailProgress)}px, 0)`,
          }}
        >
          <div className="live-output-ai-json-header">
            <span className="live-output-ai-callout-label">Editable JSON</span>
            <span className="live-output-ai-json-hint">{requestContent.method}</span>
          </div>

          <div className="live-output-ai-json-editor">
            {requestContent.lines.map((line, index) => {
              const lineProgress = rangeProgress(detailProgress, 0.08 + index * 0.06, 0.62 + index * 0.06)

              return (
                <div
                  key={`json-line-${index + 1}`}
                  className="live-output-ai-json-line"
                  style={{
                    opacity: lineProgress,
                    transform: `translate3d(0, ${mix(8, 0, lineProgress)}px, 0)`,
                  }}
                >
                  <span className="live-output-ai-json-line-number">{index + 1}</span>
                  <span className="live-output-ai-json-line-content">
                    {line.map((token, tokenIndex) => (
                      <span
                        key={`${index + 1}-${token.type}-${tokenIndex}`}
                        className={`live-output-ai-json-token is-${token.type}`}
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
      </div>
    </article>
  )
}
