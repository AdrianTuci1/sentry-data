export function LiveBridgeConnectorLine({ geometry, opacity }) {
  if (!geometry || opacity <= 0.02) {
    return null
  }

  const deltaX = geometry.endX - geometry.startX
  const deltaY = geometry.endY - geometry.startY
  const length = Math.sqrt(deltaX ** 2 + deltaY ** 2)
  const angle = Math.atan2(deltaY, deltaX)

  return (
    <div
      className="live-bridge-link"
      style={{
        width: `${length}px`,
        opacity,
        transform: `translate3d(${geometry.startX}px, ${geometry.startY}px, 0) rotate(${angle}rad)`,
      }}
    />
  )
}
