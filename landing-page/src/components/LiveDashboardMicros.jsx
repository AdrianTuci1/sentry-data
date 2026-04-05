import React from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import './LiveDashboardMicros.css'

const TONE_MAP = {
  negative: '#ff7676',
  neutral: '#f4c96b',
  positive: '#49d793',
}

const resolveTone = (tone) => TONE_MAP[tone] || TONE_MAP.positive

const buildSignalPalette = (goodAtHigh = true) => {
  const colors = goodAtHigh
    ? [
        '#ff6b7a',
        '#ff8373',
        '#ff9b6d',
        '#ffb567',
        '#ffcd6b',
        '#ffe07a',
        '#d9ef85',
        '#b8f39a',
        '#9deeb0',
        '#8ee9c0',
        '#8ae8d6',
        '#92ebf0',
      ]
    : [
        '#92ebf0',
        '#8ae8d6',
        '#8ee9c0',
        '#9deeb0',
        '#b8f39a',
        '#d9ef85',
        '#ffe07a',
        '#ffcd6b',
        '#ffb567',
        '#ff9b6d',
        '#ff8373',
        '#ff6b7a',
      ]

  return colors
}

const buildTimeSeries = (points = []) => {
  const anchor = new Date()

  return points.map((point, index) => {
    const date = new Date(anchor)
    date.setDate(anchor.getDate() - (points.length - index - 1))
    return [date.toISOString(), point]
  })
}

const TrendLine = ({ data }) => {
  if (!data?.trendValue) {
    return null
  }

  const direction =
    data?.trendDirection === 'down' ? 'down' : data?.trendDirection === 'flat' ? 'flat' : 'up'
  const arrow = direction === 'down' ? '↓' : direction === 'flat' ? '→' : '↑'
  const tone = data?.trendTone || 'positive'

  return (
    <div className={`metric-trend-inline ${tone}`}>
      <span>{arrow}</span>
      <span>{data.trendValue}</span>
      {data?.trendLabel && <span className="metric-trend-inline-label">{data.trendLabel}</span>}
    </div>
  )
}

const SparklineChart = ({ points = [], color = '#49d793' }) => {
  const seriesData = buildTimeSeries(points)

  const option = {
    animation: false,
    grid: { left: -12, right: -12, top: '26%', bottom: -12 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { animation: false },
      backgroundColor: 'rgba(17, 24, 39, 0.82)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const current = params?.[0]
        if (!current) {
          return ''
        }

        const date = new Date(current.value[0])
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} : ${current.value[1]}`
      },
    },
    xAxis: {
      type: 'time',
      show: false,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      show: false,
      boundaryGap: [0, '100%'],
      splitLine: { show: false },
    },
    series: [
      {
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: seriesData,
        lineStyle: {
          width: 3,
          color,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${color}66` },
            { offset: 1, color: `${color}00` },
          ]),
        },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
}

export const MetricTrendMicro = ({ data }) => (
  <div className="metric-trend-micro">
    <div className="metric-trend-value-line">
      <span className="metric-trend-value">{data?.value}</span>
      {data?.unit && <span className="metric-trend-unit">{data.unit}</span>}
    </div>
    <TrendLine data={data} />
  </div>
)

const SignalScaleChart = ({ orientation = 'vertical', score = 50, goodAtHigh = true, colorRamp }) => {
  const segmentCount = 12
  const palette = colorRamp || buildSignalPalette(goodAtHigh)
  const activeCount = Math.max(1, Math.round((Math.max(0, Math.min(score, 100)) / 100) * segmentCount))
  const data = palette.map((color, index) => ({
    value: 1,
    itemStyle: {
      color,
      opacity: index < activeCount ? 1 : 0.18,
      borderRadius: orientation === 'vertical' ? 4 : 999,
      shadowBlur: index < activeCount ? 12 : 0,
      shadowColor: index < activeCount ? color : 'transparent',
    },
  }))

  const option =
    orientation === 'vertical'
      ? {
          animation: false,
          grid: { left: 0, right: 0, top: 2, bottom: 2 },
          xAxis: {
            type: 'value',
            max: 1.1,
            show: false,
          },
          yAxis: {
            type: 'category',
            inverse: true,
            show: false,
            data: data.map((_, index) => index),
          },
          series: [
            {
              type: 'bar',
              data,
              barWidth: 4,
              showBackground: false,
            },
          ],
        }
      : {
          animation: false,
          grid: { left: 0, right: 0, top: 0, bottom: 0 },
          xAxis: {
            type: 'category',
            show: false,
            data: data.map((_, index) => index),
          },
          yAxis: {
            type: 'value',
            max: 1.1,
            show: false,
          },
          series: [
            {
              type: 'bar',
              data,
              barWidth: 10,
              barCategoryGap: '38%',
              showBackground: false,
            },
          ],
        }

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
}

