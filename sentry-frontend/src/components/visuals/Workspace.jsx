import React, { useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import { BrainCircuit, Play, X } from 'lucide-react';
import FeatureMindMap from './FeatureMindMap';
import Insights from './Insights';
import MindMapInspectorPanel from './MindMapInspectorPanel';
import './Workspace.css';

const Workspace = observer(({ viewState = 'engineering' }) => {
    const location = useLocation();
    const { workspaceStore } = useStore();
    const { ui, data, editor } = workspaceStore;

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

    const openCodeDocument = ({ title, code, type = 'python', recurrence = 'manual', payload = null }) => {
        editor.openCode({
            isOpen: true,
            nodeId: title,
            title,
            code,
            type,
            recurrence,
            payload
        });
    };

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

    const handleNodeClick = (node) => {
        if (node.type === 'action') {
            const code = [
                `# PNE transform draft for ${node.label}`,
                '',
                'def compile_virtual_transform(bronze_frame):',
                '    harmonized = harmonize_schema(bronze_frame)',
                '    aligned = normalize_timestamps(harmonized)',
                '    checked = apply_quality_guards(aligned)',
                '    return checked'
            ].join('\n');

            openCodeDocument({
                title: node.label,
                code,
                type: 'python',
                recurrence: 'daily'
            });
        } else if (node.type === 'card' && (node.data?.logic?.compiled_code || node.data?.logic?.code || node.data?.sqlString || node.data?.sql)) {
            openCodeDocument({
                title: `Logic: ${node.label}`,
                code: node.data?.logic?.compiled_code || node.data?.logic?.code || node.data?.sqlString || node.data?.sql,
                type: (node.data?.logic?.compiled_code || node.data?.logic?.code || '').trim().startsWith('{') ? 'json' : 'sql',
                recurrence: node.data?.activationMode === 'manual' ? 'manual' : 'realtime'
            });
        }
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
                            <span className="editor-lang-badge">{isInspector ? 'agent' : editor.type}</span>
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
                                onOpenCode={(artifact) => openCodeDocument({
                                    title: artifact.title,
                                    code: artifact.code,
                                    type: artifact.language,
                                    recurrence: 'manual',
                                    payload: editor.payload
                                })}
                            />
                        ) : (
                            <Editor
                                height="100%"
                                defaultLanguage={editor.type}
                                value={editor.code}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    fontFamily: 'JetBrains Mono, monospace',
                                    scrollBeyondLastLine: false,
                                    padding: { top: 16, bottom: 16 }
                                }}
                                onChange={(val) => editor.setCode(val)}
                            />
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
                        onNodeClick={handleNodeClick}
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
