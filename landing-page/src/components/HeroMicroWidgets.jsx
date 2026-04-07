import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './HeroMicroWidgets.css'

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Math.round(value))

const CARD_DIMENSIONS = {
  wide: { width: 496, height: 280 },
  small: { width: 238, height: 280 },
  tall: { width: 238, height: 624 },
}

const optimalTimeData = {
  title: 'Peak Engagement',
  subtitle: 'Best Campaign Window',
  calendarMonth: 'April 2026',
  calendarOffset: 2,
  daysInMonth: 30,
  totalCalendarCells: 56,
  calendarValues: [
    28, 31, 33, 35, 44, 48, 55, 56,
    32, 31, 34, 35, 26, 28, 22, 35,
    36, 35, 35, 35, 35, 21, 36, 36,
    27, 29, 32, 22, 34, 23,
  ],
  summaryCards: [
    {
      id: 'weekly-peak',
      icon: 'sparkles',
      label: 'Weekly Peak',
      value: '8,097',
      delta: '+19.6%',
      note: '42,214 engaged sessions',
      tone: 'positive',
    },
    {
      id: 'quarterly-reach',
      icon: 'orbit',
      label: 'Quarter Reach',
      value: '312,134',
      delta: '+2.5%',
      note: '301,002 prior baseline',
      tone: 'positive',
    },
  ],
  marketBreakdown: [
    { label: 'Los Angeles', value: '201,192' },
    { label: 'New York', value: '192,054' },
    { label: 'Canada', value: '166,401' },
  ],
}

const refreshCycleCard = {
  title: 'Creative Health',
  subtitle: 'Asset Freshness Score',
  footerText: 'Scheduled for Monday',
  data: {
    value: '86',
    unit: 'pts',
    trendValue: '+5 pts',
    trendDirection: 'up',
    trendTone: 'positive',
    trendLabel: 'since last refresh',
  },
}

const technicalHealthCard = {
  title: 'Health',
  subtitle: 'Service Uptime',
  data: {
    value: '99.94',
    unit: '%',
    uptimeBars: [
      'good', 'good', 'good', 'good', 'good', 'good', 'good', 'good',
      'good', 'good', 'good', 'warn', 'good', 'good', 'good', 'good',
      'good', 'good', 'good', 'good', 'good', 'good', 'good', 'good',
      'good', 'good', 'good', 'good', 'good', 'good', 'warn', 'good',
      'good', 'good', 'good', 'down', 'good', 'good', 'good', 'good',
      'good', 'good', 'good', 'good',
    ],
  },
}

function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frameId = 0
    let startTime = 0

    const tick = (timestamp) => {
      if (!startTime) {
        startTime = timestamp
      }

      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setValue(target * eased)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [target, duration])

  return value
}

function useSequentialReveal(total, stepMs = 38, initialDelay = 120) {
  const [revealedCount, setRevealedCount] = useState(0)

  useEffect(() => {
    if (!total) {
      return undefined
    }

    let timeoutId = 0
    let intervalId = 0

    setRevealedCount(0)

    timeoutId = window.setTimeout(() => {
      setRevealedCount(1)

      intervalId = window.setInterval(() => {
        setRevealedCount((current) => {
          if (current >= total) {
            window.clearInterval(intervalId)
            return total
          }

          return current + 1
        })
      }, stepMs)
    }, initialDelay)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [initialDelay, stepMs, total])

  return revealedCount
}

function buildLinePath(values, width, height, padding, domain = {}, slotCount = values.length) {
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const min = Number.isFinite(domain.min) ? domain.min : Math.min(...values)
  const max = Number.isFinite(domain.max) ? domain.max : Math.max(...values)
  const range = Math.max(1, max - min)
  const steps = Math.max(1, slotCount - 1)

  const points = values.map((value, index) => {
    const x = padding.left + (innerWidth / steps) * index
    const y = padding.top + innerHeight - ((value - min) / range) * innerHeight
    return [x, y]
  })

  const path = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')

  return { path, points }
}

function buildPartialLine(points, progress) {
  if (!points.length) {
    return { path: '', point: [0, 0] }
  }

  if (points.length === 1 || progress <= 0) {
    const [x, y] = points[0]
    return { path: `M ${x.toFixed(2)} ${y.toFixed(2)}`, point: points[0] }
  }

  const clamped = clamp(progress, 0, 1)
  const segmentCount = points.length - 1
  const scaledProgress = clamped * segmentCount
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaledProgress))
  const localProgress = clamped === 1 ? 1 : scaledProgress - segmentIndex
  const visiblePoints = points.slice(0, segmentIndex + 1)
  const [startX, startY] = points[segmentIndex]
  const [endX, endY] = points[Math.min(segmentIndex + 1, points.length - 1)]
  const currentPoint = [
    startX + (endX - startX) * localProgress,
    startY + (endY - startY) * localProgress,
  ]

  visiblePoints.push(currentPoint)

  const path = visiblePoints
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')

  return { path, point: currentPoint }
}

