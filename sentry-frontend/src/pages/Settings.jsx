import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../store/StoreProvider';
import {
    Calendar,
    Check,
    Copy,
    Edit2,
    MoreVertical,
    RefreshCw,
    Shield
} from 'lucide-react';
import './Settings.css';

const TABS = [
    { id: 'team', label: 'Team' },
    { id: 'general', label: 'General' },
    { id: 'billing', label: 'Billing' },
    { id: 'activity', label: 'Activity' },
];

const Settings = observer(() => {
    const { organizationStore } = useStore();
    const location = useLocation();
    const navigate = useNavigate();

    const queryParams = new URLSearchParams(location.search);
    const activeTab = queryParams.get('tab') || 'team';
    const currentOrg = organizationStore.currentOrg;

    const handleTabChange = (newTab) => {
        navigate(`/settings?tab=${newTab}`);
    };

    return (
        <div className="settings-page">
            <div className="settings-shell">
                <div className="settings-tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab.id)}
                            type="button"
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="settings-content">
                    {activeTab === 'team' && <TeamMembersSection />}
                    {activeTab === 'general' && <GeneralSettingsSection org={currentOrg} />}
                    {activeTab === 'billing' && <BillingSection org={currentOrg} />}
                    {activeTab === 'activity' && <ActivitySection />}
                </div>
            </div>
        </div>
    );
});

const GeneralSettingsSection = observer(({ org }) => {
    const { organizationStore } = useStore();
    const currentUser = organizationStore.currentUser;
    const limits = org?.limits;

    return (
        <div className="settings-grid">
            <section className="settings-panel">
                <div className="settings-panel-header">
                    <div>
                        <h2>Workspace profile</h2>
                    </div>
                </div>

                <div className="settings-stack">
                    <label className="settings-field">
                        <span>Workspace name</span>
                        <div className="settings-inline-field">
                            <input type="text" value={org?.name || ''} readOnly />
                            <button className="settings-ghost-btn" type="button">
                                <Edit2 size={14} />
                                Rename
                            </button>
                        </div>
                    </label>

                    <label className="settings-field">
                        <span>Workspace slug</span>
                        <input type="text" value={org?.slug || ''} readOnly />
                    </label>

                    <div className="settings-note-card">
                        <Shield size={18} />
                        <p>
                            Workspace access now lives in the control plane. Members, invites, activity, and project visibility are all scoped from here.
                        </p>
                    </div>
                </div>
            </section>

            <section className="settings-panel">
                <div className="settings-panel-header">
                    <div>
                        <h2>Workspace token</h2>
                    </div>
                </div>

                <div className="settings-stack">
                    <label className="settings-field">
                        <span>Current operator</span>
                        <input type="text" value={currentUser?.email || ''} readOnly />
                    </label>

                    <label className="settings-field">
                        <span>Workspace usage</span>
                        <div className="settings-usage-grid">
                            <div className="settings-usage-card">
                                <strong>{limits?.currentProjects ?? 0}/{limits?.maxProjects ?? 0}</strong>
                                <span>Projects</span>
                            </div>
                            <div className="settings-usage-card">
                                <strong>{limits?.currentSeats ?? 0}/{limits?.maxSeats ?? 0}</strong>
                                <span>Seats</span>
                            </div>
                            <div className="settings-usage-card">
                                <strong>{limits?.currentDataIngestedGb ?? 0}/{limits?.maxDataIngestedGb ?? 0} GB</strong>
                                <span>Ingested</span>
                            </div>
                        </div>
                    </label>

                    <div className="settings-inline-actions">
                        <button className="settings-icon-btn" type="button" aria-label="Copy token">
                            <Copy size={16} />
                        </button>
                        <button className="settings-primary-btn" type="button">
                            <RefreshCw size={14} />
                            Rotate token
                        </button>
                    </div>

                    <p className="settings-microcopy">
                        Workspace tokens still need a dedicated issuance flow, but the workspace metadata and membership model are now live behind this page.
                    </p>
                </div>
            </section>
        </div>
    );
});

