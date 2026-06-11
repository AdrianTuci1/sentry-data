# UI-Backend Wiring — Implementation Plan

> **For Hermes:** Execute task-by-task. Each task is self-contained with exact paths and code.

**Goal:** Connect frontend views to backend API for CRUD operations (org update/delete, project delete, integrations CRUD) and fix 2 path bugs.

**Architecture:** Store-first approach — add methods to useAppStore that delegate to existing Service classes, then wire existing view buttons to those store methods. No new UI components, just connecting existing UI to real API paths.

**Tech Stack:** Zustand (store), Express (backend routes), React (views)

**Current state:** Service layer 92% complete. Store calls 8/37 service methods. Views use mock data or local state. Buggy paths: AgentService.getCredentials, MeltanoService.validateConfig.

---

## Phase 1: Bug Fixes (quick wins)

### Task 1: Fix AgentService.getCredentials path

**Objective:** Backend has `GET /credentials/gcs` but frontend calls `GET /credentials` (missing `/gcs`)

**File:** `sentry-frontend/src/services/AgentService.js`

**Change line 25:**
```js
// OLD
const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/agents/credentials`);

// NEW
const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/agents/credentials/gcs`);
```

### Task 2: Fix MeltanoService.validateConfig path

**Objective:** Backend has `/organizations/:orgId/projects/:projectId/meltano/validate` but frontend calls `/meltano/validate` (missing org/project prefix)

**File:** `sentry-frontend/src/services/MeltanoService.js`

**Problem:** This method doesn't receive orgId/projectId params. It's called with `(type, settings)` but the backend path needs orgId+projectId.

**Options:**
- A) Add orgId + projectId params to validateConfig (breaking change for callers)
- B) Keep validateConfig as-is and document it only works with org/project context
- C) Make it accept optional orgId/projectId, construct dynamic path

**Decision: Option A** — no callers exist yet, so no breakage. Add params now.

