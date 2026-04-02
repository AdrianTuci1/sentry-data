import { config } from '../../config';
import { ParrotExecutionPlan, ParrotExecutionEngine, ParrotExecutionScore, ParrotSourceProfile } from '../../types/parrot';

export class WorkloadPlannerService {
    private readonly plannerVersion = 'planner-v1';

    public buildPlan(requestId: string, executionScore: ParrotExecutionScore, sourceProfiles: ParrotSourceProfile[]): ParrotExecutionPlan {
        const sourceCount = sourceProfiles.length;
        const estimatedColumns = sourceProfiles.reduce((sum, profile) => sum + profile.schema.length, 0);
        const estimatedMetricColumns = sourceProfiles.reduce((sum, profile) => sum + profile.metricCandidates.length, 0);
        const estimatedGoldViews = sourceProfiles.reduce((sum, profile) => sum + profile.goldViews.length, 0);
        const complexityScore = sourceCount * 20 + estimatedColumns + estimatedMetricColumns * 2 + estimatedGoldViews * 5;
        const workloadClass = complexityScore >= 120 ? 'large' : complexityScore >= 60 ? 'medium' : 'small';
        const engine = this.chooseEngine(workloadClass, sourceCount, estimatedColumns);
        const reasons = this.buildReasons(workloadClass, sourceCount, estimatedColumns, estimatedMetricColumns, estimatedGoldViews, engine);

        if (engine === 'ray_daft') {
            return {
                plan_id: `exec-plan-${Date.now()}`,
                request_id: requestId,
                engine,
                planner_version: this.plannerVersion,
                execution_plane: 'kubernetes_ray',
                workload_class: workloadClass,
                source_count: sourceCount,
                estimated_columns: estimatedColumns,
                estimated_metric_columns: estimatedMetricColumns,
                estimated_gold_views: estimatedGoldViews,
                target_latency_ms: executionScore.metadata.target_latency_ms,
                scheduler: {
                    platform: 'kubernetes',
                    queue: config.execution.rayQueue,
                    namespace: config.execution.k8sNamespace,
                    cluster: config.execution.k8sCluster,
                    autoscaling: true
                },
                resources: {
                    driver_cpu: workloadClass === 'large' ? 4 : 2,
                    driver_memory_gb: workloadClass === 'large' ? 16 : 8,
                    worker_cpu: workloadClass === 'large' ? 4 : 2,
                    worker_memory_gb: workloadClass === 'large' ? 12 : 8,
                    min_workers: workloadClass === 'large' ? 6 : 3,
                    max_workers: workloadClass === 'large' ? 48 : 16
                },
                routing: {
                    preferred_provider: 'ray_daft',
                    fallback_provider: 'modal'
                },
                reasons
            };
        }

        return {
            plan_id: `exec-plan-${Date.now()}`,
            request_id: requestId,
            engine,
            planner_version: this.plannerVersion,
            execution_plane: 'modal',
            workload_class: workloadClass,
            source_count: sourceCount,
            estimated_columns: estimatedColumns,
            estimated_metric_columns: estimatedMetricColumns,
            estimated_gold_views: estimatedGoldViews,
            target_latency_ms: executionScore.metadata.target_latency_ms,
            scheduler: {
                platform: 'modal',
                queue: 'modal-default',
                autoscaling: true
            },
            resources: {
                driver_cpu: 2,
                driver_memory_gb: workloadClass === 'medium' ? 8 : 4,
                worker_cpu: workloadClass === 'medium' ? 2 : 1,
                worker_memory_gb: workloadClass === 'medium' ? 6 : 4,
                min_workers: 1,
                max_workers: workloadClass === 'medium' ? 6 : 3
            },
            routing: {
                preferred_provider: 'modal',
                fallback_provider: config.execution.rayControlUrl ? 'ray_daft' : null
            },
            reasons
        };
    }

    private chooseEngine(workloadClass: 'small' | 'medium' | 'large', sourceCount: number, estimatedColumns: number): ParrotExecutionEngine {
        if (config.execution.defaultEngine === 'modal') return 'modal';
        if (config.execution.defaultEngine === 'ray_daft') return 'ray_daft';

        if (workloadClass === 'large') return 'ray_daft';
        if (sourceCount >= 4 && estimatedColumns >= 80) return 'ray_daft';
        return 'modal';
    }

    private buildReasons(
        workloadClass: 'small' | 'medium' | 'large',
        sourceCount: number,
        estimatedColumns: number,
        estimatedMetricColumns: number,
        estimatedGoldViews: number,
        engine: ParrotExecutionEngine
    ): string[] {
        return [
            `workload_class=${workloadClass}`,
            `source_count=${sourceCount}`,
            `estimated_columns=${estimatedColumns}`,
            `estimated_metric_columns=${estimatedMetricColumns}`,
            `estimated_gold_views=${estimatedGoldViews}`,
            `selected_engine=${engine}`,
            engine === 'ray_daft'
                ? 'distributed execution selected because metadata indicates multi-source or high-complexity workload'
                : 'modal execution selected because metadata indicates a contained workload suitable for current runtime'
        ];
    }
}
