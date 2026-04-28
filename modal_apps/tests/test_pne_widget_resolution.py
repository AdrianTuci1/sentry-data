import unittest

from modal_apps.pne_core.models import SourceProfile
from modal_apps.pne_core.planner import (
    build_rejection_report,
    build_trace_step,
    evaluate_query_candidate,
    evaluate_query_candidate_quality,
)
from modal_apps.pne_core.query_builder import build_default_query_specs, normalize_query_spec
from modal_apps.pne_core.widgets import prefetch_widget_manifests, resolve_widget_type, validate_widget_runtime_payload


class PneWidgetResolutionTests(unittest.TestCase):
    def test_resolves_generic_line_chart_from_sql_aliases(self) -> None:
        resolution = resolve_widget_type(
            "line_chart",
            sql="SELECT list(period) AS chartLabels, list(value) AS chartSeries FROM virtual_view",
        )

        self.assertEqual(resolution["resolved"], "live-traffic")
        self.assertTrue(resolution["manifestAvailable"])

    def test_prefetches_manifests_for_resolved_widgets(self) -> None:
        manifest_status = prefetch_widget_manifests(
            ["kpi", "line_chart", "table"],
            [
                {"sql": "SELECT 42 AS value", "title": "KPI"},
                {"sql": "SELECT list(period) AS chartLabels, list(value) AS chartSeries", "title": "Trend"},
                {"sql": "SELECT list(struct_pack(name := 'Rows', value := '10', status := 'good')) AS metrics", "title": "Table"},
            ],
        )

        self.assertTrue(manifest_status["kpi"]["manifestLoaded"])
        self.assertEqual(manifest_status["line_chart"]["resolved"], "live-traffic")
        self.assertEqual(manifest_status["table"]["resolved"], "technical-health")

    def test_resolves_lookup_entries_nested_under_lookups(self) -> None:
        resolution = resolve_widget_type("animated-line")

        self.assertEqual(resolution["resolved"], "live-traffic")
        self.assertTrue(resolution["manifestAvailable"])

    def test_trace_steps_include_human_checkpoint(self) -> None:
        step = build_trace_step("candidate_review", "fallback", {"acceptedCount": 1, "rejectedCount": 2, "duplicateCount": 0})

        self.assertEqual(step["status"], "fallback")
        self.assertIn("[WARN]", step["checkpoint"])

    def test_normalize_query_spec_infers_dependency_columns_for_new_source(self) -> None:
        profile = SourceProfile(
            sourceId="new-source",
            sourceName="New Source",
            uri="s3://bucket/new-source.parquet",
            schema=[
                {"name": "event_date", "type": "timestamp"},
                {"name": "sales_amount", "type": "double"},
            ],
            goldViews=[
                {
                    "id": "new-source_primary",
                    "columns": [
                        {"name": "event_date"},
                        {"name": "sales_amount"},
                    ],
                }
            ],
            timestampCandidates=["event_date"],
            metricCandidates=["sales_amount"],
        )
        projection_specs_by_id = {
            "new-source_primary": {
                "projectionId": "new-source_primary",
            }
        }
        normalized = normalize_query_spec(
            profile,
            projection_specs_by_id,
            {
                "queryId": "q1",
                "widgetId": "widget_1",
                "title": "Sales Trend",
                "widgetType": "line_chart",
                "sql": (
                    "SELECT list(DATE_TRUNC('day', event_date)) AS chartLabels, "
                    "list(AVG(sales_amount)) AS chartSeries FROM virtual_view"
                ),
                "dependencies": {"columns": []},
            },
        )

        self.assertEqual(normalized["widgetType"], "live-traffic")
        self.assertCountEqual(normalized["dependencies"]["columns"], ["event_date", "sales_amount"])
        self.assertEqual(normalized["projectionId"], "new-source_primary")

    def test_normalize_query_spec_repairs_gemini_metric_contract_and_lineage(self) -> None:
        profile = SourceProfile(
            sourceId="olist-products",
            sourceName="Olist Products",
            uri="s3://bucket/olist-products.parquet",
            schema=[
                {"name": "product_id", "type": "varchar"},
                {"name": "product_category_name", "type": "varchar"},
            ],
            goldViews=[
                {
                    "id": "olist-products_primary",
                    "columns": [
                        {"name": "product_id"},
                        {"name": "product_category_name"},
                    ],
                }
            ],
        )
        projection_specs_by_id = {
            "olist-products_primary": {
                "projectionId": "olist-products_primary",
            }
        }
        normalized = normalize_query_spec(
            profile,
            projection_specs_by_id,
            {
                "queryId": "total_products_query",
                "widgetId": "total_products",
                "title": "Total Products",
                "widgetType": "Metric",
                "sql": "SELECT COUNT(*) AS total_products FROM virtual_view",
                "dependencies": {"columns": []},
                "widgetContract": {
                    "source": "runtime_contract",
                    "requiredFields": ["total_products"],
                },
            },
        )

        accepted, reasons = evaluate_query_candidate(normalized)

        self.assertTrue(accepted, reasons)
        self.assertEqual(normalized["widgetType"], "metric-trend")
        self.assertEqual(normalized["widgetContract"]["source"], "catalog_manifest")
        self.assertIn("manifestPath", normalized["widgetContract"])
        self.assertCountEqual(normalized["dependencies"]["columns"], ["product_id", "product_category_name"])
        self.assertIn("AS value", normalized["sql"])

    def test_normalize_query_spec_repairs_generic_bar_chart(self) -> None:
        profile = SourceProfile(
            sourceId="olist-products",
            sourceName="Olist Products",
            uri="s3://bucket/olist-products.parquet",
            schema=[
                {"name": "product_id", "type": "varchar"},
                {"name": "product_category_name", "type": "varchar"},
            ],
            goldViews=[
                {
                    "id": "olist-products_primary",
                    "columns": [
                        {"name": "product_id"},
                        {"name": "product_category_name"},
                    ],
                }
            ],
        )
        projection_specs_by_id = {
            "olist-products_primary": {
                "projectionId": "olist-products_primary",
            }
        }
        normalized = normalize_query_spec(
            profile,
            projection_specs_by_id,
            {
                "queryId": "products_by_category_query",
                "widgetId": "products_by_category",
                "title": "Products by Category",
                "widgetType": "BarChart",
                "sql": (
                    "SELECT product_category_name AS category, COUNT(*) AS product_count "
                    "FROM virtual_view GROUP BY product_category_name"
                ),
                "dependencies": {"columns": []},
            },
        )

        accepted, reasons = evaluate_query_candidate(normalized)

        self.assertTrue(accepted, reasons)
        self.assertEqual(normalized["widgetType"], "campaign-list")
        self.assertIn("AS campaigns", normalized["sql"])
        self.assertCountEqual(normalized["dependencies"]["columns"], ["product_category_name"])

    def test_runtime_payload_validation_accepts_manifest_shape(self) -> None:
        reasons = validate_widget_runtime_payload(
            "campaign-list",
            [
                {
                    "campaigns": [
                        {"name": "Books", "value": "24", "trend": "+"},
                        {"name": "Beauty", "value": "19", "trend": "-"},
                    ]
                }
            ],
        )

        self.assertEqual(reasons, [])

    def test_runtime_payload_validation_rejects_wrong_alias_type(self) -> None:
        reasons = validate_widget_runtime_payload(
            "campaign-list",
            [
                {
                    "campaigns": {"name": "Books", "value": "24", "trend": "+"},
                }
            ],
        )

        self.assertIn("runtime_invalid_alias_type:campaigns:object[]", reasons)

    def test_rejection_report_summarizes_runtime_failures(self) -> None:
        report = build_rejection_report(
            [
                {
                    "sourceId": "olist-orders",
                    "sourceName": "Olist Orders",
                    "candidates": [
                        {
                            "queryId": "orders_runtime_query",
                            "widgetId": "orders_runtime_query",
                            "title": "Orders Runtime",
                            "widgetType": "campaign-list",
                            "candidateSource": "gemini",
                            "status": "rejected",
                            "reasons": ["runtime_invalid_alias_type:campaigns:object[]"],
                            "runtimeValidation": {"status": "failed", "rowCount": 1, "previewKeys": ["campaigns"]},
                        }
                    ],
                }
            ]
        )

        self.assertEqual(report["totalRejected"], 1)
        self.assertEqual(report["runtimeRejected"], 1)
        self.assertEqual(report["bySource"][0]["sourceId"], "olist-orders")
        self.assertIn("campaigns", report["bySource"][0]["rejectedCandidates"][0]["reasonMessages"][0])

    def test_quality_filter_rejects_numeric_query_id_and_score_bucket_counts(self) -> None:
        reasons = evaluate_query_candidate_quality(
            {
                "queryId": "3",
                "title": "Reviews with Score 5",
                "widgetType": "metric-trend",
                "sql": "SELECT COUNT(review_id) AS value FROM virtual_view WHERE review_score = 5",
            },
            [],
        )

        self.assertIn("low_signal_numeric_query_id", reasons)
        self.assertIn("low_signal_score_bucket_count", reasons)

    def test_quality_filter_rejects_redundant_extra_kpis(self) -> None:
        reasons = evaluate_query_candidate_quality(
            {
                "queryId": "olist_reviews_total_reviews",
                "title": "Total Reviews",
                "widgetType": "metric-trend",
                "sql": "SELECT COUNT(review_id) AS value FROM virtual_view",
            },
            [
                {"widgetType": "metric-trend"},
                {"widgetType": "sparkline-stat"},
            ],
        )

        self.assertIn("low_signal_redundant_kpi", reasons)

    def test_default_row_count_query_avoids_nested_aggregate(self) -> None:
        profile = SourceProfile(
            sourceId="olist-orders",
            sourceName="Olist Orders",
            uri="s3://bucket/olist-orders.parquet",
            schema=[{"name": "order_id", "type": "varchar"}],
            goldViews=[{"id": "gold-olist-orders-core", "columns": [{"name": "order_id"}]}],
        )
        projection_specs_by_id = {
            "gold-olist-orders-core": {
                "projectionId": "gold-olist-orders-core",
                "inputFingerprint": "fp-1",
            }
        }

        specs = build_default_query_specs(profile, projection_specs_by_id, "2026-04-28T00:00:00Z")
        row_count = next(spec for spec in specs if spec["queryId"].endswith("_row_count"))

        self.assertIn("FROM (SELECT COUNT(*) AS row_count", row_count["sql"])
        self.assertNotIn("CAST(COUNT(*) AS VARCHAR)", row_count["sql"])

    def test_normalize_query_spec_repairs_struct_alias_syntax(self) -> None:
        profile = SourceProfile(
            sourceId="olist-orders",
            sourceName="Olist Orders",
            uri="s3://bucket/olist-orders.parquet",
            schema=[
                {"name": "order_status", "type": "varchar"},
                {"name": "order_id", "type": "varchar"},
            ],
            goldViews=[{"id": "gold-olist-orders-core", "columns": [{"name": "order_status"}, {"name": "order_id"}]}],
        )
        projection_specs_by_id = {
            "gold-olist-orders-core": {
                "projectionId": "gold-olist-orders-core",
            }
        }

        normalized = normalize_query_spec(
            profile,
            projection_specs_by_id,
            {
                "queryId": "order_status_breakdown",
                "widgetId": "order_status_breakdown",
                "title": "Order Status Breakdown",
                "widgetType": "campaign-list",
                "sql": (
                    "SELECT LIST(STRUCT(order_status AS label, COUNT(order_id) AS value)) AS campaigns "
                    "FROM virtual_view GROUP BY order_status"
                ),
                "dependencies": {"columns": []},
            },
        )

        self.assertIn("list(struct_pack(", normalized["sql"].lower())
        self.assertNotIn("struct(order_status as label", normalized["sql"].lower())

    def test_normalize_query_spec_wraps_live_traffic_into_single_row(self) -> None:
        profile = SourceProfile(
            sourceId="olist-orders",
            sourceName="Olist Orders",
            uri="s3://bucket/olist-orders.parquet",
            schema=[
                {"name": "order_purchase_timestamp", "type": "timestamp"},
                {"name": "order_id", "type": "varchar"},
            ],
            goldViews=[{"id": "gold-olist-orders-core", "columns": [{"name": "order_purchase_timestamp"}, {"name": "order_id"}]}],
            timestampCandidates=["order_purchase_timestamp"],
        )
        projection_specs_by_id = {
            "gold-olist-orders-core": {
                "projectionId": "gold-olist-orders-core",
            }
        }

        normalized = normalize_query_spec(
            profile,
            projection_specs_by_id,
            {
                "queryId": "order_volume_trend",
                "widgetId": "order_volume_trend",
                "title": "Daily Order Volume",
                "widgetType": "live-traffic",
                "sql": (
                    "SELECT strftime(order_purchase_timestamp, '%Y-%m-%d') AS chartLabels, "
                    "COUNT(order_id) AS chartSeries FROM virtual_view GROUP BY 1"
                ),
                "dependencies": {"columns": []},
            },
        )

        self.assertIn("list(CAST(chartLabels AS VARCHAR)", normalized["sql"])
        self.assertIn("list(CAST(chartSeries AS DOUBLE)", normalized["sql"])

    def test_normalize_query_spec_uses_selected_projection_relation(self) -> None:
        profile = SourceProfile(
            sourceId="olist-products",
            sourceName="Olist Products",
            uri="s3://bucket/olist-products.parquet",
            schema=[
                {"name": "product_category_name", "type": "varchar"},
                {"name": "product_description_lenght", "type": "double"},
            ],
            goldViews=[
                {
                    "id": "gold-olist-products-core",
                    "columns": [
                        {"name": "product_category_name"},
                        {"name": "product_description_lenght"},
                    ],
                }
            ],
        )
        projection_specs_by_id = {
            "gold-olist-products-core": {
                "projectionId": "gold-olist-products-core",
                "servingUri": "s3://bucket/projections/gold-olist-products-core.parquet",
                "logic": {
                    "code": "SELECT product_category_name, product_description_lenght FROM read_parquet('s3://bucket/olist-products.parquet')"
                },
            }
        }

        normalized = normalize_query_spec(
            profile,
            projection_specs_by_id,
            {
                "queryId": "product_description_length_breakdown",
                "widgetId": "product_description_length_breakdown",
                "title": "Average Product Description Length by Category",
                "widgetType": "mpl-benchmark-bars",
                "sql": (
                    "SELECT product_category_name AS label, ROUND(AVG(product_description_lenght), 2) AS value "
                    "FROM read_parquet('s3://bucket/olist-products.parquet') GROUP BY 1"
                ),
                "dependencies": {"columns": ["product_category_name", "product_description_lenght"]},
            },
        )

        self.assertIn("FROM (SELECT product_category_name, product_description_lenght FROM read_parquet('s3://bucket/olist-products.parquet')) AS pne_projection", normalized["sql"])

    def test_normalize_query_spec_ignores_non_executable_semantic_projection_sql(self) -> None:
        profile = SourceProfile(
            sourceId="olist-orders",
            sourceName="Olist Orders",
            uri="s3://bucket/olist-orders.parquet",
            schema=[{"name": "order_id", "type": "varchar"}],
            goldViews=[{"id": "gold-olist-orders-core", "columns": [{"name": "order_id"}]}],
        )
        projection_specs_by_id = {
            "gold-olist-orders-core": {
                "projectionId": "gold-olist-orders-core",
                "servingUri": "s3://bucket/olist-orders.parquet",
                "logic": {
                    "code": "SELECT * FROM bronze.olist-orders",
                    "compiled_code": "SELECT * FROM bronze.olist-orders",
                },
            }
        }

        normalized = normalize_query_spec(
            profile,
            projection_specs_by_id,
            {
                "queryId": "total_orders_kpi",
                "widgetId": "total_orders_kpi",
                "title": "Total Orders",
                "widgetType": "metric-trend",
                "sql": "SELECT COUNT(order_id) AS value FROM virtual_view",
                "dependencies": {"columns": ["order_id"]},
            },
        )

        self.assertIn("read_parquet('s3://bucket/olist-orders.parquet')", normalized["sql"])
        self.assertNotIn("bronze.olist-orders", normalized["sql"])


if __name__ == "__main__":
    unittest.main()
