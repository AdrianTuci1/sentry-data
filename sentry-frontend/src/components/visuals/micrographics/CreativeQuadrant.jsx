import React from 'react';
import ReactECharts from 'echarts-for-react';

const QUADRANT_THRESHOLD = 5;

const QUADRANT_STYLES = {
    heroes: {
        label: 'Hero',
        detail: 'Scale',
        color: '#7CFF5B',
    },
    seekers: {
        label: 'Reach',
        detail: 'Tune CVR',
        color: '#35C9FF',
    },
    intent: {
        label: 'Intent',
        detail: 'Tune CTR',
        color: '#FFC533',
    },
    burners: {
        label: 'Burn',
        detail: 'Refresh',
        color: '#FF4D8D',
    },
};

const getQuadrantKey = (ctr, conv) => {
    if (ctr >= QUADRANT_THRESHOLD && conv >= QUADRANT_THRESHOLD) {
        return 'heroes';
    }

    if (ctr >= QUADRANT_THRESHOLD && conv < QUADRANT_THRESHOLD) {
        return 'seekers';
    }

    if (ctr < QUADRANT_THRESHOLD && conv >= QUADRANT_THRESHOLD) {
        return 'intent';
    }

    return 'burners';
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatPercent = (value) => `${Number(value).toFixed(1)}%`;

const CreativeQuadrant = ({ data: componentData }) => {
    const creatives = componentData?.creatives || [
        [4.5, 6.2, 'Video: Spring Launch', 'Video'],
        [3.9, 6.5, 'Static: Product Close-up', 'Static'],
        [1.5, 9.0, 'Testimonial: Alex B.', 'Review'],
        [6.0, 1.5, 'Flash Sale Banner', 'Static'],
        [2.5, 4.8, 'Video: How it works', 'Video'],
        [0.5, 1.0, 'Static: Old Generic', 'Static'],
        [7.2, 0.8, 'Meme: Friday Vibe', 'Social'],
    ];

    const scoredCreatives = creatives
        .map(([ctr, conv, name, type], index) => {
            const quadrantKey = getQuadrantKey(ctr, conv);
            const quadrant = QUADRANT_STYLES[quadrantKey];
            const score = Math.round(clamp((ctr * 4.6) + (conv * 5.4), 0, 100));

            return {
                id: `${name}-${index}`,
                ctr,
                conv,
                name,
                type,
                score,
                quadrant,
            };
        })
        .sort((left, right) => right.score - left.score);

    const option = {
        animation: true,
        animationDuration: 700,
        animationEasing: 'cubicOut',
        grid: {
            top: 18,
            right: 16,
            bottom: 16,
            left: 16,
            containLabel: false,
        },
        tooltip: {
            backgroundColor: 'rgba(10, 10, 10, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                if (params.seriesType !== 'scatter') {
                    return '';
                }

                const [ctr, conv, name, type] = params.data;
                const quadrant = QUADRANT_STYLES[getQuadrantKey(ctr, conv)];
                const score = Math.round(clamp((ctr * 4.6) + (conv * 5.4), 0, 100));

                return `
                    <div style="padding:2px 4px;">
                        <div style="font-weight:700; margin-bottom:4px;">${name}</div>
                        <div style="font-size:11px; color:rgba(255,255,255,0.72); margin-bottom:2px;">${type} · ${quadrant.label}</div>
                        <div style="font-size:11px;">CTR ${formatPercent(ctr)} · CVR ${formatPercent(conv)} · Score ${score}</div>
                    </div>
                `;
            },
        },
        xAxis: {
            type: 'value',
            min: 0,
            max: 10,
            splitLine: { show: false },
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: { show: false },
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 10,
            splitLine: { show: false },
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: { show: false },
        },
        series: [
            {
                type: 'scatter',
                data: creatives,
                symbolSize: (value) => Math.max(10, Math.min(16, 8 + (value[1] * 0.7))),
                itemStyle: {
                    color: (params) => QUADRANT_STYLES[getQuadrantKey(params.data[0], params.data[1])].color,
                    borderColor: '#050505',
                    borderWidth: 2,
                    shadowBlur: 16,
                    shadowColor: 'rgba(0,0,0,0.35)',
                },
                markLine: {
                    silent: true,
                    symbol: 'none',
                    z: 0,
                    lineStyle: {
                        color: 'rgba(255,255,255,0.24)',
                        width: 1.5,
                    },
                    label: { show: false },
                    data: [
                        { xAxis: QUADRANT_THRESHOLD },
                        { yAxis: QUADRANT_THRESHOLD },
                    ],
                },
            },
        ],
        graphic: [
            {
                type: 'text',
                left: '7%',
                top: '6%',
                style: {
                    text: 'Low CTR',
                    fill: 'rgba(255,255,255,0.28)',
                    fontSize: 10,
                    fontWeight: 600,
                },
            },
            {
                type: 'text',
                right: '7%',
                top: '6%',
                style: {
                    text: 'High CTR',
                    fill: 'rgba(255,255,255,0.28)',
                    fontSize: 10,
                    fontWeight: 600,
                    textAlign: 'right',
                },
            },
            {
                type: 'text',
                left: '7%',
                bottom: '6%',
                style: {
                    text: 'Low CVR',
                    fill: 'rgba(255,255,255,0.28)',
                    fontSize: 10,
                    fontWeight: 600,
                },
            },
            {
                type: 'text',
                right: '7%',
                bottom: '6%',
                style: {
                    text: 'High CVR',
                    fill: 'rgba(255,255,255,0.28)',
                    fontSize: 10,
                    fontWeight: 600,
                    textAlign: 'right',
                },
            },
        ],
    };

    return (
        <div style={{ display: 'grid', gridTemplateRows: '220px minmax(0, 1fr)', gap: '14px', height: '100%', minHeight: '420px' }}>
            <div style={{ width: '100%', minHeight: 0 }}>
                <ReactECharts
                    option={option}
                    style={{ height: '100%', width: '100%' }}
                    notMerge={true}
                    opts={{ renderer: 'svg' }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '12px', padding: '0 0 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Creative</span>
                    <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Zone</span>
                    <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'right' }}>Score</span>
                </div>

                {scoredCreatives.map((creative) => (
                    <div
                        key={creative.id}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                            gap: '12px',
                            alignItems: 'center',
                            padding: '8px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {creative.name}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.34)', fontSize: '10px', marginTop: '3px' }}>
                                {creative.type} · CTR {formatPercent(creative.ctr)} · CVR {formatPercent(creative.conv)}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: creative.quadrant.color,
                                    boxShadow: `0 0 14px ${creative.quadrant.color}66`,
                                    flexShrink: 0,
                                }}
                            />
                            <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                {creative.quadrant.label}
                            </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700, lineHeight: 1 }}>{creative.score}</div>
                            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '10px', marginTop: '4px' }}>{creative.quadrant.detail}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CreativeQuadrant;
