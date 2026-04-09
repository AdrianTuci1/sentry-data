import { makeAutoObservable } from 'mobx';

const DEFAULT_NODE_HEIGHTS = {
    source: 96,
    action: 72,
    category: 84,
    group: 72,
    card: 84,
    idea: 60
};

const COLUMN_NODE_GAP = 26;

export class FeatureMindMapUIStore {
    root;
    hoveredNodeId = null;
    activeMenu = null;
    pendingPreviewSourceId = null;
    creatingInsightIds = new Set();
    creatingInsightTimers = new Map();
    nodeHeights = new Map();
    overviewInsightIds = new Set();
    customInsightGroups = [];
    activeInsightDockId = 'overview';
    nextInsightGroupIndex = 0;
    isInsightDockEditing = false;

    constructor(root) {
        this.root = root;

        makeAutoObservable(this, {
            root: false
        }, { autoBind: true });
    }

    get scale() {
        return this.root.externalUI.scale;
    }

    get pan() {
        return this.root.externalUI.pan;
    }

    setHoveredNodeId(nodeId) {
        this.hoveredNodeId = nodeId;
    }

    clearHoveredNode() {
        this.hoveredNodeId = null;
    }

    setActiveMenu(menu) {
        this.activeMenu = menu;
    }

    clearActiveMenu() {
        this.activeMenu = null;
    }

    showPendingPreview(sourceId) {
        this.pendingPreviewSourceId = sourceId;
        this.clearActiveMenu();
    }

    clearPendingPreview() {
        this.pendingPreviewSourceId = null;
    }

    startInsightCreation(insightId, onComplete) {
        if (!insightId || this.creatingInsightIds.has(insightId)) {
            return;
        }

        this.creatingInsightIds.add(insightId);

        const timerId = window.setTimeout(() => {
            this.creatingInsightIds.delete(insightId);
            this.creatingInsightTimers.delete(insightId);
            onComplete?.();
        }, 1200);

        this.creatingInsightTimers.set(insightId, timerId);
    }

    isInsightCreating(insightId) {
        return this.creatingInsightIds.has(insightId);
    }

    syncInsightDock(insightIds = []) {
        const currentIds = new Set(insightIds);

        if (this.overviewInsightIds.size === 0 && insightIds.length > 0) {
            this.overviewInsightIds = new Set(insightIds);
        } else {
            this.overviewInsightIds = new Set(
                [...this.overviewInsightIds].filter((id) => currentIds.has(id))
            );

            insightIds.forEach((id) => {
                if (!this.overviewInsightIds.has(id)) {
                    this.overviewInsightIds.add(id);
                }
            });
        }

        this.customInsightGroups = this.customInsightGroups.map((group) => ({
            ...group,
            insightIds: group.insightIds.filter((id) => currentIds.has(id))
        }));
    }

    createInsightDockGroup() {
        const nextIndex = this.nextInsightGroupIndex + 1;
        const id = `dock-group-${nextIndex}`;
        const seedInsightIds = [...this.activeInsightDock.insightIds];
        this.customInsightGroups.push({
            id,
            name: `Group ${nextIndex}`,
            insightIds: seedInsightIds
        });
        this.activeInsightDockId = id;
        this.nextInsightGroupIndex = nextIndex;
    }

    setActiveInsightDock(id) {
        this.activeInsightDockId = id;
    }

    renameInsightDock(id, name) {
        if (!id || id === 'overview') {
            return;
        }

        const trimmedName = String(name || '').trim();
        if (!trimmedName) {
            return;
        }

        this.customInsightGroups = this.customInsightGroups.map((group) => (
            group.id === id
                ? { ...group, name: trimmedName }
                : group
        ));
    }

    deleteInsightDock(id) {
        if (!id || id === 'overview') {
            return;
        }

        this.customInsightGroups = this.customInsightGroups.filter((group) => group.id !== id);

        if (this.activeInsightDockId === id) {
            this.activeInsightDockId = 'overview';
        }
    }

    toggleInsightDockEditing() {
        this.isInsightDockEditing = !this.isInsightDockEditing;
    }

    toggleInsightVisibility(insightId) {
        if (this.activeInsightDockId === 'overview') {
            if (this.overviewInsightIds.has(insightId)) {
                this.overviewInsightIds.delete(insightId);
            } else {
                this.overviewInsightIds.add(insightId);
            }

            return;
        }

        this.customInsightGroups = this.customInsightGroups.map((group) => {
            if (group.id !== this.activeInsightDockId) {
                return group;
            }

            const hasInsight = group.insightIds.includes(insightId);
            return {
                ...group,
                insightIds: hasInsight
                    ? group.insightIds.filter((id) => id !== insightId)
                    : group.insightIds.concat(insightId)
            };
        });
    }

    get insightDockGroups() {
        return [
            {
                id: 'overview',
                name: 'Overview',
                insightIds: [...this.overviewInsightIds]
            },
            ...this.customInsightGroups
        ];
    }

    get activeInsightDock() {
        return this.insightDockGroups.find((group) => group.id === this.activeInsightDockId) || this.insightDockGroups[0] || {
            id: 'overview',
            name: 'Overview',
            insightIds: []
        };
    }

    isInsightVisible(insightId) {
        return this.activeInsightDock.insightIds.includes(insightId);
    }

    handleWindowPointerDown(event) {
        if (!event.target.closest('[data-mindmap-interactive="true"]')) {
            this.clearActiveMenu();
            this.clearPendingPreview();
        }
    }

