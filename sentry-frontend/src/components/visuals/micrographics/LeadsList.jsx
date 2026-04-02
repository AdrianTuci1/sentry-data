import React from 'react';

const LeadsList = ({ data }) => {
    const leads = data?.leads || [
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
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
            {leads.map((lead, i) => (
                <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{lead.name}</span>
                        <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{lead.value}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: getStatusColor(lead.status),
                            marginBottom: '4px',
                            boxShadow: `0 0 8px ${getStatusColor(lead.status)}`
                        }} />
                        <span style={{ fontSize: '10px', color: '#6B7280' }}>{lead.time}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LeadsList;
