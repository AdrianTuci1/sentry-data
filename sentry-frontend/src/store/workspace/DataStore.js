import { makeAutoObservable } from 'mobx';

export class DataStore {
    rootStore;
    data = null;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    setData(data) {
        this.data = data;
        // Notify UIStore to re-initialize selection when data changes
        this.rootStore.ui.initializeSelection(data);
    }

    // Computed properties for easy access to data subsets
    get tables() { return this.data?.tables || []; }
    get metricGroups() { return this.data?.metricGroups || []; }
    get predictionModels() { return this.data?.predictionModels || []; }
    get advancedAnalytics() { return this.data?.advancedAnalytics || []; }
    get dashboards() { return this.data?.dashboards || []; }
    get dashboardGroups() { return this.data?.dashboardGroups || []; }
    get metrics() { return this.data?.metrics || { precision: 0, recall: 0, roi: 0 }; }
    get features() { return this.data?.features || []; }
}
