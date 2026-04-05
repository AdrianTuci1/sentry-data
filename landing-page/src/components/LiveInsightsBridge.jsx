import { useEffect, useRef, useState } from 'react'
import marketingData from '../../../sentry-frontend/src/data/analyticsData-marketing.json'
import saasData from '../../../sentry-frontend/src/data/analyticsData-saas.json'
import cyberData from '../../../sentry-frontend/src/data/analyticsData-cybersecurity-xdr.json'
import './LiveInsightsBridge.css'
import { LiveMicroGraphicCard } from './LiveMicroGraphicCard'

const WIDGET_IDS = [
  'marketing-roas',
  'marketing-cpa',
  'marketing-conv-rate',
  'data-saturation',
  'ai-coverage',
  'budget-burn',
]

const W1 = [
  [1.25, -0.12, 0.72, 0.05, 0.18, 0.85],
  [0.18, 1.15, 0.72, 0.44, 0.24, 0.28],
  [0.96, 0.24, 1.12, 0.16, 0.74, 0.52],
  [0.42, 0.88, 0.34, 1.06, 0.66, 0.72],
  [0.24, 0.52, 0.18, 0.56, 1.18, 0.84],
]

const B1 = [-0.82, -0.78, -0.92, -0.88, -0.84, -0.86]

const W2 = [
  [1.06, 0.42, 0.76, 0.28, 0.88],
  [0.38, 1.08, 0.52, 0.84, 0.36],
  [0.92, 0.36, 1.12, 0.44, 0.72],
  [0.44, 0.96, 0.34, 1.06, 0.52],
  [0.28, 0.56, 0.98, 0.62, 1.04],
  [0.74, 0.42, 0.68, 0.88, 0.96],
]

const B2 = [-0.88, -0.84, -0.92, -0.86, -0.88]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const sigmoid = (value) => 1 / (1 + Math.exp(-value))

const dense = (input, weights, bias) =>
  weights[0].map((_, outputIndex) =>
    sigmoid(
      input.reduce(
        (sum, current, inputIndex) => sum + current * weights[inputIndex][outputIndex],
        bias[outputIndex],
      ),
    ),
  )

const proximityScore = (left, right) =>
  1 -
  Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0) / left.length)

const pickWidgets = (dataset) =>
  WIDGET_IDS.map((id) => dataset.find((widget) => widget.id === id)).filter(Boolean)

const DOMAINS = [
  {
    label: 'Ecommerce',
    eyebrow: 'Merchandising, media efficiency and revenue signals aligned in one view.',
    signal: [0.92, 0.48, 0.81, 0.66, 0.74],
    widgets: pickWidgets(marketingData),
  },
  {
    label: 'Saas',
    eyebrow: 'Product telemetry, trial motion and recurring revenue scored together.',
    signal: [0.58, 0.91, 0.72, 0.84, 0.69],
    widgets: pickWidgets(saasData),
  },
  {
    label: 'CyberSecurity',
    eyebrow: 'Threat confidence, sensor coverage and response urgency fused into one graph.',
    signal: [0.87, 0.78, 0.94, 0.57, 0.62],
    widgets: pickWidgets(cyberData),
  },
]

const OUTPUT_PROTOTYPES = DOMAINS.map((domain) => dense(dense(domain.signal, W1, B1), W2, B2))

const W3 = Array.from({ length: OUTPUT_PROTOTYPES[0].length }, (_, hiddenIndex) =>
  OUTPUT_PROTOTYPES.map((prototype) => prototype[hiddenIndex]),
)

function interpolateArray(from, to, progress) {
  return from.map((value, index) => value + (to[index] - value) * progress)
}

function easing(progress) {
  if (progress < 0.5) {
    return 2 * progress * progress
  }

  return 1 - Math.pow(-2 * progress + 2, 2) / 2
}

function normalizeActivity(values, floor = 0.16) {
  const min = Math.min(...values)
  const max = Math.max(...values)

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return values.map(() => floor)
  }

  if (max - min < 0.0001) {
    return values.map(() => 0.72)
  }

  return values.map((value) => floor + ((value - min) / (max - min)) * (1 - floor))
}

