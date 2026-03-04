import { makeAutoObservable } from "mobx";
import { OrganizationStore } from "./OrganizationStore";
import { ProjectStore } from "./ProjectStore";
import { WorkspaceRootStore } from "./workspace";

class RootStore {
    constructor() {
        this.organizationStore = new OrganizationStore(this);
        this.projectStore = new ProjectStore(this);
        this.workspaceStore = new WorkspaceRootStore(this);
        makeAutoObservable(this);
    }
}

// Instantiate a singleton
export const rootStore = new RootStore();
