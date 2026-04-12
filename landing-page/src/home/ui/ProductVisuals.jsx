import { useEffect, useRef } from 'react'

import { RingSummaryMicro } from '../../../../sentry-frontend/src/components/visuals/micrographics/DashboardMicros'
import anywhereLogo from '../../../assets/output/anywhere.png'
import logo from '../../../assets/pyramid/parrot-white.png'
import hubspotLogo from '../../../assets/output/hubspot.png'
import metaLogo from '../../../assets/output/meta.png'
import neuralLogo from '../../../assets/pyramid/neural.png'
import postgresLogo from '../../../assets/pyramid/postgres.png'
import r2Logo from '../../../assets/pyramid/r2.png'

const sourceLogos = [
  { src: postgresLogo, label: 'Postgres' },
  { src: r2Logo, label: 'R2' },
  { src: neuralLogo, label: 'Model' },
]

const outputLogos = [
  { src: hubspotLogo, label: 'HubSpot' },
  { src: metaLogo, label: 'Meta' },
  { src: anywhereLogo, label: 'Anywhere' },
]

const destinationOrbitItems = [
  { ...sourceLogos[0], x: 52, y: 12 },
  { ...outputLogos[0], x: 84, y: 30 },
  { ...sourceLogos[1], x: 76, y: 82 },
  { ...outputLogos[1], x: 43, y: 89 },
  { ...sourceLogos[2], x: 15, y: 67 },
  { ...outputLogos[2], x: 23, y: 21 },
]

const structureVisibilityWidget = {
  value: '84',
  unit: '%',
  signalScore: 84,
  signalLabel: 'Strong',
  trendValue: '+12 pts',
  trendDirection: 'up',
  trendTone: 'positive',
}

// Edit x/y/width to reposition nodes; connector paths are recalculated from these values.
export const structureMindMapNodes = [
  {
    id: 'feature-group',
    type: 'group',
    icon: 'folder',
    title: 'Feature Group',
    subtitle: 'predictive triggers',
    x: -4,
    y: 44,
    width: 48,
    showInput: false,
    showOutput: true,
  },
  {
    id: 'signal-insight',
    type: 'card',
    icon: 'dashboard',
    title: 'Signal Insight',
    subtitle: 'retrain proposal',
    x: 56,
    y: 60,
    width: 48,
    showInput: true,
    showOutput: false,
  },
]

export const approvalMindMapNodes = [
  {
    id: 'preview-group',
    type: 'group',
    icon: 'folder',
    title: 'Preview Group',
    subtitle: 'direction model',
    x: 0,
    y: 50,
    width: 36,
    showInput: false,
    showOutput: true,
  },
  {
    id: 'current-route',
    type: 'card',
    icon: 'dashboard',
    title: 'Current Route',
    subtitle: 'stable baseline',
    x: 56,
    y: 28,
    width: 37,
    showInput: true,
    showOutput: false,
  },
  {
    id: 'approval-signal',
    type: 'gate',
    icon: 'sparkles',
    title: 'Signal Approval',
    subtitle: 'human review',
    x: 56,
    y: 50,
    width: 37,
    approvalCheck: true,
    showInput: true,
    showOutput: false,
  },
  {
    id: 'policy-signal',
    type: 'gate',
    icon: 'sparkles',
    title: 'Policy Signal',
    subtitle: 'requires approval',
    x: 56,
    y: 72,
    width: 37,
    approvalCheck: true,
    showInput: true,
    showOutput: false,
  },
]

const structureMindMapEdges = [
  { id: 'feature-group-to-signal-insight', sourceId: 'feature-group', targetId: 'signal-insight' },
]

const approvalMindMapEdges = [
  { id: 'preview-group-to-current-route', sourceId: 'preview-group', targetId: 'current-route' },
  { id: 'preview-group-to-approval-signal', sourceId: 'preview-group', targetId: 'approval-signal', tone: 'amber' },
  { id: 'preview-group-to-policy-signal', sourceId: 'preview-group', targetId: 'policy-signal', tone: 'amber' },
]

const MIND_MAP_CANVAS_GUTTER = 18

const getMindMapNodeHeight = (node) => (node.type === 'group' ? 58 : 64)

