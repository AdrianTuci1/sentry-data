import { makeAutoObservable } from "mobx";
import { OrganizationStore } from "./OrganizationStore";
import { ProjectStore } from "./ProjectStore";
import { WorkspaceRootStore } from "./workspace";
import { DockStore } from "./workspace/DockStore";
import { ShellStore } from "./ShellStore";

class RootStore {
    organizationStore;
    projectStore;
    workspaceStore;
    dockStore;
    shellStore;

    constructor() {
        this.organizationStore = new OrganizationStore(this);
        this.projectStore = new ProjectStore(this);
        this.workspaceStore = new WorkspaceRootStore(this);
        this.dockStore = new DockStore(this);
        this.shellStore = new ShellStore(this);
        makeAutoObservable(this);
        this.organizationStore.initialize();
    }
}

// Instantiate a singleton
export const rootStore = new RootStore();
