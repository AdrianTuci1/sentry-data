import { makeAutoObservable } from "mobx";
import { Organization } from "./models";

export class OrganizationStore {
    rootStore = null;
    organizations = [];
    currentOrgId = null;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);

        // Mock Initial Data
        this.organizations = [
            new Organization({ id: 'org_sentry', name: 'Sentry Data' })
        ];
        this.currentOrgId = 'org_sentry';
    }

    get currentOrg() {
        return this.organizations.find(org => org.id === this.currentOrgId) || null;
    }

    selectOrg(orgId) {
        if (this.organizations.some(org => org.id === orgId)) {
            this.currentOrgId = orgId;
            // When switching orgs, we'd normally clear or re-fetch projects
            this.rootStore.projectStore.loadProjectsForOrg(orgId);
        }
    }

    addOrganization(data) {
        const newOrg = new Organization(data);
        this.organizations.push(newOrg);
        return newOrg;
    }
}