const BillingSection = ({ org }) => {
    const currentPlan = org?.plan || 'free';
    const limits = org?.limits;
    const plans = [
        {
            name: 'Free',
            subtitle: 'Small team, early signal.',
            price: '$0',
            meta: '/month',
            badge: currentPlan === 'free' ? 'Current' : '',
            tone: currentPlan === 'free' ? 'current' : '',
            cta: currentPlan === 'free' ? 'Current plan' : 'Choose Free',
            features: ['5 projects', '5 seats', '25 GB ingest']
        },
        {
            name: 'Pro',
            subtitle: 'For lean product and ops teams.',
            price: '$29',
            meta: '/month',
            badge: currentPlan === 'pro' ? 'Current' : '',
            tone: currentPlan === 'pro' ? 'current' : '',
            cta: currentPlan === 'pro' ? 'Current plan' : 'Upgrade to Pro',
            features: ['25 projects', '15 seats', '500 GB ingest']
        },
        {
            name: 'Enterprise',
            subtitle: 'Shared workflows across larger teams.',
            price: '$229',
            meta: '/month',
            badge: currentPlan === 'enterprise' ? 'Current' : 'Recommended',
            tone: currentPlan === 'enterprise' ? 'current' : 'recommended',
            cta: currentPlan === 'enterprise' ? 'Current plan' : 'Talk to sales',
            features: ['250 projects', '100 seats', '5 TB ingest']
        }
    ];

    return (
        <div className="settings-stack settings-stack-wide">
            <section className="settings-panel">
                <div className="settings-panel-header">
                    <div>
                        <h2>Plans built for signal-heavy teams</h2>
                    </div>
                    <p className="settings-panel-copy">
                        The current workspace is on <strong>{currentPlan}</strong> with {limits?.currentProjects ?? 0} active project(s) and {limits?.currentSeats ?? 0} seat(s) allocated.
                    </p>
                </div>

                <div className="billing-grid">
                    {plans.map((plan) => (
                        <article key={plan.name} className={`billing-card ${plan.tone}`}>
                            {plan.badge && <span className="billing-badge">{plan.badge}</span>}
                            <h3>{plan.name}</h3>
                            <p>{plan.subtitle}</p>
                            <div className="billing-price">
                                <strong>{plan.price}</strong>
                                <span>{plan.meta}</span>
                            </div>
                            <ul className="billing-features">
                                {plan.features.map((feature) => (
                                    <li key={feature}>
                                        <Check size={14} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <button className={`settings-primary-btn billing-cta ${plan.tone === 'current' ? 'muted' : ''}`} type="button">
                                {plan.cta}
                            </button>
                        </article>
                    ))}
                </div>
            </section>

            <section className="settings-panel settings-panel-split">
                <div>
                    <h2>Need contractual review, security add-ons, or rollout support?</h2>
                    <p className="settings-panel-copy">
                        Enterprise rollouts can now sit on real workspace limits and membership metadata instead of hard-coded plan cards.
                    </p>
                </div>

                <button className="settings-primary-btn" type="button">
                    <Calendar size={16} />
                    Schedule call
                </button>
            </section>
        </div>
    );
};

const TeamMembersSection = observer(() => {
    const { organizationStore } = useStore();
    const members = organizationStore.currentOrgMembers;
    const invitations = organizationStore.currentOrgInvitations;

    return (
        <div className="settings-stack settings-stack-wide">
            <section className="settings-panel">
                <div className="settings-table-toolbar">
                    <div className="settings-table-meta">
                        <span>{members.length} active member(s)</span>
                    </div>
                </div>
                <div className="settings-table-wrap">
                    <table className="settings-table">
                        <thead>
                            <tr>
                                <th>Member</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th aria-label="Actions"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.length > 0 ? members.map((member) => (
                                <tr key={member.userId || member.email}>
                                    <td className="settings-member-cell">
                                        <span className="settings-member-avatar">{(member.name || member.email || '?').slice(0, 1).toUpperCase()}</span>
                                        <span>{member.name || member.email}</span>
                                    </td>
                                    <td><span className="settings-badge">{member.role}</span></td>
                                    <td><span className="settings-badge settings-badge-live">{member.status}</span></td>
                                    <td>{formatDate(member.joined)}</td>
                                    <td>
                                        <button className="settings-icon-btn" type="button" aria-label={`Actions for ${member.email}`}>
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="settings-empty-cell">No workspace members yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="settings-panel">
                <div className="settings-panel-header">
                    <div>
                        <h2>Pending invitations</h2>
                    </div>
                </div>
                <div className="settings-table-wrap">
                    <table className="settings-table">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Expires</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invitations.length > 0 ? invitations.map((invite) => (
                                <tr key={invite.invitationId}>
                                    <td>{invite.email}</td>
                                    <td><span className="settings-badge">{invite.role}</span></td>
                                    <td><span className="settings-badge">{invite.status}</span></td>
                                    <td>{formatDate(invite.expiresAt)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="settings-empty-cell">No pending invites.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
});

const ActivitySection = observer(() => {
    const { organizationStore } = useStore();
    const activity = organizationStore.currentOrgActivity;

    return (
        <section className="settings-panel">
            <div className="settings-panel-header">
                <div>
                    <h2>Workspace activity</h2>
                </div>
                <p className="settings-panel-copy">
                    Control-plane actions are now persisted so we can surface an actual timeline instead of a placeholder view.
                </p>
            </div>

            <div className="settings-activity-list">
                {activity.length > 0 ? activity.map((event) => (
                    <article key={event.eventId} className="settings-activity-item">
                        <div className="settings-activity-meta">
                            <span className="settings-badge">{event.action}</span>
                            <span>{formatDate(event.createdAt)}</span>
                        </div>
                        <strong>{event.summary}</strong>
                        <p>{event.actorEmail || event.actorUserId}</p>
                    </article>
                )) : (
                    <div className="settings-empty-state">No activity recorded for this workspace yet.</div>
                )}
            </div>
        </section>
    );
});

const formatDate = (value) => {
    if (!value) {
        return 'Just now';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return 'Just now';
    }

    return parsed.toLocaleDateString();
};

export default Settings;
