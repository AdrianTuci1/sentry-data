import { mix, rangeProgress } from './LiveInsightsBridge.model'
import { LiveBridgeOutputGraph } from './LiveBridgeOutputGraph'
import { liveInsightsBridgeContent } from '../content/homePageContent'

export function LiveBridgeOutputHandoff({ nodeProgress, outputProgress }) {
  const titleProgress = rangeProgress(outputProgress, 0.34, 0.76)

  return (
    <div className="live-output-handoff">
      <div
        className="live-output-copy"
        style={{
          opacity: titleProgress,
          transform: `translate3d(-50%, ${mix(42, 0, titleProgress)}px, 0)`,
        }}
      >
        <h3>{liveInsightsBridgeContent.output.title}</h3>
      </div>

      <LiveBridgeOutputGraph progress={outputProgress} nodeProgress={nodeProgress} />
    </div>
  )
}