function interpolateSeriesValue(values, progress) {
  if (!values.length) {
    return 0
  }

  if (values.length === 1 || progress <= 0) {
    return values[0]
  }

  const clamped = clamp(progress, 0, 1)
  const segmentCount = values.length - 1
  const scaledProgress = clamped * segmentCount
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaledProgress))
  const localProgress = clamped === 1 ? 1 : scaledProgress - segmentIndex
  const startValue = values[segmentIndex]
  const endValue = values[Math.min(segmentIndex + 1, values.length - 1)]

  return startValue + (endValue - startValue) * localProgress
}

function tracePath(ctx, points, width, height, moveToFirst = true) {
  points.forEach(([x, y], index) => {
    const px = x * width
    const py = y * height

    if (index === 0) {
      if (moveToFirst) {
        ctx.moveTo(px, py)
      } else {
        ctx.lineTo(px, py)
      }
      return
    }

    const [prevX, prevY] = points[index - 1]
    const cx = ((prevX + x) / 2) * width
    ctx.bezierCurveTo(cx, prevY * height, cx, py, px, py)
  })
}

const funnelEnvelopes = [
  {
    stops: ['rgba(43, 17, 74, 0.2)', 'rgba(76, 52, 186, 0.86)', 'rgba(87, 41, 149, 0.98)'],
    halfWidths: [0.045, 0.05, 0.19, 0.19, 0.325, 0.325],
  },
  {
    stops: ['rgba(37, 48, 116, 0.18)', 'rgba(65, 95, 233, 0.92)', 'rgba(73, 91, 200, 0.94)'],
    halfWidths: [0.026, 0.03, 0.115, 0.115, 0.19, 0.19],
  },
  {
    stops: ['rgba(18, 238, 183, 0.18)', 'rgba(49, 202, 216, 0.92)', 'rgba(45, 248, 156, 1)'],
    halfWidths: [0.012, 0.016, 0.06, 0.06, 0.096, 0.096],
  },
]

const funnelContourXs = [0, 0.13, 0.33, 0.58, 0.78, 1]
const funnelCenterline = [0.592, 0.592, 0.57, 0.57, 0.548, 0.548]

function buildEnvelopePoints(halfWidths) {
  const top = funnelContourXs.map((x, index) => [x, funnelCenterline[index] - halfWidths[index]])
  const bottom = funnelContourXs.map((x, index) => [x, funnelCenterline[index] + halfWidths[index]])
  return { top, bottom }
}

function fillBand(ctx, envelope, width, height) {
  const { top, bottom } = buildEnvelopePoints(envelope.halfWidths)
  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0, envelope.stops[0])
  gradient.addColorStop(0.42, envelope.stops[1])
  gradient.addColorStop(1, envelope.stops[2])

  ctx.save()
  ctx.filter = 'blur(11px)'
  ctx.globalAlpha = 0.52
  ctx.beginPath()
  tracePath(ctx, top, width, height, true)
  tracePath(ctx, [...bottom].reverse(), width, height, false)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.restore()

  ctx.beginPath()
  tracePath(ctx, top, width, height, true)
  tracePath(ctx, [...bottom].reverse(), width, height, false)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()
}

