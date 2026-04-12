/* src/components/InviteMember.jsx */
import React, { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { X } from 'lucide-react';
import { useStore } from '../../store/StoreProvider';
import './InviteMember.css';

const InviteMember = observer(({ isOpen, onClose }) => {
    const { organizationStore } = useStore();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('Member');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const currentWorkspaceName = organizationStore.currentOrg?.name || 'current workspace';
    const normalizedRole = useMemo(() => role.toLowerCase(), [role]);

    const handleInvite = async (e) => {
        e.preventDefault();

        if (!email) {
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const invitation = await organizationStore.inviteMember({
                email,
                role: normalizedRole
            });
            if (invitation?.inviteUrl) {
                navigator.clipboard?.writeText(invitation.inviteUrl).catch(() => {});
            }
            setEmail('');
            setRole('Member');
            onClose();
        } catch (inviteError) {
            console.error('[InviteMember] Failed to invite member:', inviteError);
            setError('Invite could not be sent right now.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="invite-modal-overlay" onClick={onClose}>
            <div className="invite-modal-content" onClick={e => e.stopPropagation()}>
                <div className="invite-modal-header">
                    <div>
                        <h2 className="invite-modal-title">Add member</h2>
                        <p className="invite-modal-subtitle">
                            Invite a collaborator into {currentWorkspaceName} and keep access tied to the active workspace.
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
                                disabled={isSubmitting}
                            >
                                <option>Member</option>
                                <option>Admin</option>
                                <option>Owner</option>
                            </select>
                        </div>
                    </div>

                    {error && <div className="invite-feedback invite-feedback-error">{error}</div>}

                    <button
                        type="submit"
                        className={`send-invite-btn ${email ? 'active' : ''}`}
                        disabled={!email || isSubmitting}
                    >
                        {isSubmitting ? 'Sending invite...' : 'Send invite'}
                    </button>
                </form>
            </div>
        </div>
    );
});

export default InviteMember;
