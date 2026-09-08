package ai_test

import (
	"testing"

	"github.com/staticlabs/statsparrot/runtime/ai"
	"github.com/staticlabs/statsparrot/runtime/testruntime"
	"github.com/stretchr/testify/require"
)

func TestParrotAgentListMetricsViews(t *testing.T) {
	rt, instanceID := testruntime.NewInstanceWithOptions(t, testruntime.InstanceOptions{
		Files: map[string]string{
			"test_data.sql": `SELECT 'US' AS country, 100 AS revenue, NOW() AS timestamp`,
			"test_metrics.yaml": `
type: metrics_view
version: 1
model: test_data
dimensions:
- column: country
measures:
- expression: SUM(revenue)
  name: total_revenue
explore:
  skip: true
`,
		},
		Variables: map[string]string{
			"statsparrot.ai.require_time_range": "false",
		},
	})
	testruntime.RequireReconcileState(t, rt, instanceID, 3, 0, 0)

	s := newSession(t, rt, instanceID)

	var res *ai.ParrotAgentResult
	_, err := s.CallTool(t.Context(), ai.RoleUser, ai.ParrotAgentName, &res, &ai.ParrotAgentArgs{Intent: ai.ListMetricsViewsName})
	require.NoError(t, err)
	require.Contains(t, res.Response, "test_metrics")
	require.NotEmpty(t, s.Messages(ai.FilterByType(ai.MessageTypeCall), ai.FilterByTool(ai.ListMetricsViewsName)))
}

func TestParrotAgentQueryMetricsView(t *testing.T) {
	rt, instanceID := testruntime.NewInstanceWithOptions(t, testruntime.InstanceOptions{
		Files: map[string]string{
			"test_data.sql": `SELECT 'US' AS country, 100 AS revenue, NOW() AS timestamp`,
			"test_metrics.yaml": `
type: metrics_view
version: 1
model: test_data
dimensions:
- column: country
measures:
- expression: SUM(revenue)
  name: total_revenue
explore:
  skip: true
`,
		},
		Variables: map[string]string{
			"statsparrot.ai.require_time_range": "false",
		},
	})
	testruntime.RequireReconcileState(t, rt, instanceID, 3, 0, 0)

	s := newSession(t, rt, instanceID)

	var res *ai.ParrotAgentResult
	_, err := s.CallTool(t.Context(), ai.RoleUser, ai.ParrotAgentName, &res, &ai.ParrotAgentArgs{
		Intent: ai.QueryMetricsViewName,
		Args: map[string]any{
			"metrics_view": "test_metrics",
			"dimensions":   []map[string]any{{"name": "country"}},
			"measures":     []map[string]any{{"name": "total_revenue"}},
		},
	})
	require.NoError(t, err)
	require.NotEmpty(t, res.Schema)
	require.NotEmpty(t, res.Data)
	require.NotEmpty(t, s.Messages(ai.FilterByType(ai.MessageTypeCall), ai.FilterByTool(ai.QueryMetricsViewName)))
}