function propagateRelevance(nextLayerFocus, weights, nodeValues) {
  return weights.map((row, nodeIndex) => {
    const weightedActivation = row.reduce(
      (sum, weight, targetIndex) => sum + Math.abs(weight) * nextLayerFocus[targetIndex],
      0,
    )

    return weightedActivation * (0.3 + nodeValues[nodeIndex] * 0.7)
  })
}

function computeLayerFocus(current, winner) {
  const outputSeed = current.outputs.map((value, index) =>
    index === winner ? value * 1.2 : value * 0.45,
  )
  const outputs = normalizeActivity(outputSeed, 0.14).map((value, index) =>
    index === winner ? Math.min(1, value + 0.18) : value * 0.58,
  )
  const hidden2 = normalizeActivity(
    propagateRelevance(outputs, W3, current.hidden2),
    0.18,
  )
  const hidden1 = normalizeActivity(
    propagateRelevance(hidden2, W2, current.hidden1),
    0.16,
  )
  const input = normalizeActivity(
    propagateRelevance(hidden1, W1, current.input),
    0.14,
  )

  return { input, hidden1, hidden2, outputs }
}

function computeNetworkStep(targetIndex) {
  const target = DOMAINS[targetIndex]
  const input = target.signal.map((value, index) =>
    clamp(value + Math.sin((targetIndex + 1) * (index + 2) * 1.37) * 0.045, 0.12, 0.98),
  )
  const hidden1 = dense(input, W1, B1)
  const hidden2 = dense(hidden1, W2, B2)
  const outputs = OUTPUT_PROTOTYPES.map((prototype) => proximityScore(hidden2, prototype))
  const winner = outputs.indexOf(Math.max(...outputs))

  return { input, hidden1, hidden2, outputs, winner }
}

