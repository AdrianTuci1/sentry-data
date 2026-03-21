# Widget Standardization Plan

This plan defines the standard "Contract" for all Sentry-Data widgets. It ensures visual consistency, high reliability through internal mocks, and seamless integration with real-time data calculations.

## Core Principle: On-the-Fly Calculation
The backend does NOT persist aggregated widget data. Every time a widget is requested:
1.  **SQL Execution**: The backend runs the associated DuckDB query.
2.  **Hydration**: `SDUIHydrator` maps the raw SQL rows to component-friendly props.
3.  **Delivery**: The component code and its specific data payload are delivered to the frontend.

---

## 1. Widget Component Standard
All components must be resilient to empty data and prioritize sources in this order:
1.  **Named Keys**: (e.g., `data.leads`, `data.metrics`)
2.  **Generic Keys**: `data.data` or `data.results`
3.  **Internal Mocks**: High-quality static data defined inside the component.

### Example Pattern:
```javascript
const MyWidget = ({ data = {}, isMock = false }) => {
    // Priority-based data extraction
    const items = (data.items?.length > 0 ? data.items : null) || 
                  (data.data?.length > 0 ? data.data : null) || 
                  (data.results?.length > 0 ? data.results : null) || 
                  [ /* Internal Mock Data */ ];

    const value = data.value || (isMock ? "72" : "0");
    
    return (<div className="widget-root">...</div>);
};
```

---

## 2. Backend Contract (SDUIHydrator)
The `SDUIHydrator` is responsible for ensuring the "Fat Payload" which includes redundant keys for backward and forward compatibility:
- `data`: The primary mapped collection.
- `results`: The raw input rows.
- `value`/`unit`: Primary scalar metrics.

---

## 3. Modular Styling
- Every widget must have its own `style.css` in its folder.
- CSS must be imported at the top of `component.jsx`.
- Use class names instead of inline styles for better performance and maintainability.

---

## 4. Implementation Checklist
- [ ] Add `style.css` to all widgets.
- [ ] Refactor components to use the resilient destructuring pattern.
- [ ] Update `WidgetDataMapper` to provide consistent mapping for all categories (Marketing, ML, Charts, etc.).
- [ ] Ensure `manifest.yml` has a valid `data_structure_template` for frontend previews.
