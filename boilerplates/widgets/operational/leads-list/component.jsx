import React from 'react';
import './style.css';

const LeadsList = ({ data = {} }) => {
    const leads = (data.leads?.length > 0 ? data.leads : null) || 
                  (data.data?.length > 0 ? data.data : null) || 
                  (data.results?.length > 0 ? data.results : null) || [
        { name: 'Andrei Popescu', value: 'Google Ads', status: 'hot', time: '2m ago' },
        { name: 'Maria Ionescu', value: 'Facebook', status: 'warm', time: '15m ago' },
        { name: 'Digital Solutions', value: 'Direct', status: 'hot', time: '1h ago' },
        { name: 'Tech Global', value: 'LinkedIn', status: 'cool', time: '3h ago' },
        { name: 'Creative Agency', value: 'TikTok', status: 'hot', time: '5h ago' },
        { name: 'Retail Hub', value: 'Email', status: 'warm', time: '6h ago' }
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case 'hot': return '#EF4444';
            case 'warm': return '#F59E0B';
            case 'cool': return '#3B82F6';
            default: return '#9CA3AF';
        }
    };

    return (
        <div className="leads-list-container">
            {leads.map((lead, i) => (
                <div key={i} className="leads-list-item">
                    <div className="lead-primary-info">
                        <span className="lead-name">{lead.name}</span>
                        <span className="lead-source">{lead.value}</span>
                    </div>
                    <div className="lead-secondary-info">
                        <div 
                            className="lead-status-dot"
                            style={{ 
                                backgroundColor: getStatusColor(lead.status),
                                boxShadow: `0 0 8px ${getStatusColor(lead.status)}`
                            }} 
                        />
                        <span className="lead-time">{lead.time}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LeadsList;
