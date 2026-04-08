import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import processorImage from '../../assets/pyramid/neural.png'
import { mix, rangeProgress } from './LiveInsightsBridge.model'

function configureTexture(texture, anisotropy = 1) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = anisotropy
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
}

function createSurfacePlane({ width, height, color = '#ffffff', opacity = 1, map = null }) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: map ? '#ffffff' : color,
      map,
      transparent: opacity < 1 || Boolean(map),
      opacity,
      side: THREE.DoubleSide,
      alphaTest: map ? 0.02 : 0,
      toneMapped: false,
    }),
  )
}

function createSurfaceMaterials({
  topColor,
  rightColor,
  leftColor,
  frontColor,
  bottomColor = '#060708',
  emissiveColor = '#111111',
  emissiveIntensity = 0.08,
}) {
  return [
    new THREE.MeshStandardMaterial({
      color: rightColor,
      metalness: 0.18,
      roughness: 0.72,
    }),
    new THREE.MeshStandardMaterial({
      color: leftColor,
      metalness: 0.16,
      roughness: 0.84,
    }),
    new THREE.MeshStandardMaterial({
      color: topColor,
      emissive: emissiveColor,
      emissiveIntensity,
      metalness: 0.08,
      roughness: 0.58,
    }),
    new THREE.MeshStandardMaterial({
      color: bottomColor,
      metalness: 0.08,
      roughness: 0.96,
    }),
    new THREE.MeshStandardMaterial({
      color: frontColor,
      metalness: 0.14,
      roughness: 0.78,
    }),
    new THREE.MeshStandardMaterial({
      color: frontColor,
      metalness: 0.14,
      roughness: 0.78,
    }),
  ]
}

function createLayer({
  width,
  depth,
  height,
  topColor,
  rightColor,
  leftColor,
  frontColor,
  edgeColor,
  panelColor,
  panelOpacity = 0.34,
  panelMap = null,
  panelImageScale = 0.6,
  emissiveColor = '#0f1011',
  emissiveIntensity = 0.08,
}) {
  const group = new THREE.Group()
  const geometry = new THREE.BoxGeometry(width, height, depth)
  const block = new THREE.Mesh(
    geometry,
    createSurfaceMaterials({
      topColor,
      rightColor,
      leftColor,
      frontColor,
      emissiveColor,
      emissiveIntensity,
    }),
  )

  block.castShadow = true
  block.receiveShadow = true
  group.add(block)

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: 0.48,
    }),
  )
  group.add(edges)

  const panelBase = createSurfacePlane({
    width: width * 0.72,
    height: depth * 0.72,
    color: panelColor,
    opacity: panelOpacity,
  })
  panelBase.rotation.x = -Math.PI / 2
  panelBase.position.y = height / 2 + 0.012
  group.add(panelBase)

  if (panelMap) {
    const panelImage = createSurfacePlane({
      width: width * panelImageScale,
      height: depth * panelImageScale,
      map: panelMap,
      opacity: 0.98,
    })
    panelImage.rotation.x = -Math.PI / 2
    panelImage.position.y = height / 2 + 0.016
    group.add(panelImage)
  }

  return group
}

function createRaisedPanel({ width, depth, height, panelMap }) {
  return createLayer({
    width,
    depth,
    height,
    topColor: '#181a1d',
    rightColor: '#101215',
    leftColor: '#0a0c0e',
    frontColor: '#111316',
    edgeColor: '#7b8087',
    panelColor: '#f2f4ef',
    panelOpacity: 0.08,
    panelMap,
    panelImageScale: 0.74,
    emissiveColor: '#1e2126',
    emissiveIntensity: 0.06,
  })
}

function disposeScene(scene) {
  scene.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose()
    }

    if (!node.material) {
      return
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material]

    materials.forEach((material) => {
      if (material.map) {
        material.map.dispose()
      }

      material.dispose()
    })
  })
}