**Change:**
```js
// OLD
async validateConfig(type, settings) {
    const response = await apiClient.post("/meltano/validate", { type, settings });
    return response.data;
}

// NEW
async validateConfig(orgId, projectId, type, settings) {
    const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/meltano/validate`, { type, settings });
    return response.data;
}
```

---

## Phase 2: Store CRUD Methods (infrastructure)

### Task 3: Add store.deleteOrganization

**File:** `sentry-frontend/src/stores/useAppStore.js`

**Add after `createOrganization`:**
```js
deleteOrganization: async (orgId) => {
    if (get().devMode) {
        set((state) => ({
            organizations: state.organizations.filter((o) => o.id !== orgId),
            workspaces: state.workspaces.filter((w) => w.organizationId !== orgId),
            currentOrganization: state.currentOrganization?.id === orgId 
                ? (state.organizations.find((o) => o.id !== orgId) || emptyOrg)
                : state.currentOrganization,
        }));
        return;
    }
    set({ isLoading: true });
    try {
        await organizationService.delete(orgId);
        set((state) => ({
            organizationsData: state.organizationsData.filter((o) => o.id !== orgId),
            organizations: state.organizations.filter((o) => o.id !== orgId),
            workspaces: state.workspaces.filter((w) => w.organizationId !== orgId),
            projectsData: state.projectsData.filter((p) => p.organizationId !== orgId),
            currentOrganization: state.currentOrganization?.id === orgId
                ? (state.organizationsData.find((o) => o.id !== orgId) || emptyOrg)
                : state.currentOrganization,
            isLoading: false,
        }));
    } catch (err) {
        set({ error: err.message, isLoading: false });
        throw err;
    }
},
```

### Task 4: Add store.updateOrganization

**File:** `sentry-frontend/src/stores/useAppStore.js`

**Add after `deleteOrganization`:**
```js
updateOrganization: async (orgId, dto) => {
    if (get().devMode) {
        set((state) => ({
            organizations: state.organizations.map((o) => 
                o.id === orgId ? { ...o, ...dto } : o
            ),
            currentOrganization: state.currentOrganization?.id === orgId
                ? { ...state.currentOrganization, ...dto }
                : state.currentOrganization,
        }));
        return;
    }
    set({ isLoading: true });
    try {
        const updated = await organizationService.update(orgId, dto);
        set((state) => ({
            organizationsData: state.organizationsData.map((o) =>
                o.id === orgId ? { ...o, ...updated } : o
            ),
            organizations: state.organizations.map((o) =>
                o.id === orgId ? { ...o, ...updated } : o
            ),
            currentOrganization: state.currentOrganization?.id === orgId
                ? { ...state.currentOrganization, ...updated }
                : state.currentOrganization,
            isLoading: false,
        }));
        return updated;
    } catch (err) {
        set({ error: err.message, isLoading: false });
        throw err;
    }
},
```

### Task 5: Add store.deleteProject (workspace)

**File:** `sentry-frontend/src/stores/useAppStore.js`

**Add after `updateOrganization`:**
```js
deleteProject: async (orgId, projectId) => {
    if (get().devMode) {
        set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== projectId),
            currentWorkspace: state.currentWorkspace?.id === projectId ? null : state.currentWorkspace,
            activeScope: state.currentWorkspace?.id === projectId ? 'organization' : state.activeScope,
        }));
        return;
    }
    set({ isLoading: true });
    try {
        await projectService.delete(orgId, projectId);
        set((state) => ({
            projectsData: state.projectsData.filter((p) => p.id !== projectId),
            workspaces: state.workspaces.filter((w) => w.id !== projectId),
            currentWorkspace: state.currentWorkspace?.id === projectId ? null : state.currentWorkspace,
            activeScope: state.currentWorkspace?.id === projectId ? 'organization' : state.activeScope,
            isLoading: false,
        }));
    } catch (err) {
        set({ error: err.message, isLoading: false });
        throw err;
    }
},
```

### Task 6: Add store methods for integrations CRUD

**File:** `sentry-frontend/src/stores/useAppStore.js`

**Add after `deleteProject`:**
```js
createIntegration: async (orgId, projectId, dto) => {
    if (get().devMode) {
        const integration = { id: `int_${Date.now()}`, ...dto, createdAt: new Date().toISOString() };
        set((state) => ({
            integrationsData: [...state.integrationsData, integration],
        }));
        return integration;
    }
    set({ isLoading: true });
    try {
        const integration = await integrationService.create(orgId, projectId, dto);
        set((state) => ({
            integrationsData: [...state.integrationsData, integration],
            isLoading: false,
        }));
        return integration;
    } catch (err) {
        set({ error: err.message, isLoading: false });
        throw err;
    }
},

deleteIntegration: async (orgId, projectId, integrationId) => {
    if (get().devMode) {
        set((state) => ({
            integrationsData: state.integrationsData.filter((i) => i.id !== integrationId),
        }));
        return;
    }
    set({ isLoading: true });
    try {
        await integrationService.delete(orgId, projectId, integrationId);
        set((state) => ({
            integrationsData: state.integrationsData.filter((i) => i.id !== integrationId),
            isLoading: false,
        }));
    } catch (err) {
        set({ error: err.message, isLoading: false });
        throw err;
    }
},

updateIntegration: async (orgId, projectId, integrationId, dto) => {
    if (get().devMode) {
        set((state) => ({
            integrationsData: state.integrationsData.map((i) =>
                i.id === integrationId ? { ...i, ...dto } : i
            ),
        }));
        return;
    }
    set({ isLoading: true });
    try {
        const updated = await integrationService.update(orgId, projectId, integrationId, dto);
        set((state) => ({
            integrationsData: state.integrationsData.map((i) =>
                i.id === integrationId ? { ...i, ...updated } : i
            ),
            isLoading: false,
        }));
        return updated;
    } catch (err) {
        set({ error: err.message, isLoading: false });
        throw err;
    }
},
```

---

## Phase 3: Wire Views to Store Methods

### Task 7: Wire OrganizationOrganizationsView delete to store

**File:** `sentry-frontend/src/components/shell/OrganizationOrganizationsView.jsx`

**Current:** `handleDelete` only removes from local `localOrgs` state. Edit modal changes don't persist.

**Change 1 — Fix handleDelete to call store:**
```js
// OLD (line ~51-54)
const handleDelete = (id) => {
    const org = localOrgs.find((o) => o.id === id);
    if (org?.isDefault) return;
    setLocalOrgs((prev) => prev.filter((o) => o.id !== id));
};

