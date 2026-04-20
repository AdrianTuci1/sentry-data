import React, { useState, useEffect, useMemo, useRef } from 'react';
import './Insights.css';
import MicroGraphicCard from './MicroGraphicCard';
import { useStore } from '../../store/StoreProvider';
import { ProjectService } from '../../api/core';
import { observer } from 'mobx-react-lite';
import { Grip, Star, Building2, LayoutGrid } from 'lucide-react';
import fallbackAnalyticsData from '../../data/analyticsData-marketing.json'

const CUSTOM_ORDER_STORAGE_KEY = 'sentry-insights-widget-order-v1';

const MOST_RELEVANT_ORDER = {
    'marketing-roas': 1,
    'attribution-models': 2,
    'data-scatter': 3,
    'sales-funnel': 4,
    'income-density': 5,
    'creative-quadrant': 6,
    'shapley-attribution': 7,
    'financial-waterfall': 8,
    'market-sentiment': 9,
    'revenue-forecast': 10,
    'romania-3d': 11,
};

const CLIENT_ORDER = {
    'romania-3d': 1,
    'stat-leads': 2,
    'top-routes': 3,
    'market-sentiment': 4,
    'creative-quadrant': 5,
    'sales-funnel': 6,
    'income-density': 7,
    'attribution-models': 8,
    'data-scatter': 9,
    'shapley-attribution': 10,
    'trend-spotter': 11,
};

const getSortIndex = (widget, sortMode, fallbackIndex) => {
    if (sortMode === 'overview') {
        return widget.overviewIndex ?? fallbackIndex + 1;
    }

    if (sortMode === 'client') {
        return widget.clientIndex ?? CLIENT_ORDER[widget.id] ?? fallbackIndex + 100;
    }

    return widget.relevanceIndex ?? MOST_RELEVANT_ORDER[widget.id] ?? fallbackIndex + 100;
};

const readStoredWidgetOrder = () => {
    if (typeof window === 'undefined') return [];

    try {
        const parsedOrder = JSON.parse(window.localStorage.getItem(CUSTOM_ORDER_STORAGE_KEY) || '[]');
        return Array.isArray(parsedOrder) ? parsedOrder.filter(Boolean) : [];
    } catch (error) {
        console.warn('[Insights] Failed to read stored widget order.', error);
        return [];
    }
};

const storeWidgetOrder = (order) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(CUSTOM_ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch (error) {
        console.warn('[Insights] Failed to store widget order.', error);
    }
};

const orderWidgetsByIds = (widgets, orderedIds) => {
    const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));
    const orderedWidgets = orderedIds
        .map((id) => widgetsById.get(id))
        .filter(Boolean);
    const remainingWidgets = widgets.filter((widget) => !orderedIds.includes(widget.id));

    return [...orderedWidgets, ...remainingWidgets];
};

const moveIdToIndex = (orderedIds, sourceId, targetIndex) => {
    const nextOrder = orderedIds.filter((id) => id !== sourceId);
    const boundedIndex = Math.max(0, Math.min(targetIndex, nextOrder.length));

    nextOrder.splice(boundedIndex, 0, sourceId);
    return nextOrder;
};

const getWidgetGridSize = (widget, columnCount) => {
    const gridSpan = widget?.gridSpan || '';
    const requestedColumns = gridSpan.includes('col-span-3') ? 3 : gridSpan.includes('col-span-2') ? 2 : 1;
    const columnSpan = Math.min(requestedColumns, columnCount);
    const rowSpan = gridSpan.includes('row-span-2') ? 2 : 1;

    return { columnSpan, rowSpan };
};

const canPlaceWidget = (occupiedCells, row, column, columnSpan, rowSpan, columnCount) => {
    if (column + columnSpan > columnCount) return false;

    for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
            if (occupiedCells[row + rowOffset]?.[column + columnOffset]) {
                return false;
            }
        }
    }

    return true;
};

const markWidgetCells = (occupiedCells, row, column, columnSpan, rowSpan) => {
    for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        const targetRow = row + rowOffset;
        occupiedCells[targetRow] = occupiedCells[targetRow] || [];

        for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
            occupiedCells[targetRow][column + columnOffset] = true;
        }
    }
};

const getWidgetPlacements = (widgets, columnCount) => {
    const occupiedCells = [];
    const placements = new Map();

    widgets.forEach((widget) => {
        const { columnSpan, rowSpan } = getWidgetGridSize(widget, columnCount);
        let row = 0;
        let column = 0;
        let wasPlaced = false;

        while (!wasPlaced) {
            for (column = 0; column < columnCount; column += 1) {
                if (canPlaceWidget(occupiedCells, row, column, columnSpan, rowSpan, columnCount)) {
                    markWidgetCells(occupiedCells, row, column, columnSpan, rowSpan);
                    placements.set(widget.id, {
                        gridColumn: `${column + 1} / span ${columnSpan}`,
                        gridRow: `${row + 1} / span ${rowSpan}`,
                    });
                    wasPlaced = true;
                    break;
                }
            }

            if (!wasPlaced) {
                row += 1;
            }
        }
    });

    return placements;
};

