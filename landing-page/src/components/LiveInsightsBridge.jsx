import { useEffect, useRef } from 'react'
import './LiveInsightsBridge.css'
import { LiveBridgeConnectorLine } from './LiveBridgeConnectorLine'
import { LiveBridgeDomainWindow } from './LiveBridgeDomainWindow'
import { LiveBridgeOutputHandoff } from './LiveBridgeOutputHandoff'
import { LiveInsightsBridgeHeader } from './LiveInsightsBridgeHeader'
import { LiveInsightsBridgeStoreProvider, useLiveInsightsBridgeStore } from './LiveInsightsBridgeStore'
import {
  clamp,
  mix,
  rangeProgress,
} from './LiveInsightsBridge.model'
import { LiveNeuralNetworkCanvas } from './LiveNeuralNetworkCanvas'

function LiveInsightsBridgeScene() {
  const {
    activeDomain,
    connectorGeometry,
    isCompactLayout,
    outputAnchor,
    scrollProgress,
    setConnectorGeometry,
    setScrollProgress,
    setStageWidth,
    setTransitionState,
    setViewportWidth,
    setVisibleDomain,
    stageWidth,
    transitionState,
    viewportWidth,
    visibleDomain,
  } = useLiveInsightsBridgeStore()
  const pendingDomainRef = useRef(null)
  const enterFrameRef = useRef(0)
  const snapTimeoutRef = useRef(0)
  const snapReleaseRef = useRef(0)
  const autoSnappingRef = useRef(false)
  const stickyTrackRef = useRef(null)
  const stageRef = useRef(null)
  const networkFrameRef = useRef(null)
  const widgetSignalRef = useRef(null)

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
      window.clearTimeout(snapTimeoutRef.current)
      window.clearTimeout(snapReleaseRef.current)
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

  useEffect(() => {
    let frameId = 0

    const updateMeasurements = () => {
      frameId = 0

      setViewportWidth((currentWidth) => {
        const nextWidth = window.innerWidth || currentWidth
        return currentWidth === nextWidth ? currentWidth : nextWidth
      })

      setStageWidth((currentWidth) => {
        const nextWidth = stageRef.current?.offsetWidth || currentWidth
        return currentWidth === nextWidth ? currentWidth : nextWidth
      })

      const track = stickyTrackRef.current

      if (!track) {
        return
      }

      const viewportHeight = window.innerHeight || 1
      const rect = track.getBoundingClientRect()
      const totalTravel = Math.max(track.offsetHeight - viewportHeight, 1)
      const nextProgress = clamp(-rect.top / totalTravel, 0, 1)

      setScrollProgress((currentProgress) =>
        Math.abs(currentProgress - nextProgress) < 0.001 ? currentProgress : nextProgress,
      )
    }

    const scheduleUpdate = () => {
      if (frameId) {
        return
      }

      frameId = window.requestAnimationFrame(updateMeasurements)
    }

    updateMeasurements()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

  useEffect(() => {
    if (isCompactLayout || autoSnappingRef.current) {
      return undefined
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    const track = stickyTrackRef.current

    if (!track || scrollProgress <= 0.06 || scrollProgress >= 0.999) {
      return undefined
    }

    const snapTargets = [
      { progress: 0.72, threshold: 0.12, delay: 120, release: 620 },
      { progress: 0.95, threshold: 0.14, delay: 70, release: 760 },
      { progress: 0.995, threshold: 0.08, delay: 40, release: 820 },
    ]
    const nearestTarget = snapTargets.reduce((closestTarget, target) => {
      const distance = Math.abs(scrollProgress - target.progress)

      if (distance > target.threshold) {
        return closestTarget
      }

      if (!closestTarget || distance < closestTarget.distance) {
        return { ...target, distance }
      }

      return closestTarget
    }, null)

    if (!nearestTarget) {
      return undefined
    }

    window.clearTimeout(snapTimeoutRef.current)
    snapTimeoutRef.current = window.setTimeout(() => {
      const latestTrack = stickyTrackRef.current

      if (!latestTrack || autoSnappingRef.current) {
        return
      }

      const viewportHeight = window.innerHeight || 1
      const rect = latestTrack.getBoundingClientRect()
      const totalTravel = Math.max(latestTrack.offsetHeight - viewportHeight, 1)
      const trackTop = window.scrollY + rect.top
      const targetScrollTop = trackTop + nearestTarget.progress * totalTravel

      if (Math.abs(window.scrollY - targetScrollTop) < 18) {
        return
      }

      autoSnappingRef.current = true
      window.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      })

      window.clearTimeout(snapReleaseRef.current)
      snapReleaseRef.current = window.setTimeout(() => {
        autoSnappingRef.current = false
      }, nearestTarget.release ?? 520)
    }, nearestTarget.delay ?? 140)

    return () => {
      window.clearTimeout(snapTimeoutRef.current)
    }
  }, [isCompactLayout, scrollProgress])

  useEffect(() => {
    let frameId = 0

    const updateConnector = () => {
      frameId = 0

      const stageRect = stageRef.current?.getBoundingClientRect()
      const networkRect = networkFrameRef.current?.getBoundingClientRect()
      const signalRect = widgetSignalRef.current?.getBoundingClientRect()

      if (!stageRect || !networkRect || !signalRect) {
        return
      }

      const nextConnector = {
        startX: networkRect.left - stageRect.left + networkRect.width * outputAnchor.x,
        startY: networkRect.top - stageRect.top + networkRect.height * outputAnchor.y,
        endX: signalRect.left - stageRect.left + signalRect.width / 2,
        endY: signalRect.top - stageRect.top + signalRect.height / 2,
      }

      setConnectorGeometry((currentConnector) => {
        if (!currentConnector) {
          return nextConnector
        }

        const difference =
          Math.abs(currentConnector.startX - nextConnector.startX) +
          Math.abs(currentConnector.startY - nextConnector.startY) +
          Math.abs(currentConnector.endX - nextConnector.endX) +
          Math.abs(currentConnector.endY - nextConnector.endY)

        return difference < 1 ? currentConnector : nextConnector
      })
    }

    frameId = window.requestAnimationFrame(updateConnector)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [outputAnchor, scrollProgress, transitionState, viewportWidth])

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

  const shiftProgress = rangeProgress(scrollProgress, 0.18, 0.42)
  const focusCenterProgress = rangeProgress(scrollProgress, 0.28, 0.56)
  const focusFadeProgress = rangeProgress(scrollProgress, 0.38, 0.58)
  const dockProgress = rangeProgress(scrollProgress, 0.42, 0.72)
  const dockRetreatProgress = rangeProgress(scrollProgress, 0.76, 0.86)
  const collapseProgress = rangeProgress(scrollProgress, 0.82, 0.9)
  const nodeProgress = rangeProgress(scrollProgress, 0.88, 0.96)
  const outputProgress = rangeProgress(scrollProgress, 0.9, 1)
  const cyclePaused = scrollProgress > 0.4
  const connectorOpacity = clamp(
    (0.16 + shiftProgress * 0.94) * (1 - focusFadeProgress) * (1 - collapseProgress),
    0,
    1,
  )
  const networkOpacity = mix(1, 0, focusFadeProgress)
  const isMobileLayout = viewportWidth < 700
  const safeStageWidth = Math.max(stageWidth, Math.min(viewportWidth - 24, 1440))
  const networkWidth = isCompactLayout
    ? Math.min(safeStageWidth - (isMobileLayout ? 110 : 180), isMobileLayout ? 332 : 412)
    : Math.min(safeStageWidth * 0.36, 540)
  const widgetWidth = isCompactLayout
    ? Math.min(safeStageWidth - (isMobileLayout ? 26 : 44), isMobileLayout ? 362 : 476)
    : Math.min(safeStageWidth * 0.7, 880)
  const desktopNetworkBaseOffset = isCompactLayout ? 0 : -Math.min(safeStageWidth * 0.075, 92)
  const desktopWidgetBaseOffset = isCompactLayout ? 0 : Math.min(safeStageWidth * 0.04, 52)
  const networkOffsetX = isCompactLayout
    ? mix(0, isMobileLayout ? -6 : -10, shiftProgress)
    : mix(
      desktopNetworkBaseOffset,
      desktopNetworkBaseOffset - Math.min(safeStageWidth * 0.18, 220),
      Math.max(shiftProgress, focusCenterProgress),
    )
  const networkOffsetY = isCompactLayout ? mix(0, isMobileLayout ? -12 : -18, shiftProgress) : 0
  const networkScale = mix(
    1,
    isCompactLayout ? (isMobileLayout ? 0.96 : 0.98) : 0.9,
    Math.max(shiftProgress, focusCenterProgress),
  )
  const widgetLeftStart = isCompactLayout ? 0 : safeStageWidth - widgetWidth + desktopWidgetBaseOffset
  const widgetLeftCentered = isCompactLayout ? 0 : (safeStageWidth - widgetWidth) / 2
  const widgetLeft = isCompactLayout
    ? undefined
    : mix(widgetLeftStart, widgetLeftCentered, focusCenterProgress)
  const widgetOffsetY =
    (isCompactLayout ? mix(0, isMobileLayout ? -6 : -12, shiftProgress) : 0) +
    mix(0, isCompactLayout ? 120 : 172, collapseProgress)
  const widgetScale = mix(isCompactLayout ? 0.98 : 0.97, isCompactLayout ? 1.02 : 1.05, focusCenterProgress)
  const sceneScale = mix(1, 0.08, collapseProgress)
  const sceneTranslateY = mix(0, isCompactLayout ? 58 : 88, collapseProgress)
  const sceneOpacity = mix(1, 0, collapseProgress)

  const networkPaneStyle = {
    opacity: networkOpacity,
    '--pane-x': `${networkOffsetX}px`,
    '--pane-y': `${networkOffsetY}px`,
    '--pane-scale': `${networkScale}`,
    '--pane-width': `${networkWidth}px`,
  }

  const widgetPaneStyle = {
    '--pane-y': `${widgetOffsetY}px`,
    '--pane-scale': `${widgetScale}`,
    '--pane-width': `${widgetWidth}px`,
    left: widgetLeft === undefined ? undefined : `${widgetLeft}px`,
    right: widgetLeft === undefined ? undefined : 'auto',
  }

  return (
    <section className="live-bridge-section">
      <div className={`live-bridge-shell ${isCompactLayout ? 'is-compact' : ''}`}>
        <LiveInsightsBridgeHeader />

        <div ref={stickyTrackRef} className="live-bridge-sticky-track">
          <div className="live-bridge-sticky-frame">
            <div ref={stageRef} className="live-bridge-stage">
              <div
                className="live-bridge-scene-core"
                style={{
                  opacity: sceneOpacity,
                  transform: `translate3d(0, ${sceneTranslateY}px, 0) scale(${sceneScale})`,
                }}
              >
                <div className="live-network-pane" style={networkPaneStyle}>
                  <LiveNeuralNetworkCanvas frameRef={networkFrameRef} paused={cyclePaused} />
                </div>

                <LiveBridgeConnectorLine
                  geometry={connectorGeometry}
                  opacity={connectorOpacity}
                />

                <LiveBridgeDomainWindow
                  onTransitionEnd={handleWidgetStageTransitionEnd}
                  signalOpacity={networkOpacity}
                  signalTop={50}
                  dockProgress={dockProgress}
                  retreatProgress={dockRetreatProgress}
                  collapseProgress={collapseProgress}
                  widgetPaneStyle={widgetPaneStyle}
                  widgetSignalRef={widgetSignalRef}
                />
              </div>

              <LiveBridgeOutputHandoff
                nodeProgress={nodeProgress}
                outputProgress={outputProgress}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LiveInsightsBridge() {
  return (
    <LiveInsightsBridgeStoreProvider>
      <LiveInsightsBridgeScene />
    </LiveInsightsBridgeStoreProvider>
  )
}
