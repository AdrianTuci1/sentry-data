import { useEffect, useRef } from 'react'
import './PipelineFlow.css'
import { goldInputs, goldViews, pipelineFlowCtx } from '../content'

export function PipelineFlow() {
  const graphRef = useRef(null)
  const canvasRef = useRef(null)
  const centerRef = useRef(null)
  const centerLeftAnchorRef = useRef(null)
  const centerRightAnchorRef = useRef(null)
  const leftRefs = useRef([])
  const rightRefs = useRef([])
  const flowchartVars = {
    '--flowchart-left-group-offset': pipelineFlowCtx.leftGroupOffset,
    '--flowchart-center-offset': pipelineFlowCtx.centerOffset,
    '--flowchart-right-group-offset': pipelineFlowCtx.rightGroupOffset,
  }

  useEffect(() => {
    const graph = graphRef.current
    const canvas = canvasRef.current
    const center = centerRef.current
    const centerLeftAnchor = centerLeftAnchorRef.current
    const centerRightAnchor = centerRightAnchorRef.current

    if (!graph || !canvas || !center || !centerLeftAnchor || !centerRightAnchor) {
      return undefined
    }

    const draw = () => {
      const rect = graph.getBoundingClientRect()
      const centerRect = center.getBoundingClientRect()
      const centerLeftRect = centerLeftAnchor.getBoundingClientRect()
      const centerRightRect = centerRightAnchor.getBoundingClientRect()
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
      context.lineWidth = 1.2
      context.lineCap = 'round'

      const centerLeftX = centerLeftRect.left - rect.left + centerLeftRect.width / 2
      const centerRightX = centerRightRect.left - rect.left + centerRightRect.width / 2
      const centerY = centerRect.top - rect.top + centerRect.height / 2

      leftRefs.current.forEach((element) => {
        if (!element) {
          return
        }

        const itemRect = element.getBoundingClientRect()
        const startX = itemRect.right - rect.left
        const startY = itemRect.top - rect.top + itemRect.height / 2
        const curveX = startX + (centerLeftX - startX) * 0.44

        context.beginPath()
        context.strokeStyle = 'rgba(201, 78, 78, 0.72)'
        context.moveTo(startX, startY)
        context.bezierCurveTo(curveX, startY, centerLeftX - 56, centerY, centerLeftX, centerY)
        context.stroke()
      })

      rightRefs.current.forEach((element) => {
        if (!element) {
          return
        }

        const itemRect = element.getBoundingClientRect()
        const endX = itemRect.left - rect.left
        const endY = itemRect.top - rect.top + itemRect.height / 2
        const curveX = centerRightX + (endX - centerRightX) * 0.56

        context.beginPath()
        context.strokeStyle = 'rgba(124, 86, 208, 0.78)'
        context.moveTo(centerRightX, centerY)
        context.bezierCurveTo(curveX, centerY, endX - 36, endY, endX, endY)
        context.stroke()
      })
    }

    const frame = requestAnimationFrame(draw)
    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(graph)

    leftRefs.current.forEach((element) => {
      if (element) {
        resizeObserver.observe(element)
      }
    })

    rightRefs.current.forEach((element) => {
      if (element) {
        resizeObserver.observe(element)
      }
    })

    resizeObserver.observe(center)
    resizeObserver.observe(centerLeftAnchor)
    resizeObserver.observe(centerRightAnchor)
    window.addEventListener('resize', draw)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', draw)
    }
  }, [])

  return (
    <section className="flowchart-section" id="gold-views">
      <div className="flowchart-bleed">
        <div className="flowchart-panel">
          <div className="flowchart-meta">
            <span>StatsParrot Gold</span>
            <span>STATSPARROT</span>
          </div>

          <div className="flowchart-stage">
            <div className="flowchart-title-slot">
              <div className="flowchart-copy flowchart-copy-top">
                <h2>We take raw data and give you immediate decisions.</h2>
              </div>
            </div>

            <div ref={graphRef} className="flowchart-graph">
              <canvas ref={canvasRef} className="flowchart-canvas" aria-hidden="true" />

              <div className="flowchart-grid" style={flowchartVars}>
                <div className="flowchart-column flowchart-column-left">
                  {goldInputs.map((item, index) => (
                    <div
                      key={item}
                      className="flow-pill-row flow-pill-row-left"
                      style={{ '--delay': `${0.04 * index}s` }}
                    >
                      <div
                        ref={(element) => {
                          leftRefs.current[index] = element
                        }}
                        className="flow-pill flow-pill-left"
                      >
                        <span className="flow-pill-dot flow-pill-dot-left" />
                        <span>{item}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flowchart-center">
                  <div ref={centerRef} className="flowchart-core">
                    <span
                      ref={centerLeftAnchorRef}
                      className="flowchart-core-anchor flowchart-core-anchor-left"
                      aria-hidden="true"
                    />
                    <span
                      ref={centerRightAnchorRef}
                      className="flowchart-core-anchor flowchart-core-anchor-right"
                      aria-hidden="true"
                    />
                    <div className="flowchart-core-inner">
                      <div className="flowchart-image-placeholder" aria-hidden="true">
                        <span className="flowchart-image-placeholder-icon" />
                        <span className="flowchart-image-placeholder-label">Image Placeholder</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flowchart-column flowchart-column-right">
                  {goldViews.map((item, index) => (
                    <div
                      key={item}
                      className="flow-pill-row flow-pill-row-right"
                      style={{ '--delay': `${0.08 + index * 0.04}s` }}
                    >
                      <div
                        ref={(element) => {
                          rightRefs.current[index] = element
                        }}
                        className="flow-pill flow-pill-right"
                      >
                        <span className="flow-pill-dot flow-pill-dot-right" />
                        <span>{item}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flowchart-footer-slot">
              <div className="flowchart-copy flowchart-copy-bottom">
                <p>
                  Our powerful neural engine lets us surface your data without extra
                  transformations. Use smart decisions out of the box or build your own
                  query logic.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
