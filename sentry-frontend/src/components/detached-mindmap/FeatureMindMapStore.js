import { makeAutoObservable } from 'mobx';
import { FeatureMindMapDataStore } from './FeatureMindMapDataStore';
import { FeatureMindMapUIStore } from './FeatureMindMapUIStore';
import { FeatureMindMapDocumentsStore } from './FeatureMindMapDocumentsStore';

export class FeatureMindMapStore {
    workspaceStore;
    onNodeClick = null;
    data;
    ui;
    documents;

    constructor(workspaceStore, onNodeClick) {
        this.workspaceStore = workspaceStore;
        this.onNodeClick = onNodeClick;
        this.data = new FeatureMindMapDataStore(this);
        this.ui = new FeatureMindMapUIStore(this);
        this.documents = new FeatureMindMapDocumentsStore(this);

        makeAutoObservable(this, {
            workspaceStore: false,
            onNodeClick: false,
            data: false,
            ui: false,
            documents: false
        }, { autoBind: true });
    }

    get externalUI() {
        return this.workspaceStore.ui;
    }

    get externalDataStore() {
        return this.workspaceStore.data;
    }

    get editor() {
        return this.workspaceStore.editor;
    }

    setOnNodeClick(onNodeClick) {
        this.onNodeClick = onNodeClick;
    }

    openNodeMenu(event, node) {
        event.preventDefault();
        event.stopPropagation();
        this.ui.setActiveMenu(this.documents.buildNodeMenu(node));
    }

    handleNodeClick(node) {
        const nodeContext = this.data.buildNodeContext(node);
        this.documents.openInspectorDocument(`${node.label} Workspace`, this.data.buildNodeInspectorPayload(node, nodeContext), 'overview');
    }

    handlePendingLayerAction(event, node) {
        event.preventDefault();
        event.stopPropagation();
        this.ui.showPendingPreview(node.id);
    }

    toggleSelection(nodeId) {
        this.externalUI.toggleSelection(nodeId);
    }

    toggleGroup(nodeIds = []) {
        this.externalUI.toggleGroup(nodeIds);
    }

    toggleRecommendation(nodeId) {
        this.externalUI.toggleRecommendation(nodeId);
        this.ui.clearActiveMenu();
    }

    createRecommendedInsight(nodeId) {
        this.ui.startInsightCreation(nodeId, () => {
            this.externalUI.toggleRecommendation(nodeId);
        });
    }
}