const getMindMapNodeFrame = (node, width, height) => {
  const usableWidth = Math.max(1, width - MIND_MAP_CANVAS_GUTTER * 2)
  const usableHeight = Math.max(1, height - MIND_MAP_CANVAS_GUTTER * 2)
  const nodeWidth = usableWidth * (node.width / 100)
  const nodeHeight = getMindMapNodeHeight(node)
  const left = MIND_MAP_CANVAS_GUTTER + usableWidth * (node.x / 100)
  const centerY = MIND_MAP_CANVAS_GUTTER + usableHeight * (node.y / 100)

  return {
    left,
    top: centerY - nodeHeight / 2,
    right: left + nodeWidth,
    bottom: centerY + nodeHeight / 2,
    centerX: left + nodeWidth / 2,
    centerY,
    width: nodeWidth,
    height: nodeHeight,
    radius: node.type === 'group' ? nodeHeight / 2 : 18,
  }
}

const getMindMapPortPosition = (frame, side = 'right') => ({
  x: side === 'left' ? frame.left : frame.right,
  y: frame.centerY,
})

const drawRoundRect = (context, x, y, width, height, radius) => {
  const cappedRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + cappedRadius, y)
  context.lineTo(x + width - cappedRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + cappedRadius)
  context.lineTo(x + width, y + height - cappedRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - cappedRadius, y + height)
  context.lineTo(x + cappedRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - cappedRadius)
  context.lineTo(x, y + cappedRadius)
  context.quadraticCurveTo(x, y, x + cappedRadius, y)
  context.closePath()
}

const drawTruncatedText = (context, text, x, y, maxWidth) => {
  const safeText = String(text || '')

  if (context.measureText(safeText).width <= maxWidth) {
    context.fillText(safeText, x, y)
    return
  }

  let output = safeText

  while (output.length > 1 && context.measureText(`${output}...`).width > maxWidth) {
    output = output.slice(0, -1)
  }

  context.fillText(`${output}...`, x, y)
}

