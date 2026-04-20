import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import './ProjectEditorOverlay.css';
import { ProjectWidgetSelector } from './ProjectCardWidget';
import { getDefaultProjectCardWidget, useProjectDefaultSpanWidgets } from './ProjectCardWidgetData';

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

const ProjectEditorModal = ({ mode, project, onClose, onSubmit }) => {
    const [title, setTitle] = useState(() => project?.name || '');
    const [members, setMembers] = useState(() => (project?.members?.length ? project.members : [createEmptyMember()]));
    const [viewLink, setViewLink] = useState(() => project?.viewLink || '');
    const [isViewLinkDisabled, setIsViewLinkDisabled] = useState(() => Boolean(project?.viewLinkDisabled));
    const [selectedCardWidgetId, setSelectedCardWidgetId] = useState(() => project?.cardWidgetId || '');
    const { widgets: defaultSpanWidgets, isLoading: isLoadingWidgets } = useProjectDefaultSpanWidgets(project?.id);

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
            viewLink: isViewLinkDisabled ? '' : viewLink.trim(),
            viewLinkDisabled: isViewLinkDisabled,
            cardWidgetId: selectedCardWidgetId || getDefaultProjectCardWidget(defaultSpanWidgets, selectedCardWidgetId)?.id || '',
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
                                    disabled={isViewLinkDisabled}
                                />
                                <button
                                    type="button"
                                    className="project-editor-inline-action"
                                    onClick={resetViewLink}
                                    disabled={isViewLinkDisabled}
                                >
                                    Reset
                                </button>
                            </div>
                            <label className="project-editor-toggle">
                                <input
                                    type="checkbox"
                                    checked={isViewLinkDisabled}
                                    onChange={(event) => setIsViewLinkDisabled(event.target.checked)}
                                />
                                <span>Disable view-only link</span>
                            </label>
                        </label>
                    </div>

                    <div className="project-editor-widget-section">
                        <div className="project-editor-widget-header">
                            <span>Project card widget</span>
                            <p>Only default-span widgets fit in the square project card preview.</p>
                        </div>
                        {isLoadingWidgets ? (
                            <div className="project-widget-selector-empty">Loading widgets...</div>
                        ) : (
                            <ProjectWidgetSelector
                                widgets={defaultSpanWidgets}
                                selectedWidgetId={selectedCardWidgetId}
                                onChange={setSelectedCardWidgetId}
                            />
                        )}
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

const ProjectEditorOverlay = ({ isOpen, mode, project, onClose, onSubmit }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <ProjectEditorModal
            key={`${mode}-${project?.id || 'new'}`}
            mode={mode}
            project={project}
            onClose={onClose}
            onSubmit={onSubmit}
        />
    );
};

export default ProjectEditorOverlay;
