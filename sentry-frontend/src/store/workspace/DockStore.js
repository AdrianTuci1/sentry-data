import { makeAutoObservable } from 'mobx';

export class DockStore {
    rootStore;
    isRecommendationsOpen = false;

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
}
