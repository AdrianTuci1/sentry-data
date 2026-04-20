import { useEffect, useState } from 'react';
import { ProjectService } from '../../api/core';
import fallbackAnalyticsData from '../../data/analyticsData-marketing.json';

const isDefaultSpanWidget = (widget) => {
    const gridSpan = widget?.gridSpan || 'default';
    return gridSpan === 'default' || (!gridSpan.includes('col-span-') && !gridSpan.includes('row-span-'));
};

export const useProjectDefaultSpanWidgets = (projectId) => {
    const [widgets, setWidgets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isActive = true;

        const loadWidgets = async () => {
            if (!projectId) {
                setWidgets(fallbackAnalyticsData.filter(isDefaultSpanWidget));
                setIsLoading(false);
                return;
            }

            try {
                const res = await ProjectService.getAnalytics(projectId);
                const dashboards = res?.data?.dashboards || res?.dashboards || [];
                const nextWidgets = dashboards.length > 0 ? dashboards : fallbackAnalyticsData;

                if (isActive) {
                    setWidgets(nextWidgets.filter(isDefaultSpanWidget));
                }
            } catch (error) {
                console.warn('[ProjectCardWidget] Failed to fetch project widgets.', error);
                if (isActive) setWidgets(fallbackAnalyticsData.filter(isDefaultSpanWidget));
            } finally {
                if (isActive) setIsLoading(false);
            }
        };

        loadWidgets();

        return () => {
            isActive = false;
        };
    }, [projectId]);

    return { widgets, isLoading };
};

export const getDefaultProjectCardWidget = (widgets, widgetId) => {
    if (!widgets.length) return null;
    return widgets.find((widget) => widget.id === widgetId) || widgets[0];
};

export const getWidgetDescription = (widget) => (
    widget?.description ||
    widget?.subtitle ||
    widget?.footerText ||
    'Default-span dashboard widget.'
);
