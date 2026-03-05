import { makeAutoObservable } from "mobx";
import { OrganizationStore } from "./OrganizationStore";
import { ProjectStore } from "./ProjectStore";
import { WorkspaceRootStore } from "./workspace";
import { DockStore } from "./workspace/DockStore";

class RootStore {
    organizationStore;
    projectStore;
    workspaceStore;
    dockStore;

    constructor() {
        this.organizationStore = new OrganizationStore(this);
        this.projectStore = new ProjectStore(this);
        this.workspaceStore = new WorkspaceRootStore(this);
        this.dockStore = new DockStore(this);
        makeAutoObservable(this);
    }
}

// Instantiate a singleton
export const rootStore = new RootStore();
