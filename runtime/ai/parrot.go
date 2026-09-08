package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/jsonschema-go/jsonschema"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/staticlabs/statsparrot/runtime"
)

// ParrotAgentName is the name of the Parrot agent tool.
const ParrotAgentName = "parrot_agent"

// Parrot intent strings. These are the intents the Parrot chat UI emits,
// which the Parrot agent translates onto Parrot's runtime AI tool layer.
const (
	parrotIntentNavigate          = "navigate_to"
	parrotIntentShowWidget        = "show_widget"
	parrotIntentRunAnalyticsQuery = "run_analytics_query"
)

// ParrotAgent bridges the Statsparrot Parrot chat UI onto Parrot's runtime AI tool layer.
// It receives a high-level intent plus raw arguments from the Parrot UI and dispatches
// to the corresponding Parrot tool (list_metrics_views / query_metrics_view / create_chart /
// navigate) so that metrics views and charts can be rendered directly in chat.
type ParrotAgent struct{}

var _ Tool[*ParrotAgentArgs, *ParrotAgentResult] = (*ParrotAgent)(nil)

// ParrotAgentArgs are the arguments emitted by the Parrot chat UI.
type ParrotAgentArgs struct {
	Prompt string `json:"prompt" jsonschema:"The user's natural language prompt."`
	Intent string `json:"intent" jsonschema:"The intent to route: list_metrics_views, query_metrics_view, create_chart, show_widget, run_analytics_query, or navigate_to."`
	Args   map[string]any `json:"args" jsonschema:"The intent-specific arguments. For navigate_to this carries the 'section' argument. For query_metrics_view/show_widget this carries the metrics-view query arguments (e.g. metrics_view, dimensions, measures, time_range) plus the Parrot UI's widget_query_ref/title/question/sql fields."`
}

// ParrotChartResult describes a chart that the Parrot chat should render.
type ParrotChartResult struct {
	ChartType string         `json:"chart_type,omitempty"`
	Spec      map[string]any `json:"spec,omitempty"`
	Title     string         `json:"title,omitempty"`
}

// ParrotAgentResult is the result of a Parrot agent invocation.
type ParrotAgentResult struct {
	Response string             `json:"response,omitempty"`
	Schema   []SchemaField      `json:"schema,omitempty"`
	Data     [][]any            `json:"data,omitempty"`
	Chart    *ParrotChartResult `json:"chart,omitempty"`
}

func (t *ParrotAgent) Spec() *mcp.Tool {
	inputSchema, err := jsonschema.For[*ParrotAgentArgs](&jsonschema.ForOptions{})
	if err != nil {
		panic(fmt.Errorf("failed to infer input schema: %w", err))
	}

	return &mcp.Tool{
		Name:        ParrotAgentName,
		Title:       "Parrot Agent",
		Description: "Statsparrot agent that routes the Parrot chat UI's intents onto Parrot's runtime AI tools so metrics views and charts can be rendered in chat. Supported intents: list_metrics_views, query_metrics_view, create_chart, show_widget, run_analytics_query, navigate_to.",
		InputSchema: inputSchema,
		Meta: map[string]any{
			"openai/toolInvocation/invoking": "Routing Parrot intent...",
			"openai/toolInvocation/invoked":  "Parrot intent handled",
		},
	}
}

func (t *ParrotAgent) CheckAccess(ctx context.Context) (bool, error) {
	// Must be allowed to use AI and query metrics.
	s := GetSession(ctx)
	if !s.Claims().Can(runtime.UseAI) || !s.Claims().Can(runtime.ReadMetrics) {
		return false, nil
	}
	return true, nil
}

func (t *ParrotAgent) Handler(ctx context.Context, args *ParrotAgentArgs) (*ParrotAgentResult, error) {
	s := GetSession(ctx)

	switch args.Intent {
	case ListMetricsViewsName:
		var res ListMetricsViewsResult
		if _, err := s.CallTool(ctx, RoleAssistant, ListMetricsViewsName, &res, &ListMetricsViewsArgs{}); err != nil {
			return nil, err
		}
		return &ParrotAgentResult{
			Response: buildListMetricsViewsResponse(res),
		}, nil

	case QueryMetricsViewName:
		var res QueryMetricsViewResult
		if _, err := s.CallTool(ctx, RoleAssistant, QueryMetricsViewName, &res, QueryMetricsViewArgs(args.Args)); err != nil {
			return nil, err
		}
		return &ParrotAgentResult{
			Schema: res.Schema,
			Data:   res.Data,
		}, nil

	case CreateChartName, parrotIntentShowWidget, parrotIntentRunAnalyticsQuery:
		return t.chartIntent(ctx, s, args)

	case parrotIntentNavigate:
		section, _ := args.Args["section"].(string)
		kind, name := parseSection(section)
		if kind == "" || name == "" {
			return nil, fmt.Errorf("navigate intent requires a 'section' argument")
		}
		var res NavigateResult
		if _, err := s.CallTool(ctx, RoleAssistant, NavigateName, &res, &NavigateArgs{Kind: kind, Name: name}); err != nil {
			return nil, err
		}
		return &ParrotAgentResult{}, nil

	default:
		return nil, fmt.Errorf("unknown parrot intent %q", args.Intent)
	}
}

