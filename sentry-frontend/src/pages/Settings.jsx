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
];

const Settings = observer(() => {
    const { organizationStore } = useStore();
    const location = useLocation();
    const navigate = useNavigate();

    const queryParams = new URLSearchParams(location.search);
    const activeTab = queryParams.get('tab') || 'team';
    const currentOrgName = organizationStore.currentOrg?.name || 'Sentry Data';

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
                    {activeTab === 'general' && <GeneralSettingsSection orgName={currentOrgName} />}
                    {activeTab === 'billing' && <BillingSection />}
                </div>
            </div>
        </div>
    );
});

const GeneralSettingsSection = ({ orgName }) => (
    <div className="settings-grid">
        <section className="settings-panel">
            <div className="settings-panel-header">
                <div>
                    <h2>Organisation profile</h2>
                </div>
            </div>

            <div className="settings-stack">
                <label className="settings-field">
                    <span>Organisation name</span>
                    <div className="settings-inline-field">
                        <input type="text" value={orgName} readOnly />
                        <button className="settings-ghost-btn" type="button">
                            <Edit2 size={14} />
                            Rename
                        </button>
                    </div>
                </label>

                <div className="settings-note-card">
                    <Shield size={18} />
                    <p>
                        Use the organisation layer for workspace-wide defaults. Project-level API keys and
                        runtime settings should stay closer to the team that owns delivery.
                    </p>
                </div>
            </div>
        </section>

        <section className="settings-panel">
            <div className="settings-panel-header">
                <div>
                    <h2>Organisation token</h2>
                </div>
            </div>

            <div className="settings-stack">
                <label className="settings-field">
                    <span>Current token</span>
                    <div className="settings-inline-field">
                        <input type="text" placeholder="No organisation token generated yet" readOnly />
                        <div className="settings-inline-actions">
                            <button className="settings-icon-btn" type="button" aria-label="Copy token">
                                <Copy size={16} />
                            </button>
                            <button className="settings-primary-btn" type="button">
                                <RefreshCw size={14} />
                                Generate
                            </button>
                        </div>
                    </div>
                </label>

                <p className="settings-microcopy">
                    Rotate this token when rotating shared infrastructure credentials or onboarding a new control plane.
                </p>
            </div>
        </section>
    </div>
);

const BillingSection = () => {
    const plans = [
        {
            name: 'Free',
            subtitle: 'Small team, early signal.',
            price: '$0',
            meta: '/month',
            badge: 'Current',
            tone: 'current',
            cta: 'Current plan',
            features: ['20k tool calls', 'Community support', 'Single workspace']
        },
        {
            name: 'Studio',
            subtitle: 'For lean product and ops teams.',
            price: '$29',
            meta: '/month',
            badge: '',
            tone: '',
            cta: 'Upgrade to Studio',
            features: ['200k tool calls', 'Email support', 'Multiple projects']
        },
        {
            name: 'Scale',
            subtitle: 'Shared workflows across larger teams.',
            price: '$229',
            meta: '/month',
            badge: 'Recommended',
            tone: 'recommended',
            cta: 'Talk to sales',
            features: ['2M tool calls', 'Slack support', 'Priority governance']
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
                        Pricing stays visible and operational instead of feeling like a separate checkout flow.
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
                        Enterprise setups can include custom onboarding, policy review, shared support channels,
                        and a tighter procurement path.
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

const TeamMembersSection = () => {
    const members = [
        {
            id: 1,
            name: 'adrian.tucicovenco@gmail.com',
            role: 'Admin',
            status: 'Active',
            joined: '11 Feb 2026'
        }
    ];

    return (
        <div className="settings-stack settings-stack-wide">
            <section className="settings-panel">
                <div className="settings-table-toolbar">
                    <div className="settings-table-meta">
                        <span>{members.length} member</span>
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
                            {members.map((member) => (
                                <tr key={member.id}>
                                    <td className="settings-member-cell">
                                        <span className="settings-member-avatar">{member.name.slice(0, 1).toUpperCase()}</span>
                                        <span>{member.name}</span>
                                    </td>
                                    <td><span className="settings-badge">{member.role}</span></td>
                                    <td><span className="settings-badge settings-badge-live">{member.status}</span></td>
                                    <td>{member.joined}</td>
                                    <td>
                                        <button className="settings-icon-btn" type="button" aria-label={`Actions for ${member.name}`}>
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default Settings;
