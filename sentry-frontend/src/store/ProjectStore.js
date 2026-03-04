import { makeAutoObservable } from "mobx";
import { Project } from "./models";
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

    loadProjectsForOrg(orgId) {
        // Mock data fetching based on orgId
        // Currently, we just load the hardcoded list mapped from projectData.json

        const mockDbProjects = [
            { id: 'marketing_campaign_2024', name: projectData.projectNames['marketing_campaign_2024'], status: 'active', lastActive: '2 min ago', connectors: 3, models: 1 },
            { id: 'customer_churn_v1', name: projectData.projectNames['customer_churn_v1'], status: 'active', lastActive: '2h ago', connectors: 1, models: 2 },
            { id: 'sales_forecast_q3', name: projectData.projectNames['sales_forecast_q3'], status: 'archived', lastActive: '5d ago', connectors: 2, models: 0 }
        ];

        this.projects = mockDbProjects.map(data => new Project(data));

        // Ensure current project is valid or null
        if (!this.projects.some(p => p.id === this.currentProjectId)) {
            this.currentProjectId = null;
        }
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
