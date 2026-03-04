import { makeAutoObservable } from 'mobx';

export class UIStore {
    rootStore;
    activeTab = 'engineering';
    activeMenu = null;
    scale = 1;
    pan = { x: 0, y: 0 };
    isDragging = false;
    lastMousePos = { x: 0, y: 0 };
    selectedItems = new Set();

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
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

    initializeSelection(data) {
        if (!data) return;
        const initialSelection = new Set();
        const processItems = (items) => items?.forEach(item => {
            if (item.status !== 'error') initialSelection.add(item.id);
        });

        const { tables, metricGroups, predictionModels, advancedAnalytics, dashboards } = data;

        (tables || []).forEach(t => processItems(t.columns));
        (metricGroups || []).forEach(g => processItems(g.metrics));
        (predictionModels || []).forEach(m => processItems(m.predictions));
        (advancedAnalytics || []).forEach(g => processItems(g.items));
        (dashboards || []).forEach(g => processItems(g.items));

        this.selectedItems = initialSelection;
    }
}
