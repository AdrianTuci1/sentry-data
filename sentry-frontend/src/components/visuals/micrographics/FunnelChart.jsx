import React, { useLayoutEffect, useRef } from 'react';
import { MoreVertical } from 'lucide-react';
import './FunnelChart.css';

const defaultColumns = [
    { top: '21,980', bottom: '3,021' },
    { top: '50,201', bottom: '12,222' },
    { top: '82,229', bottom: '22,951' },
];

const markerPercents = [0.222, 0.5, 0.79];

const envelopes = [
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
];

const contourXs = [0, 0.13, 0.33, 0.58, 0.78, 1];
const centerline = [0.592, 0.592, 0.57, 0.57, 0.548, 0.548];

const tracePath = (ctx, points, width, height, moveToFirst = true) => {
    points.forEach(([x, y], index) => {
        const px = x * width;
        const py = y * height;

        if (index === 0) {
            if (moveToFirst) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
            return;
        }

        const [prevX, prevY] = points[index - 1];
        const cx = ((prevX + x) / 2) * width;
        ctx.bezierCurveTo(cx, prevY * height, cx, py, px, py);
    });
};

const buildEnvelopePoints = (halfWidths) => {
    const top = contourXs.map((x, index) => [x, centerline[index] - halfWidths[index]]);
    const bottom = contourXs.map((x, index) => [x, centerline[index] + halfWidths[index]]);
    return { top, bottom };
};

const fillBand = (ctx, envelope, width, height) => {
    const { top, bottom } = buildEnvelopePoints(envelope.halfWidths);
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, envelope.stops[0]);
    gradient.addColorStop(0.42, envelope.stops[1]);
    gradient.addColorStop(1, envelope.stops[2]);

    ctx.save();
    ctx.filter = 'blur(11px)';
    ctx.globalAlpha = 0.52;
    ctx.beginPath();
    tracePath(ctx, top, width, height, true);
    tracePath(ctx, [...bottom].reverse(), width, height, false);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    tracePath(ctx, top, width, height, true);
    tracePath(ctx, [...bottom].reverse(), width, height, false);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
};

const drawFunnel = (canvas, width, height) => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.filter = 'blur(28px)';
    const glow = ctx.createRadialGradient(width * 0.48, height * 0.56, 0, width * 0.48, height * 0.56, width * 0.38);
    glow.addColorStop(0, 'rgba(32, 130, 255, 0.4)');
    glow.addColorStop(0.5, 'rgba(19, 76, 171, 0.22)');
    glow.addColorStop(1, 'rgba(6, 18, 43, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(width * 0.48, height * 0.56, width * 0.34, height * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    envelopes.forEach((envelope) => fillBand(ctx, envelope, width, height));

    // Feather the lower edge so the outer ribbon does not terminate abruptly.
    const fade = ctx.createLinearGradient(0, height * 0.82, 0, height);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, height * 0.82, width, height * 0.18);
};

const FunnelChart = ({ data }) => {
    const stageRef = useRef(null);
    const visualRef = useRef(null);
    const canvasRef = useRef(null);
    const summaryLabel = data?.summaryLabel || 'Income';
    const summaryValue = data?.summaryValue || '$32,134';
    const summaryDelta = data?.summaryDelta || '↑2.5%';
    const summaryCompare = data?.summaryCompare || 'Compared to $21,340 last month';
    const stageColumns = data?.stageColumns || (Array.isArray(data?.funnel) && data.funnel.length >= 2
        ? data.funnel.slice(0, 3).map((step, index, steps) => ({
            top: String(step?.name || `Stage ${index + 1}`),
            bottom: String(step?.value ?? ''),
            metric: String(steps[index + 1]?.value ?? step?.value ?? ''),
        }))
        : defaultColumns);

    useLayoutEffect(() => {
        const stage = stageRef.current;
        const visual = visualRef.current;
        const canvas = canvasRef.current;
        if (!stage || !visual || !canvas) {
            return undefined;
        }

        const redraw = () => {
            const rect = visual.getBoundingClientRect();
            if (rect.width < 20 || rect.height < 20) {
                return;
            }

            drawFunnel(canvas, rect.width, rect.height);
        };

        const raf1 = requestAnimationFrame(redraw);
        const raf2 = requestAnimationFrame(redraw);
        const observer = new ResizeObserver(redraw);
        observer.observe(stage);
        observer.observe(visual);
        window.addEventListener('resize', redraw);

        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
            observer.disconnect();
            window.removeEventListener('resize', redraw);
        };
    }, [stageColumns]);

    return (
        <div className="funnel-hero-widget">
            <div className="funnel-hero-toolbar">
                <div className="funnel-hero-summary">
                    <span className="funnel-hero-kicker">{summaryLabel}</span>
                    <div className="funnel-hero-value-line">
                        <strong>{summaryValue}</strong>
                        <span className="funnel-hero-delta">{summaryDelta}</span>
                        <span className="funnel-hero-compare">{summaryCompare}</span>
                    </div>
                </div>

            </div>

            <div ref={stageRef} className="funnel-hero-stage">
                <div ref={visualRef} className="funnel-hero-visual">
                    <canvas ref={canvasRef} className="funnel-hero-canvas" />
                </div>

                {stageColumns.map((column, index) => (
                    <div key={`${column.top}-${index}`} className="funnel-marker" style={{ left: `${markerPercents[index] * 100}%` }}>
                        <div className="funnel-marker-line" />
                        <div className="funnel-pill funnel-pill-top">{column.top}</div>
                        <div className="funnel-pill funnel-pill-bottom">{column.metric || column.bottom}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FunnelChart;