    handleWindowKeyDown(event) {
        if (event.key === 'Escape') {
            this.clearActiveMenu();
            this.clearPendingPreview();
        }
    }

    getViewportStyle(x, y, transform = 'translate(-50%, -100%)') {
        return {
            left: `calc(50% + ${this.pan.x + (x * this.scale)}px)`,
            top: `calc(50% + ${this.pan.y + (y * this.scale)}px)`,
            transform
        };
    }

    measureNode(nodeId, element) {
        if (!element) {
            return;
        }

        const measuredHeight = element.offsetHeight;
        if (!measuredHeight || this.nodeHeights.get(nodeId) === measuredHeight) {
            return;
        }

        this.nodeHeights.set(nodeId, measuredHeight);
    }

    getNodeHeight(node) {
        return this.nodeHeights.get(node.id) || DEFAULT_NODE_HEIGHTS[node.type] || 72;
    }

    resolveColumnNodes(nodes) {
        const sortedNodes = [...nodes].sort((left, right) => {
            if (left.y !== right.y) {
                return left.y - right.y;
            }

            return left.id.localeCompare(right.id);
        });

        if (sortedNodes.length <= 1) {
            return sortedNodes;
        }

        const resolvedNodes = [];

        sortedNodes.forEach((node, index) => {
            const currentHalfHeight = this.getNodeHeight(node) / 2;
            const previousNode = resolvedNodes[index - 1];
            const previousBottom = previousNode
                ? previousNode.y + (this.getNodeHeight(previousNode) / 2)
                : null;

            const nextY = previousBottom == null
                ? node.y
                : Math.max(node.y, previousBottom + COLUMN_NODE_GAP + currentHalfHeight);

            resolvedNodes.push({
                ...node,
                y: nextY
            });
        });

        return resolvedNodes;
    }

    get positionedNodes() {
        const rawNodes = this.root.data.layout.nodes;
        const nodesByColumn = new Map();

        rawNodes.forEach((node) => {
            const columnKey = String(node.x);

            if (!nodesByColumn.has(columnKey)) {
                nodesByColumn.set(columnKey, []);
            }

            nodesByColumn.get(columnKey).push(node);
        });

        const resolvedNodesById = new Map();
        nodesByColumn.forEach((columnNodes) => {
            this.resolveColumnNodes(columnNodes).forEach((node) => {
                resolvedNodesById.set(node.id, node);
            });
        });

        return rawNodes.map((node) => resolvedNodesById.get(node.id) || node);
    }

    get positionedNodeMap() {
        return new Map(this.positionedNodes.map((node) => [node.id, node]));
    }

    get activeTrace() {
        if (!this.hoveredNodeId) {
            return null;
        }

        const visitedNodes = new Set([this.hoveredNodeId]);
        const visitedEdges = new Set();
        const queue = [this.hoveredNodeId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            const currentNode = this.root.data.nodeMap.get(currentId);

            if (!currentNode) {
                continue;
            }

            this.root.data.layout.edges.forEach((edge) => {
                if (edge.targetId !== currentId) {
                    return;
                }

                visitedEdges.add(edge.id);

                if (!edge.sourceId || visitedNodes.has(edge.sourceId)) {
                    return;
                }

                const sourceNode = this.root.data.nodeMap.get(edge.sourceId);
                visitedNodes.add(edge.sourceId);

                const shouldStopTrace = sourceNode?.type === 'idea' || sourceNode?.type === 'category';
                if (!shouldStopTrace) {
                    queue.push(edge.sourceId);
                }
            });
        }

        return { nodes: visitedNodes, edges: visitedEdges };
    }

    isEdgeDimmed(edge) {
        return this.activeTrace ? !this.activeTrace.edges.has(edge.id) : false;
    }

    isNodeDimmed(node) {
        return this.activeTrace ? !this.activeTrace.nodes.has(node.id) : false;
    }

    get edgeViewModels() {
        return this.root.data.layout.edges.map((edge) => {
            const isTrace = this.activeTrace ? this.activeTrace.edges.has(edge.id) : false;

            return {
                edge,
                isTrace,
                isDimmed: this.isEdgeDimmed(edge),
                path: `M ${edge.source.x} ${edge.source.y}
                    C ${edge.source.x + 100} ${edge.source.y},
                      ${edge.target.x - 100} ${edge.target.y},
                      ${edge.target.x} ${edge.target.y}`
            };
        });
    }

    get nodeViewModels() {
        return this.positionedNodes
            .map((node) => this.root.data.buildNodeViewModel(node, {
                isDimmed: this.isNodeDimmed(node),
                isTraceActive: this.activeTrace ? this.activeTrace.nodes.has(node.id) : false
            }));
    }

    get pendingPreview() {
        if (!this.pendingPreviewSourceId) {
            return null;
        }

        const sourceNode = this.positionedNodeMap.get(this.pendingPreviewSourceId) || this.root.data.nodeMap.get(this.pendingPreviewSourceId);
        if (!sourceNode) {
            return null;
        }

        const ghostWidth = 260;
        const ghostX = this.root.data.layout.X_ADJUSTED ?? -380;
        const ghostY = sourceNode.y;

        return {
            sourceNode,
            ghostNode: {
                id: `ghost-${sourceNode.id}`,
                type: 'category',
                label: 'Virtual Layer',
                x: ghostX,
                y: ghostY,
                width: ghostWidth
            }
        };
    }
}