const drawMindMapPort = (context, x, y, active = false) => {
  context.save()
  context.fillStyle = '#0d1116'
  context.beginPath()
  context.arc(x, y, 7, 0, Math.PI * 2)
  context.fill()

  context.lineWidth = 1
  context.strokeStyle = active ? 'rgba(125, 211, 252, 0.28)' : 'rgba(255, 255, 255, 0.18)'
  context.stroke()

  context.fillStyle = active ? 'rgba(125, 211, 252, 0.82)' : '#8b98a6'
  context.beginPath()
  context.arc(x, y, 3, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

const drawApprovalCheck = (context, frame) => {
  const radius = 17
  const x = frame.right + radius + 10
  const y = frame.centerY

  context.save()
  context.fillStyle = 'rgba(34, 197, 94, 0.96)'
  context.shadowColor = 'rgba(34, 197, 94, 0.42)'
  context.shadowBlur = 20
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
  context.restore()

  context.save()
  context.strokeStyle = '#062d17'
  context.lineWidth = 3.2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(x - 7, y)
  context.lineTo(x - 2, y + 5)
  context.lineTo(x + 8, y - 7)
  context.stroke()
  context.restore()
}

const drawSparkleDiamond = (context, cx, cy, size) => {
  context.beginPath()
  context.moveTo(cx, cy - size)
  context.lineTo(cx + size, cy)
  context.lineTo(cx, cy + size)
  context.lineTo(cx - size, cy)
  context.closePath()
  context.fill()
}

const drawMindMapIcon = (context, icon, x, y, size) => {
  context.save()
  context.lineWidth = 1.8
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (icon === 'folder') {
    context.fillStyle = '#a7f3d0'
    drawRoundRect(context, x + size * 0.18, y + size * 0.34, size * 0.64, size * 0.42, 5)
    context.fill()
    context.beginPath()
    context.moveTo(x + size * 0.22, y + size * 0.34)
    context.lineTo(x + size * 0.38, y + size * 0.24)
    context.lineTo(x + size * 0.52, y + size * 0.34)
    context.closePath()
    context.fill()
  } else if (icon === 'sparkles') {
    context.fillStyle = '#fde68a'
    drawSparkleDiamond(context, x + size * 0.48, y + size * 0.42, size * 0.17)
    drawSparkleDiamond(context, x + size * 0.68, y + size * 0.62, size * 0.08)
  } else {
    context.strokeStyle = '#bae6fd'
    drawRoundRect(context, x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6, 2)
    context.stroke()
    context.beginPath()
    context.moveTo(x + size * 0.2, y + size * 0.42)
    context.lineTo(x + size * 0.8, y + size * 0.42)
    context.moveTo(x + size * 0.44, y + size * 0.42)
    context.lineTo(x + size * 0.44, y + size * 0.8)
    context.stroke()
  }

  context.restore()
}

const drawMindMapNode = (context, node, frame) => {
  if (!frame) {
    return
  }

  const iconSize = Math.max(30, Math.min(40, frame.width * 0.28))
  const iconX = frame.left + 14
  const iconY = frame.centerY - iconSize / 2
  const copyX = iconX + iconSize + 11
  const copyWidth = Math.max(28, frame.right - copyX - 14)
  const isGroup = node.type === 'group'
  const isGate = node.type === 'gate'

  if (node.approvalRing) {
    context.save()
    context.strokeStyle = 'rgba(134, 239, 172, 0.88)'
    context.lineWidth = 2.2
    context.shadowColor = 'rgba(74, 222, 128, 0.32)'
    context.shadowBlur = 18
    context.beginPath()
    context.arc(frame.centerX || frame.left + frame.width / 2, frame.centerY, Math.max(frame.width, frame.height) * 0.54, 0, Math.PI * 2)
    context.stroke()
    context.restore()
  }

  context.save()
  context.shadowColor = 'rgba(0, 0, 0, 0.24)'
  context.shadowBlur = 28
  context.shadowOffsetY = 12
  drawRoundRect(context, frame.left, frame.top, frame.width, frame.height, frame.radius)
  context.fillStyle = isGate ? 'rgba(36, 28, 20, 0.96)' : 'rgba(26, 28, 32, 0.96)'
  context.fill()
  context.restore()

  context.save()
  drawRoundRect(context, frame.left, frame.top, frame.width, frame.height, frame.radius)
  context.strokeStyle = isGate ? 'rgba(251, 191, 36, 0.22)' : 'rgba(255, 255, 255, 0.1)'
  context.lineWidth = 1
  context.stroke()
  context.restore()

  context.save()
  drawRoundRect(context, iconX, iconY, iconSize, iconSize, isGroup ? iconSize / 2 : 14)
  context.fillStyle = isGate ? 'rgba(52, 43, 24, 0.98)' : '#23262b'
  context.fill()
  context.strokeStyle = isGate ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 255, 255, 0.1)'
  context.stroke()
  drawMindMapIcon(context, node.icon, iconX, iconY, iconSize)
  context.restore()

  context.fillStyle = isGroup ? '#ecfdf5' : '#ffffff'
  context.font = '600 13px Inter, sans-serif'
  context.textBaseline = 'top'
  drawTruncatedText(context, node.title, copyX, frame.centerY - 15, copyWidth)

  context.fillStyle = isGate ? 'rgba(254, 243, 199, 0.72)' : 'rgba(143, 160, 177, 0.86)'
  context.font = '500 10.5px Inter, sans-serif'
  drawTruncatedText(context, node.subtitle, copyX, frame.centerY + 4, copyWidth)

  if (node.showInput) {
    drawMindMapPort(context, frame.left, frame.centerY, false)
  }

  if (node.showOutput) {
    drawMindMapPort(context, frame.right, frame.centerY, true)
  }

  if (node.approvalCheck) {
    drawApprovalCheck(context, frame)
  }
}

const drawMindMapEdge = (context, framesById, edge) => {
  const sourceFrame = framesById.get(edge.sourceId)
  const targetFrame = framesById.get(edge.targetId)

  if (!sourceFrame || !targetFrame) {
    return
  }

  const source = getMindMapPortPosition(sourceFrame, edge.sourceSide || 'right')
  const target = getMindMapPortPosition(targetFrame, edge.targetSide || 'left')
  const controlOffset = Math.max(32, Math.abs(target.x - source.x) * 0.32)

  context.save()
  context.beginPath()
  context.moveTo(source.x, source.y)
  context.bezierCurveTo(
    source.x + controlOffset,
    source.y,
    target.x - controlOffset,
    target.y,
    target.x,
    target.y,
  )
  context.strokeStyle = edge.tone === 'amber' ? 'rgba(251, 191, 36, 0.68)' : 'rgba(125, 211, 252, 0.62)'
  context.lineWidth = edge.tone === 'amber' ? 1.8 : 1.6
  context.lineCap = 'round'
  context.stroke()
  context.restore()
}

const drawMindMapMarker = (context, marker, width, height) => {
  const usableWidth = Math.max(1, width - MIND_MAP_CANVAS_GUTTER * 2)
  const usableHeight = Math.max(1, height - MIND_MAP_CANVAS_GUTTER * 2)
  const x = MIND_MAP_CANVAS_GUTTER + usableWidth * (marker.x / 100)
  const y = MIND_MAP_CANVAS_GUTTER + usableHeight * (marker.y / 100)

  context.save()
  context.fillStyle = 'rgba(251, 191, 36, 0.94)'
  context.shadowColor = 'rgba(251, 191, 36, 0.38)'
  context.shadowBlur = 18
  context.beginPath()
  context.arc(x, y, marker.radius, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function MindMapCanvas({ nodes, edges, markers = [] }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return undefined
    }

    const context = canvas.getContext('2d')

    if (!context) {
      return undefined
    }

    const resizeAndDraw = () => {
      const bounds = canvas.getBoundingClientRect()
      const width = Math.max(1, Math.floor(bounds.width))
      const height = Math.max(1, Math.floor(bounds.height))
      const dpr = window.devicePixelRatio || 1

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)

      const framesById = new Map(
        nodes.map((node) => [node.id, getMindMapNodeFrame(node, width, height)]),
      )

      markers.forEach((marker) => drawMindMapMarker(context, marker, width, height))
      edges.forEach((edge) => drawMindMapEdge(context, framesById, edge))
      nodes.forEach((node) => drawMindMapNode(context, node, framesById.get(node.id)))
    }

    resizeAndDraw()

    const observer = new ResizeObserver(() => resizeAndDraw())
    observer.observe(canvas)

    return () => observer.disconnect()
  }, [edges, markers, nodes])

  return <canvas ref={canvasRef} className="home-mindmap-canvas" aria-hidden="true" />
}

