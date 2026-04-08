import { useEffect, useRef, useState } from 'react'
import './PipelineFlow.css'
import { mix, rangeProgress } from './LiveInsightsBridge.model'
import { PipelineFlowIsometricCanvas } from './PipelineFlowIsometricCanvas'
import { pipelineFlowContent } from '../content/homePageContent'

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

const LOCKED_SCROLL_KEYS = new Set([
  ' ',
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Home',
  'End',
])

function easeInOutCubic(value) {
  if (value < 0.5) {
    return 4 * value ** 3
  }

  return 1 - ((-2 * value + 2) ** 3) / 2
}

function getBranchWindow(index, total, baseStart, staggerSpan, duration) {
  const ratio = total > 1 ? index / (total - 1) : 0
  const start = baseStart + staggerSpan * ratio
  const end = Math.min(1, start + duration)

  return { start, end }
}

function getBranchProgress(progress, index, total, baseStart, staggerSpan, duration) {
  const { start, end } = getBranchWindow(index, total, baseStart, staggerSpan, duration)

  return rangeProgress(progress, start, end)
}

export function PipelineFlow() {
  const sectionRef = useRef(null)
  const titleSlotRef = useRef(null)
  const footerSlotRef = useRef(null)
  const graphRef = useRef(null)
  const canvasRef = useRef(null)
  const centerRef = useRef(null)
  const centerLeftAnchorRef = useRef(null)
  const centerRightAnchorRef = useRef(null)
  const leftRefs = useRef([])
  const rightRefs = useRef([])
  const drawRef = useRef(() => { })
  const progressRef = useRef(0)
  const [animationProgress, setAnimationProgress] = useState(0)
  const flowchartVars = {
    '--flowchart-left-group-offset': pipelineFlowContent.layout.leftGroupOffset,
    '--flowchart-center-offset': pipelineFlowContent.layout.centerOffset,
    '--flowchart-right-group-offset': pipelineFlowContent.layout.rightGroupOffset,
  }

  progressRef.current = animationProgress
  const titleRevealProgress = rangeProgress(animationProgress, 0.76, 0.93)
  const footerRevealProgress = rangeProgress(animationProgress, 0.82, 0.98)
  const titleStyle = {
    opacity: titleRevealProgress,
    transform: `translate3d(0, ${mix(-36, 0, titleRevealProgress)}px, 0) scale(${mix(
      0.98,
      1,
      titleRevealProgress,
    )})`,
  }
  const footerStyle = {
    opacity: footerRevealProgress,
    transform: `translate3d(0, ${mix(36, 0, footerRevealProgress)}px, 0) scale(${mix(
      0.985,
      1,
      footerRevealProgress,
    )})`,
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
      const centerLeftRect = centerLeftAnchor.getBoundingClientRect()
      const centerRightRect = centerRightAnchor.getBoundingClientRect()
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

      const centerLeftX = centerLeftRect.left - rect.left + centerLeftRect.width / 2
      const centerLeftY = centerLeftRect.top - rect.top + centerLeftRect.height / 2
      const centerRightX = centerRightRect.left - rect.left + centerRightRect.width / 2
      const centerRightY = centerRightRect.top - rect.top + centerRightRect.height / 2

      leftRefs.current.forEach((element, index) => {
        if (!element) {
          return
        }

        const itemRect = element.getBoundingClientRect()
        const endPoint = {
          x: itemRect.right - rect.left,
          y: itemRect.top - rect.top + itemRect.height / 2,
        }
        const startPoint = { x: centerLeftX, y: centerLeftY }
        const branchProgress = getBranchProgress(
          currentProgress,
          index,
          leftRefs.current.length,
          0.52,
          0.14,
          0.22,
        )
        const control1 = {
          x: startPoint.x - rect.width * 0.08,
          y: startPoint.y + (endPoint.y - startPoint.y) * 0.08,
        }
        const control2 = {
          x: endPoint.x + rect.width * 0.06,
          y: endPoint.y,
        }

        if (branchProgress > 0.02) {
          strokeCurve(
            context,
            startPoint,
            control1,
            control2,
            endPoint,
            1,
            'rgba(227, 83, 83, 0.08)',
            1.1,
          )
          strokeCurve(
            context,
            startPoint,
            control1,
            control2,
            endPoint,
            branchProgress,
            'rgba(227, 83, 83, 0.16)',
            5.4,
          )
          strokeCurve(
            context,
            startPoint,
            control1,
            control2,
            endPoint,
            branchProgress,
            'rgba(227, 83, 83, 0.88)',
            1.35,
          )
        }
      })

      rightRefs.current.forEach((element, index) => {
        if (!element) {
          return
        }

        const itemRect = element.getBoundingClientRect()
        const endPoint = {
          x: itemRect.left - rect.left,
          y: itemRect.top - rect.top + itemRect.height / 2,
        }
        const startPoint = { x: centerRightX, y: centerRightY }
        const branchProgress = getBranchProgress(
          currentProgress,
          index,
          rightRefs.current.length,
          0.56,
          0.12,
          0.22,
        )
        const control1 = {
          x: startPoint.x + rect.width * 0.09,
          y: startPoint.y + (endPoint.y - startPoint.y) * 0.08,
        }
        const control2 = {
          x: endPoint.x - rect.width * 0.06,
          y: endPoint.y,
        }

        if (branchProgress > 0.02) {
          strokeCurve(
            context,
            startPoint,
            control1,
            control2,
            endPoint,
            1,
            'rgba(138, 95, 255, 0.08)',
            1.1,
          )
          strokeCurve(
            context,
            startPoint,
            control1,
            control2,
            endPoint,
            branchProgress,
            'rgba(138, 95, 255, 0.16)',
            5.4,
          )
          strokeCurve(
            context,
            startPoint,
            control1,
            control2,
            endPoint,
            branchProgress,
            'rgba(138, 95, 255, 0.9)',
            1.35,
          )
        }
      })
    }

    drawRef.current = draw

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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      drawRef.current()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [animationProgress])

  useEffect(() => {
    const section = sectionRef.current

    if (!section) {
      return undefined
    }

    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animationFrame = 0
    let animationStart = null
    let animationStarted = motionMedia.matches
    let lockActive = false
    let lockTimeout = 0
    let holdFrame = 0

    const durationMs = 1800

    if (motionMedia.matches) {
      setAnimationProgress(1)
    }

    const scrollListenerOptions = { passive: false }
    const keyListenerOptions = { passive: false }

    function preventScroll(event) {
      if (!lockActive) {
        return
      }

      event.preventDefault()
    }

    function preventKeyScroll(event) {
      if (!lockActive || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const target = event.target
      const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

      if (isEditable || !LOCKED_SCROLL_KEYS.has(event.key)) {
        return
      }

      event.preventDefault()
    }

    const releaseScrollLock = () => {
      if (!lockActive) {
        return
      }

      lockActive = false
      window.clearTimeout(lockTimeout)
      window.cancelAnimationFrame(holdFrame)
      window.removeEventListener('wheel', preventScroll, scrollListenerOptions)
      window.removeEventListener('touchmove', preventScroll, scrollListenerOptions)
      window.removeEventListener('keydown', preventKeyScroll, keyListenerOptions)
    }

    const engageSoftLock = () => {
      if (motionMedia.matches || window.innerWidth < 1100 || lockActive) {
        return
      }

      const rect = section.getBoundingClientRect()
      const sectionTop = window.scrollY + rect.top
      const viewportHeight = window.innerHeight || 1
      const titleRect = titleSlotRef.current?.getBoundingClientRect() ?? rect
      const footerRect = footerSlotRef.current?.getBoundingClientRect() ?? rect
      const titleTop = window.scrollY + titleRect.top
      const footerBottom = window.scrollY + footerRect.bottom
      const lowerBound = Math.max(0, footerBottom - viewportHeight + 40)
      const upperBound = Math.max(0, titleTop - 28)
      const centeredSectionTop = Math.max(
        0,
        sectionTop - Math.max((viewportHeight - rect.height) / 2, 40),
      )
      const targetTop =
        lowerBound <= upperBound
          ? Math.min(Math.max(centeredSectionTop, lowerBound), upperBound)
          : lowerBound

      const fromY = window.scrollY
      const toY = targetTop
      const snapDurationMs = 420
      let snapStart = null

      lockActive = true
      window.addEventListener('wheel', preventScroll, scrollListenerOptions)
      window.addEventListener('touchmove', preventScroll, scrollListenerOptions)
      window.addEventListener('keydown', preventKeyScroll, keyListenerOptions)

      const holdPosition = () => {
        if (!lockActive) {
          return
        }

        if (Math.abs(window.scrollY - toY) > 2) {
          window.scrollTo({
            top: toY,
            behavior: 'auto',
          })
        }

        holdFrame = window.requestAnimationFrame(holdPosition)
      }

      const runSnap = (timestamp) => {
        if (!lockActive) {
          return
        }

        if (snapStart === null) {
          snapStart = timestamp
        }

        const nextProgress = Math.min((timestamp - snapStart) / snapDurationMs, 1)
        const easedProgress = easeInOutCubic(nextProgress)
        window.scrollTo({
          top: mix(fromY, toY, easedProgress),
          behavior: 'auto',
        })

        if (nextProgress < 1) {
          holdFrame = window.requestAnimationFrame(runSnap)
          return
        }

        holdFrame = window.requestAnimationFrame(holdPosition)
      }

      window.cancelAnimationFrame(holdFrame)
      holdFrame = window.requestAnimationFrame(runSnap)
      window.clearTimeout(lockTimeout)
      lockTimeout = window.setTimeout(releaseScrollLock, durationMs + 180)
    }

    const runAnimation = (timestamp) => {
      if (animationStart === null) {
        animationStart = timestamp
      }

      const nextProgress = Math.min((timestamp - animationStart) / durationMs, 1)
      setAnimationProgress(nextProgress)

      if (nextProgress < 1) {
        animationFrame = window.requestAnimationFrame(runAnimation)
      } else {
        animationFrame = 0
      }
    }

    const startAnimation = () => {
      if (animationStarted || motionMedia.matches) {
        return
      }

      animationStarted = true
      animationStart = null
      engageSoftLock()
      animationFrame = window.requestAnimationFrame(runAnimation)
    }

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries

        if (!entry) {
          return
        }

        if (entry.intersectionRatio >= 0.5) {
          startAnimation()
          visibilityObserver.disconnect()
        }
      },
      {
        threshold: [0.5],
      },
    )

    if (!motionMedia.matches) {
      visibilityObserver.observe(section)
    }

    const handleMotionChange = (event) => {
      if (event.matches) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
        animationStarted = true
        setAnimationProgress(1)
        releaseScrollLock()
        visibilityObserver.disconnect()
        return
      }

      if (!animationStarted) {
        setAnimationProgress(0)
        visibilityObserver.observe(section)
      }
    }

    motionMedia.addEventListener('change', handleMotionChange)

    return () => {
      releaseScrollLock()
      visibilityObserver.disconnect()
      window.cancelAnimationFrame(animationFrame)
      motionMedia.removeEventListener('change', handleMotionChange)
    }
  }, [])

  return (
    <section ref={sectionRef} className="flowchart-section" id="gold-views">
      <div className="flowchart-bleed">
        <div className="flowchart-panel">
          {/* <div className="flowchart-meta">
            <span>{pipelineFlowContent.meta.leftLabel}</span>
            <span>{pipelineFlowContent.meta.rightLabel}</span>
          </div> */}

          <div className="flowchart-stage">
            <div ref={titleSlotRef} className="flowchart-title-slot">
              <div className="flowchart-copy flowchart-copy-top" style={titleStyle}>
                <h2>{pipelineFlowContent.title}</h2>
              </div>
            </div>

            <div ref={graphRef} className="flowchart-graph">
              <canvas ref={canvasRef} className="flowchart-canvas" aria-hidden="true" />

              <div className="flowchart-grid" style={flowchartVars}>
                <div className="flowchart-column flowchart-column-left">
                  {pipelineFlowContent.inputs.map((item, index) => {
                    const { end } = getBranchWindow(
                      index,
                      pipelineFlowContent.inputs.length,
                      0.52,
                      0.14,
                      0.22,
                    )
                    const chipProgress = rangeProgress(animationProgress, Math.min(0.94, end), 1)

                    return (
                      <div
                        key={item}
                        className="flow-pill-row flow-pill-row-left"
                        style={{
                          opacity: chipProgress,
                          transform: `translate3d(${mix(-20, 0, chipProgress)}px, 0, 0)`,
                        }}
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
                    )
                  })}
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
                    <PipelineFlowIsometricCanvas progress={animationProgress} />
                  </div>
                </div>

                <div className="flowchart-column flowchart-column-right">
                  {pipelineFlowContent.views.map((item, index) => {
                    const { end } = getBranchWindow(
                      index,
                      pipelineFlowContent.views.length,
                      0.56,
                      0.12,
                      0.22,
                    )
                    const chipProgress = rangeProgress(animationProgress, Math.min(0.94, end), 1)

                    return (
                      <div
                        key={item}
                        className="flow-pill-row flow-pill-row-right"
                        style={{
                          opacity: chipProgress,
                          transform: `translate3d(${mix(20, 0, chipProgress)}px, 0, 0)`,
                        }}
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
                    )
                  })}
                </div>
              </div>
            </div>

            <div ref={footerSlotRef} className="flowchart-footer-slot">
              <div className="flowchart-copy flowchart-copy-bottom" style={footerStyle}>
                <p>{pipelineFlowContent.description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
