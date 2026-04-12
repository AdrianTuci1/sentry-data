import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import bucketImage from '../../assets/pyramid/bucket.png'
import googleImage from '../../assets/pyramid/google.png'
import neuralImage from '../../assets/pyramid/neural.png'
import parrotLogoImage from '../../assets/pyramid/parrot-white.png'
import postgresImage from '../../assets/pyramid/postgres.png'
import r2Image from '../../assets/pyramid/r2.png'
import tiktokImage from '../../assets/pyramid/tiktok.png'

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)

const getSegmentProgress = (value, start, end) => {
  if (end <= start) {
    return 1
  }

  return clamp01((value - start) / (end - start))
}

const easeInOutCubic = (value) => {
  if (value < 0.5) {
    return 4 * value ** 3
  }

  return 1 - ((-2 * value + 2) ** 3) / 2
}

const easeOutCubic = (value) => 1 - (1 - value) ** 3

const baseTileAssetUrls = [bucketImage, googleImage, postgresImage, r2Image, tiktokImage]

const configureTexture = (texture, anisotropy = 1) => {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = anisotropy
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
}

const createSurfacePlane = ({ width, height, color = '#ffffff', opacity = 1, map = null }) =>
  new THREE.Mesh(
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

const createTagTexture = (text) => {
  const canvas = document.createElement('canvas')
  canvas.width = 1720
  canvas.height = 256

  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.shadowColor = 'rgba(0, 0, 0, 0.5)'
  context.shadowBlur = 16
  context.fillStyle = '#f3f5ed'
  context.font = '700 148px Inter, Arial, sans-serif'
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(text.toUpperCase(), 20, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  return texture
}

const createSurfaceMaterials = ({
  topColor,
  rightColor,
  leftColor,
  frontColor,
  bottomColor = '#060708',
  emissiveColor = '#111111',
  emissiveIntensity = 0.08,
}) => [
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

const createLayer = ({
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
}) => {
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

const createRaisedPanel = ({ width, depth, height, panelMap }) =>
  createLayer({
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

const addBaseTiles = (layer, width, height, tileTextures = []) => {
  const tileGroup = new THREE.Group()
  const tileSize = width * 0.2
  const tileHeight = height * 0.24
  const gap = width * 0.028
  const start = -((tileSize * 3 + gap * 2) / 2) + tileSize / 2

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(tileSize, tileHeight, tileSize),
        createSurfaceMaterials({
          topColor: '#1d1f21',
          rightColor: '#101113',
          leftColor: '#090a0b',
          frontColor: '#111214',
          emissiveColor: '#111315',
          emissiveIntensity: 0.05,
        }),
      )
      tile.castShadow = true
      tile.receiveShadow = true
      tile.position.set(
        start + column * (tileSize + gap),
        height / 2 + tileHeight / 2 + 0.08,
        start + row * (tileSize + gap),
      )
      tileGroup.add(tile)

      const texture = tileTextures[(row * 3 + column) % Math.max(tileTextures.length, 1)]

      if (texture) {
        const tileImage = createSurfacePlane({
          width: tileSize * 0.78,
          height: tileSize * 0.78,
          map: texture,
          opacity: 0.98,
        })
        tileImage.rotation.x = -Math.PI / 2
        tileImage.position.y = tileHeight / 2 + 0.022
        tile.add(tileImage)
      }
    }
  }

  layer.add(tileGroup)
}

const disposeScene = (scene) => {
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

function ArchitectureLayersCanvas() {
  const frameRef = useRef(null)
  const canvasRef = useRef(null)

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

    let requestRender = () => {}
    const textureLoader = new THREE.TextureLoader()
    const anisotropy = renderer.capabilities.getMaxAnisotropy()
    const loadTexture = (url) => {
      const texture = textureLoader.load(url, () => {
        requestRender()
      })
      configureTexture(texture, anisotropy)
      return texture
    }

    const baseTileTextures = baseTileAssetUrls.map(loadTexture)
    const middlePanelTexture = loadTexture(neuralImage)
    const topPanelTexture = loadTexture(parrotLogoImage)
    const tagTexture = createTagTexture('Neural engine')

    if (tagTexture) {
      configureTexture(tagTexture, anisotropy)
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50)
    const baseAngle = Math.PI / 4

    const ambient = new THREE.AmbientLight('#f7f5f0', 1.15)
    scene.add(ambient)

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.3)
    keyLight.position.set(6, 14, 8)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 30
    keyLight.shadow.camera.left = -9
    keyLight.shadow.camera.right = 9
    keyLight.shadow.camera.top = 9
    keyLight.shadow.camera.bottom = -9
    scene.add(keyLight)

    const rimLight = new THREE.PointLight('#f4f5f1', 11, 18, 2)
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
      material.opacity = 0.34
    })
    scene.add(grid)

    const shadowGlow = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 48),
      new THREE.MeshBasicMaterial({
        color: '#0b0b0b',
        transparent: true,
        opacity: 0.22,
      }),
    )
    shadowGlow.rotation.x = -Math.PI / 2
    shadowGlow.position.y = 0.01
    shadowGlow.scale.set(1.22, 0.9, 1)
    scene.add(shadowGlow)

    const stack = new THREE.Group()
    stack.rotation.y = baseAngle
    scene.add(stack)

    const baseHeight = 0.88
    const middleHeight = 0.68
    const topHeight = 0.48
    const middlePanelHeight = 0.18
    const topPanelHeight = 0.2

    const baseLayer = createLayer({
      width: 6.2,
      depth: 6.2,
      height: baseHeight,
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
    addBaseTiles(baseLayer, 6.2, baseHeight, baseTileTextures)
    stack.add(baseLayer)

    const middleLayer = createLayer({
      width: 4.16,
      depth: 4.16,
      height: middleHeight,
      topColor: '#141617',
      rightColor: '#0f1012',
      leftColor: '#070809',
      frontColor: '#101112',
      edgeColor: '#696d72',
      panelColor: '#f2f4ef',
      panelOpacity: 0.06,
      emissiveColor: '#202328',
      emissiveIntensity: 0.08,
    })
    stack.add(middleLayer)

    const middlePanels = new THREE.Group()
    const middlePanelSize = 1.18
    const middlePanelGap = 0.28
    const middlePanelOffsets = [
      [-((middlePanelSize + middlePanelGap) / 2), -((middlePanelSize + middlePanelGap) / 2)],
      [((middlePanelSize + middlePanelGap) / 2), -((middlePanelSize + middlePanelGap) / 2)],
      [-((middlePanelSize + middlePanelGap) / 2), ((middlePanelSize + middlePanelGap) / 2)],
      [((middlePanelSize + middlePanelGap) / 2), ((middlePanelSize + middlePanelGap) / 2)],
    ]

    middlePanelOffsets.forEach(([x, z]) => {
      const panel = createRaisedPanel({
        width: middlePanelSize,
        depth: middlePanelSize,
        height: middlePanelHeight,
        panelMap: middlePanelTexture,
      })
      panel.position.set(x, 0, z)
      middlePanels.add(panel)
    })

    middlePanels.position.y = middleHeight / 2 - middlePanelHeight / 2 + 0.02
    middleLayer.add(middlePanels)

    if (tagTexture) {
      const middleTag = createSurfacePlane({
        width: 2.72,
        height: 0.58,
        map: tagTexture,
        opacity: 1,
      })
      middleTag.position.set(-(4.16 / 2) - 0.03, 0.12, 0.12)
      middleTag.rotation.y = -Math.PI / 2
      middleLayer.add(middleTag)
    }

    const topLayer = createLayer({
      width: 2.26,
      depth: 2.26,
      height: topHeight,
      topColor: '#181b1d',
      rightColor: '#111316',
      leftColor: '#090a0c',
      frontColor: '#121518',
      edgeColor: '#72767c',
      panelColor: '#f2f4ef',
      panelOpacity: 0.05,
      emissiveColor: '#1f2227',
      emissiveIntensity: 0.08,
    })
    topLayer.position.z = 0.02
    stack.add(topLayer)

    const topPanel = createRaisedPanel({
      width: 1.28,
      depth: 1.28,
      height: topPanelHeight,
      panelMap: topPanelTexture,
    })
    topPanel.position.set(0, topHeight / 2 - topPanelHeight / 2 + 0.02, 0.02)
    topLayer.add(topPanel)

    const targets = {
      base: {
        fromY: -6.1,
        toY: baseHeight / 2,
        ease: easeInOutCubic,
      },
      middle: {
        fromY: 10.6,
        toY: 2.38,
        ease: easeOutCubic,
      },
      middlePanels: {
        fromY: middleHeight / 2 + 3.2,
        toY: middleHeight / 2 + middlePanelHeight / 2 + 0.06,
        ease: easeOutCubic,
      },
      top: {
        fromY: 11.8,
        toY: 4.42,
        ease: easeOutCubic,
      },
      topPanel: {
        fromY: topHeight / 2 - topPanelHeight / 2 + 0.02,
        toY: topHeight / 2 + topPanelHeight / 2 + 0.05,
        ease: easeOutCubic,
      },
    }

    const setAnimatedY = (object, config, progress) => {
      object.position.y = THREE.MathUtils.lerp(config.fromY, config.toY, config.ease(progress))
      return progress
    }

    let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionChange = (event) => {
      prefersReducedMotion = event.matches

      if (prefersReducedMotion) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
        animationStarted = true
        animationCompleted = true
        currentProgress = 1
      } else if (!animationStarted) {
        currentProgress = 0
      }

      requestRender()
    }
    motionMedia.addEventListener('change', handleMotionChange)

    const updateSize = () => {
      const { width, height } = frame.getBoundingClientRect()
      const nextWidth = Math.max(320, width)
      const nextHeight = Math.max(320, height)
      const compact = nextWidth < 700

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(nextWidth, nextHeight, false)

      stack.scale.setScalar(compact ? 0.88 : 0.8)
      camera.aspect = nextWidth / nextHeight
      camera.fov = compact ? 36 : 32
      camera.position.set(0, compact ? 6.15 : 5.7, compact ? 12.2 : 11.2)
      camera.lookAt(0, compact ? 0.42 : 0.28, 0)
      camera.updateProjectionMatrix()
    }

    updateSize()

    const animationDurationMs = 2600
    let currentProgress = prefersReducedMotion ? 1 : 0
    let animationStarted = prefersReducedMotion
    let animationCompleted = prefersReducedMotion
    let animationStartTime = null
    let renderFrame = 0
    let animationFrame = 0

    const renderScene = () => {
      const sceneProgress = currentProgress
      const baseProgress = setAnimatedY(
        baseLayer,
        targets.base,
        getSegmentProgress(sceneProgress, 0, 0.62),
      )
      const middleProgress = setAnimatedY(
        middleLayer,
        targets.middle,
        getSegmentProgress(sceneProgress, 0.08, 0.48),
      )
      const middlePanelProgress = setAnimatedY(
        middlePanels,
        targets.middlePanels,
        getSegmentProgress(sceneProgress, 0.54, 0.74),
      )
      const topProgress = setAnimatedY(
        topLayer,
        targets.top,
        getSegmentProgress(sceneProgress, 0.72, 0.92),
      )
      const topPanelProgress = setAnimatedY(
        topPanel,
        targets.topPanel,
        getSegmentProgress(sceneProgress, 0.9, 1),
      )

      stack.position.y = THREE.MathUtils.lerp(-1.18, -0.64, sceneProgress)
      stack.rotation.y = baseAngle + THREE.MathUtils.lerp(0.06, -0.02, sceneProgress)
      topLayer.rotation.y = (1 - topProgress) * 0.12

      shadowGlow.scale.x = 1.06 + (1 - topProgress) * 0.1
      shadowGlow.scale.y = 0.8 + (1 - middleProgress) * 0.06
      shadowGlow.material.opacity =
        0.1 + baseProgress * 0.04 + middleProgress * 0.04 + middlePanelProgress * 0.02

      renderer.render(scene, camera)
    }

    let renderQueued = false
    requestRender = () => {
      if (renderQueued) {
        return
      }

      renderQueued = true
      renderFrame = window.requestAnimationFrame(() => {
        renderQueued = false
        renderScene()
      })
    }

    const runAnimation = (timestamp) => {
      if (animationStartTime === null) {
        animationStartTime = timestamp
      }

      const elapsed = timestamp - animationStartTime
      currentProgress = clamp01(elapsed / animationDurationMs)
      renderScene()

      if (currentProgress < 1) {
        animationFrame = window.requestAnimationFrame(runAnimation)
        return
      }

      animationCompleted = true
      animationFrame = 0
    }

    const startAnimation = () => {
      if (prefersReducedMotion || animationStarted) {
        return
      }

      animationStarted = true
      animationCompleted = false
      animationStartTime = null
      animationFrame = window.requestAnimationFrame(runAnimation)
    }

    requestRender()

    const handleResize = () => {
      updateSize()
      requestRender()
    }

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries

        if (!entry || animationCompleted) {
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

    visibilityObserver.observe(frame)

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(frame)
    window.addEventListener('resize', handleResize)

    return () => {
      visibilityObserver.disconnect()
      window.cancelAnimationFrame(renderFrame)
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      motionMedia.removeEventListener('change', handleMotionChange)
      disposeScene(scene)
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={frameRef} className="architecture-scene">
      <canvas ref={canvasRef} className="architecture-canvas" aria-hidden="true" />
    </div>
  )
}

export { ArchitectureLayersCanvas }