function LiveNeuralNetworkCanvas({ onDomainChange }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const simulationRef = useRef({
    from: computeNetworkStep(0),
    to: computeNetworkStep(0),
    stepStartedAt: 0,
    sequenceIndex: 1,
    winner: 0,
  })

  useEffect(() => {
    const frame = frameRef.current
    const canvas = canvasRef.current

    if (!frame || !canvas) {
      return undefined
    }

    let animationFrame = 0

    const cycleDuration = 3600
    const transitionDuration = 1500

    const draw = (timestamp) => {
      const rect = frame.getBoundingClientRect()
      const width = Math.max(340, rect.width)
      const height = Math.max(300, rect.height)
      const dpr = window.devicePixelRatio || 1

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const context = canvas.getContext('2d')

      if (!context) {
        return
      }

      const state = simulationRef.current

      if (!state.stepStartedAt) {
        state.stepStartedAt = timestamp
        onDomainChange(DOMAINS[state.winner].label)
      }

      if (timestamp - state.stepStartedAt > cycleDuration) {
        const previous = state.to
        const next = computeNetworkStep(state.sequenceIndex % DOMAINS.length)
        state.from = previous
        state.to = next
        state.winner = next.winner
        state.sequenceIndex += 1
        state.stepStartedAt = timestamp
        onDomainChange(DOMAINS[next.winner].label)
      }

      const progress = easing(Math.min((timestamp - state.stepStartedAt) / transitionDuration, 1))
      const pulse = 0.72 + Math.sin(timestamp * 0.0042) * 0.18
      const current = {
        input: interpolateArray(state.from.input, state.to.input, progress),
        hidden1: interpolateArray(state.from.hidden1, state.to.hidden1, progress),
        hidden2: interpolateArray(state.from.hidden2, state.to.hidden2, progress),
        outputs: interpolateArray(state.from.outputs, state.to.outputs, progress),
      }
      const layerFocus = computeLayerFocus(current, state.winner)

      const paddingX = width * 0.1
      const paddingY = height * 0.14
      const innerWidth = width - paddingX * 2
      const innerHeight = height - paddingY * 2
      const layerCounts = [current.input.length, current.hidden1.length, current.hidden2.length, current.outputs.length]
      const positions = layerCounts.map((count, layerIndex) =>
        Array.from({ length: count }, (_, nodeIndex) => ({
          x: paddingX + (innerWidth * layerIndex) / (layerCounts.length - 1),
          y: paddingY + (innerHeight * (nodeIndex + 1)) / (count + 1),
        })),
      )

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)

      const drawConnections = (
        fromPositions,
        toPositions,
        fromValues,
        toValues,
        fromFocus,
        toFocus,
        weights,
      ) => {
        const connectionScores = toPositions.map((_, toIndex) =>
          fromPositions.map((_, fromIndex) => {
            const weight = Math.abs(weights[fromIndex][toIndex] || 0.1)

            return (
              weight *
              (0.42 + fromValues[fromIndex] * 0.58) *
              (0.28 + fromFocus[fromIndex] * 0.72) *
              (0.22 + toValues[toIndex] * 0.78) *
              (0.24 + toFocus[toIndex] * 0.76)
            )
          }),
        )
        const maxScoreByTarget = connectionScores.map((scores) => Math.max(...scores, 0.0001))

        fromPositions.forEach((fromPoint, fromIndex) => {
          toPositions.forEach((toPoint, toIndex) => {
            const weight = Math.abs(weights[fromIndex][toIndex] || 0.1)
            const baseIntensity = clamp(
              (fromFocus[fromIndex] * 0.24 + toFocus[toIndex] * 0.34) * (0.32 + weight * 0.38),
              0.02,
              0.26,
            )
            const score = connectionScores[toIndex][fromIndex]
            const activationRatio = score / maxScoreByTarget[toIndex]
            const isActivatedPath =
              toFocus[toIndex] > 0.52 &&
              fromFocus[fromIndex] > 0.3 &&
              activationRatio > 0.72
            const highlightIntensity = clamp(
              score * (0.65 + activationRatio * 0.7) * pulse,
              0.08,
              1,
            )

            context.beginPath()
            context.moveTo(fromPoint.x, fromPoint.y)
            context.lineTo(toPoint.x, toPoint.y)
            context.strokeStyle = `rgba(255,255,255,${0.012 + baseIntensity * 0.12})`
            context.lineWidth = 0.8 + weight * 0.25
            context.stroke()

            if (!isActivatedPath) {
              return
            }

            context.beginPath()
            context.moveTo(fromPoint.x, fromPoint.y)
            context.lineTo(toPoint.x, toPoint.y)
            context.strokeStyle = `rgba(209,255,94,${0.08 + highlightIntensity * 0.46})`
            context.lineWidth = 1.1 + highlightIntensity * 1.6
            context.stroke()
          })
        })
      }

      drawConnections(
        positions[0],
        positions[1],
        current.input,
        current.hidden1,
        layerFocus.input,
        layerFocus.hidden1,
        W1,
      )
      drawConnections(
        positions[1],
        positions[2],
        current.hidden1,
        current.hidden2,
        layerFocus.hidden1,
        layerFocus.hidden2,
        W2,
      )
      drawConnections(
        positions[2],
        positions[3],
        current.hidden2,
        current.outputs,
        layerFocus.hidden2,
        layerFocus.outputs,
        W3,
      )

      positions.forEach((layer, layerIndex) => {
        const values = [current.input, current.hidden1, current.hidden2, current.outputs][layerIndex]
        const focusValues = [
          layerFocus.input,
          layerFocus.hidden1,
          layerFocus.hidden2,
          layerFocus.outputs,
        ][layerIndex]

        layer.forEach((point, nodeIndex) => {
          const value = values[nodeIndex]
          const focus = focusValues[nodeIndex]
          const nodeEnergy = clamp(value * 0.45 + focus * 0.9, 0.08, 1)
          const radius = layerIndex === 3 ? 8.5 : 7
          const glowRadius = radius + nodeEnergy * 11

          context.beginPath()
          context.arc(point.x, point.y, glowRadius, 0, Math.PI * 2)
          context.fillStyle =
            layerIndex === 3 && nodeIndex === simulationRef.current.winner
              ? `rgba(209,255,94,${0.18 + nodeEnergy * 0.24})`
              : `rgba(114,212,255,${0.04 + nodeEnergy * 0.12})`
          context.fill()

          context.beginPath()
          context.arc(point.x, point.y, radius, 0, Math.PI * 2)
          context.fillStyle =
            layerIndex === 3 && nodeIndex === simulationRef.current.winner
              ? `rgba(209,255,94,${0.52 + nodeEnergy * 0.4})`
              : focus > 0.58
                ? `rgba(209,255,94,${0.18 + nodeEnergy * 0.34})`
                : `rgba(255,255,255,${0.22 + nodeEnergy * 0.48})`
          context.fill()

          context.beginPath()
          context.arc(point.x, point.y, radius, 0, Math.PI * 2)
          context.strokeStyle =
            focus > 0.62
              ? `rgba(209,255,94,${0.24 + nodeEnergy * 0.28})`
              : `rgba(255,255,255,${0.16 + nodeEnergy * 0.24})`
          context.lineWidth = 1
          context.stroke()
        })
      })

      animationFrame = requestAnimationFrame(draw)
    }

    animationFrame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [onDomainChange])

  return (
    <div ref={frameRef} className="live-network-shell">
      <canvas ref={canvasRef} className="live-network-canvas" aria-hidden="true" />
    </div>
  )
}

