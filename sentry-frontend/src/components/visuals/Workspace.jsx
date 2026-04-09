import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useLocation } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import { BrainCircuit, Play, X } from 'lucide-react';
import { createParrotRuntimeMock, createParrotRuntimeMockPlaybackStep, getParrotRuntimeMockPlaybackStages } from '../../mocks/parrotRuntimeMock';
import FeatureMindMap from './FeatureMindMap';
import Insights from './Insights';
import MindMapInspectorPanel from './MindMapInspectorPanel';
import './Workspace.css';

const normalizeEditorLanguage = (language) => {
    if (language === 'pandas') {
        return 'python';
    }

    if (language === 'text') {
        return 'plaintext';
    }

    return language || 'plaintext';
};

const getEditorHeight = (code = '', minLines = 10, maxLines = 24) => {
    const lineCount = String(code).split('\n').length;
    const visibleLines = Math.min(Math.max(lineCount, minLines), maxLines);
    return `${(visibleLines * 22) + 24}px`;
};

const getCodeBlockPath = (block, language) => {
    const normalizedId = (block.id || block.title || block.label || 'artifact')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .toLowerCase();

    const extensionByLanguage = {
        python: 'py',
        sql: 'sql',
        yaml: 'yaml',
        json: 'json',
        plaintext: 'txt'
    };

    return `mindmap/code/${normalizedId}.${extensionByLanguage[language] || 'txt'}`;
};

const CodeBlockEditor = ({ block }) => {
    const language = normalizeEditorLanguage(block.language);
    const [draftCode, setDraftCode] = useState(() => block.code || '');

    return (
        <div className="overflow-hidden border border-[#31343A] bg-[#141619]">
            <div className="flex items-center justify-between border-b border-[#2A2D31] px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-[#8E918F]">
                <span>{block.title || block.label}</span>
                <span>{block.language || 'code'}</span>
            </div>
            <Editor
                path={getCodeBlockPath(block, language)}
                height={getEditorHeight(draftCode)}
                language={language}
                value={draftCode}
                theme="vs-dark"
                onMount={(editorInstance) => {
                    const formatAction = editorInstance.getAction('editor.action.formatDocument');
                    if (formatAction) {
                        formatAction.run().catch(() => {});
                    }
                }}
                onChange={(value) => setDraftCode(value || '')}
                options={{
                    readOnly: false,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    glyphMargin: false,
                    folding: false,
                    lineDecorationsWidth: 10,
                    overviewRulerBorder: false,
                    overviewRulerLanes: 0,
                    renderLineHighlight: 'none',
                    padding: { top: 10, bottom: 10 },
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace'
                }}
            />
        </div>
    );
};

