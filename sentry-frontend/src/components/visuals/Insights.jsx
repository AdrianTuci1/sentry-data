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
                // Fetch FULLY HYDRATED data (server-side orchestration)
                const res = await ProjectService.getAnalytics(projectId);

                if (res.data && res.data.dashboards) {
                    setAnalyticsData(res.data.dashboards);
                } else {
                    setAnalyticsData([]); // Show "Nothing to see here" if no data at all
                }
            } catch (error) {
                console.warn("[Insights] Failed to fetch analytics from backend.", error);
                setAnalyticsData([]); // Set empty to trigger "Nothing to see here"
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
                {analyticsData.length > 0 ? (
                    analyticsData.map((data) => {
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
