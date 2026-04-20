import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { clsx } from 'clsx';
import {
    ArrowDown,
    ArrowUp,
    Eye,
    EyeOff,
    Plus,
    Trash2
} from 'lucide-react';
import { useStore } from '../../store/StoreProvider';

const FeatureMindMapOverlay = observer(() => {
    const { workspaceStore } = useStore();
    const store = workspaceStore.ui.activeMindMapStore;
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [draftGroupName, setDraftGroupName] = useState('');
    const [draftInsightName, setDraftInsightName] = useState('');

    if (!store?.ui.isInsightDockEditing) {
        return null;
    }

    const dockGroups = store.ui.insightDockGroups;
    const insightNodes = store.data.layout.nodes
        .filter((node) => node.type === 'card')
        .map((node) => store.ui.positionedNodeMap.get(node.id) || node);
    const activeDock = store.ui.activeInsightDock;
    const activeInsightNodes = activeDock.insightIds
        .map((id) => insightNodes.find((node) => node.id === id))
        .filter(Boolean);
    const visibleInsightCount = activeInsightNodes.filter((node) => store.ui.isInsightVisible(node.id)).length;

    if (insightNodes.length === 0) {
        return null;
    }

    const commitRename = () => {
        if (editingGroupId) {
            store.ui.renameInsightDock(editingGroupId, draftGroupName);
        }

        setEditingGroupId(null);
        setDraftGroupName('');
    };
    const createInsight = () => {
        const createdInsight = store.ui.createInsightCard(draftInsightName);
        if (createdInsight) {
            setDraftInsightName('');
        }
    };
    const stopWheel = (event) => {
        event.stopPropagation();
    };

    return (
        <div
            data-mindmap-interactive="true"
            className="fixed inset-0 z-[2200] bg-[#090B0E]/82 backdrop-blur-md"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onWheel={stopWheel}
            onWheelCapture={stopWheel}
        >
            <button
                type="button"
                className="absolute left-1/2 top-5 inline-flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-sky-300/30 bg-sky-500/[0.16] text-sky-100 shadow-[0_12px_28px_rgba(0,0,0,0.30)]"
                onClick={(event) => {
                    event.stopPropagation();
                    store.ui.closeInsightDockEditing();
                }}
                aria-label="Close"
                title="Close"
            >
                <ArrowDown size={15} />
            </button>

            <div className="flex h-full w-full items-start justify-center overflow-y-auto px-5 pb-8 pt-20">
                <div className="w-full max-w-3xl rounded-lg border border-white/10 bg-[#111317]/96 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.44)]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7F8B98]">Manage</div>
                            <div className="mt-1 truncate text-[16px] font-semibold text-white">{activeDock.name}</div>
                        </div>
                        <span className="shrink-0 text-[11px] text-[#8F9BA7]">
                            {visibleInsightCount}/{activeInsightNodes.length}
                        </span>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                        {dockGroups.map((group) => {
                            const isActive = store.ui.activeInsightDockId === group.id;
                            const isRenaming = editingGroupId === group.id;
                            const canRename = group.id !== 'overview';

                            return (
                                <div key={group.id}>
                                    {isRenaming ? (
                                        <input
                                            autoFocus
                                            value={draftGroupName}
                                            className="h-8 w-[128px] rounded-lg border border-sky-300/30 bg-sky-500/[0.14] px-3 text-[11px] font-medium text-sky-100 outline-none"
                                            onChange={(event) => setDraftGroupName(event.target.value)}
                                            onBlur={commitRename}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    commitRename();
                                                }

                                                if (event.key === 'Escape') {
                                                    setEditingGroupId(null);
                                                    setDraftGroupName('');
                                                }
                                            }}
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            className={clsx(
                                                'h-8 max-w-[150px] truncate rounded-lg border px-3 text-[11px] font-medium transition-colors',
                                                isActive
                                                    ? 'border-sky-300/30 bg-sky-500/[0.14] text-sky-100'
                                                    : 'border-white/10 bg-white/[0.04] text-[#AEB8C3] hover:border-white/18 hover:text-white'
                                            )}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                store.ui.setActiveInsightDock(group.id);
                                            }}
                                            onDoubleClick={(event) => {
                                                event.stopPropagation();
                                                if (!canRename) {
                                                    return;
                                                }

                                                setEditingGroupId(group.id);
                                                setDraftGroupName(group.name);
                                            }}
                                            title={canRename ? 'Click to select, double click to rename' : group.name}
                                        >
                                            {group.name}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        <button
                            type="button"
                            className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[11px] font-medium text-[#C8D1DB] hover:border-white/18 hover:text-white"
                            onClick={(event) => {
                                event.stopPropagation();
                                store.ui.createInsightDockGroup();
                            }}
                            aria-label="Create group"
                            title="Create group"
                        >
                            <Plus size={14} />
                            Group
                        </button>
                        {activeDock.id !== 'overview' && (
                            <button
                                type="button"
                                className="inline-flex h-8 items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-500/[0.08] px-3 text-[11px] font-medium text-rose-100 hover:border-rose-300/30"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    store.ui.deleteInsightDock(activeDock.id);
                                }}
                                aria-label="Delete group"
                                title="Delete group"
                            >
                                <Trash2 size={13} />
                                Delete
                            </button>
                        )}
                    </div>

                    <div className="mb-4 flex gap-2">
                        <input
                            value={draftInsightName}
                            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white outline-none placeholder:text-[#6F7A86] focus:border-sky-300/30"
                            placeholder="New card"
                            onChange={(event) => setDraftInsightName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    createInsight();
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-300/30 bg-sky-500/[0.14] px-3 text-[12px] font-medium text-sky-100"
                            onClick={(event) => {
                                event.stopPropagation();
                                createInsight();
                            }}
                        >
                            <Plus size={14} />
                            Card
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        {activeInsightNodes.map((node, index) => {
                            const isVisible = store.ui.isInsightVisible(node.id);
                            const VisibilityIcon = isVisible ? Eye : EyeOff;
                            const canMoveUp = index > 0;
                            const canMoveDown = index < activeInsightNodes.length - 1;

                            return (
                                <div
                                    key={node.id}
                                    className={clsx(
                                        'flex items-center gap-2 rounded-lg border px-2.5 py-2',
                                        isVisible
                                            ? 'border-white/10 bg-white/[0.035] text-[#DCE4EB]'
                                            : 'border-white/6 bg-[#0E1013]/70 text-[#7F8B98]'
                                    )}
                                >
                                    <span className="w-7 text-[11px] text-[#6F7A86]">{index + 1}</span>
                                    <button
                                        type="button"
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[#9BA7B4] disabled:opacity-30"
                                        disabled={!canMoveUp}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            store.ui.moveInsightInActiveDock(node.id, 'up');
                                        }}
                                        aria-label={`Move ${node.label} up`}
                                        title="More important"
                                    >
                                        <ArrowUp size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-flex h-8 min-w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] font-medium text-[#9BA7B4] disabled:opacity-30"
                                        disabled={!canMoveDown}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            store.ui.moveInsightInActiveDock(node.id, 'down');
                                        }}
                                        aria-label={`Move ${node.label} down`}
                                        title="Less important"
                                    >
                                        Less
                                    </button>
                                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{node.label}</span>
                                    <span className="hidden rounded-lg border border-white/10 px-2 py-1 text-[10px] font-medium text-[#8F9BA7] sm:inline-flex">
                                        {node.data?.activationMode || node.data?.activation_mode || 'manual'}
                                    </span>
                                    <button
                                        type="button"
                                        className={clsx(
                                            'inline-flex h-8 w-8 items-center justify-center rounded-lg border',
                                            isVisible
                                                ? 'border-sky-300/30 bg-sky-500/[0.14] text-sky-100'
                                                : 'border-white/10 bg-white/[0.03] text-[#7F8B98]'
                                        )}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            store.ui.toggleInsightVisibility(node.id);
                                        }}
                                        aria-label={isVisible ? `Hide ${node.label}` : `Show ${node.label}`}
                                        title={isVisible ? 'Hide card' : 'Show card'}
                                    >
                                        <VisibilityIcon size={14} />
                                    </button>
                                </div>
                            );
                        })}

                        {activeInsightNodes.length === 0 && (
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-6 text-center text-[12px] text-[#8F9BA7]">
                                No cards in this group.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default FeatureMindMapOverlay;
