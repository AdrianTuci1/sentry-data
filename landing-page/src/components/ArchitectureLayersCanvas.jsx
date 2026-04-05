import { useEffect, useRef } from 'react'

function ArchitectureLayersCanvas() {
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
      const width = Math.max(420, rect.width)
      const height = Math.max(560, rect.height)
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

      const unit = Math.min(width / 12.2, height / 15.4)
      const isoX = unit * 0.92
      const isoY = unit * 0.47
      const zScale = unit * 0.68
      const originX = width * 0.47 + sceneOffsetX
      const originY = height * 0.75 + sceneOffsetY

      const project = (x, y, z = 0) => ({
        x: originX - (x - y) * isoX,
        y: originY + (x + y) * isoY - z * zScale,
      })

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

      const lerpPoint = (from, to, amount) => ({
        x: from.x + (to.x - from.x) * amount,
        y: from.y + (to.y - from.y) * amount,
      })

      const polygonCenter = (points) => ({
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      })

      const insetPolygon = (points, horizontalInset = 0.18, verticalInset = 0.18) => {
        const topLeft = points[0]
        const topRight = points[1]
        const bottomRight = points[2]
        const bottomLeft = points[3]

        return [
          lerpPoint(
            lerpPoint(topLeft, topRight, horizontalInset),
            lerpPoint(topLeft, bottomLeft, verticalInset),
            0.5,
          ),
          lerpPoint(
            lerpPoint(topRight, topLeft, horizontalInset),
            lerpPoint(topRight, bottomRight, verticalInset),
            0.5,
          ),
          lerpPoint(
            lerpPoint(bottomRight, bottomLeft, horizontalInset),
            lerpPoint(bottomRight, topRight, verticalInset),
            0.5,
          ),
          lerpPoint(
            lerpPoint(bottomLeft, bottomRight, horizontalInset),
            lerpPoint(bottomLeft, topLeft, verticalInset),
            0.5,
          ),
        ]
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
        frontStroke = '#303030',
        topFill = '#141414',
        leftFill = '#050505',
        rightFill = '#0c0c0c',
        frontFill = '#101010',
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
        const front = [
          project(x, y + depthUnits, z),
          project(x + widthUnits, y + depthUnits, z),
          project(x + widthUnits, y + depthUnits, z - thickness),
          project(x, y + depthUnits, z - thickness),
        ]

        fillPath(left, leftFill)
        fillPath(right, rightFill)
        fillPath(front, frontFill)
        fillPath(top, topFill)
        drawPath(top, topStroke)
        drawPath(left, leftStroke)
        drawPath(right, rightStroke)
        drawPath(front, frontStroke)

        return { top, left, right, front }
      }

      const drawCuboid = ({
        x,
        y,
        z,
        widthUnits,
        depthUnits,
        heightUnits,
        topFill = '#171717',
        leftFill = '#060606',
        rightFill = '#0f0f0f',
        frontFill = '#101010',
        stroke = '#5e5e5e',
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
        const front = [
          project(x, y + depthUnits, z),
          project(x + widthUnits, y + depthUnits, z),
          project(x + widthUnits, y + depthUnits, z - heightUnits),
          project(x, y + depthUnits, z - heightUnits),
        ]

        fillPath(left, leftFill)
        fillPath(right, rightFill)
        fillPath(front, frontFill)
        fillPath(top, topFill)
        drawPath(top, stroke, 1.15)
        drawPath(left, '#171717', 1.15)
        drawPath(right, '#222222', 1.15)
        drawPath(front, '#252525', 1.15)

        return { top, left, right, front }
      }

      const drawGrid = () => {
        context.save()
        context.strokeStyle = 'rgba(255,255,255,0.08)'
        context.lineWidth = 1

        for (let i = 0; i <= 8; i += 1) {
          const a = project(-0.8, i, -0.02)
          const b = project(9.2, i, -0.02)
          context.beginPath()
          context.moveTo(a.x, a.y)
          context.lineTo(b.x, b.y)
          context.stroke()
        }

        for (let i = -1; i <= 9; i += 1) {
          const a = project(i, -0.3, -0.02)
          const b = project(i, 8.8, -0.02)
          context.beginPath()
          context.moveTo(a.x, a.y)
          context.lineTo(b.x, b.y)
          context.stroke()
        }

        context.restore()
      }

      const drawTopPlaceholder = (topPoints) => {
        const placeholder = insetPolygon(topPoints, 0.24, 0.24)
        fillPath(placeholder, 'rgba(255,255,255,0.035)')
        drawPath(placeholder, 'rgba(255,255,255,0.22)', 1)
      }

      const drawFaceLabel = (facePoints, text, edge = [0, 1], offsetY = 0) => {
        const center = polygonCenter(facePoints)
        let angle = Math.atan2(
          facePoints[edge[1]].y - facePoints[edge[0]].y,
          facePoints[edge[1]].x - facePoints[edge[0]].x,
        )
        if (angle >= Math.PI / 2 || angle <= -Math.PI / 2) {
          angle += Math.PI
        }
        context.save()
        context.translate(center.x, center.y + offsetY)
        context.rotate(angle)
        context.fillStyle = 'rgba(255,255,255,0.84)'
        context.font = `${Math.max(11, unit * 0.31)}px Geist, Inter, sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(text, 0, 0)
        context.restore()
      }

      drawGrid()

      const bottomSupport = drawPlane({
        x: 2,
        y: 2,
        z: 0.5,
        widthUnits: 3,
        depthUnits: 3,
        thickness: 0.96,
        topStroke: '#5b5b5b',
        leftStroke: '#171717',
        rightStroke: '#222222',
        frontStroke: '#252525',
        topFill: '#171717',
        leftFill: '#060606',
        rightFill: '#0f0f0f',
        frontFill: '#111111',
      })

      const bottomCubes = []
      const bottomCubeSize = 0.72
      const bottomCubeGap = 0.14
      const bottomCubeHeight = 0.68
      const bottomStart = 2 + (3 - (bottomCubeSize * 3 + bottomCubeGap * 2)) / 2

      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          bottomCubes.push({
            x: bottomStart + col * (bottomCubeSize + bottomCubeGap),
            y: bottomStart + row * (bottomCubeSize + bottomCubeGap),
          })
        }
      }

      bottomCubes.forEach((cube) => {
        const faces = drawCuboid({
          x: cube.x,
          y: cube.y,
          z: 1.06,
          widthUnits: bottomCubeSize,
          depthUnits: bottomCubeSize,
          heightUnits: bottomCubeHeight,
          topFill: '#181818',
          leftFill: '#070707',
          rightFill: '#101010',
          frontFill: '#121212',
          stroke: '#5b5b5b',
        })
        drawTopPlaceholder(faces.top)
      })

      const middlePlane = drawPlane({
        x: 2,
        y: 2,
        z: 3.05,
        widthUnits: 3,
        depthUnits: 3,
        thickness: 0.82,
        topStroke: '#606060',
        leftStroke: '#181818',
        rightStroke: '#242424',
        frontStroke: '#2b2b2b',
        topFill: '#121212',
        leftFill: '#040404',
        rightFill: '#0b0b0b',
        frontFill: '#111111',
      })

      const topCube = drawCuboid({
        x: 3,
        y: 3,
        z: 5.2,
        widthUnits: 1,
        depthUnits: 1,
        heightUnits: 0.88,
        topFill: '#181818',
        leftFill: '#070707',
        rightFill: '#101010',
        frontFill: '#121212',
        stroke: '#5b5b5b',
      })

      drawTopPlaceholder(bottomSupport.top)
      drawTopPlaceholder(middlePlane.top)
      drawTopPlaceholder(topCube.top)
      drawFaceLabel(middlePlane.right, 'Neural engine', [0, 1], unit * 0.05)
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

export { ArchitectureLayersCanvas }