export function PipelineFlowIsometricCanvas({ progress }) {
  const frameRef = useRef(null)
  const canvasRef = useRef(null)
  const renderRef = useRef(() => {})
  const progressRef = useRef(progress)

  progressRef.current = progress

  useEffect(() => {
    const frame = frameRef.current
    const canvas = canvasRef.current

    if (!frame || !canvas) {
      return undefined
    }

    let renderer

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      })
    } catch {
      return undefined
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const textureLoader = new THREE.TextureLoader()
    const anisotropy = renderer.capabilities.getMaxAnisotropy()
    const processorTexture = textureLoader.load(processorImage, () => {
      renderRef.current()
    })
    configureTexture(processorTexture, anisotropy)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50)
    const stack = new THREE.Group()
    const baseAngle = Math.PI / 4

    stack.rotation.y = baseAngle
    scene.add(stack)

    const ambient = new THREE.AmbientLight('#f7f5f0', 1.15)
    scene.add(ambient)

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.3)
    keyLight.position.set(6, 14, 8)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 30
    keyLight.shadow.camera.left = -8
    keyLight.shadow.camera.right = 8
    keyLight.shadow.camera.top = 8
    keyLight.shadow.camera.bottom = -8
    scene.add(keyLight)

    const rimLight = new THREE.PointLight('#f4f5f1', 10, 18, 2)
    rimLight.position.set(-5.5, 4.2, 4.5)
    scene.add(rimLight)

    const fillLight = new THREE.DirectionalLight('#91a3ff', 0.45)
    fillLight.position.set(-6, 5, -7)
    scene.add(fillLight)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.ShadowMaterial({
        color: '#000000',
        opacity: 0.14,
      }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.02
    floor.receiveShadow = true
    scene.add(floor)

    const grid = new THREE.GridHelper(18, 18, '#4c4f54', '#1f2022')
    grid.position.y = 0.02
    grid.rotation.y = baseAngle
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    gridMaterials.forEach((material) => {
      material.transparent = true
      material.opacity = 0.28
    })
    scene.add(grid)

    const shadowGlow = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.MeshBasicMaterial({
        color: '#0b0b0b',
        transparent: true,
        opacity: 0.22,
      }),
    )
    shadowGlow.rotation.x = -Math.PI / 2
    shadowGlow.position.y = 0.01
    shadowGlow.scale.set(1.14, 0.84, 1)
    scene.add(shadowGlow)

    const layerHeight = 0.88
    const processorBlockHeight = 1.04

    const baseLayer = createLayer({
      width: 6.1,
      depth: 6.1,
      height: layerHeight,
      topColor: '#18191b',
      rightColor: '#101113',
      leftColor: '#08090b',
      frontColor: '#111214',
      edgeColor: '#5b5e62',
      panelColor: '#f2f4ef',
      panelOpacity: 0.12,
      emissiveColor: '#101112',
      emissiveIntensity: 0.06,
    })
    stack.add(baseLayer)

    const innerPanel = createSurfacePlane({
      width: 3.9,
      height: 3.9,
      color: '#f2f4ef',
      opacity: 0.08,
    })
    innerPanel.rotation.x = -Math.PI / 2
    innerPanel.position.y = layerHeight / 2 + 0.018
    baseLayer.add(innerPanel)

    const processorBlock = createRaisedPanel({
      width: 1.94,
      depth: 1.94,
      height: processorBlockHeight,
      panelMap: processorTexture,
    })
    stack.add(processorBlock)

    const updateSize = () => {
      const { width, height } = frame.getBoundingClientRect()
      const nextWidth = Math.max(320, width)
      const nextHeight = Math.max(280, height)
      const compact = nextWidth < 240

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(nextWidth, nextHeight, false)

      stack.scale.setScalar(compact ? 0.72 : 0.78)
      camera.aspect = nextWidth / nextHeight
      camera.fov = compact ? 36 : 32
      camera.position.set(0, compact ? 6.1 : 5.7, compact ? 12 : 11.2)
      camera.lookAt(0, compact ? 0.48 : 0.34, 0)
      camera.updateProjectionMatrix()
    }

    const renderScene = () => {
      const currentProgress = progressRef.current
      const layerProgress = rangeProgress(currentProgress, 0.02, 0.34)
      const cubeDropProgress = rangeProgress(currentProgress, 0.16, 0.68)
      const cubeSettleProgress = rangeProgress(currentProgress, 0.68, 0.9)
      const glowProgress = rangeProgress(currentProgress, 0.72, 1)

      const bounce = Math.sin(cubeSettleProgress * Math.PI) * 0.28 * (1 - cubeSettleProgress * 0.48)

      baseLayer.position.y = mix(-4.8, layerHeight / 2, layerProgress)
      processorBlock.position.y =
        mix(9.8, layerHeight / 2 + processorBlockHeight / 2 + 0.16, cubeDropProgress) + bounce

      processorBlock.rotation.y = mix(0.14, 0, cubeDropProgress) + bounce * 0.16
      processorBlock.rotation.z = mix(0.08, 0, cubeDropProgress) - bounce * 0.08
      processorBlock.scale.setScalar(mix(0.86, 1, cubeDropProgress))

      stack.position.y = mix(-0.92, -0.54, glowProgress)
      stack.rotation.y = baseAngle + mix(0.08, -0.015, glowProgress)

      innerPanel.material.opacity = mix(0.02, 0.11, glowProgress)
      baseLayer.children[0].material[2].emissiveIntensity = mix(0.06, 0.1, glowProgress)
      processorBlock.children[0].material[2].emissiveIntensity = mix(0.06, 0.12, glowProgress)

      shadowGlow.scale.x = 1.05 + (1 - cubeDropProgress) * 0.16
      shadowGlow.scale.y = 0.78 + (1 - cubeDropProgress) * 0.08
      shadowGlow.material.opacity = 0.1 + layerProgress * 0.04 + glowProgress * 0.05

      renderer.render(scene, camera)
    }

    renderRef.current = renderScene
    updateSize()
    renderScene()

    const handleResize = () => {
      updateSize()
      renderScene()
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(frame)
    window.addEventListener('resize', handleResize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      disposeScene(scene)
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      renderRef.current()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [progress])

  return (
    <div ref={frameRef} className="flowchart-core-canvas-shell">
      <canvas ref={canvasRef} className="flowchart-core-canvas" aria-hidden="true" />
    </div>
  )
}
