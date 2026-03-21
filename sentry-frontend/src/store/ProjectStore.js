import { makeAutoObservable, runInAction } from "mobx";
import { Project } from "./models";
import { ProjectService } from "../api/core";
import projectData from "../data/projectData.json"; // Using this as our initial "DB"

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
            this.sseCloser = ProjectService.connectToPipelineStream(
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
            }
        } catch (error) {
            console.error("[ProjectStore] Failed to fetch latest discovery:", error);
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

        if (type === 'pipeline_progress') {
            console.log("[ProjectStore] Pipeline Progress:", data.step, `${data.progress}%`);
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
            { id: 'marketing_campaign_2024', name: projectData.projectNames['marketing_campaign_2024'], status: 'active', lastActive: '2 min ago', connectors: 3, models: 1 },
            { id: 'customer_churn_v1', name: projectData.projectNames['customer_churn_v1'], status: 'active', lastActive: '2h ago', connectors: 1, models: 2 },
            { id: 'sales_forecast_q3', name: projectData.projectNames['sales_forecast_q3'], status: 'archived', lastActive: '5d ago', connectors: 2, models: 0 }
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
            ...data
        });
        this.projects.push(project);
        return project;
    }
}
