import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../store/StoreProvider';
import { MoreVertical, Edit2, Copy, RefreshCw, Check, Calendar } from 'lucide-react';
import InviteMember from '../components/common/InviteMember';
import './Settings.css';

const Settings = observer(() => {
    const { organizationStore } = useStore();
    const location = useLocation();
    const navigate = useNavigate();

    // Parse tab from URL
    const queryParams = new URLSearchParams(location.search);
    const activeTab = queryParams.get('tab') || 'team';

    const handleTabChange = (newTab) => {
        navigate(`/settings?tab=${newTab}`);
    };

    const currentOrgName = organizationStore.currentOrganization?.name || 'Loading...';

    return (
        <div className="h-full w-full overflow-y-auto" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="settings-container py-8">
                <div className="page-header">
                    <h1 className="page-title">Organisation Settings</h1>

                    <div className="tabs-nav border-[#444746]/50">
                        <button
                            className={`tab-link ${activeTab === 'team' ? 'active' : ''}`}
                            onClick={() => handleTabChange('team')}
                        >
                            Team Members
                        </button>
                        <button
                            className={`tab-link ${activeTab === 'general' ? 'active' : ''}`}
                            onClick={() => handleTabChange('general')}
                        >
                            General Settings
                        </button>
                        <button
                            className={`tab-link ${activeTab === 'billing' ? 'active' : ''}`}
                            onClick={() => handleTabChange('billing')}
                        >
                            Billing
                        </button>
                    </div>
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

const GeneralSettingsSection = ({ orgName }) => {
    return (
        <div className="settings-section">
            <div className="settings-card org-name-card">
                <div className="card-field">
                    <label>Organization Name</label>
                    <div className="input-with-action">
                        <input type="text" value={orgName} readOnly />
                        <button className="btn-secondary">
                            <Edit2 size={14} /> Rename
                        </button>
                    </div>
                </div>
            </div>

            <div className="settings-header-group">
                <h3>Organization Access Tokens</h3>
                <p>Manage your org wide access tokens, if you are looking for apikeys go to project settings.</p>
            </div>

            <div className="input-with-action token-input">
                <input type="text" placeholder="No Access Token found, please generate one" readOnly />
                <div className="action-group">
                    <button className="icon-btn"><Copy size={16} /></button>
                    <button className="btn-secondary">
                        <RefreshCw size={14} /> Generate
                    </button>
                </div>
            </div>
        </div>
    );
};

const BillingSection = () => {
    return (
        <div className="billing-section">
            <div className="billing-header">
                <h2>Pricing Plans</h2>
                <p>Choose the plan that works best for your needs. Upgrade or downgrade at any time.</p>
            </div>

            <div className="pricing-grid">
                {/* Totally Free */}
                <div className="pricing-card current">
                    <div className="plan-badge active">CURRENT PLAN</div>
                    <h3 className="plan-name">Totally Free</h3>
                    <p className="plan-subtitle">No credit card required</p>
                    <div className="plan-price">
                        <span className="currency">$</span>
                        <span className="amount">0</span>
                        <span className="period">/month</span>
                    </div>
                    <ul className="plan-features">
                        <li><Check size={16} className="check-icon" /> 20k tool calls/mo</li>
                        <li><Check size={16} className="check-icon" /> Community support</li>
                        <li><Check size={16} className="check-icon" /> No usage based</li>
                    </ul>
                    <button className="plan-btn disabled">Current Plan</button>
                </div>

                {/* Ridiculously Cheap */}
                <div className="pricing-card">
                    <h3 className="plan-name">Ridiculously Cheap</h3>
                    <p className="plan-subtitle">No need to talk to humans</p>
                    <div className="plan-price">
                        <span className="currency">$</span>
                        <span className="amount">29</span>
                        <span className="period">/month</span>
                    </div>
                    <ul className="plan-features">
                        <li><Check size={16} className="check-icon" /> 200k tool calls/mo</li>
                        <li><Check size={16} className="check-icon" /> Email support</li>
                        <li><Check size={16} className="check-icon" /> $0.39/1k additional calls</li>
                    </ul>
                    <button className="plan-btn">Get Started</button>
                </div>

                {/* Serious Business */}
                <div className="pricing-card">
                    <div className="plan-badge recommended">RECOMMENDED</div>
                    <h3 className="plan-name">Serious Business</h3>
                    <p className="plan-subtitle">Maybe talk to humans?</p>
                    <div className="plan-price">
                        <span className="currency">$</span>
                        <span className="amount">229</span>
                        <span className="period">/month</span>
                    </div>
                    <ul className="plan-features">
                        <li><Check size={16} className="check-icon" /> 2M tool calls/mo</li>
                        <li><Check size={16} className="check-icon" /> Slack support (1x/month)</li>
                        <li><Check size={16} className="check-icon" /> $0.34/1k additional calls</li>
                    </ul>
                    <button className="plan-btn highlight">Get Started</button>
                </div>
            </div>

            <div className="enterprise-card">
                <div className="enterprise-info">
                    <h3>Enterprise</h3>
                    <p>Built for larger organizations who want to scale with confidence.</p>
                    <p>We offer custom apps, advanced security, priority support, master service agreement, and more.</p>
                </div>
                <div className="enterprise-action">
                    <h3>Contact Us</h3>
                    <button className="btn-primary-dark full-width">
                        <Calendar size={16} /> Schedule Call
                    </button>
                </div>
            </div>
        </div>
    );
};

const TeamMembersSection = () => {
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    const members = [
        {
            id: 1,
            name: 'adrian.tucicovenco@gmail.com',
            role: 'ADMIN',
            status: 'ACTIVE',
            joined: '2026-02-11'
        }
    ];

    return (
        <div>
            <div className="section-header">
                <div className="section-title">
                    <h3>Team Members & Invites</h3>
                    <p className="section-subtitle">Manage your organization's team members and pending invites.</p>
                </div>
                <button
                    className="btn-primary-dark"
                    onClick={() => setIsInviteModalOpen(true)}
                >
                    Invite Member
                </button>
            </div>

            <InviteMember
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
            />

            <div className="settings-table-container">
                <table className="settings-table">
                    <thead>
                        <tr>
                            <th>Member</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody style={{ textAlign: 'left' }}>
                        {members.map(member => (
                            <tr key={member.id}>
                                <td>{member.name}</td>
                                <td>
                                    <span className="role-badge">{member.role}</span>
                                </td>
                                <td>
                                    <span className="status-badge">{member.status}</span>
                                </td>
                                <td>{member.joined}</td>
                                <td>
                                    <button className="action-menu-btn">
                                        <MoreVertical size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Settings;
