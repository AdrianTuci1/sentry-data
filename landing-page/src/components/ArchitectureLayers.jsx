import { useEffect, useRef } from 'react'
import './ArchitectureLayers.css'

const sourceIcons = ['WH', 'CRM', 'ADS', 'BILL', 'PRD', 'SUP', 'DB', 'API', 'ETL']

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

function ArchitectureCanvas() {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current

    if (!canvas || !frame) {
      return undefined
    }

    let animationFrame = 0
    let lastSignature = ''

    const draw = () => {
      const rect = frame.getBoundingClientRect()
      const styles = window.getComputedStyle(frame)
      const width = Math.max(320, rect.width)
      const height = Math.max(480, rect.height)
      const dpr = window.devicePixelRatio || 1
      const sceneOffsetX =
        Number.parseFloat(styles.getPropertyValue('--architecture-scene-offset-x')) || 0
      const sceneOffsetY =
        Number.parseFloat(styles.getPropertyValue('--architecture-scene-offset-y')) || 0
      const signature = `${width}|${height}|${dpr}|${sceneOffsetX}|${sceneOffsetY}`

      if (signature === lastSignature) {
        return
      }

      lastSignature = signature

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const context = canvas.getContext('2d')

      if (!context) {
        return
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)

      const unit = Math.min(width / 13.8, height / 17.5)
      const isoX = unit * 0.92
      const isoY = unit * 0.47
      const zScale = unit * 0.68
      const originX = width * 0.42 + sceneOffsetX
      const originY = height * 0.72 + sceneOffsetY

      const project = (x, y, z = 0) => ({
        x: originX - (x - y) * isoX,
        y: originY + (x + y) * isoY - z * zScale,
      })

      const drawPath = (points, strokeStyle, lineWidth = 1.15, alpha = 1) => {
        context.save()
        context.globalAlpha = alpha
        context.beginPath()
        context.moveTo(points[0].x, points[0].y)
        points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
        context.closePath()
        context.strokeStyle = strokeStyle
        context.lineWidth = lineWidth
        context.stroke()
        context.restore()
      }

      const fillPath = (points, fillStyle, alpha = 1) => {
        context.save()
        context.globalAlpha = alpha
        context.beginPath()
        context.moveTo(points[0].x, points[0].y)
        points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
        context.closePath()
        context.fillStyle = fillStyle
        context.fill()
        context.restore()
      }

      const drawPlane = ({
        x,
        y,
        z,
        widthUnits,
        depthUnits,
        thickness,
        topStroke = '#5e5e5e',
        leftStroke = '#1b1b1b',
        rightStroke = '#242424',
        topFill = '#141414',
        leftFill = '#050505',
        rightFill = '#0c0c0c',
      }) => {
        const top = [
          project(x, y, z),
          project(x + widthUnits, y, z),
          project(x + widthUnits, y + depthUnits, z),
          project(x, y + depthUnits, z),
        ]
        const left = [
          project(x, y + depthUnits, z),
          project(x, y, z),
          project(x, y, z - thickness),
          project(x, y + depthUnits, z - thickness),
        ]
        const right = [
          project(x + widthUnits, y, z),
          project(x + widthUnits, y + depthUnits, z),
          project(x + widthUnits, y + depthUnits, z - thickness),
          project(x + widthUnits, y, z - thickness),
        ]

        fillPath(left, leftFill)
        fillPath(right, rightFill)
        fillPath(top, topFill)
        drawPath(top, topStroke)
        drawPath(left, leftStroke)
        drawPath(right, rightStroke)

        return { top, left, right }
      }

      const drawCuboid = ({
        x,
        y,
        z,
        widthUnits,
        depthUnits,
        heightUnits,
        topFill,
        leftFill,
        rightFill,
        stroke = '#5e5e5e',
        accent = false,
      }) => {
        const top = [
          project(x, y, z),
          project(x + widthUnits, y, z),
          project(x + widthUnits, y + depthUnits, z),
          project(x, y + depthUnits, z),
        ]
        const left = [
          project(x, y + depthUnits, z),
          project(x, y, z),
          project(x, y, z - heightUnits),
          project(x, y + depthUnits, z - heightUnits),
        ]
        const right = [
          project(x + widthUnits, y, z),
          project(x + widthUnits, y + depthUnits, z),
          project(x + widthUnits, y + depthUnits, z - heightUnits),
          project(x + widthUnits, y, z - heightUnits),
        ]

        fillPath(left, leftFill)
        fillPath(right, rightFill)
        fillPath(top, topFill)
        drawPath(top, accent ? '#d1ff5e' : stroke, 1.2)
        drawPath(left, accent ? '#86a722' : '#161616', 1.2)
        drawPath(right, accent ? '#6f8d1a' : '#202020', 1.2)

        return { top }
      }

      const drawGrid = () => {
        context.save()
        context.strokeStyle = 'rgba(255,255,255,0.08)'
        context.lineWidth = 1

        for (let i = 0; i <= 8; i += 1) {
          const a = project(-1.2, i, -0.02)
          const b = project(8.7, i, -0.02)
          context.beginPath()
          context.moveTo(a.x, a.y)
          context.lineTo(b.x, b.y)
          context.stroke()
        }

        for (let i = -1; i <= 9; i += 1) {
          const a = project(i, -0.5, -0.02)
          const b = project(i, 8.4, -0.02)
          context.beginPath()
          context.moveTo(a.x, a.y)
          context.lineTo(b.x, b.y)
          context.stroke()
        }

        context.restore()
      }

      const drawArrow = () => {
        const center = project(3.5, 3.5, 2.35)
        context.save()
        context.translate(center.x, center.y)
        context.rotate(-0.12)
        context.scale(-1, 1)
        context.fillStyle = 'rgba(255,255,255,0.92)'
        context.shadowColor = 'rgba(255,255,255,0.2)'
        context.shadowBlur = 18
        context.beginPath()
        context.moveTo(-32, -5)
        context.lineTo(8, -5)
        context.lineTo(8, -12)
        context.lineTo(36, 0)
        context.lineTo(8, 12)
        context.lineTo(8, 5)
        context.lineTo(-32, 5)
        context.closePath()
        context.fill()
        context.restore()
      }

      const drawLogoPlaceholder = () => {
        const topCenter = project(3.5, 3.5, 5.98)
        context.save()
        context.translate(topCenter.x, topCenter.y)
        context.rotate(0.46)
        context.strokeStyle = 'rgba(255,255,255,0.3)'
        context.lineWidth = 1
        drawRoundedRect(context, -24, -14, 48, 28, 8)
        context.stroke()
        context.beginPath()
        context.moveTo(-14, -8)
        context.lineTo(14, 8)
        context.moveTo(-14, 8)
        context.lineTo(14, -8)
        context.stroke()
        context.restore()
      }

      const drawSourceLabels = () => {
        const cubePositions = [
          { x: 2, y: 2 },
          { x: 3.05, y: 2 },
          { x: 4.1, y: 2 },
          { x: 2, y: 3.05 },
          { x: 3.05, y: 3.05 },
          { x: 4.1, y: 3.05 },
          { x: 2, y: 4.1 },
          { x: 3.05, y: 4.1 },
          { x: 4.1, y: 4.1 },
        ]

        cubePositions.forEach((position, index) => {
          const anchor = project(position.x + 0.45, position.y + 0.45, 0.72)
          context.save()
          context.translate(anchor.x, anchor.y)
          context.rotate(0.46)
          context.fillStyle = index < 2 ? '#efffc0' : '#d8d8d8'
          context.font = `${Math.max(10, unit * 0.28)}px Geist, Inter, sans-serif`
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText(sourceIcons[index], 0, 0)
          context.restore()
        })
      }

      drawGrid()

      const sourceCubes = [
        { x: 2, y: 2, accent: true },
        { x: 3.05, y: 2, accent: true },
        { x: 4.1, y: 2, accent: false },
        { x: 2, y: 3.05, accent: false },
        { x: 3.05, y: 3.05, accent: false },
        { x: 4.1, y: 3.05, accent: false },
        { x: 2, y: 4.1, accent: false },
        { x: 3.05, y: 4.1, accent: false },
        { x: 4.1, y: 4.1, accent: false },
      ]

      sourceCubes.forEach((cube) => {
        drawCuboid({
          x: cube.x,
          y: cube.y,
          z: 0.5,
          widthUnits: 0.9,
          depthUnits: 0.9,
          heightUnits: 0.96,
          topFill: cube.accent ? '#d1ff5e' : '#171717',
          leftFill: cube.accent ? '#91b327' : '#060606',
          rightFill: cube.accent ? '#76931e' : '#0f0f0f',
          accent: cube.accent,
        })
      })

      drawPlane({
        x: 1.85,
        y: 1.85,
        z: 2.7,
        widthUnits: 3.3,
        depthUnits: 3.3,
        thickness: 0.82,
        topStroke: '#606060',
        leftStroke: '#181818',
        rightStroke: '#242424',
        topFill: '#121212',
        leftFill: '#040404',
        rightFill: '#0b0b0b',
      })

      drawArrow()

      drawCuboid({
        x: 3,
        y: 3,
        z: 5.74,
        widthUnits: 1,
        depthUnits: 1,
        heightUnits: 1.02,
        topFill: '#141414',
        leftFill: '#050505',
        rightFill: '#0c0c0c',
        stroke: '#666666',
      })

      drawLogoPlaceholder()
      drawSourceLabels()
    }

    const tick = () => {
      draw()
      animationFrame = requestAnimationFrame(tick)
    }

    const handleResize = () => {
      lastSignature = ''
      draw()
    }

    animationFrame = requestAnimationFrame(tick)
    const resizeObserver = new ResizeObserver(() => {
      lastSignature = ''
      draw()
    })
    resizeObserver.observe(frameRef.current)
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div ref={frameRef} className="architecture-scene">
      <canvas ref={canvasRef} className="architecture-canvas" aria-hidden="true" />
    </div>
  )
}

export function ArchitectureLayers() {
  return (
    <section className="architecture-section" id="architecture">
      <div className="architecture-stage">
        <div className="architecture-copy">
          <h2>GIVING YOUR DATA AN EDGE</h2>

          <div className="architecture-steps">
            <p>You create a project</p>
            <p>You connect data sources</p>
            <p>Our system does everything</p>
            <p>You get insights and smart recommendations</p>
          </div>
        </div>
        <div className="architecture-visual">
          <ArchitectureCanvas />
        </div>
      </div>
    </section>
  )
}
