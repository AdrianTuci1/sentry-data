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
        if (!orgId) {
            runInAction(() => {
                this.projects = [];
                this.currentProjectId = null;
            });
            return;
        }

        try {
            const res = await ProjectService.getProjects(orgId);
            if (res && Array.isArray(res.data) && res.data.length > 0) {
                runInAction(() => {
                    this.projects = res.data.map((project) => this.mapProject(project));
                });
            } else {
                this.loadMockProjects();
            }
        } catch (error) {
            console.warn("[ProjectStore] Failed to fetch projects", error);
            this.loadMockProjects();
        }

        runInAction(() => {
            // Ensure current project is valid or null
            if (!this.projects.some(p => p.id === this.currentProjectId)) {
                this.currentProjectId = null;
            }
        });
    }

    async addProject(data) {
        const workspaceId = this.rootStore.organizationStore.currentOrgId;
        const res = await ProjectService.createProject({
            ...data,
            workspaceId
        });
        const project = this.mapProject(res.data);

        runInAction(() => {
            this.projects = [project, ...this.projects.filter((entry) => entry.id !== project.id)];
        });

        return project;
    }

    loadMockProjects() {
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
            this.projects = mockDbProjects.map((data) => new Project(data));
        });
    }

    async updateProject(projectId, data) {
        const res = await ProjectService.updateProject(projectId, data);
        const nextProject = this.mapProject(res.data);

        runInAction(() => {
            const currentProject = this.projects.find((entry) => entry.id === projectId);
            if (currentProject) {
                currentProject.update({
                    ...nextProject,
                    members: nextProject.members,
                    viewLink: nextProject.viewLink
                });
            } else {
                this.projects.push(nextProject);
            }
        });

        return nextProject;
    }

    async createShareLink(projectId, payload = {}) {
        const res = await ProjectService.createShareLink(projectId, payload);
        const currentProject = this.projects.find((entry) => entry.id === projectId);

        runInAction(() => {
            if (currentProject) {
                currentProject.update({
                    viewLink: res.data.shareUrl
                });
            }
        });

        return res.data;
    }

    mapProject(project) {
        return new Project({
            id: project.projectId,
            name: project.name,
            status: project.status,
            lastActive: this.formatTimestamp(project.updatedAt || project.createdAt),
            connectors: Array.isArray(project.queryConfigs) ? project.queryConfigs.length : 0,
            models: 0,
            members: project.members || [],
            viewLink: project.viewLink || '',
        });
    }

    formatTimestamp(value) {
        if (!value) {
            return 'Just now';
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return 'Just now';
        }

        return parsed.toLocaleDateString();
    }
}