// NEW
const { deleteOrganization, updateOrganization } = useAppStore();

const handleDelete = async (id) => {
    const org = localOrgs.find((o) => o.id === id);
    if (org?.isDefault) return;
    try {
        await deleteOrganization(id);
        // Sync local state from store
        const updated = useAppStore.getState().organizations;
        setLocalOrgs(updated);
    } catch (err) {
        alert('Failed to delete organization: ' + err.message);
    }
};
```

**Change 2 — Wire edit modal save to store:**
Find the save/edit handler for the org edit modal (where it sets name/plan). Replace local-only update with:
```js
const handleSaveEdit = async () => {
    try {
        const updated = await updateOrganization(selectedOrg.id, {
            name: editName.trim(),
            plan: editPlan,
        });
        // Sync local state
        const orgs = useAppStore.getState().organizations;
        setLocalOrgs(orgs);
        setEditingOrg(null);
        setDirty(false);
    } catch (err) {
        alert('Failed to update organization: ' + err.message);
    }
};
```

### Task 8: Wire OrganizationSettingsView "Edit" button

**File:** `sentry-frontend/src/components/shell/OrganizationSettingsView.jsx`

**Current:** Line 66 has `<button className="org-btn-secondary">Edit</button>` that does nothing.

**Add inline edit capability:**

```jsx
import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';

// Inside component, add state:
const [editingName, setEditingName] = useState(false);
const [nameValue, setNameValue] = useState('');
const { updateOrganization, currentOrganization } = useAppStore();

// Replace the display name row (lines ~59-67):
<div className="org-setting-row">
    <div className="org-setting-left">
        <div className="org-setting-icon-box"><Globe size={16} /></div>
        <div>
            <div className="org-setting-label">Organization display name</div>
            {editingName ? (
                <input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="org-setting-input"
                    autoFocus
                    onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                            await updateOrganization(currentOrganization.id, { name: nameValue.trim() });
                            setEditingName(false);
                        }
                        if (e.key === 'Escape') setEditingName(false);
                    }}
                />
            ) : (
                <div className="org-setting-desc">{currentOrganization.name}</div>
            )}
        </div>
    </div>
    {editingName ? (
        <div className="flex gap-2">
            <button className="org-btn-secondary" onClick={async () => {
                await updateOrganization(currentOrganization.id, { name: nameValue.trim() });
                setEditingName(false);
            }}>Save</button>
            <button className="org-btn-secondary" onClick={() => setEditingName(false)}>Cancel</button>
        </div>
    ) : (
        <button className="org-btn-secondary" onClick={() => {
            setNameValue(currentOrganization.name);
            setEditingName(true);
        }}>Edit</button>
    )}
</div>
```

### Task 9: Wire SettingsView delete project to store

**File:** `sentry-frontend/src/components/shell/SettingsView.jsx`

**Current:** `handleDelete` line 36-40 just alerts "Project deleted."

**Change:**
```jsx
import { useAppStore } from '@/stores/useAppStore';
import { useNavigate } from 'react-router-dom';

// Inside component:
const { currentOrganization, currentWorkspace, deleteProject } = useAppStore();
const navigate = useNavigate();

const handleDelete = async () => {
    if (!currentWorkspace || !currentOrganization) return;
    if (confirm("Are you sure you want to delete this project? This action is permanent and cannot be undone.")) {
        try {
            await deleteProject(currentOrganization.id, currentWorkspace.id);
            navigate('/app', { replace: true });
        } catch (err) {
            alert('Failed to delete project: ' + err.message);
        }
    }
};
```

Also wire the "Re-analysis" button (lines 28-34) to an actual API call if there's a backend endpoint, or remove the `setTimeout` mock and add a TODO comment.

### Task 10: Wire IntegrationsView to integrationService

**File:** `sentry-frontend/src/components/shell/IntegrationsView.jsx`

**Current:** Uses `connectors.json` + `localStorage`. Has `loadConnections`/`saveConnections` helpers that persist to localStorage.

**Changes:**

1. Import store and services:
```jsx
import { useAppStore } from '@/stores/useAppStore';
```

2. Replace `loadConnections` with store data fetch on mount:
```jsx
const { currentOrganization, currentWorkspace, integrationsData, createIntegration, deleteIntegration, fetchIntegrations } = useAppStore();