export const SignalScaleMicro = ({ data }) => {
  const orientation = data?.signalOrientation === 'horizontal' ? 'horizontal' : 'vertical'
  const score = Number.isFinite(data?.signalScore) ? data.signalScore : Number.parseFloat(data?.value) || 0
  const goodAtHigh = data?.goodAtHigh !== false
  const label = data?.signalLabel
  const note = data?.signalNote

  if (orientation === 'horizontal') {
    return (
      <div className="signal-scale-micro horizontal">
        <div className="signal-scale-horizontal-chart">
          <SignalScaleChart
            orientation="horizontal"
            score={score}
            goodAtHigh={goodAtHigh}
            colorRamp={data?.signalPalette}
          />
        </div>
        <div className="signal-scale-horizontal-copy">
          <div className="signal-scale-value-line">
            <span className="signal-scale-value">{data?.value}</span>
            {data?.unit && <span className="signal-scale-unit">{data.unit}</span>}
          </div>
          {label && <div className="signal-scale-label">{label}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="signal-scale-micro vertical">
      <div className="signal-scale-vertical">
        <div className="signal-scale-axis">
          <span>100%</span>
          <span>0%</span>
        </div>
        <div className="signal-scale-chart">
          <SignalScaleChart
            orientation="vertical"
            score={score}
            goodAtHigh={goodAtHigh}
            colorRamp={data?.signalPalette}
          />
        </div>
      </div>
      <div className="signal-scale-side">
        <div className="signal-scale-value-line">
          <span className="signal-scale-value">{data?.value}</span>
          {data?.unit && <span className="signal-scale-unit">{data.unit}</span>}
        </div>
        {label && <div className="signal-scale-label">{label}</div>}
        {note && <div className="signal-scale-note">{note}</div>}
      </div>
    </div>
  )
}

export const GaugePanelMicro = ({ data }) => {
  const gaugeColor = data?.gaugeColor || resolveTone(data?.trendTone)
  const gaugeValue = Number.isFinite(data?.sliderValue) ? data.sliderValue : Number.parseFloat(data?.value) || 0
  const gaugeUnit = data?.gaugeUnit || '%'

  const option = {
    animation: false,
    series: [
      {
        type: 'gauge',
        progress: {
          show: true,
          width: 14,
          itemStyle: {
            color: gaugeColor,
          },
        },
        axisLine: {
          lineStyle: {
            width: 14,
            color: [[1, 'rgba(255,255,255,0.12)']],
          },
        },
        axisTick: {
          show: false,
        },
        splitLine: {
          length: 10,
          lineStyle: {
            width: 2,
            color: 'rgba(255,255,255,0.28)',
          },
        },
        axisLabel: {
          show: false,
        },
        anchor: {
          show: true,
          showAbove: true,
          size: 16,
          itemStyle: {
            color: gaugeColor,
            borderWidth: 5,
            borderColor: 'rgba(255,255,255,0.18)',
          },
        },
        title: {
          show: false,
        },
        detail: {
          valueAnimation: true,
          fontSize: 24,
          color: '#fff',
          offsetCenter: [0, '70%'],
          formatter: (value) => `${Math.round(value)}${gaugeUnit}`,
        },
        data: [
          {
            value: gaugeValue,
          },
        ],
      },
    ],
  }

  return (
    <div className="gauge-micro">
      <div className="gauge-micro-chart">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  )
}

export const SparklineStatMicro = ({ data }) => (
  <div className="sparkline-stat-micro">
    <div className="sparkline-stat-value-line">
      <span className="sparkline-stat-value">{data?.value}</span>
      {data?.unit && <span className="sparkline-stat-unit">{data.unit}</span>}
    </div>
    <div className="sparkline-stat-chart">
      <SparklineChart
        points={data?.dataPoints || []}
        color={data?.sparklineColor || resolveTone(data?.trendTone)}
      />
    </div>
  </div>
)
