/* src/components/InviteMember.jsx */
import React, { useState } from 'react';
import { X } from 'lucide-react';
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
                    <div>
                        <h2 className="invite-modal-title">Add member</h2>
                        <p className="invite-modal-subtitle">
                            Add a collaborator directly or share a controlled access link.
                        </p>
                    </div>
                    <button className="invite-close-btn" type="button" onClick={onClose} aria-label="Close invite overlay">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleInvite} className="invite-member-form">
                    <div className="invite-form-row">
                        <div className="invite-field-group email">
                            <label className="invite-label">Email</label>
                            <input
                                type="email"
                                className="invite-input"
                                placeholder="name@company.com"
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
                        Send invite
                    </button>
                </form>
            </div>
        </div>
    );
};

export default InviteMember;