function drawFunnel(canvas, width, height, revealProgress = 1) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(width * dpr))
  canvas.height = Math.max(1, Math.floor(height * dpr))

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  ctx.save()
  ctx.filter = 'blur(28px)'
  const glow = ctx.createRadialGradient(width * 0.48, height * 0.56, 0, width * 0.48, height * 0.56, width * 0.38)
  glow.addColorStop(0, 'rgba(32, 130, 255, 0.4)')
  glow.addColorStop(0.5, 'rgba(19, 76, 171, 0.22)')
  glow.addColorStop(1, 'rgba(6, 18, 43, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(width * 0.48, height * 0.56, width * 0.34, height * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, width * revealProgress, height)
  ctx.clip()
  funnelEnvelopes.forEach((envelope) => fillBand(ctx, envelope, width, height))
  ctx.restore()

  const fade = ctx.createLinearGradient(0, height * 0.82, 0, height)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(1, 'rgba(0,0,0,0.3)')
  ctx.fillStyle = fade
  ctx.fillRect(0, height * 0.82, width, height * 0.18)
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function getOptimalCellStyle(value) {
  const normalized = clamp((value - 1) / 55, 0, 1)
  const hue = 252 - normalized * 200
  const saturation = 70 + normalized * 18
  const lightness = 38 + normalized * 26
  const textColor = normalized > 0.72 ? '#15120a' : 'rgba(245, 247, 252, 0.96)'

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    color: textColor,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,${0.06 + normalized * 0.12})`,
  }
}

function HeroSparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
      <circle cx="4" cy="20" r="2" />
    </svg>
  )
}

function HeroOrbitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.341 6.484A10 10 0 0 1 10.266 21.85" />
      <path d="M3.659 17.516A10 10 0 0 1 13.74 2.152" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
    </svg>
  )
}

function TrendLine({ data }) {
  if (!data?.trendValue) {
    return null
  }

  const direction = data?.trendDirection === 'down' ? 'down' : data?.trendDirection === 'flat' ? 'flat' : 'up'
  const arrow = direction === 'down' ? '↓' : direction === 'flat' ? '→' : '↑'
  const tone = data?.trendTone || 'positive'

  return (
    <div className={`metric-trend-inline ${tone}`}>
      <span>{arrow}</span>
      <span>{data.trendValue}</span>
      {data?.trendLabel ? <span className="metric-trend-inline-label">{data.trendLabel}</span> : null}
    </div>
  )
}

function MetricTrendMicro({ data }) {
  return (
    <div className="metric-trend-micro">
      <div className="metric-trend-value-line">
        <span className="metric-trend-value">{data?.displayValue || data?.value}</span>
        {data?.unit ? <span className="metric-trend-unit">{data.unit}</span> : null}
      </div>
      <TrendLine data={data} />
    </div>
  )
}

function UptimeStripMicro({ data }) {
  const bars = Array.isArray(data?.uptimeBars) && data.uptimeBars.length ? data.uptimeBars : []

  return (
    <div className="uptime-strip-micro">
      <div className="uptime-strip-value-line">
        <span className="uptime-strip-value">{data?.displayValue || data?.value}</span>
        {data?.unit ? <span className="uptime-strip-unit">{data.unit}</span> : null}
      </div>
      <div className="uptime-strip-bars">
        {bars.map((status, index) => (
          <span
            key={`${status}-${index}`}
            className={`uptime-strip-bar ${status}`}
            style={{ height: '28px' }}
          />
        ))}
      </div>
    </div>
  )
}

function PeakEngagementMicro({ data }) {
  const summaryCards = data.summaryCards || []
  const marketBreakdown = data.marketBreakdown || []
  const monthLabel = data.calendarMonth || 'April 2026'
  const calendarOffset = Number.isFinite(data.calendarOffset) ? data.calendarOffset : 2
  const calendarValues = Array.isArray(data.calendarValues) ? data.calendarValues : []
  const daysInMonth = Number.isFinite(data.daysInMonth) ? data.daysInMonth : calendarValues.length
  const totalCells = Number.isFinite(data.totalCalendarCells) ? data.totalCalendarCells : 56
  const leadingDays = Array.from({ length: calendarOffset }, (_, index) => ({
    id: `leading-${index}`,
    outside: true,
  }))
  const days = Array.from({ length: daysInMonth }, (_, index) => ({
    id: `day-${index + 1}`,
    dayNumber: index + 1,
    intensity: calendarValues[index] ?? 0,
  }))
  const trailingDays = Array.from({ length: Math.max(0, totalCells - leadingDays.length - days.length) }, (_, index) => ({
    id: `trailing-${index}`,
    outside: true,
  }))
  const calendarCells = [...leadingDays, ...days, ...trailingDays]
  const revealedCount = useSequentialReveal(calendarCells.length, 36, 140)

  return (
    <div className="optimal-time-widget">
      <div className="optimal-time-header">
        <div className="optimal-time-title-block">
          <span className="optimal-time-kicker">Engagement Matrix</span>
          <h3>{data.title || 'Peak Engagement'}</h3>
          <p>{data.subtitle || 'Best Campaign Window'}</p>
        </div>
      </div>

      <div className="optimal-time-calendar-head">
        <span>{monthLabel}</span>
        <span className="optimal-time-calendar-note">Hotter cells mark stronger response windows</span>
      </div>

      <div className="optimal-time-grid" aria-label="Peak engagement calendar">
        {calendarCells.map((cell, index) => (
          <div
            key={cell.id}
            className={`optimal-time-cell ${cell.outside ? 'is-outside' : ''} ${revealedCount > 0 && index < revealedCount ? 'is-revealed' : ''}`}
            style={cell.outside ? undefined : getOptimalCellStyle(cell.intensity)}
          >
            {!cell.outside ? <strong>{cell.dayNumber}</strong> : null}
          </div>
        ))}
      </div>

      <div className="optimal-time-summary">
        {summaryCards.map((card) => (
          <section key={card.id} className="optimal-time-summary-card">
            <div className="optimal-time-summary-label">
              <span className="optimal-time-summary-icon">
                {card.icon === 'sparkles' ? <HeroSparklesIcon /> : <HeroOrbitIcon />}
              </span>
              <span>{card.label}</span>
            </div>

            <div className="optimal-time-summary-value">{card.value}</div>

            <div className="optimal-time-summary-meta">
              <span className={`optimal-time-delta optimal-time-delta-${card.tone || 'positive'}`}>
                {card.delta}
              </span>
              <span className="optimal-time-note">{card.note}</span>
            </div>
          </section>
        ))}
      </div>

      <div className="optimal-time-market-list">
        {marketBreakdown.map((market) => (
          <div key={market.label} className="optimal-time-market-row">
            <span>{market.label}</span>
            <strong>{market.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function HeroCardFrame({ variant, children }) {
  return (
    <div className={`hero-card-frame hero-card-frame-${variant}`}>
      <div className="hero-card-shell">
        {children}
      </div>
    </div>
  )
}

function HeroLiveTrafficWidget() {
  const lineFinalValues = useMemo(() => [182, 244, 316, 428], [])
  const lineStartValues = useMemo(() => [34, 68, 104, 146], [])
  const activeTarget = lineFinalValues[lineFinalValues.length - 1]
  const peakTarget = 506
  const [lineValues, setLineValues] = useState(lineStartValues)
  const [drawProgress, setDrawProgress] = useState(0)
  const animatedActive = useCountUp(activeTarget, 1050)
  const animatedPeak = useCountUp(peakTarget, 1250)
  const chart = useMemo(
    () => buildLinePath(
      lineValues,
      420,
      180,
      { top: 16, right: 24, bottom: 28, left: 24 },
      { min: 0, max: peakTarget * 1.08 },
      5,
    ),
    [lineValues, peakTarget],
  )
  const renderedLine = useMemo(() => buildPartialLine(chart.points, drawProgress), [chart.points, drawProgress])
  const focusPoint = renderedLine.point
  const tagLabel = `${formatNumber(interpolateSeriesValue(lineValues, drawProgress))} live`

  useEffect(() => {
    let frameId = 0
    let startTime = 0

    const tick = (timestamp) => {
      if (!startTime) {
        startTime = timestamp
      }

      const progress = Math.min((timestamp - startTime) / 1500, 1)
      const eased = 1 - (1 - progress) ** 3
      setLineValues(lineStartValues.map((value, index) => value + (lineFinalValues[index] - value) * eased))
      setDrawProgress(eased)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [lineFinalValues, lineStartValues])

  return (
    <div className="hero-widget hero-widget-live">
      <div className="hero-live-top">
        <div className="hero-widget-header">
          <span className="hero-widget-kicker">Live Traffic</span>
        </div>

        <div className="hero-live-metrics hero-live-metrics-top">
          <section className="hero-live-metric-card">
            <div className="hero-live-metric-label">Active now</div>
            <div className="hero-live-metric-value">{formatNumber(animatedActive)}</div>
            <div className="hero-live-metric-meta">
              <span className="hero-live-metric-delta">+7.0%</span>
              <span className="hero-live-metric-note">users online</span>
            </div>
          </section>

          <section className="hero-live-metric-card">
            <div className="hero-live-metric-label">Peak today</div>
            <div className="hero-live-metric-value">{formatNumber(animatedPeak)}</div>
            <div className="hero-live-metric-meta">
              <span className="hero-live-metric-delta">+12.4%</span>
              <span className="hero-live-metric-note">highest concurrent users</span>
            </div>
          </section>
        </div>
      </div>

      <div className="hero-live-chart-shell">
        <div className="hero-live-glow" />
        <svg className="hero-live-chart" viewBox="0 0 420 180" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hero-live-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef8b43" />
              <stop offset="100%" stopColor="#db3e93" />
            </linearGradient>
          </defs>
          {[32, 76, 120, 164].map((y) => (
            <line
              key={y}
              x1="24"
              x2="396"
              y1={y}
              y2={y}
              className="hero-live-grid-line"
            />
          ))}
          <path d={renderedLine.path} className="hero-live-line-shadow" />
          <path d={renderedLine.path} className="hero-live-line" />
          <circle cx={focusPoint[0]} cy={focusPoint[1]} r="10" className="hero-live-highlight-ring" />
          <circle cx={focusPoint[0]} cy={focusPoint[1]} r="4" className="hero-live-highlight-core" />
        </svg>
        <div
          className="hero-live-tag"
          style={{
            left: `${(focusPoint[0] / 420) * 100}%`,
            top: `${(focusPoint[1] / 180) * 100}%`,
          }}
        >
          {tagLabel}
        </div>
      </div>
    </div>
  )
}

function HeroSalesFunnelWidget() {
  const stageRef = useRef(null)
  const visualRef = useRef(null)
  const canvasRef = useRef(null)
  const [flowProgress, setFlowProgress] = useState(0)
  const funnelState = {
    revenue: 32134,
    stages: [
      { top: 'Visits', metric: '100%', position: 0.214 },
      { top: 'Inquiry', metric: '85%', position: 0.486 },
      { top: 'Purchase', metric: '12%', position: 0.756 },
    ],
  }
  const revenue = useCountUp(funnelState.revenue, 1000)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const visual = visualRef.current
    const canvas = canvasRef.current
    if (!stage || !visual || !canvas) {
      return undefined
    }

    const redraw = () => {
      const rect = visual.getBoundingClientRect()
      if (rect.width < 20 || rect.height < 20) {
        return
      }

      drawFunnel(canvas, rect.width, rect.height, flowProgress)
    }

    const raf1 = requestAnimationFrame(redraw)
    const raf2 = requestAnimationFrame(redraw)
    const observer = new ResizeObserver(redraw)
    observer.observe(stage)
    observer.observe(visual)
    window.addEventListener('resize', redraw)

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      observer.disconnect()
      window.removeEventListener('resize', redraw)
    }
  }, [flowProgress])

  useEffect(() => {
    let frameId = 0
    let startTime = 0

    const tick = (timestamp) => {
      if (!startTime) {
        startTime = timestamp
      }

      const progress = Math.min((timestamp - startTime) / 1250, 1)
      const eased = 1 - (1 - progress) ** 3
      setFlowProgress(eased)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div className="hero-widget hero-widget-funnel">
      <div className="hero-funnel-summary">
        <span className="hero-funnel-kicker">Income</span>
        <div className="hero-funnel-value-line">
          <strong>${formatNumber(revenue)}</strong>
          <span className="hero-funnel-delta">+2.5%</span>
          <span className="hero-funnel-compare">Compared to $21,340 last month</span>
        </div>
      </div>

      <div ref={stageRef} className="hero-funnel-stage">
        <div ref={visualRef} className="hero-funnel-visual">
          <canvas ref={canvasRef} className="hero-funnel-canvas" />
        </div>

        {funnelState.stages.map((column) => (
          <div
            key={column.top}
            className="hero-funnel-marker"
            style={{
              left: `${column.position * 100}%`,
              opacity: clamp((flowProgress - 0.38) / 0.4, 0, 1),
            }}
          >
            <div className="hero-funnel-marker-line" />
            <div className="hero-funnel-pill hero-funnel-pill-top">{column.top}</div>
            <div className="hero-funnel-pill hero-funnel-pill-bottom">{column.metric}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HeroOptimalTimeWidget() {
  return (
    <div className="micro-card theme-natural optimal-time-card">
      <div className="micro-card-body">
        <PeakEngagementMicro data={optimalTimeData} />
      </div>
    </div>
  )
}

function HeroRefreshCycleWidget() {
  const animatedScore = useCountUp(Number.parseInt(refreshCycleCard.data.value, 10), 1100)

  return (
    <div className="micro-card theme-color">
      <div className="micro-card-header">
        <h3 className="micro-title">{refreshCycleCard.title}</h3>
        <span className="micro-subtitle">{refreshCycleCard.subtitle}</span>
      </div>
      <div className="micro-card-body">
        <MetricTrendMicro
          data={{
            ...refreshCycleCard.data,
            displayValue: `${Math.round(animatedScore)}`,
          }}
        />
      </div>
      <div className="micro-card-footer">
        <span className="footer-main">{refreshCycleCard.footerText}</span>
      </div>
    </div>
  )
}

function HeroTechnicalHealthWidget() {
  const animatedUptime = useCountUp(Number.parseFloat(technicalHealthCard.data.value), 1200)

  return (
    <div className="micro-card theme-weather">
      <div className="micro-card-header">
        <h3 className="micro-title">{technicalHealthCard.title}</h3>
        <span className="micro-subtitle">{technicalHealthCard.subtitle}</span>
      </div>
      <div className="micro-card-body">
        <UptimeStripMicro
          data={{
            ...technicalHealthCard.data,
            displayValue: animatedUptime.toFixed(2),
          }}
        />
      </div>
    </div>
  )
}

export function HeroMicroWidgets() {
  return (
    <>
      <div className="hero-card hero-card-sessions">
        <HeroCardFrame variant="wide">
          <HeroLiveTrafficWidget />
        </HeroCardFrame>
      </div>
      <div className="hero-card hero-card-funnel">
        <HeroCardFrame variant="wide">
          <HeroSalesFunnelWidget />
        </HeroCardFrame>
      </div>
      <div className="hero-card hero-card-activity">
        <HeroCardFrame variant="tall">
          <HeroOptimalTimeWidget />
        </HeroCardFrame>
      </div>
      <div className="hero-card hero-card-infra">
        <HeroCardFrame variant="small">
          <HeroRefreshCycleWidget />
        </HeroCardFrame>
      </div>
      <div className="hero-card hero-card-creative">
        <HeroCardFrame variant="small">
          <HeroTechnicalHealthWidget />
        </HeroCardFrame>
      </div>
    </>
  )
}
