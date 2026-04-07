import { useEffect, useRef } from 'react'
import { OUTPUT_DESTINATIONS, mix, rangeProgress } from './LiveInsightsBridge.model'
import { LiveBridgeOutputDraftPanel } from './LiveBridgeOutputDraftPanel'

function interpolatePoint(from, to, progress) {
  return {
    x: mix(from.x, to.x, progress),
    y: mix(from.y, to.y, progress),
  }
}

function getCurveSegment(start, control1, control2, end, progress) {
  if (progress <= 0) {
    return null
  }

  if (progress >= 1) {
    return { control1, control2, end }
  }

  const p01 = interpolatePoint(start, control1, progress)
  const p12 = interpolatePoint(control1, control2, progress)
  const p23 = interpolatePoint(control2, end, progress)
  const p012 = interpolatePoint(p01, p12, progress)
  const p123 = interpolatePoint(p12, p23, progress)
  const p0123 = interpolatePoint(p012, p123, progress)

  return {
    control1: p01,
    control2: p012,
    end: p0123,
  }
}

function strokeCurve(context, start, control1, control2, end, progress, strokeStyle, lineWidth) {
  const segment = getCurveSegment(start, control1, control2, end, progress)

  if (!segment) {
    return
  }

  context.beginPath()
  context.lineWidth = lineWidth
  context.strokeStyle = strokeStyle
  context.moveTo(start.x, start.y)
  context.bezierCurveTo(
    segment.control1.x,
    segment.control1.y,
    segment.control2.x,
    segment.control2.y,
    segment.end.x,
    segment.end.y,
  )
  context.stroke()
}

export function LiveBridgeOutputGraph({ progress, nodeProgress }) {
  const graphRef = useRef(null)
  const canvasRef = useRef(null)
  const nodeRef = useRef(null)
  const chipRefs = useRef([])
  const progressRef = useRef(progress)
  const drawRef = useRef(() => {})
  const chipProgress = rangeProgress(nodeProgress, 0.18, 0.82)

  progressRef.current = progress

  useEffect(() => {
    const graph = graphRef.current
    const canvas = canvasRef.current
    const node = nodeRef.current

    if (!graph || !canvas || !node) {
      return undefined
    }

    const draw = () => {
      const rect = graph.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      const currentProgress = progressRef.current
      const dpr = window.devicePixelRatio || 1

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      const context = canvas.getContext('2d')

      if (!context) {
        return
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, rect.width, rect.height)
      context.lineCap = 'round'

      const nodePoint = {
        x: nodeRect.left - rect.left + nodeRect.width / 2,
        y: nodeRect.top - rect.top + nodeRect.height / 2,
      }

      chipRefs.current.forEach((element, index) => {
        if (!element) {
          return
        }

        const chipRect = element.getBoundingClientRect()
        const endPoint = {
          x: chipRect.left - rect.left + 10,
          y: chipRect.top - rect.top + chipRect.height / 2,
        }
        const branchProgress = rangeProgress(
          currentProgress,
          0.18 + index * 0.08,
          0.72 + index * 0.12,
        )
        const branchControl1 = {
          x: nodePoint.x + rect.width * 0.08,
          y: nodePoint.y + (endPoint.y - nodePoint.y) * 0.16,
        }
        const branchControl2 = {
          x: endPoint.x - rect.width * 0.08,
          y: endPoint.y,
        }

        if (branchProgress > 0.02) {
          strokeCurve(
            context,
            nodePoint,
            branchControl1,
            branchControl2,
            endPoint,
            1,
            'rgba(209, 255, 94, 0.1)',
            1.1,
          )
          strokeCurve(
            context,
            nodePoint,
            branchControl1,
            branchControl2,
            endPoint,
            branchProgress,
            'rgba(209, 255, 94, 0.22)',
            6,
          )
          strokeCurve(
            context,
            nodePoint,
            branchControl1,
            branchControl2,
            endPoint,
            branchProgress,
            'rgba(209, 255, 94, 0.82)',
            1.8,
          )
        }
      })
    }

    drawRef.current = draw

    const frameId = window.requestAnimationFrame(draw)
    const resizeObserver = new ResizeObserver(() => {
      drawRef.current()
    })

    resizeObserver.observe(graph)
    resizeObserver.observe(node)

    chipRefs.current.forEach((element) => {
      if (element) {
        resizeObserver.observe(element)
      }
    })

    window.addEventListener('resize', draw)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', draw)
    }
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      drawRef.current()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [progress])

  return (
    <div className="live-output-graph" ref={graphRef}>
      <canvas ref={canvasRef} className="live-output-canvas" aria-hidden="true" />

      <div className="live-output-grid">
        <LiveBridgeOutputDraftPanel progress={rangeProgress(progress, 0.02, 0.48)} />

        <div className="live-output-origin-lane">
          <span
            className="live-output-origin-chip"
            style={{
              opacity: nodeProgress,
              transform: `translate3d(0, ${mix(10, 0, chipProgress)}px, 0) scale(${mix(
                0.9,
                1,
                chipProgress,
              )})`,
            }}
          >
            <span ref={nodeRef} className="live-output-origin-dot" aria-hidden="true">
              <span></span>
            </span>
          </span>
        </div>

        <div className="live-output-chip-list">
          {OUTPUT_DESTINATIONS.map((destination, index) => {
            const chipProgress = rangeProgress(progress, 0.24 + index * 0.08, 0.78 + index * 0.1)

            return (
              <article
                key={destination.label}
                ref={(element) => {
                  chipRefs.current[index] = element
                }}
                className="live-output-chip"
                style={{
                  opacity: chipProgress,
                  transform: `translate3d(${mix(22, 0, chipProgress)}px, ${mix(12, 0, chipProgress)}px, 0)`,
                }}
              >
                <span className="live-output-chip-dot" aria-hidden="true" />
                <span className="live-output-chip-icon" aria-hidden="true">
                  <img src={destination.iconSrc} alt="" />
                </span>
                <div className="live-output-chip-copy">
                  <strong>{destination.label}</strong>
                  <small>{destination.meta}</small>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
