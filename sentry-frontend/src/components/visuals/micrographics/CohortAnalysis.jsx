import React from 'react';
import { Sparkles } from 'lucide-react';
import './CohortAnalysis.css';

const defaultRows = [
    { label: '500', segments: [39, 11, 10, 10], marker: 97 },
    { label: '400', segments: [39, 15, 14, 15], marker: 87 },
    { label: '300', segments: [16, 9, 8, 8], marker: 49 },
    { label: '200', segments: [16, 13, 13, 13], marker: 63 },
    { label: '100', segments: [39, 15, 14, 15], marker: 97 },
];

const segmentColors = ['#8d55d8', '#2c9de0', '#2df0b1', '#fff11f'];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatPercent = (value) => `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%`;

const deriveBarsFromCohorts = (cohorts = []) => (
    cohorts
        .map((cohort) => {
            const checkpoints = (cohort?.data || []).filter((value) => Number.isFinite(value));
            if (!checkpoints.length) {
                return null;
            }

            const retained = clamp(checkpoints[checkpoints.length - 1], 0, 100);
            const contributingPoints = checkpoints.slice(1, 5);
            const segmentCount = Math.max(1, Math.min(4, contributingPoints.length || 1));
            const equalWidth = retained / segmentCount;
            const segments = Array.from({ length: segmentCount }, (_, index) => (
                index === segmentCount - 1
                    ? Number((retained - equalWidth * (segmentCount - 1)).toFixed(2))
                    : Number(equalWidth.toFixed(2))
            ));

            return {
                label: cohort?.size ? String(cohort.size) : String(cohort?.week || ''),
                segments,
                marker: retained,
            };
        })
        .filter(Boolean)
);

const getAverageRetention = (cohorts = []) => {
    const terminalPoints = cohorts
        .map((cohort) => cohort?.data?.[cohort.data.length - 1])
        .filter((value) => Number.isFinite(value));

    if (!terminalPoints.length) {
        return null;
    }

    return terminalPoints.reduce((sum, value) => sum + value, 0) / terminalPoints.length;
};

const CohortAnalysis = ({ data = {} }) => {
    const cohortBars = deriveBarsFromCohorts(data.cohorts);
    const bars = cohortBars.length ? cohortBars : (data.retentionBars || defaultRows);
    const averageRetention = getAverageRetention(data.cohorts);
    const summaryValue = data.summaryValue || (averageRetention !== null ? formatPercent(averageRetention) : '38.4%');
    const summaryCompare = data.summaryCompare || (
        averageRetention !== null
            ? `Average last-step retention across ${data.cohorts?.length || bars.length} cohorts`
            : 'Compared to 34.1% last period'
    );
    const summaryDelta = data.summaryDelta || '+3.1 pts';

    return (
        <div className="retention-widget">
            <div className="retention-header">
                <div>
                    <div className="retention-title">{data.title || 'Retention'}</div>
                    <div className="retention-value-row">
                        <span className="retention-value">{summaryValue}</span>
                        <span className="retention-delta">{summaryDelta}</span>
                    </div>
                    <div className="retention-compare">
                        {summaryCompare}
                    </div>
                </div>

                <div className="retention-icon-shell" aria-hidden="true">
                    <Sparkles size={16} strokeWidth={2.2} />
                </div>
            </div>

            <div className="retention-bars">
                {bars.map((row) => (
                    <div key={row.label} className="retention-row">
                        <span className="retention-row-label">{row.label}</span>

                        <div className="retention-track">
                            <div className="retention-segments">
                                {row.segments.map((segment, index) => (
                                    <span
                                        key={`${row.label}-${index}`}
                                        className="retention-segment"
                                        style={{
                                            width: `${segment}%`,
                                            background: segmentColors[index % segmentColors.length],
                                        }}
                                    />
                                ))}
                            </div>

                            <span
                                className="retention-track-marker"
                                style={{ left: `${row.marker}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CohortAnalysis;
