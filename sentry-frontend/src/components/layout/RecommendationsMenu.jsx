import React from 'react';
import { observer } from 'mobx-react-lite';
import { ArrowRight } from 'lucide-react';
import './RecommendationsMenu.css';

const RecommendationsMenu = observer(({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const recommendations = [
        {
            id: 1,
            segment: "High-Intent Cart Abandoners",
            action: "Create",
            actionType: "create",
            modification: "Sync to Meta Ads Manager",
            impact: "-12% CPA",
            impactTrend: "positive"
        },
        {
            id: 2,
            segment: "Low-LTV Purchasers",
            action: "Exclude",
            actionType: "exclude",
            modification: "Remove from Lookalike Seeds",
            impact: "+15% LTV",
            impactTrend: "positive"
        },
        {
            id: 3,
            segment: "Tech Professionals (25-34)",
            action: "Modify",
            actionType: "modify",
            modification: "Add Interest: B2B SaaS",
            impact: "Expands reach",
            impactTrend: "neutral"
        },
        {
            id: 4,
            segment: "Recent Bounce Visitors",
            action: "Exclude",
            actionType: "exclude",
            modification: "Remove from Retargeting Pool",
            impact: "Saves $450/week",
            impactTrend: "positive"
        }
    ];

    return (
        <div className="recommendations-menu-overlay" onClick={onClose}>
            <div className="recommendations-menu-container" onClick={(e) => e.stopPropagation()}>

                <div className="copilot-header">
                    <div className="ai-status">
                        <span className="pulse-dot"></span>
                        <span>Audience AI Engine Active</span>
                    </div>
                    <div className="sync-all-btn">Sync Meta & Google</div>
                </div>

                <div className="recommendations-list">
                    {recommendations.map((rec) => (
                        <div key={rec.id} className="rec-item">
                            <div className="rec-content">
                                <div className="rec-item-header">
                                    <span className="rec-segment">{rec.segment}</span>
                                    <span className={`rec-action ${rec.actionType}`}>{rec.action}</span>
                                </div>
                                <div className="rec-details">
                                    <div className="rec-modification">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 20V10M18 20V4M6 20v-4" />
                                        </svg>
                                        {rec.modification}
                                    </div>
                                    <div className="rec-impact">
                                        <span className={rec.impactTrend === 'positive' ? 'impact-green' : 'impact-yellow'}>
                                            {rec.impact}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button className="mini-apply-btn">
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="menu-footer">
                    <p>Recommendations are generated in real-time based on ML user scoring.</p>
                </div>
            </div>
        </div>
    );
});

export default RecommendationsMenu;
