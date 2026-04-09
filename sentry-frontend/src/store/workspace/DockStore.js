import { makeAutoObservable } from 'mobx';

export class DockStore {
    rootStore;
    isRecommendationsOpen = false;
    projectEditor = {
        isOpen: false,
        mode: 'create',
        project: null,
    };
    memberInvite = {
        isOpen: false,
    };

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    setRecommendationsOpen(isOpen) {
        this.isRecommendationsOpen = isOpen;
    }

    toggleRecommendations() {
        this.isRecommendationsOpen = !this.isRecommendationsOpen;
    }

    openProjectEditor(mode = 'create', project = null) {
        this.projectEditor = {
            isOpen: true,
            mode,
            project,
        };
    }

    closeProjectEditor() {
        this.projectEditor = {
            isOpen: false,
            mode: 'create',
            project: null,
        };
    }

    openMemberInvite() {
        this.memberInvite = {
            isOpen: true,
        };
    }

    closeMemberInvite() {
        this.memberInvite = {
            isOpen: false,
        };
    }
}