// chartIntent implements the show_widget and run_analytics_query intents.
// The Parrot UI does not send an internal chart_type+spec map; it sends the natural
// language question, an optional SQL query, and a widget_query_ref/title. We map those
// real arguments onto Parrot's tool layer: a metric query when a widget/metrics view is
// referenced, a raw SQL query when SQL is provided, and (when a chart_type is present)
// a create_chart spec so the chat can render the resulting chart.
func (t *ParrotAgent) chartIntent(ctx context.Context, s *Session, args *ParrotAgentArgs) (*ParrotAgentResult, error) {
	result := &ParrotAgentResult{
		Response: buildChartIntentResponse(args),
	}

	if sql, _ := args.Args["sql"].(string); sql != "" {
		var res QuerySQLResult
		if _, err := s.CallTool(ctx, RoleAssistant, QuerySQLName, &res, &QuerySQLArgs{SQL: sql}); err != nil {
			return nil, err
		}
		result.Schema = res.Schema
		result.Data = res.Data
		return result, nil
	}

	widgetRef, _ := args.Args["widget_query_ref"].(string)
	if widgetRef == "" {
		// No widget or SQL to resolve against; return a helpful message rather than
		// failing with the internal-only "requires a chart request" error.
		return result, nil
	}

	// Query the referenced metrics view so the chat has data to render.
	queryArgs := QueryMetricsViewArgs{
		"metrics_view": widgetRef,
	}
	for _, k := range []string{"dimensions", "measures", "time_range", "where", "time_grain", "sort", "limit"} {
		if v, ok := args.Args[k]; ok {
			queryArgs[k] = v
		}
	}
	var res QueryMetricsViewResult
	if _, err := s.CallTool(ctx, RoleAssistant, QueryMetricsViewName, &res, queryArgs); err != nil {
		return nil, err
	}
	result.Schema = res.Schema
	result.Data = res.Data

	// Optionally produce a chart specification so the chat can render a chart.
	if chartType, _ := args.Args["chart_type"].(string); chartType != "" {
		spec := map[string]any{"metrics_view": widgetRef}
		if tr, ok := args.Args["time_range"]; ok {
			spec["time_range"] = tr
		}
		if tg, ok := args.Args["time_grain"]; ok {
			spec["time_grain"] = tg
		}
		var chartRes CreateChartResult
		if _, err := s.CallTool(ctx, RoleAssistant, CreateChartName, &chartRes, CreateChartArgs{"chart_type": chartType, "spec": spec}); err == nil {
			result.Chart = &ParrotChartResult{ChartType: chartRes.ChartType, Spec: chartRes.Spec}
		}
	}

	return result, nil
}

// parseSection maps a Parrot navigation section argument onto NavigateArgs.Kind/Name.
// The Parrot UI sends a single 'section' string; we split it into a kind/name pair so
// Parrot's navigate tool can be invoked (its args expect kind and name, not section).
// Supported separators are "/" and ":". A bare identifier defaults the kind to "explore".
func parseSection(section string) (kind, name string) {
	section = strings.TrimSpace(section)
	if section == "" {
		return "", ""
	}
	for _, sep := range []string{"/", ":"} {
		if k, n, ok := strings.Cut(section, sep); ok && k != "" && n != "" {
			return k, n
		}
	}
	return "explore", section
}

func buildListMetricsViewsResponse(res ListMetricsViewsResult) string {
	var b strings.Builder
	b.WriteString("Metrics views:\n")
	for _, mv := range res.MetricsViews {
		name, _ := mv["name"].(string)
		b.WriteString("- " + name + "\n")
	}
	return strings.TrimSpace(b.String())
}

func buildChartIntentResponse(args *ParrotAgentArgs) string {
	if title, _ := args.Args["title"].(string); title != "" {
		return title
	}
	if q, _ := args.Args["question"].(string); q != "" {
		return q
	}
	return ""
}
