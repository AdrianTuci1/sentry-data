import React, { useState, useEffect } from 'react';
import './Insights.css';
import MicroGraphicCard from './MicroGraphicCard';
import fallbackAnalyticsData from '../../data/analyticsData.json';
import { useStore } from '../../store/StoreProvider';
import { ProjectService } from '../../api/core';
import { observer } from 'mobx-react-lite';

const Insights = observer(() => {
    const { projectStore, workspaceStore } = useStore();
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [analyticsData, setAnalyticsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            const projectId = projectStore.currentProjectId;
            if (!projectId) {
                setAnalyticsData(fallbackAnalyticsData);
                setIsLoading(false);
                return;
            }

            try {
                const res = await ProjectService.getAnalytics(projectId);

                // Get Dashboards
                if (res.data && res.data.dashboards && res.data.dashboards.length > 0) {
                    setAnalyticsData(res.data.dashboards);
                } else {
                    setAnalyticsData(fallbackAnalyticsData);
                }


            } catch (error) {
                console.warn("[Insights] Failed to fetch analytics, using fallback.", error);
                setAnalyticsData(fallbackAnalyticsData);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, [projectStore.currentProjectId]);

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
                <h1 className="insights-title">Analytics</h1>
            </div>

            <div className={`insights-grid ${expandedCardId ? 'has-expanded' : ''}`}>
                {analyticsData.map((data) => {
                    const isExpanded = expandedCardId === data.id;
                    // If a card is expanded, we hide all others to give a focused view.
                    if (expandedCardId && !isExpanded) return null;

                    return (
                        <MicroGraphicCard
                            key={data.id}
                            data={data}
                            isExpanded={isExpanded}
                            onClick={handleCardClick}
                        />
                    );
                })}
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
