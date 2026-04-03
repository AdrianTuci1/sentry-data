import React from 'react';

const LeadsList = ({ data }) => {
    const leads = data?.leads || [
        { name: 'Andrei Popescu', value: 'Google Ads', status: 'vip', time: '2m ago' },
        { name: 'Maria Ionescu', value: 'Facebook', status: 'warm', time: '15m ago' },
        { name: 'Digital Solutions', value: 'Direct', status: 'vip', time: '1h ago' },
        { name: 'Tech Global', value: 'LinkedIn', status: 'cold', time: '3h ago' },
        { name: 'Creative Agency', value: 'TikTok', status: 'vip', time: '5h ago' },
        { name: 'Retail Hub', value: 'Email', status: 'warm', time: '6h ago' }
    ];

    const getStatusMeta = (status) => {
        switch (status) {
            case 'vip': return { color: '#7CFF5B', label: 'VIP' };
            case 'warm': return { color: '#FFC533', label: 'Warm' };
            case 'cold': return { color: '#35C9FF', label: 'Cold' };
            default: return null;
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
            {leads.map((lead, i) => (
                <div
                    key={i}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: '10px',
                        alignItems: 'center',
                        paddingBottom: '10px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name}</span>
                        <span style={{ fontSize: '10px', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.value}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        {getStatusMeta(lead.status) ? (
                            <span
                                style={{
                                    fontSize: '9px',
                                    fontWeight: '700',
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    color: getStatusMeta(lead.status).color,
                                }}
                            >
                                {getStatusMeta(lead.status).label}
                            </span>
                        ) : null}
                        <span style={{ fontSize: '10px', color: '#6B7280' }}>{lead.time}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LeadsList;