const Insights = observer(() => {
    const { projectStore } = useStore();
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [analyticsData, setAnalyticsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [customWidgetOrder, setCustomWidgetOrder] = useState(readStoredWidgetOrder);
    const [sortMode, setSortMode] = useState(() => (readStoredWidgetOrder().length > 0 ? 'custom' : 'overview'));
    const [draggedCardId, setDraggedCardId] = useState(null);
    const [dragOverCardId, setDragOverCardId] = useState(null);
    const [dragPreviewOrder, setDragPreviewOrder] = useState(null);
    const [gridColumnCount, setGridColumnCount] = useState(() => (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 4 : 2));
    const gridRef = useRef(null);
    const draggedCardIdRef = useRef(null);
    const dragPreviewOrderRef = useRef(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            const projectId = projectStore.currentProjectId;
            if (!projectId) {
                setAnalyticsData(fallbackAnalyticsData);
                setIsLoading(false);
                return;
            }

            try {
                const res = await ProjectService.getAnalytics(projectId);
                const dashboards = res?.data?.dashboards || res?.dashboards || [];

                if (dashboards.length > 0) {
                    setAnalyticsData(dashboards);
                } else {
                    setAnalyticsData(fallbackAnalyticsData);
                }
            } catch (error) {
                console.warn("[Insights] Failed to fetch analytics from backend.", error);
                setAnalyticsData(fallbackAnalyticsData);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, [projectStore.currentProjectId]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const updateGridColumnCount = () => {
            setGridColumnCount(window.innerWidth >= 1024 ? 4 : 2);
        };

        window.addEventListener('resize', updateGridColumnCount);

        return () => window.removeEventListener('resize', updateGridColumnCount);
    }, []);

    const sortedAnalyticsData = useMemo(() => (
        [...analyticsData]
            .map((widget, index) => ({ widget, baseIndex: index }))
            .sort((left, right) => {
                const sortPreset = sortMode === 'custom' ? 'overview' : sortMode;
                const leftScore = getSortIndex(left.widget, sortPreset, left.baseIndex);
                const rightScore = getSortIndex(right.widget, sortPreset, right.baseIndex);

                if (leftScore !== rightScore) {
                    return leftScore - rightScore;
                }

                return left.baseIndex - right.baseIndex;
            })
            .map(({ widget }) => widget)
    ), [analyticsData, sortMode]);

    const orderedAnalyticsData = useMemo(() => {
        if (dragPreviewOrder?.length) {
            return orderWidgetsByIds(sortedAnalyticsData, dragPreviewOrder);
        }

        if (sortMode !== 'custom' || !customWidgetOrder.length) {
            return sortedAnalyticsData;
        }

        return orderWidgetsByIds(sortedAnalyticsData, customWidgetOrder);
    }, [customWidgetOrder, dragPreviewOrder, sortMode, sortedAnalyticsData]);

    const widgetPlacements = useMemo(() => (
        getWidgetPlacements(orderedAnalyticsData, gridColumnCount)
    ), [gridColumnCount, orderedAnalyticsData]);

    const handleCardClick = (id) => {
        if (window.innerWidth >= 1024) return;

        if (expandedCardId === id) {
            setExpandedCardId(null);
        } else {
            setExpandedCardId(id);
        }
    };

    const handleDragStart = (event, id) => {
        event.stopPropagation();
        draggedCardIdRef.current = id;
        dragPreviewOrderRef.current = orderedAnalyticsData.map((widget) => widget.id);
        setDraggedCardId(id);
        setDragOverCardId(null);
        setDragPreviewOrder(dragPreviewOrderRef.current);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
    };

    const getPointerPreviewOrder = (event, sourceId) => {
        const gridElement = gridRef.current;
        const baseOrder = dragPreviewOrderRef.current?.length
            ? dragPreviewOrderRef.current
            : orderedAnalyticsData.map((widget) => widget.id);

        if (!gridElement || !sourceId) {
            return { nextOrder: baseOrder, targetId: null };
        }

        const candidates = Array.from(gridElement.querySelectorAll('[data-widget-id]'))
            .map((element) => ({
                element,
                id: element.dataset.widgetId,
                rect: element.getBoundingClientRect(),
            }))
            .filter((candidate) => candidate.id && candidate.id !== sourceId);

        if (!candidates.length) {
            return { nextOrder: baseOrder, targetId: null };
        }

        const closestCandidate = candidates.reduce((closest, candidate) => {
            const centerX = candidate.rect.left + (candidate.rect.width / 2);
            const centerY = candidate.rect.top + (candidate.rect.height / 2);
            const distance = ((event.clientX - centerX) ** 2) + ((event.clientY - centerY) ** 2);

            if (!closest || distance < closest.distance) {
                return { ...candidate, distance, centerX, centerY };
            }

            return closest;
        }, null);

        const orderWithoutSource = baseOrder.filter((id) => id !== sourceId);
        const targetIndex = orderWithoutSource.indexOf(closestCandidate.id);

        if (targetIndex === -1) {
            return { nextOrder: baseOrder, targetId: null };
        }

        const verticalBias = Math.abs(event.clientY - closestCandidate.centerY) > closestCandidate.rect.height * 0.25;
        const shouldPlaceAfter = verticalBias
            ? event.clientY > closestCandidate.centerY
            : event.clientX > closestCandidate.centerX;
        const insertionIndex = targetIndex + (shouldPlaceAfter ? 1 : 0);

        return {
            nextOrder: moveIdToIndex(baseOrder, sourceId, insertionIndex),
            targetId: closestCandidate.id,
        };
    };

    const previewDragMove = (event) => {
        const sourceId = draggedCardIdRef.current || event.dataTransfer.getData('text/plain');
        if (!sourceId || expandedCardId) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const { nextOrder, targetId } = getPointerPreviewOrder(event, sourceId);
        const currentOrder = dragPreviewOrderRef.current;
        const didOrderChange = !currentOrder || nextOrder.some((id, index) => id !== currentOrder[index]);

        setDragOverCardId(targetId);

        if (didOrderChange) {
            dragPreviewOrderRef.current = nextOrder;
            setDragPreviewOrder(nextOrder);
        }
    };

    const handleDragOver = (event, id) => {
        if (!draggedCardIdRef.current || draggedCardIdRef.current === id || expandedCardId) return;

        previewDragMove(event);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const sourceId = event.dataTransfer.getData('text/plain') || draggedCardIdRef.current;
        const nextOrder = dragPreviewOrderRef.current?.length
            ? dragPreviewOrderRef.current
            : orderedAnalyticsData.map((widget) => widget.id);
        draggedCardIdRef.current = null;
        dragPreviewOrderRef.current = null;
        setDraggedCardId(null);
        setDragOverCardId(null);
        setDragPreviewOrder(null);

        if (!sourceId) return;

        setCustomWidgetOrder(nextOrder);
        storeWidgetOrder(nextOrder);
        setSortMode('custom');
    };

    const handleDragEnd = () => {
        draggedCardIdRef.current = null;
        dragPreviewOrderRef.current = null;
        setDraggedCardId(null);
        setDragOverCardId(null);
        setDragPreviewOrder(null);
    };

    if (isLoading) {
        return <div className="insights-container"><div className="insights-header"><h1 className="insights-title">Loading...</h1></div></div>;
    }

    return (
        <div className="insights-container">
            <div className="insights-header">
                <div className="insights-meta-chips">
                    <button
                        type="button"
                        className={`insights-chip ${sortMode === 'overview' ? 'insights-chip-active' : ''}`}
                        onClick={() => setSortMode('overview')}
                    >
                        <LayoutGrid size={14} strokeWidth={2.1} />
                        <span>Overview</span>
                    </button>
                    <button
                        type="button"
                        className={`insights-chip ${sortMode === 'most-relevant' ? 'insights-chip-active insights-chip-accent' : ''}`}
                        onClick={() => setSortMode('most-relevant')}
                    >
                        <Star size={14} strokeWidth={2.1} />
                        <span>Most Relevant</span>
                    </button>
                    <button
                        type="button"
                        className={`insights-chip ${sortMode === 'client' ? 'insights-chip-active' : ''}`}
                        onClick={() => setSortMode('client')}
                    >
                        <Building2 size={14} strokeWidth={2.1} />
                        <span>Client</span>
                    </button>
                    {customWidgetOrder.length > 0 && (
                        <button
                            type="button"
                            className={`insights-chip ${sortMode === 'custom' ? 'insights-chip-active' : ''}`}
                            onClick={() => setSortMode('custom')}
                        >
                            <Grip size={14} strokeWidth={2.1} />
                            <span>Custom</span>
                        </button>
                    )}
                </div>
            </div>

            <div
                ref={gridRef}
                className={`insights-grid ${expandedCardId ? 'has-expanded' : ''}`}
                onDragOver={previewDragMove}
                onDrop={handleDrop}
            >
                {orderedAnalyticsData.length > 0 ? (
                    orderedAnalyticsData.map((data) => {
                        const isExpanded = expandedCardId === data.id;
                        if (expandedCardId && !isExpanded) return null;

                        return (
                            <MicroGraphicCard
                                key={data.id}
                                data={data}
                                isExpanded={isExpanded}
                                isDragging={draggedCardId === data.id}
                                isDragTarget={dragOverCardId === data.id}
                                gridPlacement={widgetPlacements.get(data.id)}
                                onClick={handleCardClick}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onDragEnd={handleDragEnd}
                            />
                        );
                    })
                ) : (
                    <div className="nothing-to-see">
                        <p>Nothing to see here</p>
                    </div>
                )}
            </div>

            {expandedCardId && (
                <div className="expanded-details-section animate-fade-in">
                    <h2 className="details-header">Detailed Analysis</h2>
                    <div className="details-content-box">
                        <p>This section loads the detailed breakdown component associated with the selected analytic.</p>
                        <p>The micrographics render as a large top banner, while complex data tables, graphs, and trends populate here dynamically, maintaining the single-page application experience.</p>
                    </div>
                </div>
            )}
        </div>
    );
});

export default Insights;
