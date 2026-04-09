import { makeAutoObservable, runInAction } from "mobx";
import { Project } from "./models";
import { ProjectService } from "../api/core";
import { createParrotRuntimeMock } from "../mocks/parrotRuntimeMock";

export class ProjectStore {
    rootStore = null;
    projects = [];
    currentProjectId = null;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
        this.loadProjectsForOrg('org_sentry'); // Load initial mock data
        this.sseCloser = null;
    }

    get currentProject() {
        return this.projects.find(p => p.id === this.currentProjectId) || null;
    }

    get activeProjectsCount() {
        return this.projects.filter(p => p.status === 'active').length;
    }

    selectProject(projectId) {
        this.currentProjectId = projectId;
        this.reconnectSSE();
    }

    reconnectSSE() {
        if (this.sseCloser) {
            this.sseCloser();
            this.sseCloser = null;
        }

        if (this.currentProjectId) {
            this.sseCloser = ProjectService.connectToRuntimeStream(
                (message) => this.handleSSEMessage(message),
                (error) => console.error("[ProjectStore] SSE Error:", error)
            );
        }
    }

    async fetchProjectDiscovery(projectId) {
        try {
            const res = await ProjectService.getLineage(projectId);
            if (res && res.data) {
                runInAction(() => {
                    this.rootStore.workspaceStore.data.setData(res.data);
                });
            } else {
                runInAction(() => {
                    this.rootStore.workspaceStore.data.setData(createParrotRuntimeMock(projectId));
                });
            }
        } catch (error) {
            console.error("[ProjectStore] Failed to fetch latest discovery:", error);
            runInAction(() => {
                this.rootStore.workspaceStore.data.setData(createParrotRuntimeMock(projectId));
            });
        }
    }

    handleSSEMessage(envelope) {
        const { type, data } = envelope;

        if (type === 'discovery_updated') {
            const { projectId } = data;
            if (projectId === this.currentProjectId) {
                console.log("[ProjectStore] Discovery update notification received, fetching full state from DB...");
                this.fetchProjectDiscovery(projectId);
            }
        }

        if (type === 'runtime_progress') {
            console.log("[ProjectStore] Runtime Progress:", data.step, `${data.progress}%`);
        }
    }

    async loadProjectsForOrg(orgId) {
        try {
            const res = await ProjectService.getProjects();
            if (res && res.data && res.data.length > 0) {
                runInAction(() => {
                    this.projects = res.data.map(p => new Project({
                        id: p.projectId,
                        name: p.name,
                        status: p.status,
                        lastActive: p.createdAt ? new Date(parseInt(p.createdAt)).toLocaleDateString() : 'Just now',
                        connectors: Array.isArray(p.queryConfigs) ? p.queryConfigs.length : 0,
                        models: 0,
                    }));
                });
            } else {
                this._loadMockProjects();
            }
        } catch (error) {
            console.warn("Failed to fetch projects, using mock fallback", error);
            this._loadMockProjects();
        }

        runInAction(() => {
            // Ensure current project is valid or null
            if (!this.projects.some(p => p.id === this.currentProjectId)) {
                this.currentProjectId = null;
            }
        });
    }

    _loadMockProjects() {
        const mockDbProjects = [
            {
                id: 'parrot-commerce-demo',
                name: 'Parrot Commerce Demo',
                status: 'active',
                lastActive: '2 min ago',
                connectors: 2,
                models: 1,
                viewLink: 'https://app.sentry.local/view/parrot-commerce-demo',
                members: [
                    { id: 'm_1', account: 'ops@sentry.local', access: 'admin' },
                    { id: 'm_2', account: 'growth@sentry.local', access: 'contributor' },
                ]
            },
            {
                id: 'parrot-growth-studio',
                name: 'Parrot Growth Studio',
                status: 'active',
                lastActive: '2h ago',
                connectors: 3,
                models: 2,
                viewLink: 'https://app.sentry.local/view/parrot-growth-studio',
                members: [
                    { id: 'm_3', account: 'brand@sentry.local', access: 'admin' },
                    { id: 'm_4', account: 'sales@sentry.local', access: 'viewer' },
                ]
            },
            {
                id: 'parrot-risk-lab',
                name: 'Parrot Risk Lab',
                status: 'archived',
                lastActive: '5d ago',
                connectors: 2,
                models: 1,
                viewLink: 'https://app.sentry.local/view/parrot-risk-lab',
                members: [
                    { id: 'm_5', account: 'security@sentry.local', access: 'admin' },
                ]
            }
        ];

        runInAction(() => {
            this.projects = mockDbProjects.map(data => new Project(data));
        });
    }

    addProject(data) {
        const project = new Project({
            id: `proj_${Date.now()}`,
            status: 'active',
            lastActive: 'Just now',
            connectors: 0,
            models: 0,
            members: [],
            viewLink: `https://app.sentry.local/view/proj_${Date.now()}`,
            ...data
        });
        this.projects.push(project);
        return project;
    }

    updateProject(projectId, data) {
        const project = this.projects.find((entry) => entry.id === projectId);
        if (!project) return null;

        project.update({
            ...data,
            lastActive: 'Just now',
        });

        return project;
    }
}
