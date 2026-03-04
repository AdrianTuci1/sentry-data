/* src/components/InviteMember.jsx */
import React, { useState } from 'react';
import './InviteMember.css';

const InviteMember = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('Member');

    if (!isOpen) return null;

    const handleInvite = (e) => {
        e.preventDefault();
        if (email) {
            console.log(`Inviting ${email} as ${role}`);
            onClose();
        }
    };

    return (
        <div className="invite-modal-overlay" onClick={onClose}>
            <div className="invite-modal-content" onClick={e => e.stopPropagation()}>
                <div className="invite-modal-header">
                    <h2 className="invite-modal-title">Invite Team Members</h2>
                    <p className="invite-modal-subtitle">
                        Invite new members to your organization by email or create a public invite link.
                    </p>
                </div>

                <form onSubmit={handleInvite}>
                    <div className="invite-form-row">
                        <div className="invite-field-group email">
                            <label className="invite-label">Email Address</label>
                            <input
                                type="email"
                                className="invite-input"
                                placeholder="Enter email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="invite-field-group role">
                            <label className="invite-label">Role</label>
                            <select
                                className="invite-select"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <option>Member</option>
                                <option>Admin</option>
                                <option>Owner</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className={`send-invite-btn ${email ? 'active' : ''}`}
                        disabled={!email}
                    >
                        Send Email Invite
                    </button>
                </form>

                <div className="invite-divider">
                    <span>or</span>
                </div>

                <div className="public-invite-section">
                    <h3 className="public-invite-header">Public Invite Link</h3>
                    <div className="public-invite-card">
                        <p>Create a public invite link that anyone can use to join your organization</p>
                        <button className="create-link-btn">Create Public Link</button>
                    </div>
                </div>

                <div className="invite-modal-footer">
                    <button className="close-btn" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default InviteMember;