const CodeDocumentPanel = ({ editor }) => {
    const payload = editor.payload || {};
    const codeArtifacts = payload.codeArtifacts || [];

    if (payload.subjectType === 'Virtual Layer' && codeArtifacts.length > 0) {
        return (
            <div className="h-full overflow-auto bg-[#141619] px-6 py-6">
                <div className="mx-auto flex max-w-5xl flex-col gap-5">
                    {codeArtifacts.map((block, index) => (
                        <CodeBlockEditor
                            key={`${block.id || index}-${block.language || 'text'}-${block.code || ''}`}
                            block={block}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <Editor
            height="100%"
            language={normalizeEditorLanguage(editor.type)}
            value={editor.code}
            theme="vs-dark"
            options={{
                readOnly: false,
                minimap: { enabled: false },
                automaticLayout: true,
                fontSize: 14,
                fontFamily: 'JetBrains Mono, monospace',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 16, bottom: 16 }
            }}
            onChange={(val) => editor.setCode(val)}
        />
    );
};

const Workspace = observer(({ viewState = 'engineering' }) => {
    const location = useLocation();
    const { workspaceStore } = useStore();
    const { ui, data, editor } = workspaceStore;
    const [playbackState, setPlaybackState] = useState({
        isRunning: false,
        stageIndex: getParrotRuntimeMockPlaybackStages().length - 1
    });

    // Destructure from sub-stores
    const {
        activeTab,
        scale,
        pan,
        isDragging
    } = ui;

    const {
        metrics,
        features
    } = data;

    // Sync tab from URL
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const tab = queryParams.get('tab');
        if (tab && ['engineering', 'insights', 'results'].includes(tab)) {
            ui.setActiveTab(tab);
        } else if (!tab && location.pathname.includes('/project/')) {
            ui.setActiveTab('engineering');
        }
    }, [location.search, location.pathname, ui]);

    // Sync viewState prop with internal tab
    useEffect(() => {
        if (viewState === 'results') ui.setActiveTab('results');
    }, [viewState, ui]);

    useEffect(() => {
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        if (editor.isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        }

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, [editor.isOpen]);

    useEffect(() => {
        if (!playbackState.isRunning) {
            return undefined;
        }

        const stages = getParrotRuntimeMockPlaybackStages();
        const currentProjectId = workspaceStore.projectStore.currentProjectId || 'parrot-demo';

        if (playbackState.stageIndex >= stages.length - 1) {
            setPlaybackState({
                isRunning: false,
                stageIndex: stages.length - 1
            });
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            const nextStageIndex = playbackState.stageIndex + 1;
            workspaceStore.data.setData(createParrotRuntimeMockPlaybackStep(currentProjectId, nextStageIndex));
            setPlaybackState({
                isRunning: nextStageIndex < stages.length - 1,
                stageIndex: nextStageIndex
            });
        }, stages[playbackState.stageIndex].durationMs);

        return () => window.clearTimeout(timeoutId);
    }, [playbackState, workspaceStore]);

    const startDiscoveryPlayback = () => {
        const currentProjectId = workspaceStore.projectStore.currentProjectId || 'parrot-demo';
        workspaceStore.data.setData(createParrotRuntimeMockPlaybackStep(currentProjectId, 0));
        setPlaybackState({
            isRunning: true,
            stageIndex: 0
        });
    };

    const resetDiscoveryPlayback = () => {
        const currentProjectId = workspaceStore.projectStore.currentProjectId || 'parrot-demo';
        workspaceStore.data.setData(createParrotRuntimeMock(currentProjectId));
        setPlaybackState({
            isRunning: false,
            stageIndex: getParrotRuntimeMockPlaybackStages().length - 1
        });
    };



    const renderResults = () => {
        return (
            <div className="results-container">
                <h2 className="results-title">Model Performance</h2>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-label">Precision</div>
                        <div className="metric-value precision">{(metrics.precision * 100).toFixed(1)}%</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Recall</div>
                        <div className="metric-value recall">{(metrics.recall * 100).toFixed(1)}%</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Est. ROI</div>
                        <div className="metric-value roi">{metrics.roi}x</div>
                    </div>
                </div>
                <div className="features-card">
                    <h3 className="features-title">Feature Importance</h3>
                    <div className="features-list">
                        {features.map((f, i) => (
                            <div key={i}>
                                <div className="feature-item-header">
                                    <span>{f.name}</span>
                                    <span>{(f.val * 100).toFixed(0)}%</span>
                                </div>
                                <div className="feature-progress-track">
                                    <div className="feature-progress-bar" style={{ width: `${f.val * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderEditorModal = () => {
        if (!editor.isOpen) return null;

        const isInspector = editor.view === 'inspector';

        return (
            <div
                className="editor-overlay"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onWheelCapture={(event) => event.stopPropagation()}
            >
                <div
                    className="editor-modal"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onWheelCapture={(event) => event.stopPropagation()}
                >
                    {/* Header */}
                    <div className="editor-header">
                        <div className="editor-title-group">
                            <BrainCircuit size={18} color="#A8C7FA" />
                            <span className="editor-title">{editor.title}</span>
                            <span className="editor-lang-badge">{isInspector ? 'agent' : normalizeEditorLanguage(editor.type)}</span>
                        </div>
                        <button onClick={() => editor.close()} className="editor-close-btn">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Toolbar */}
                    {!isInspector && (
                        <div className="editor-toolbar">
                            <div className="editor-setting-group">
                                <span className="editor-setting-label">Recurrence:</span>
                                <select
                                    value={editor.recurrence}
                                    onChange={(e) => editor.setRecurrence(e.target.value)}
                                    className="editor-select"
                                >
                                    <option value="hourly">Hourly</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="realtime">Real-time Stream</option>
                                    <option value="manual">Manual</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }} />
                            <button className="editor-btn-run">
                                <Play size={14} /> Run Now
                            </button>
                        </div>
                    )}

                    {/* Editor */}
                    <div
                        className="editor-body"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        onWheelCapture={(event) => event.stopPropagation()}
                    >
                        {isInspector ? (
                            <MindMapInspectorPanel
                                editor={editor}
                                ui={ui}
                            />
                        ) : (
                            <CodeDocumentPanel editor={editor} />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const renderMindMap = () => {
        const handleMouseDown = (e) => {
            if (e.button === 2 || e.altKey || e.button === 0) {
                ui.setIsDragging(true);
                ui.setLastMousePos({ x: e.clientX, y: e.clientY });
            }
        };
        const handleMouseMove = (e) => {
            if (isDragging) {
                const { x: lastX, y: lastY } = ui.lastMousePos;
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                ui.setPan({ x: pan.x + dx, y: pan.y + dy });
                ui.setLastMousePos({ x: e.clientX, y: e.clientY });
            }
        };
        const handleMouseUp = () => ui.setIsDragging(false);
        const handleWheel = (e) => {
            const delta = -e.deltaY * 0.001;
            ui.setScale(Math.min(4, Math.max(0.2, scale + delta)));
        };

        return (
            <div className="mindmap-container">
                <div className="mindmap-controls">
                    <div className="mindmap-zoom-group">
                        <button
                            type="button"
                            className="mindmap-zoom-btn"
                            onClick={startDiscoveryPlayback}
                        >
                            <Play size={14} />
                            <span>Simulate Discovery</span>
                        </button>
                        <button
                            type="button"
                            className="mindmap-zoom-btn"
                            onClick={resetDiscoveryPlayback}
                        >
                            <X size={14} />
                            <span>Reset Full</span>
                        </button>
                    </div>
                    {data.meta?.discoveryPlayback && (
                        <div className="mindmap-playback-status">
                            <span>{data.meta.discoveryPlayback.label}</span>
                            <span>
                                {data.meta.discoveryPlayback.stage + 1}/{data.meta.discoveryPlayback.totalStages}
                            </span>
                        </div>
                    )}
                </div>
                <div
                    className="mindmap-canvas"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onContextMenu={(e) => e.preventDefault()}
                    onWheel={handleWheel}
                >
                    <FeatureMindMap
                        showCosts={true}
                    />
                    {renderEditorModal()}
                </div>

                <div className="mindmap-bg"
                    style={{
                        transform: `translate(${pan.x % 20}px, ${pan.y % 20}px)`
                    }}>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'engineering': return renderMindMap();
            case 'insights': return <Insights />;
            case 'results': return renderResults();
            default: return renderMindMap();
        }
    };

    return (
        <div className="workspace-container">
            <div className="workspace-content">
                {renderContent()}
            </div>
        </div>
    );
});

export default Workspace;
