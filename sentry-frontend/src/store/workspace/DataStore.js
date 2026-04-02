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
    // New hierarchy getters
    get connector() { return this.data?.connector || []; }
    get actionType() { return this.data?.actionType || []; }
    get origin() { return this.data?.origin || []; }
    get adjustedData() { return this.data?.adjustedData || []; }
    get group() { return this.data?.group || []; }
    get insight() { return this.data?.insight || []; }
    get mindmapManifest() { return this.data?.mindmapManifest || null; }
    get mindmapYaml() { return this.data?.mindmapYaml || ''; }
    get sourceMetadata() { return this.data?.sourceMetadata || []; }
    get features() { return this.data?.features || []; }
    get meta() { return this.data?.meta || null; }

    get metrics() { return this.data?.metrics || { precision: 0, recall: 0, roi: 0 }; }
}
