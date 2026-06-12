import { useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { ViewFrame } from '@/components/shell/ViewFrame';
import {
  ShieldCheck,
  UserPlus,
  Users,
  Clock,
  Pencil,
  XIcon,
  Check,
  FolderPlus,
  FolderEdit,
  UserCog,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import '@/styles/organization-views.css';

const PERMISSION_DEFS = [
  { key: 'createProject', label: 'Create project', icon: FolderPlus },
  { key: 'editProject', label: 'Edit project', icon: FolderEdit },
  { key: 'assignRoles', label: 'Assign roles', icon: UserCog },
];

const DEFAULT_ROLES = [
  { name: 'Owner', permissions: { createProject: true, editProject: true, assignRoles: true } },
  { name: 'Admin', permissions: { createProject: true, editProject: true, assignRoles: true } },
  { name: 'Member', permissions: { createProject: false, editProject: true, assignRoles: false } },
  { name: 'Viewer', permissions: { createProject: false, editProject: false, assignRoles: false } },
];

const DEFAULT_MEMBERS = [
  { id: '1', name: 'Adrian Tucicovenco', email: 'adrian.tucicovenco@gmail.com', role: 'Owner', status: 'Active', permissions: { createProject: true, editProject: true, assignRoles: true } },
  { id: '2', name: 'Maria Popescu', email: 'maria@efferd.io', role: 'Admin', status: 'Active', permissions: { createProject: true, editProject: true, assignRoles: true } },
  { id: '3', name: 'Andrei Ionescu', email: 'andrei@efferd.io', role: 'Member', status: 'Active', permissions: { createProject: false, editProject: true, assignRoles: false } },
  { id: '4', name: 'Elena Dumitrescu', email: 'elena@efferd.io', role: 'Viewer', status: 'Pending', permissions: { createProject: false, editProject: false, assignRoles: false } },
];

function PermissionToggle({ checked, onChange, label, icon: Icon }) {
  return (
    <button
      type="button"
      className={`org-perm-toggle ${checked ? 'active' : ''}`}
      onClick={onChange}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function MemberModal({ open, onOpenChange, member, onSave }) {
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [role, setRole] = useState(member?.role || 'Member');
  const [permissions, setPermissions] = useState(
    member?.permissions || { createProject: false, editProject: true, assignRoles: false }
  );

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'Owner' || newRole === 'Admin') {
      setPermissions({ createProject: true, editProject: true, assignRoles: true });
    } else if (newRole === 'Viewer') {
      setPermissions({ createProject: false, editProject: false, assignRoles: false });
    } else {
      setPermissions({ createProject: false, editProject: true, assignRoles: false });
    }
  };

  const togglePermission = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onSave({
      id: member?.id || `m_${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
      status: member?.status || 'Active',
      permissions,
    });
    onOpenChange(false);
  };

  const isEditing = !!member;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="org-modal-backdrop" />
        <DialogPrimitive.Popup className="org-modal-frame">
          <div className="org-modal">
            <DialogPrimitive.Close
              render={
                <Button variant="ghost" size="icon-sm" className="org-modal-close" type="button" />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <form className="org-modal-form" onSubmit={handleSubmit}>
              <div className="org-modal-header">
                <DialogPrimitive.Title className="org-modal-title">
                  {isEditing ? 'Edit member' : 'Invite member'}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="org-modal-description">
                  {isEditing
                    ? 'Update member details and organization-level permissions.'
                    : 'Add a new member to the organization and configure their access.'}
                </DialogPrimitive.Description>
              </div>

              <div className="org-modal-body">
                <div className="org-modal-grid">
                  <label className="org-modal-field">
                    <span className="org-modal-field-label">Name</span>
                    <Input
                      className="org-modal-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                    />
                  </label>
                  <label className="org-modal-field">
                    <span className="org-modal-field-label">Email</span>
                    <Input
                      className="org-modal-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@domain.com"
                    />
                  </label>

                  <label className="org-modal-field">
                    <span className="org-modal-field-label">Role</span>
                    <select
                      className="org-form-select"
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value)}
                    >
                      <option value="Owner">Owner</option>
                      <option value="Admin">Admin</option>
                      <option value="Member">Member</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </label>
                </div>

                <div className="org-modal-perms">
                  <span className="org-modal-perms-title">Organization-level permissions</span>
                  <div className="org-permissions-grid">
                    {PERMISSION_DEFS.map((pdef) => (
                      <PermissionToggle
                        key={pdef.key}
                        checked={permissions[pdef.key]}
                        onChange={() => togglePermission(pdef.key)}
                        label={pdef.label}
                        icon={pdef.icon}
                      />
                    ))}
                  </div>
                  <p className="org-modal-perms-note">
                    Members with permissions have full access inside the assigned projects.
                  </p>
                </div>
              </div>

              <div className="org-modal-footer">
                <Button
                  type="button"
                  variant="outline"
                  className="org-modal-secondary-btn"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="org-modal-primary-btn">
                  <Check size={14} />
                  {isEditing ? 'Save changes' : 'Send invite'}
                </Button>
              </div>
            </form>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function RoleModal({ open, onOpenChange, roles, onSaveRoles }) {
  const [editableRoles, setEditableRoles] = useState(
    roles.map((r) => ({ ...r, permissions: { ...r.permissions } }))
  );

  const toggleRolePerm = (roleName, key) => {
    setEditableRoles((prev) =>
      prev.map((r) =>
        r.name === roleName
          ? { ...r, permissions: { ...r.permissions, [key]: !r.permissions[key] } }
          : r
      )
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveRoles(editableRoles);
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="org-modal-backdrop" />
        <DialogPrimitive.Popup className="org-modal-frame">
          <div className="org-modal">
            <DialogPrimitive.Close
              render={
                <Button variant="ghost" size="icon-sm" className="org-modal-close" type="button" />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <form className="org-modal-form" onSubmit={handleSubmit}>
              <div className="org-modal-header">
                <DialogPrimitive.Title className="org-modal-title">
                  Role permissions
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="org-modal-description">
                  Configure what each role can do at the organization level.
                </DialogPrimitive.Description>
              </div>

              <div className="org-modal-body" style={{ padding: 0 }}>
                <div className="org-role-matrix" style={{ padding: '18px 20px' }}>
                  {editableRoles.map((role) => (
                    <div key={role.name} className="org-role-row">
                      <span className="org-role-name">{role.name}</span>
                      <div className="org-permissions-grid" style={{ flexWrap: 'nowrap' }}>
                        {PERMISSION_DEFS.map((pdef) => (
                          <button
                            key={pdef.key}
                            type="button"
                            className={`org-perm-toggle ${role.permissions[pdef.key] ? 'active' : ''}`}
                            onClick={() => toggleRolePerm(role.name, pdef.key)}
                          >
                            <pdef.icon size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="org-modal-footer">
                <Button
                  type="button"
                  variant="outline"
                  className="org-modal-secondary-btn"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="org-modal-primary-btn">
                  <Check size={14} />
                  Save roles
                </Button>
              </div>
            </form>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function OrganizationAccessView() {
  const [tab, setTab] = useState('members');
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const handleSaveMember = (member) => {
    if (editingMember) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? member : m)));
    } else {
      setMembers((prev) => [...prev, member]);
    }
    setEditingMember(null);
  };

  const openAddMember = () => {
    setEditingMember(null);
    setMemberModalOpen(true);
  };

  const openEditMember = (member) => {
    setEditingMember(member);
    setMemberModalOpen(true);
  };

  const activeCount = members.filter((m) => m.status === 'Active').length;
  const pendingCount = members.filter((m) => m.status === 'Pending').length;
  const roleCount = [...new Set(members.map((m) => m.role))].length;

  return (
    <ViewFrame
      title="Access Management"
      description="Manage organization members and role-based permissions."
      maxWidthClassName="max-w-4xl"
    >
      <div className="org-metrics-row">
        <div className="org-metric-item">
          <span className="org-metric-label">Active Members</span>
          <span className="org-metric-value">{activeCount}</span>
        </div>
        <div className="org-metric-item">
          <span className="org-metric-label">Pending</span>
          <span className="org-metric-value">{pendingCount}</span>
        </div>
        <div className="org-metric-item">
          <span className="org-metric-label">Roles</span>
          <span className="org-metric-value">{roleCount}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="org-gap-4">
        <div className="org-tab-bar">
          <button
            className={`org-tab ${tab === 'members' ? 'active' : ''}`}
            onClick={() => setTab('members')}
          >
            <Users size={14} />
            Members
            <span className="org-tab-count">{members.length}</span>
          </button>
          <button
            className={`org-tab ${tab === 'roles' ? 'active' : ''}`}
            onClick={() => setTab('roles')}
          >
            <ShieldCheck size={14} />
            Roles
          </button>
        </div>

        {tab === 'members' ? (
          <div className="org-list-container">
            <div className="org-list-header-row" style={{ marginTop: 0 }}>
              <span className="org-list-select-label">Team Members</span>
              <button className="org-list-add-btn" onClick={openAddMember}>
                Add member
              </button>
            </div>

            <div className="org-stack">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="org-card-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => openEditMember(member)}
                >
                  <div className="org-card-left">
                    <div className="org-avatar">{member.name.charAt(0)}</div>
                    <div>
                      <div className="org-row-name">
                        {member.name}
                        <span className="org-row-role-text">· {member.role}</span>
                      </div>
                      <div className="org-row-meta">
                        {member.email}
                        {member.status === 'Pending' && (
                          <span className="org-row-status-pending-text">(Pending)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="org-card-right">
                    <Pencil size={14} className="org-hover-pencil" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="org-list-container">
            <div className="org-list-header-row" style={{ marginTop: 0 }}>
              <span className="org-list-select-label">Role Permissions</span>
              <button className="org-list-add-btn" onClick={() => setRoleModalOpen(true)}>
                Edit roles
              </button>
            </div>

            <div className="org-stack">
              {roles.map((role) => (
                <div
                  key={role.name}
                  className="org-card-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setRoleModalOpen(true)}
                >
                  <div className="org-card-left">
                    <span className="org-card-primary-name" style={{ fontSize: '14px', fontWeight: 600 }}>{role.name}</span>
                  </div>
                  <div className="org-card-right">
                    <span className="org-role-permissions-text">
                      {PERMISSION_DEFS.filter((p) => role.permissions[p.key])
                        .map((pdef) => pdef.label)
                        .join(', ')}
                    </span>
                    <Pencil size={14} className="org-hover-pencil" />
                  </div>
                </div>
              ))}
            </div>

            <div className="org-permissions-section" style={{ marginTop: '16px', paddingLeft: '4px' }}>
              <p className="org-stat-copy" style={{ fontSize: 12, margin: 0 }}>
                Permissions are scoped at the organization level. Members assigned to projects automatically have full access within those projects.
              </p>
            </div>
          </div>
        )}
      </div>

      <MemberModal
        open={memberModalOpen}
        onOpenChange={setMemberModalOpen}
        member={editingMember}
        onSave={handleSaveMember}
      />

      <RoleModal
        open={roleModalOpen}
        onOpenChange={setRoleModalOpen}
        roles={roles}
        onSaveRoles={setRoles}
      />
    </ViewFrame>
  );
}
