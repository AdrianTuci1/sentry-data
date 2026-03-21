import React from 'react';
import './style.css';

const AudienceCopilot = ({ data = {}, isMock = false }) => {
    const recommendations = (Array.isArray(data.recommendations) && data.recommendations.length > 0 ? data.recommendations : null) ||
                            (Array.isArray(data.data) && data.data.length > 0 ? data.data : null) || 
                            [
                                { segment: "High Intent Visitors", actionType: "create", action: "Create Lookalike", modification: "+20% Bid", impactTrend: "positive", impact: "+15% Conv" },
                                { segment: "Bounced Carts", actionType: "modify", action: "Increase Retargeting", modification: "+10% Bid", impactTrend: "positive", impact: "+5% Ret" }
                            ];

    return (
        <div className="audience-copilot-container">
            <div className="copilot-header">
                <div className="ai-status">
                    <span className="pulse-dot"></span>
                    <span>AI Audience Engine Active</span>
                </div>
                <div className="sync-all-btn">Sync Meta & Google</div>
            </div>

            <div className="recommendations-list">
                {recommendations.map((rec, idx) => (
                    <div key={idx} className="rec-item">
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
                ))}
            </div>

            <div className="copilot-footer">
                <span className="last-sync">Last updated: 2 mins ago</span>
            </div>
        </div>
    );
};

export default AudienceCopilot;
