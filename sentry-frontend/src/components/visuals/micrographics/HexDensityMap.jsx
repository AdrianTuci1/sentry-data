import React, { useMemo } from 'react';
import { MoreVertical } from 'lucide-react';
import './HexDensityMap.css';

const SQRT3 = Math.sqrt(3);
const DEFAULT_RADIUS = 6;
const DEFAULT_SIZE = 11.8;
const DEFAULT_DETACHED_CELLS = [
    [-8, -1],
    [-8, 1],
    [-7, -4],
    [-7, 4],
    [-5, -7],
    [-5, 7],
    [-1, -8],
    [1, 8],
    [5, -7],
    [5, 7],
    [7, -4],
    [7, 4],
    [8, -1],
    [8, 1],
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const interpolateColor = (stops, value) => {
    const clamped = clamp(value, 0, 1);

    for (let index = 0; index < stops.length - 1; index += 1) {
        const start = stops[index];
        const end = stops[index + 1];

        if (clamped >= start.at && clamped <= end.at) {
            const localProgress = (clamped - start.at) / Math.max(0.0001, end.at - start.at);
            const color = start.color.map((channel, channelIndex) => (
                Math.round(channel + (end.color[channelIndex] - channel) * localProgress)
            ));

            return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        }
    }

    const lastColor = stops[stops.length - 1].color;
    return `rgb(${lastColor[0]}, ${lastColor[1]}, ${lastColor[2]})`;
};

const colorStops = [
    { at: 0, color: [12, 15, 34] },
    { at: 0.18, color: [24, 29, 58] },
    { at: 0.36, color: [63, 45, 91] },
    { at: 0.56, color: [156, 52, 97] },
    { at: 0.74, color: [255, 31, 10] },
    { at: 0.9, color: [255, 109, 0] },
    { at: 1, color: [255, 206, 33] },
];

const buildDefaultCells = (radius = DEFAULT_RADIUS) => {
    const cells = [];

    for (let q = -radius; q <= radius; q += 1) {
        const rMin = Math.max(-radius, -q - radius);
        const rMax = Math.min(radius, -q + radius);

        for (let r = rMin; r <= rMax; r += 1) {
            const s = -q - r;
            const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
            const edgeBreak = distance === radius && ((q - r + radius) % 4 === 0);

            if (edgeBreak) {
                continue;
            }

            const normalizedDistance = 1 - distance / (radius + 0.45);
            const coreBoost = Math.exp(-(distance ** 2) / (2 * (radius * 0.42) ** 2));
            const swirl = Math.sin((q + 1.1) * 0.82) * 0.075
                + Math.cos((r - 0.8) * 0.94) * 0.065
                + Math.sin((q - r) * 0.7) * 0.045;
            const directionalBias = ((q * 0.78) - (r * 0.32)) / radius * 0.05;
            const intensity = clamp(
                0.08 + normalizedDistance * 0.42 + coreBoost * 0.52 + swirl + directionalBias,
                0.04,
                1,
            );

            cells.push({
                q,
                r,
                value: intensity,
                detached: false,
            });
        }
    }

    DEFAULT_DETACHED_CELLS.forEach(([q, r], index) => {
        const seed = Math.abs(q * 17 + r * 31 + index * 13);

        cells.push({
            q,
            r,
            value: 0.07 + (seed % 7) * 0.016,
            detached: true,
        });
    });

    return cells;
};

const normalizeCells = (cells) => {
    if (!Array.isArray(cells) || !cells.length) {
        return buildDefaultCells();
    }

    return cells.map((cell, index) => ({
        q: Number(cell.q ?? cell.col ?? 0),
        r: Number(cell.r ?? cell.row ?? 0),
        value: clamp(Number(cell.value ?? cell.intensity ?? cell.weight ?? 0), 0, 1),
        detached: Boolean(cell.detached ?? cell.isDetached ?? false),
        id: cell.id ?? `${cell.q ?? 0}-${cell.r ?? 0}-${index}`,
    }));
};

const buildHexPoints = (size) => (
    Array.from({ length: 6 }, (_, index) => {
        const angle = ((60 * index) - 30) * (Math.PI / 180);
        return `${(Math.cos(angle) * size).toFixed(2)},${(Math.sin(angle) * size).toFixed(2)}`;
    }).join(' ')
);

const layoutCells = (cells, size) => {
    const halfWidth = (SQRT3 * size) / 2;
    const halfHeight = size;

    const positioned = cells.map((cell, index) => {
        const x = size * SQRT3 * (cell.q + cell.r / 2);
        const y = size * 1.5 * cell.r;

        return {
            ...cell,
            id: cell.id || `${cell.q}-${cell.r}-${index}`,
            x,
            y,
        };
    });

    const minX = Math.min(...positioned.map((cell) => cell.x - halfWidth));
    const maxX = Math.max(...positioned.map((cell) => cell.x + halfWidth));
    const minY = Math.min(...positioned.map((cell) => cell.y - halfHeight));
    const maxY = Math.max(...positioned.map((cell) => cell.y + halfHeight));
    const padding = size * 2.2;

    return {
        cells: positioned.map((cell) => ({
            ...cell,
            renderX: cell.x - minX + padding,
            renderY: cell.y - minY + padding,
        })),
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
    };
};

const formatDelta = (value) => {
    const raw = String(value || '+2.5%').trim();
    return raw.startsWith('↑') ? raw : `↑${raw}`;
};

const HexDensityMap = ({ data = {} }) => {
    const summaryLabel = data.summaryLabel || 'Income';
    const summaryValue = data.summaryValue || '$32,134';
    const summaryDelta = formatDelta(data.summaryDelta || '+2.5%');
    const summaryCompare = data.summaryCompare || 'Compared to $21,340 last month';
    const size = Number.isFinite(data.hexSize) ? data.hexSize : DEFAULT_SIZE;
    const cells = useMemo(() => normalizeCells(data.hexCells), [data.hexCells]);
    const layout = useMemo(() => layoutCells(cells, size), [cells, size]);
    const hexPoints = useMemo(() => buildHexPoints(size - 0.8), [size]);

    return (
        <div className="hex-density-widget">
            <div className="hex-density-toolbar">
                <div className="hex-density-heading-row">
                    <span className="hex-density-kicker">{summaryLabel}</span>
                    <div className="hex-density-menu" aria-hidden="true">
                        <MoreVertical size={18} strokeWidth={2.2} />
                    </div>
                </div>

                <div className="hex-density-value-line">
                    <strong>{summaryValue}</strong>
                    <span className="hex-density-delta">{summaryDelta}</span>
                </div>

                <div className="hex-density-compare">{summaryCompare}</div>
            </div>

            <div className="hex-density-map-shell">
                <svg
                    className="hex-density-map"
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label={`${summaryLabel} density heatmap`}
                >
                    <defs>
                        <radialGradient id="hex-density-core-glow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="rgba(255, 198, 0, 0.34)" />
                            <stop offset="52%" stopColor="rgba(255, 66, 31, 0.16)" />
                            <stop offset="100%" stopColor="rgba(13, 14, 24, 0)" />
                        </radialGradient>
                    </defs>

                    <ellipse
                        className="hex-density-glow"
                        cx={layout.width / 2}
                        cy={layout.height / 2}
                        rx={layout.width * 0.24}
                        ry={layout.height * 0.22}
                    />

                    {layout.cells.map((cell) => (
                        <polygon
                            key={cell.id}
                            points={hexPoints}
                            transform={`translate(${cell.renderX} ${cell.renderY})`}
                            fill={interpolateColor(colorStops, cell.value)}
                            opacity={cell.detached ? 0.86 : 1}
                            className={cell.detached ? 'hex-density-cell is-detached' : 'hex-density-cell'}
                        />
                    ))}
                </svg>
            </div>
        </div>
    );
};

export default HexDensityMap;