func TestParrotAgentChartIntent(t *testing.T) {
	rt, instanceID := testruntime.NewInstanceWithOptions(t, testruntime.InstanceOptions{
		Files: map[string]string{
			"test_data.sql": `
SELECT '2025-05-10T00:00:00Z'::TIMESTAMP AS event_time, 'US' AS country, 100 AS revenue
UNION ALL
SELECT '2025-05-11T00:00:00Z'::TIMESTAMP AS event_time, 'US' AS country, 200 AS revenue
UNION ALL
SELECT '2025-05-12T00:00:00Z'::TIMESTAMP AS event_time, 'US' AS country, 300 AS revenue
`,
			"test_metrics.yaml": `
type: metrics_view
model: test_data
timeseries: event_time
dimensions:
- column: country
measures:
- name: total_revenue
  expression: SUM(revenue)
explore:
  skip: true
`,
		},
		Variables: map[string]string{
			"statsparrot.ai.require_time_range": "false",
		},
	})
	testruntime.RequireReconcileState(t, rt, instanceID, 3, 0, 0)

	s := newSession(t, rt, instanceID)

	// The real Parrot UI sends widget_query_ref/title (and question/sql), not an
	// internal chart_type+spec map. Verify the agent routes those real args onto the
	// query_metrics_view and create_chart tools so a chart can render in chat.
	var res *ai.ParrotAgentResult
	_, err := s.CallTool(t.Context(), ai.RoleUser, ai.ParrotAgentName, &res, &ai.ParrotAgentArgs{
		Intent: "show_widget",
		Args: map[string]any{
			"widget_query_ref": "test_metrics",
			"title":            "Revenue by country",
			"chart_type":       "bar_chart",
			"dimensions":       []map[string]any{{"name": "country"}},
			"measures":         []map[string]any{{"name": "total_revenue"}},
			"time_range": map[string]any{
				"start": "2025-05-10T00:00:00Z",
				"end":   "2025-05-13T00:00:00Z",
			},
		},
	})
	require.NoError(t, err)
	require.NotEmpty(t, res.Schema)
	require.NotEmpty(t, res.Data)
	require.NotNil(t, res.Chart)
	require.Equal(t, "bar_chart", res.Chart.ChartType)
	require.NotEmpty(t, s.Messages(ai.FilterByType(ai.MessageTypeCall), ai.FilterByTool(ai.QueryMetricsViewName)))
	require.NotEmpty(t, s.Messages(ai.FilterByType(ai.MessageTypeCall), ai.FilterByTool(ai.CreateChartName)))
}

func TestParrotAgentRunAnalyticsQuery(t *testing.T) {
	rt, instanceID := testruntime.NewInstanceWithOptions(t, testruntime.InstanceOptions{
		Files: map[string]string{
			"test_data.sql": `SELECT 'US' AS country, 100 AS revenue`,
		},
		Variables: map[string]string{
			"statsparrot.ai.require_time_range": "false",
		},
	})
	testruntime.RequireReconcileState(t, rt, instanceID, 2, 0, 0)

	s := newSession(t, rt, instanceID)

	// run_analytics_query with a raw SQL question should route to query_sql.
	var res *ai.ParrotAgentResult
	_, err := s.CallTool(t.Context(), ai.RoleUser, ai.ParrotAgentName, &res, &ai.ParrotAgentArgs{
		Intent: "run_analytics_query",
		Args: map[string]any{
			"question": "What is the total revenue?",
			"sql":      "SELECT SUM(revenue) AS total FROM test_data",
		},
	})
	require.NoError(t, err)
	require.NotEmpty(t, res.Schema)
	require.NotEmpty(t, res.Data)
	require.NotEmpty(t, s.Messages(ai.FilterByType(ai.MessageTypeCall), ai.FilterByTool(ai.QuerySQLName)))
}

func TestParrotAgentNavigateTo(t *testing.T) {
	rt, instanceID := testruntime.NewInstanceWithOptions(t, testruntime.InstanceOptions{})
	testruntime.RequireReconcileState(t, rt, instanceID, 1, 0, 0)

	s := newSession(t, rt, instanceID)

	// The Parrot UI sends a single 'section' argument; the agent must map it onto
	// NavigateArgs.Kind/Name (its args do not have kind/name).
	var res *ai.ParrotAgentResult
	_, err := s.CallTool(t.Context(), ai.RoleUser, ai.ParrotAgentName, &res, &ai.ParrotAgentArgs{
		Intent: "navigate_to",
		Args: map[string]any{
			"section": "explore/test_metrics",
		},
	})
	require.NoError(t, err)
	navigateCalls := s.Messages(ai.FilterByType(ai.MessageTypeCall), ai.FilterByTool(ai.NavigateName))
	require.NotEmpty(t, navigateCalls)
	require.Contains(t, navigateCalls[0].Content, `"kind":"explore"`)
	require.Contains(t, navigateCalls[0].Content, `"name":"test_metrics"`)
}
