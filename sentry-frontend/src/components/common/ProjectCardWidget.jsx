import React, { useEffect, useMemo, useState } from 'react';
import { prepareMicroGraphicData, resolveMicroGraphicComponent } from '../visuals/micrographics/registry';
import { getDefaultProjectCardWidget, getWidgetDescription, useProjectDefaultSpanWidgets } from './ProjectCardWidgetData';

const BareMicroGraphic = ({ widget }) => {
    const data = useMemo(() => prepareMicroGraphicData(widget), [widget]);
    const GraphicComponent = useMemo(() => resolveMicroGraphicComponent(data), [data]);

    const renderGraphic = () => {
        if (!GraphicComponent) {
            return (
                <div className="project-card-widget-empty">
                    {data?.title || 'Widget'}
                </div>
            );
        }

        return <GraphicComponent data={data} isMock={data.isMock} />;
    };

    return renderGraphic();
};

export const ProjectCardWidget = ({ projectId, widgetId }) => {
    const { widgets, isLoading } = useProjectDefaultSpanWidgets(projectId);
    const widget = getDefaultProjectCardWidget(widgets, widgetId);

    if (isLoading) {
        return <div className="project-card-widget-empty">Loading widget...</div>;
    }

    if (!widget) {
        return <div className="project-card-widget-empty">No widget</div>;
    }

    return (
        <div className="project-card-widget-frame">
            <div className="project-card-widget-square">
                <BareMicroGraphic widget={widget} />
            </div>
            <div className="project-card-widget-caption">
                <span>{widget.title || widget.id}</span>
                <p>{getWidgetDescription(widget)}</p>
            </div>
        </div>
    );
};

export const ProjectWidgetSelector = ({ widgets, selectedWidgetId, onChange }) => {
    const resolvedSelectedWidget = getDefaultProjectCardWidget(widgets, selectedWidgetId);
    const [isOpen, setIsOpen] = useState(false);
    const selectorRef = React.useRef(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePointerDown = (event) => {
            if (!selectorRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        window.addEventListener('mousedown', handlePointerDown);
        return () => window.removeEventListener('mousedown', handlePointerDown);
    }, [isOpen]);

    if (!widgets.length) {
        return <div className="project-widget-selector-empty">No default-span widgets available.</div>;
    }

    return (
        <div className="project-widget-selector" ref={selectorRef}>
            <button
                type="button"
                className={`project-widget-select-trigger ${isOpen ? 'project-widget-select-trigger-open' : ''}`}
                onClick={() => setIsOpen((currentState) => !currentState)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span>{resolvedSelectedWidget?.title || resolvedSelectedWidget?.id || 'Choose widget'}</span>
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                    <path d="M5 7.5 10 12l5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {isOpen && (
                <div className="project-widget-select-menu" role="listbox">
                    {widgets.map((widget) => {
                        const isSelected = resolvedSelectedWidget?.id === widget.id;

                        return (
                            <button
                                key={widget.id}
                                type="button"
                                className={`project-widget-select-option ${isSelected ? 'project-widget-select-option-selected' : ''}`}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                    onChange(widget.id);
                                    setIsOpen(false);
                                }}
                            >
                                <span>{widget.title || widget.id}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {resolvedSelectedWidget && (
                <p>{getWidgetDescription(resolvedSelectedWidget)}</p>
            )}
        </div>
    );
};
