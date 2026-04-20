import { mockData } from './mockData';

class MockUIStore {
    scale = 1;
    pan = { x: 0, y: 0 };
    
    // We keep these empty since the standalone mode just mocks UI action events:
    toggleSelection() {}
    toggleGroup() {}
    toggleRecommendation() {}
    setActiveMindMapStore() {}
    clearActiveMindMapStore() {}
    isRecommendationAccepted() { return false; }
}

class MockDataStore {
    connector = mockData.connector;
    actionType = mockData.actionType;
    adjustedData = mockData.adjustedData;
    group = mockData.group;
    insight = mockData.insight;
    mindmapManifest = mockData.mindmapManifest;
    mindmapYaml = mockData.mindmapYaml;
    sourceMetadata = mockData.sourceMetadata;
}

class MockEditorStore {
    isOpen = false;
    
    openCode(config) {
        console.log('Mock Editor: Opened Code', config);
    }
    
    openInspector(config) {
        console.log('Mock Editor: Opened Inspector', config);
    }
}

class MockWorkspaceStore {
    ui = new MockUIStore();
    data = new MockDataStore();
    editor = new MockEditorStore();
    
    get externalUI() { return this.ui; }
    get externalDataStore() { return this.data; }
}

const mockWorkspaceStore = new MockWorkspaceStore();

export const useStore = () => {
    return {
        workspaceStore: mockWorkspaceStore
    };
};
