import React from 'react';
import './AudienceCopilot.css';

const AudienceCopilot = ({ data = {} }) => {
    const recommendations = (data.recommendations?.length > 0 ? data.recommendations : null) || 
                            (data.data?.length > 0 ? data.data : null) || 
                            (data.results?.length > 0 ? data.results : null) || [
        { segment: 'Tech Enthusiasts', action: 'Increase Bid', actionType: 'bid', modification: '+15% CPM', impact: 'Est. +250 Conv', impactTrend: 'positive' },
        { segment: 'Cart Abandoners', action: 'New Creative', actionType: 'creative', modification: 'UGC Video', impact: 'Est. -12% CPA', impactTrend: 'positive' },
        { segment: 'Lapsed Users', action: 'Discount Code', actionType: 'promo', modification: 'SAVE20', impact: 'Est. 5.2x ROAS', impactTrend: 'positive' }
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
