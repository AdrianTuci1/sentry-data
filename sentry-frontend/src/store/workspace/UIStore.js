import { makeAutoObservable, observable } from 'mobx';

export class UIStore {
    rootStore;
    activeTab = 'engineering';
    activeMenu = null;
    scale = 1;
    pan = { x: 0, y: 0 };
    isDragging = false;
    lastMousePos = { x: 0, y: 0 };
    selectedItems = new Set();
    acceptedRecommendations = new Set();
    activeMindMapStore = null;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this, {
            rootStore: false,
            activeMindMapStore: observable.ref
        });
    }

    setActiveTab(tab) {
        this.activeTab = tab;
    }

    setActiveMenu(menu) {
        this.activeMenu = menu;
    }

    setScale(scale) {
        this.scale = scale;
    }

    setPan(pan) {
        this.pan = pan;
    }

    setIsDragging(isDragging) {
        this.isDragging = isDragging;
    }

    setLastMousePos(pos) {
        this.lastMousePos = pos;
    }

    toggleSelection(id) {
        if (this.selectedItems.has(id)) {
            this.selectedItems.delete(id);
        } else {
            this.selectedItems.add(id);
        }
    }

    toggleGroup(ids) {
        const allSelected = ids.every(id => this.selectedItems.has(id));
        if (allSelected) {
            ids.forEach(id => this.selectedItems.delete(id));
        } else {
            ids.forEach(id => this.selectedItems.add(id));
        }
    }

    isRecommendationAccepted(id) {
        return this.acceptedRecommendations.has(id);
    }

    toggleRecommendation(id) {
        if (this.acceptedRecommendations.has(id)) {
            this.acceptedRecommendations.delete(id);
        } else {
            this.acceptedRecommendations.add(id);
        }
    }

    resetRecommendations() {
        this.acceptedRecommendations = new Set();
    }

    setActiveMindMapStore(store) {
        this.activeMindMapStore = store;
    }

    clearActiveMindMapStore(store) {
        if (!store || this.activeMindMapStore === store) {
            this.activeMindMapStore = null;
        }
    }

    initializeSelection(data) {
        if (!data) return;
        this.resetRecommendations();
        const initialSelection = new Set();
        const { connector, actionType, adjustedData, insight } = data;

        const processList = (list) => list?.forEach(item => {
            if (item.status !== 'error') initialSelection.add(item.id);
        });

        const processColumns = (items) => items?.forEach(item => {
            if (item.status !== 'error') initialSelection.add(item.id);
        });

        processList(connector);
        processList(actionType);
        (adjustedData || []).forEach(adj => processColumns(adj.columns));
        processList(insight);

        this.selectedItems = initialSelection;
    }
}