function DomainWidgetGrid({ domain, className = '' }) {
  return (
    <div className={`live-widget-grid ${className}`}>
      {domain.widgets.map((widget, index) => (
        <div
          key={`${domain.label}-${widget.id}`}
          className="live-widget-item"
          style={{ '--widget-index': index }}
        >
          <LiveMicroGraphicCard widget={widget} />
        </div>
      ))}
    </div>
  )
}

export function LiveInsightsBridge() {
  const [activeDomain, setActiveDomain] = useState(DOMAINS[0].label)
  const [visibleDomain, setVisibleDomain] = useState(DOMAINS[0].label)
  const [transitionState, setTransitionState] = useState('idle')
  const pendingDomainRef = useRef(null)
  const enterFrameRef = useRef(0)
  const displayedDomain = DOMAINS.find((domain) => domain.label === visibleDomain) || DOMAINS[0]

  useEffect(() => {
    if (activeDomain === visibleDomain || transitionState === 'fading-out') {
      return undefined
    }

    pendingDomainRef.current = activeDomain
    setTransitionState('fading-out')

    return undefined
  }, [activeDomain, transitionState, visibleDomain])

  useEffect(
    () => () => {
      window.cancelAnimationFrame(enterFrameRef.current)
    },
    [],
  )

  useEffect(() => {
    if (transitionState !== 'ready-in') {
      return undefined
    }

    enterFrameRef.current = window.requestAnimationFrame(() => {
      enterFrameRef.current = window.requestAnimationFrame(() => {
        setTransitionState('fading-in')
      })
    })

    return () => {
      window.cancelAnimationFrame(enterFrameRef.current)
    }
  }, [transitionState])

  const handleWidgetStageTransitionEnd = (event) => {
    if (event.target !== event.currentTarget) {
      return
    }

    if (transitionState === 'fading-out') {
      const nextDomain = pendingDomainRef.current

      if (!nextDomain) {
        setTransitionState('idle')
        return
      }

      setVisibleDomain(nextDomain)
      pendingDomainRef.current = null
      setTransitionState('ready-in')
      return
    }

    if (transitionState === 'fading-in') {
      setTransitionState('idle')
    }
  }

  return (
    <section className="live-bridge-section">
      <div className="live-bridge-shell">
        <header className="live-bridge-header">
          <h2>And It&apos;s so good it feels alive!</h2>
          <div className="live-bridge-tabs" aria-label="Industry views">
            {DOMAINS.map((domain) => (
              <span
                key={domain.label}
                className={domain.label === activeDomain ? 'is-active' : ''}
              >
                {domain.label}
              </span>
            ))}
          </div>
        </header>

        <div className="live-bridge-stage">
          <LiveNeuralNetworkCanvas onDomainChange={setActiveDomain} />

          <div
            className={`live-widget-stack is-${transitionState}`}
            onTransitionEnd={handleWidgetStageTransitionEnd}
          >
            <DomainWidgetGrid
              key={displayedDomain.label}
              domain={displayedDomain}
              className={transitionState === 'fading-in' ? 'is-entering' : ''}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
