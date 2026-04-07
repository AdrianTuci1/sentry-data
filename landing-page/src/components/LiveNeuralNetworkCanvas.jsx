import { useEffect, useRef } from 'react'
import {
  DEFAULT_OUTPUT_ANCHOR,
  DOMAINS,
  W1,
  W2,
  W3,
  clamp,
  computeLayerFocus,
  computeNetworkStep,
  easing,
  interpolateArray,
} from './LiveInsightsBridge.model'
import { useLiveInsightsBridgeStore } from './LiveInsightsBridgeStore'

export function LiveNeuralNetworkCanvas({
  paused = false,
  frameRef: externalFrameRef,
}) {
  const { setActiveDomain, setOutputAnchor } = useLiveInsightsBridgeStore()
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const lastReportedAnchorRef = useRef(DEFAULT_OUTPUT_ANCHOR)
  const simulationRef = useRef({
    from: computeNetworkStep(0),
    to: computeNetworkStep(0),
    stepStartedAt: 0,
    sequenceIndex: 1,
    winner: 0,
  })

  useEffect(() => {
    if (!externalFrameRef) {
      return undefined
    }

    externalFrameRef.current = frameRef.current

    return () => {
      if (externalFrameRef.current === frameRef.current) {
        externalFrameRef.current = null
      }
    }
  }, [externalFrameRef])

  useEffect(() => {
    let animationFrame = 0

    const frame = frameRef.current
    const canvas = canvasRef.current

    if (!frame || !canvas) {
      return undefined
    }

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
        setActiveDomain(DOMAINS[state.winner].label)
      }

      if (!paused && timestamp - state.stepStartedAt > cycleDuration) {
        const previous = state.to
        const next = computeNetworkStep(state.sequenceIndex % DOMAINS.length)
        state.from = previous
        state.to = next
        state.winner = next.winner
        state.sequenceIndex += 1
        state.stepStartedAt = timestamp
        setActiveDomain(DOMAINS[next.winner].label)
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
      const layerCounts = [
        current.input.length,
        current.hidden1.length,
        current.hidden2.length,
        current.outputs.length,
      ]
      const positions = layerCounts.map((count, layerIndex) =>
        Array.from({ length: count }, (_, nodeIndex) => ({
          x: paddingX + (innerWidth * layerIndex) / (layerCounts.length - 1),
          y: paddingY + (innerHeight * (nodeIndex + 1)) / (count + 1),
        })),
      )

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)

      const winnerPoint = positions[3]?.[state.winner]

      if (winnerPoint) {
        const nextAnchor = {
          x: winnerPoint.x / width,
          y: winnerPoint.y / height,
          winner: state.winner,
        }
        const previousAnchor = lastReportedAnchorRef.current

        if (
          !previousAnchor ||
          previousAnchor.winner !== nextAnchor.winner ||
          Math.abs(previousAnchor.x - nextAnchor.x) > 0.001 ||
          Math.abs(previousAnchor.y - nextAnchor.y) > 0.001
        ) {
          lastReportedAnchorRef.current = nextAnchor
          setOutputAnchor(nextAnchor)
        }
      }

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
  }, [paused, setActiveDomain, setOutputAnchor])

  return (
    <div ref={frameRef} className="live-network-shell">
      <canvas ref={canvasRef} className="live-network-canvas" aria-hidden="true" />
    </div>
  )
}
