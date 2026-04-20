import { makeAutoObservable } from 'mobx';
import { CheckCircle2, Clock3, Code2, Info, Sparkles } from 'lucide-react';

export class FeatureMindMapDocumentsStore {
    root;

    constructor(root) {
        this.root = root;

        makeAutoObservable(this, {
            root: false
        }, { autoBind: true });
    }

    get editor() {
        return this.root.editor;
    }

    openCodeDocument(title, code, type = 'python', recurrence = 'manual', payload = null) {
        this.editor.openCode({
            isOpen: true,
            nodeId: title,
            title,
            code,
            type,
            recurrence,
            payload
        });

        this.root.ui.clearActiveMenu();
    }

    openInspectorDocument(title, payload, initialTab = 'overview') {
        this.editor.openInspector({
            isOpen: true,
            nodeId: title,
            title,
            payload,
            initialTab,
            type: 'python'
        });

        this.root.ui.clearActiveMenu();
    }

    getCodeDocumentTitle(nodeContext, artifact) {
        if (nodeContext?.label === 'Data Normalization') {
            return `Data Normalization · ${artifact.title}`;
        }

        if (nodeContext?.label === 'Virtual Layer') {
            return `Virtual Layer · ${artifact.title}`;
        }

        if (nodeContext?.label === 'Feature Engineering') {
            return `Feature Engineering · ${artifact.title}`;
        }

        return artifact.title;
    }

    getPrimaryCodeArtifact(nodeContext, codeArtifacts = []) {
        if (!Array.isArray(codeArtifacts) || codeArtifacts.length === 0) {
            return null;
        }

        if (nodeContext?.label === 'Feature Engineering') {
            return (
                codeArtifacts.find((artifact) => artifact.id?.endsWith('-editable'))
                || codeArtifacts.find((artifact) => artifact.id?.endsWith('-compiled'))
                || codeArtifacts[0]
            );
        }

        return codeArtifacts[0];
    }

    resolveOpenCodeDocument(node, nodeContext, inspectorPayload) {
        const codeArtifacts = inspectorPayload?.codeArtifacts || [];

        if (nodeContext?.label === 'Virtual Layer') {
            const logic = nodeContext?.details?.logic || {};
            const preferredCode = logic.code || logic.compiled_code || '';

            if (preferredCode) {
                return {
                    title: 'Virtual Layer · Editable Feature Logic',
                    code: preferredCode,
                    language: (preferredCode || '').toLowerCase().includes('select') ? 'sql' : 'python'
                };
            }
        }

        const primaryArtifact = this.getPrimaryCodeArtifact(nodeContext, codeArtifacts);
        if (!primaryArtifact) {
            return null;
        }

        return {
            title: this.getCodeDocumentTitle(nodeContext, primaryArtifact),
            code: primaryArtifact.code,
            language: primaryArtifact.language
        };
    }

    buildNodeMenu(node) {
        const nodeContext = this.root.data.buildNodeContext(node);
        const inspectorPayload = this.root.data.buildNodeInspectorPayload(node, nodeContext);
        const openCodeDocument = this.resolveOpenCodeDocument(node, nodeContext, inspectorPayload);
        const isRecommended = this.root.data.isNodeRecommended(node);
        const isAccepted = this.root.externalUI.isRecommendationAccepted(node.id);

        const actions = [
            {
                id: `${node.id}-workspace`,
                icon: Info,
                label: 'Open details',
                onSelect: () => this.openInspectorDocument(`${node.label} Workspace`, inspectorPayload, 'overview')
            }
        ];

        if (openCodeDocument) {
            actions.push({
                id: `${node.id}-logic`,
                icon: Code2,
                label: 'Open code',
                onSelect: () => this.openCodeDocument(
                    openCodeDocument.title,
                    openCodeDocument.code,
                    openCodeDocument.language,
                    'manual',
                    inspectorPayload
                )
            });
        }

        if (!openCodeDocument && inspectorPayload.suggestions?.length > 0) {
            actions.push({
                id: `${node.id}-suggestions`,
                icon: Sparkles,
                label: 'Open suggestions',
                onSelect: () => this.openInspectorDocument(`${node.label} Suggestions`, inspectorPayload, 'suggestions')
            });
        }

        if (isRecommended) {
            actions.push({
                id: `${node.id}-toggle-recommendation`,
                icon: isAccepted ? CheckCircle2 : Clock3,
                label: isAccepted ? 'Mark pending' : 'Approve',
                onSelect: () => this.root.toggleRecommendation(node.id)
            });
        }

        return {
            kind: 'node',
            title: node.label,
            subtitle: nodeContext.label,
            x: node.type === 'source' ? node.x + 20 : node.x + 28,
            y: node.y - 12,
            transform: 'translate(0, -10%)',
            actions
        };
    }
}
