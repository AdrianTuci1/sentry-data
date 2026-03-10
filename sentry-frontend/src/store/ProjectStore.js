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
    }

    get currentProject() {
        return this.projects.find(p => p.id === this.currentProjectId) || null;
    }

    get activeProjectsCount() {
        return this.projects.filter(p => p.status === 'active').length;
    }

    selectProject(projectId) {
        this.currentProjectId = projectId;
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
