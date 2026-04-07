import { createContext, useContext, useMemo, useState } from 'react'
import { DEFAULT_OUTPUT_ANCHOR, DOMAINS } from './LiveInsightsBridge.model'

const LiveInsightsBridgeStoreContext = createContext(null)

export function LiveInsightsBridgeStoreProvider({ children }) {
  const [activeDomain, setActiveDomain] = useState(DOMAINS[0].label)
  const [visibleDomain, setVisibleDomain] = useState(DOMAINS[0].label)
  const [transitionState, setTransitionState] = useState('idle')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(1440)
  const [stageWidth, setStageWidth] = useState(1260)
  const [outputAnchor, setOutputAnchor] = useState(DEFAULT_OUTPUT_ANCHOR)
  const [connectorGeometry, setConnectorGeometry] = useState(null)

  const displayedDomain = DOMAINS.find((domain) => domain.label === visibleDomain) || DOMAINS[0]
  const isCompactLayout = viewportWidth < 960

  const value = useMemo(
    () => ({
      activeDomain,
      connectorGeometry,
      displayedDomain,
      isCompactLayout,
      outputAnchor,
      scrollProgress,
      setActiveDomain,
      setConnectorGeometry,
      setOutputAnchor,
      setScrollProgress,
      setStageWidth,
      setTransitionState,
      setViewportWidth,
      setVisibleDomain,
      stageWidth,
      transitionState,
      viewportWidth,
      visibleDomain,
    }),
    [
      activeDomain,
      connectorGeometry,
      displayedDomain,
      isCompactLayout,
      outputAnchor,
      scrollProgress,
      stageWidth,
      transitionState,
      viewportWidth,
      visibleDomain,
    ],
  )

  return (
    <LiveInsightsBridgeStoreContext.Provider value={value}>
      {children}
    </LiveInsightsBridgeStoreContext.Provider>
  )
}

export function useLiveInsightsBridgeStore() {
  const store = useContext(LiveInsightsBridgeStoreContext)

  if (!store) {
    throw new Error('useLiveInsightsBridgeStore must be used within LiveInsightsBridgeStoreProvider')
  }

  return store
}
