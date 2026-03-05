import React from 'react';
import { observer } from 'mobx-react-lite';
import { ArrowRight } from 'lucide-react';
import './RecommendationsMenu.css';

const RecommendationsMenu = observer(({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const recommendations = [
        {
            id: 1,
            title: "Optimize Token Allocation",
            description: "Your current token usage is peaking in APAC regions. Consider redistributing for cost-efficiency.",
            category: "Efficiency"
        },
        {
            id: 2,
            title: "Predictive Scaling Alert",
            description: "Projected traffic increase of 40% in the next 2 hours. Enable auto-scaling for cluster B.",
            category: "Performance"
        },
        {
            id: 3,
            title: "Security Pattern Detected",
            description: "Unusual access pattern from a new service account. Review permissions for 'Dev-Proxy-01'.",
            category: "Security"
        }
    ];

    return (
        <div className="recommendations-menu-overlay" onClick={onClose}>
            <div className="recommendations-menu-container" onClick={(e) => e.stopPropagation()}>
                <div className="recommendations-list">
                    {recommendations.map((rec) => (
                        <div key={rec.id} className="recommendation-card">
                            <div className="card-content">
                                <h4>{rec.title}</h4>
                                <p>{rec.description}</p>
                            </div>
                            <button className="mini-apply-btn">
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="menu-footer">
                    <p>Recommendations are updated in real-time based on your workspace data.</p>
                </div>
            </div>
        </div>
    );
});

export default RecommendationsMenu;