useEffect(() => {
    if (currentOrganization?.id && currentWorkspace?.id) {
        fetchIntegrations(currentOrganization.id, currentWorkspace.id);
    }
}, [currentOrganization?.id, currentWorkspace?.id]);
```

3. Map `integrationsData` to the UI's connection format instead of reading from localStorage:
```jsx
const [connectedSources, setConnectedSources] = useState([]);
const [connectedDestinations, setConnectedDestinations] = useState([]);

useEffect(() => {
    // Map store integrations to UI format
    const sources = integrationsData
        .filter(i => i.flow === 'source')
        .map(i => ({ id: i.id, name: i.name, flow: 'source', ...i }));
    const destinations = integrationsData
        .filter(i => i.flow === 'destination')
        .map(i => ({ id: i.id, name: i.name, flow: 'destination', ...i }));
    setConnectedSources(sources);
    setConnectedDestinations(destinations);
}, [integrationsData]);
```

4. Wire add/remove to store instead of localStorage:
```jsx
const handleAddConnection = async (connector) => {
    try {
        const dto = {
            name: connector.name,
            flow: connector.flow,
            type: connector.id,
        };
        const created = await createIntegration(
            currentOrganization.id,
            currentWorkspace.id,
            dto
        );
        // UI updates via integrationsData reactivity (useEffect above)
    } catch (err) {
        alert('Failed to add integration: ' + err.message);
    }
};

const handleRemoveConnection = async (id) => {
    try {
        await deleteIntegration(currentOrganization.id, currentWorkspace.id, id);
    } catch (err) {
        alert('Failed to remove integration: ' + err.message);
    }
};
```

5. Remove localStorage read/write (`SOURCE_STORAGE_KEY`, `DESTINATION_STORAGE_KEY`, `loadConnections`, `saveConnections` calls).

---

## Phase 4: OrganizationBillingView — wire plan display (already correct)

### Task 11: Guard OrganizationBillingView against null currentOrganization

**File:** `sentry-frontend/src/components/shell/OrganizationBillingView.jsx`

**Current:** Line 21 accesses `currentOrganization.plan` and line 24 accesses `currentOrganization.owner` without null guard.

**Change:**
```jsx
const org = currentOrganization || { name: '', plan: 'Starter', owner: '' };

// Then use org.plan and org.owner
<div className="org-stat-value">{org.plan}</div>
<p className="org-stat-copy">{org.owner} &middot; Monthly billing</p>
```

---

## Summary

| Task | File | What |
|------|------|------|
| 1 | AgentService.js | Fix `/credentials` → `/credentials/gcs` |
| 2 | MeltanoService.js | Fix `/meltano/validate` → `/orgs/:id/projects/:id/meltano/validate` |
| 3 | useAppStore.js | Add `deleteOrganization` |
| 4 | useAppStore.js | Add `updateOrganization` |
| 5 | useAppStore.js | Add `deleteProject` |
| 6 | useAppStore.js | Add `createIntegration`, `deleteIntegration`, `updateIntegration` |
| 7 | OrganizationOrganizationsView.jsx | Wire delete + edit to store |
| 8 | OrganizationSettingsView.jsx | Wire "Edit" name to `updateOrganization` |
| 9 | SettingsView.jsx | Wire "Delete Project" to `deleteProject` |
| 10 | IntegrationsView.jsx | Replace localStorage with `integrationsData` + store methods |
| 11 | OrganizationBillingView.jsx | Guard against null `currentOrganization` |

**After this:** The store will call 15/37 service methods (up from 8). Org CRUD, project delete, and integrations CRUD will be fully wired end-to-end.

**Not covered (separate plans):**
- Analytics widget data pipeline (generateMockData → analyticsService queries)
- Agent launch/chat flow (agentService.createSession/launch)
- GraphView data (analytics queries for topology)
- OrganizationAccessView (needs backend access management endpoint)
- Billing history (needs Stripe integration backend)
