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

    applyRuntimeMindMapPartial(partial) {
        const patch = partial?.discoveryPatch || {};
        const current = this.data || {};
        const runtimeMindmapPartials = [
            ...(current.runtimeMindmapPartials || []),
            {
                requestId: partial?.requestId,
                stage: partial?.stage,
                emittedAt: partial?.emittedAt,
                projectionPlanPreview: patch.projectionPlanPreview || null
            }
        ].slice(-20);

        this.data = {
            ...current,
            ...patch,
            connector: patch.connector || current.connector || [],
            actionType: patch.actionType || current.actionType || [],
            origin: patch.origin || current.origin || [],
            adjustedData: patch.adjustedData || current.adjustedData || [],
            group: patch.group || current.group || [],
            insight: patch.insight || current.insight || [],
            sourceMetadata: patch.sourceMetadata || current.sourceMetadata || [],
            projectionSpecs: patch.projectionSpecs || current.projectionSpecs || [],
            querySpecs: patch.querySpecs || current.querySpecs || [],
            mlRecommendations: patch.mlRecommendations || current.mlRecommendations || [],
            invalidationHints: patch.invalidationHints || current.invalidationHints || [],
            sentinelModelSignals: patch.sentinelModelSignals || current.sentinelModelSignals || [],
            runtimeMindmapPartials,
            runtimeMindmapStage: partial?.stage || current.runtimeMindmapStage || null
        };

        this.rootStore.ui.initializeSelection(this.data);
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
    get runtimeMindmapPartials() { return this.data?.runtimeMindmapPartials || []; }
    get runtimeMindmapStage() { return this.data?.runtimeMindmapStage || null; }
    get features() { return this.data?.features || []; }
    get meta() { return this.data?.meta || null; }

    get metrics() { return this.data?.metrics || { precision: 0, recall: 0, roi: 0 }; }
}
