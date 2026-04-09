import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import './ProjectEditorOverlay.css';

const ACCESS_OPTIONS = [
    { value: 'viewer', label: 'Viewer' },
    { value: 'contributor', label: 'Contributor' },
    { value: 'admin', label: 'Admin' },
];

const createEmptyMember = () => ({
    id: `member_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    account: '',
    access: 'viewer',
});

const createDefaultViewLink = (projectName = '') => {
    const slug = projectName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `https://app.sentry.local/view/${slug || `project-${Date.now()}`}`;
};

const ProjectEditorOverlay = ({ isOpen, mode, project, onClose, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [members, setMembers] = useState([createEmptyMember()]);
    const [viewLink, setViewLink] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        setTitle(project?.name || '');
        setMembers(project?.members?.length ? project.members : [createEmptyMember()]);
        setViewLink(project?.viewLink || '');
    }, [isOpen, project]);

    if (!isOpen) {
        return null;
    }

    const updateMember = (memberId, key, value) => {
        setMembers((currentMembers) =>
            currentMembers.map((member) =>
                member.id === memberId ? { ...member, [key]: value } : member
            )
        );
    };

    const addMember = () => {
        setMembers((currentMembers) => [...currentMembers, createEmptyMember()]);
    };

    const resetViewLink = () => {
        setViewLink(createDefaultViewLink(title || project?.name || ''));
    };

    const removeMember = (memberId) => {
        setMembers((currentMembers) => {
            if (currentMembers.length === 1) {
                return [createEmptyMember()];
            }

            return currentMembers.filter((member) => member.id !== memberId);
        });
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const normalizedMembers = members
            .map((member) => ({
                ...member,
                account: member.account.trim(),
            }))
            .filter((member) => member.account);

        if (!title.trim()) {
            return;
        }

        onSubmit({
            name: title.trim(),
            members: normalizedMembers,
            viewLink: viewLink.trim(),
        });
    };

    return (
        <div className="project-editor-overlay" onClick={onClose}>
            <div
                className="project-editor-modal"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="project-editor-header">
                    <div>
                        <p className="project-editor-eyebrow">
                            {mode === 'edit' ? 'Edit project' : 'New project'}
                        </p>
                        <h2 className="project-editor-title">
                            {mode === 'edit' ? 'Update project access' : 'Create a new project'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        className="project-editor-close"
                        onClick={onClose}
                        aria-label="Close project editor"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form className="project-editor-form" onSubmit={handleSubmit}>
                    <div className="project-editor-grid">
                        <label className="project-editor-field">
                            <span>Title</span>
                            <input
                                type="text"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Project title"
                            />
                        </label>

                        <label className="project-editor-field">
                            <span>View-only link</span>
                            <div className="project-editor-inline-field">
                                <input
                                    type="text"
                                    value={viewLink}
                                    onChange={(event) => setViewLink(event.target.value)}
                                    placeholder="https://..."
                                />
                                <button
                                    type="button"
                                    className="project-editor-inline-action"
                                    onClick={resetViewLink}
                                >
                                    Reset
                                </button>
                            </div>
                        </label>
                    </div>

                    <div className="project-editor-members">
                        <div className="project-editor-members-header">
                            <span>Accounts and access</span>
                            <button
                                type="button"
                                className="project-editor-add"
                                onClick={addMember}
                            >
                                <Plus size={16} />
                                Add account
                            </button>
                        </div>

                        <div className="project-editor-member-list">
                            {members.map((member) => (
                                <div className="project-editor-member-row" key={member.id}>
                                    <input
                                        type="text"
                                        value={member.account}
                                        onChange={(event) => updateMember(member.id, 'account', event.target.value)}
                                        placeholder="email@company.com"
                                    />
                                    <select
                                        value={member.access}
                                        onChange={(event) => updateMember(member.id, 'access', event.target.value)}
                                    >
                                        {ACCESS_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="project-editor-remove"
                                        onClick={() => removeMember(member.id)}
                                        aria-label="Remove account"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="project-editor-actions">
                        <button type="button" className="project-editor-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="project-editor-primary" disabled={!title.trim()}>
                            {mode === 'edit' ? 'Save changes' : 'Create project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProjectEditorOverlay;
