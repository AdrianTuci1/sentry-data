import React, { useState, useEffect, useMemo } from 'react';
import './Insights.css';
import MicroGraphicCard from './MicroGraphicCard';
import { useStore } from '../../store/StoreProvider';
import { ProjectService } from '../../api/core';
import { observer } from 'mobx-react-lite';
import { Star, Building2, LayoutGrid } from 'lucide-react';
import fallbackAnalyticsData from '../../data/analyticsData-marketing.json'

const MOST_RELEVANT_ORDER = {
    'marketing-roas': 1,
    'attribution-models': 2,
    'data-scatter': 3,
    'sales-funnel': 4,
    'creative-quadrant': 5,
    'shapley-attribution': 6,
    'financial-waterfall': 7,
    'market-sentiment': 8,
    'revenue-forecast': 9,
    'romania-3d': 10,
};

const CLIENT_ORDER = {
    'romania-3d': 1,
    'stat-leads': 2,
    'top-routes': 3,
    'market-sentiment': 4,
    'creative-quadrant': 5,
    'sales-funnel': 6,
    'attribution-models': 7,
    'data-scatter': 8,
    'shapley-attribution': 9,
    'trend-spotter': 10,
};

const getSortIndex = (widget, sortMode, fallbackIndex) => {
    if (sortMode === 'overview') {
        return widget.overviewIndex ?? fallbackIndex + 1;
    }

    if (sortMode === 'client') {
        return widget.clientIndex ?? CLIENT_ORDER[widget.id] ?? fallbackIndex + 100;
    }

    return widget.relevanceIndex ?? MOST_RELEVANT_ORDER[widget.id] ?? fallbackIndex + 100;
};

const Insights = observer(() => {
    const { projectStore } = useStore();
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [analyticsData, setAnalyticsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortMode, setSortMode] = useState('overview');

    useEffect(() => {
        const fetchAnalytics = async () => {
            const projectId = projectStore.currentProjectId;
            if (!projectId) {
                setAnalyticsData(fallbackAnalyticsData);
                setIsLoading(false);
                return;
            }

            try {
                // Fetch dashboard metadata plus optional widget data payloads.
                const res = await ProjectService.getAnalytics(projectId);
                const dashboards = res?.data?.dashboards || res?.dashboards || [];

                if (dashboards.length > 0) {
                    setAnalyticsData(dashboards);
                } else {
                    setAnalyticsData(fallbackAnalyticsData);
                }
            } catch (error) {
                console.warn("[Insights] Failed to fetch analytics from backend.", error);
                setAnalyticsData(fallbackAnalyticsData);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, [projectStore.currentProjectId]);

    const orderedAnalyticsData = useMemo(() => (
        [...analyticsData]
            .map((widget, index) => ({ widget, baseIndex: index }))
            .sort((left, right) => {
                const leftScore = getSortIndex(left.widget, sortMode, left.baseIndex);
                const rightScore = getSortIndex(right.widget, sortMode, right.baseIndex);

                if (leftScore !== rightScore) {
                    return leftScore - rightScore;
                }

                return left.baseIndex - right.baseIndex;
            })
            .map(({ widget }) => widget)
    ), [analyticsData, sortMode]);

    const handleCardClick = (id) => {
        // Prevent expansion on desktop (user requirement)
        if (window.innerWidth >= 1024) return;

        if (expandedCardId === id) {
            setExpandedCardId(null);
        } else {
            setExpandedCardId(id);
        }
    };

    if (isLoading) {
        return <div className="insights-container"><div className="insights-header"><h1 className="insights-title">Loading...</h1></div></div>;
    }

    return (
        <div className="insights-container">
            <div className="insights-header">
                <div className="insights-meta-chips">
                    <button
                        type="button"
                        className={`insights-chip ${sortMode === 'overview' ? 'insights-chip-active' : ''}`}
                        onClick={() => setSortMode('overview')}
                    >
                        <LayoutGrid size={14} strokeWidth={2.1} />
                        <span>Overview</span>
                    </button>
                    <button
                        type="button"
                        className={`insights-chip ${sortMode === 'most-relevant' ? 'insights-chip-active insights-chip-accent' : ''}`}
                        onClick={() => setSortMode('most-relevant')}
                    >
                        <Star size={14} strokeWidth={2.1} />
                        <span>Most Relevant</span>
                    </button>
                    <button
                        type="button"
                        className={`insights-chip ${sortMode === 'client' ? 'insights-chip-active' : ''}`}
                        onClick={() => setSortMode('client')}
                    >
                        <Building2 size={14} strokeWidth={2.1} />
                        <span>Client</span>
                    </button>
                </div>
            </div>

            <div className={`insights-grid ${expandedCardId ? 'has-expanded' : ''}`}>
                {orderedAnalyticsData.length > 0 ? (
                    orderedAnalyticsData.map((data) => {
                        const isExpanded = expandedCardId === data.id;
                        if (expandedCardId && !isExpanded) return null;

                        return (
                            <MicroGraphicCard
                                key={data.id}
                                data={data}
                                isExpanded={isExpanded}
                                onClick={handleCardClick}
                            />
                        );
                    })
                ) : (
                    <div className="nothing-to-see">
                        <p>Nothing to see here</p>
                    </div>
                )}
            </div>

            {expandedCardId && (
                <div className="expanded-details-section animate-fade-in">
                    <h2 className="details-header">Detailed Analysis</h2>
                    <div className="details-content-box">
                        <p>This section loads the detailed breakdown component associated with the selected analytic.</p>
                        <p>The micrographics render as a large top banner, while complex data tables, graphs, and trends populate here dynamically, maintaining the single-page application experience.</p>
                    </div>
                </div>
            )}
        </div>
    );
});

export default Insights;