function ApprovalPreviewCanvas() {
  return (
    <div className="home-approval-preview-map">
      <MindMapCanvas nodes={approvalMindMapNodes} edges={approvalMindMapEdges} />
    </div>
  )
}

function MindMapMini({ approval = false }) {
  const nodes = approval ? approvalMindMapNodes : structureMindMapNodes
  const edges = approval ? approvalMindMapEdges : structureMindMapEdges

  return (
    <div className={`home-product-snippet home-mindmap-mini ${approval ? 'is-approval' : ''}`}>
      {approval ? (
        <div className="home-widget-topline">
          <span>Review flow</span>
        </div>
      ) : null}

      <MindMapCanvas nodes={nodes} edges={edges} />

      {approval ? (
        <>
          <div className="home-mindmap-overlay-peek">
            <span>Pending proposal</span>
            <strong>Approve route update</strong>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MicroGraphicPreview() {
  return (
    <div className="home-product-snippet home-dashboard-widget-preview">
      <RingSummaryMicro data={structureVisibilityWidget} />
    </div>
  )
}

export function StructureCardVisual({ kind }) {
  if (kind === 'warm') {
    return <MindMapMini />
  }

  if (kind === 'cool') {
    return <MicroGraphicPreview />
  }

  return null
}

export function ImpactLoopVisual() {
  return (
    <div className="home-feature-visual-shell is-impact-loop">
      <div className="home-impact-inspector-window">
        <aside className="home-inspector-panel-preview">
          <div className="home-inspector-status">
            <span className="home-inspector-status-icon" aria-hidden="true">✓</span>
            <span>Aligned</span>
          </div>

          <h3>Signal quality layer</h3>

          <div className="home-inspector-section">
            <span>Description</span>
            <p>Reviewing the active data layer before the next automation loop moves downstream.</p>
          </div>

          <div className="home-inspector-section">
            <span>Sentinel</span>
            <ul>
              <li>Freshness checks are aligned.</li>
              <li>Route impact is inside tolerance.</li>
            </ul>
          </div>

          <div className="home-inspector-reasoning">
            <div>
              <span>Model reasoning</span>
              <span>live review</span>
            </div>
            <p>Signal freshness is strong, downstream impact is low, and the next route can be promoted after approval.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function ApprovalFlowVisual() {
  return (
    <div className="home-feature-visual-shell is-approval-stage">
      <div className="home-approval-canvas">
        <ApprovalPreviewCanvas />
      </div>
    </div>
  )
}

export function DestinationsVisual() {
  return (
    <div className="home-destination-showcase">
      <div className="home-destination-orbit">
        <svg className="home-destination-orbit-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {destinationOrbitItems.map((item) => (
            <line key={item.label} x1="50" y1="50" x2={item.x} y2={item.y} />
          ))}
        </svg>

        <div className="home-destination-orbit-center">
          <img src={logo} alt="" />
        </div>

        {destinationOrbitItems.map((item) => (
          <div
            key={item.label}
            className="home-destination-orbit-logo"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            <img src={item.src} alt="" loading="lazy" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
