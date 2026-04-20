import { createHash } from 'crypto';
import {
    ParrotCodeFormulaView,
    ParrotDecisionOverride,
    ParrotMLRecommendation,
    ParrotProjectionSpec,
    ParrotQuerySpec
} from '../../types/parrot';

export class DecisionOverrideService {
    public validateOverride(input: {
        targetType: ParrotDecisionOverride['targetType'];
        targetId: string;
        codeFormula?: string;
        userIntent?: string;
    }): ParrotDecisionOverride['validation'] {
        const warnings: string[] = [];
        const errors: string[] = [];
        const code = input.codeFormula?.trim() || '';

        if (!code && !input.userIntent?.trim()) {
            errors.push('override_requires_code_or_intent');
        }

        if (input.targetType === 'query' || input.targetType === 'widget') {
            this.validateSqlFormula(code, warnings, errors);
        }

        if (input.targetType === 'ml_recommendation' && code && !this.isJsonLike(code)) {
            warnings.push('ml_override_should_prefer_json_policy_formula');
        }

        return {
            functional: errors.length === 0,
            warnings,
            errors,
            checkedAt: new Date().toISOString()
        };
    }

    public buildOverride(input: {
        targetType: ParrotDecisionOverride['targetType'];
        targetId: string;
        codeFormula?: string;
        userIntent?: string;
        createdBy?: string;
    }): ParrotDecisionOverride {
        const validation = this.validateOverride(input);
        const now = new Date().toISOString();

        return {
            overrideId: this.buildOverrideId(input.targetType, input.targetId, now),
            targetType: input.targetType,
            targetId: input.targetId,
            codeFormula: input.codeFormula,
            userIntent: input.userIntent,
            status: validation.errors.length > 0 ? 'blocked' : (validation.warnings.length > 0 ? 'warning' : 'active'),
            validation,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now
        };
    }

    public buildFormulaViews(input: {
        querySpecs?: ParrotQuerySpec[];
        projectionSpecs?: ParrotProjectionSpec[];
        mlRecommendations?: ParrotMLRecommendation[];
        overrides?: ParrotDecisionOverride[];
    }): ParrotCodeFormulaView[] {
        const overridesByTarget = new Map((input.overrides || []).map((override) => [`${override.targetType}:${override.targetId}`, override]));
        const views: ParrotCodeFormulaView[] = [];

        for (const projection of input.projectionSpecs || []) {
            const override = overridesByTarget.get(`projection:${projection.projectionId}`);
            views.push({
                formulaId: `formula-projection-${projection.projectionId}`,
                targetType: 'projection',
                targetId: projection.projectionId,
                title: projection.title,
                language: 'sql',
                displayCode: override?.codeFormula || projection.logic.effective_query || projection.logic.compiled_code || projection.logic.code || projection.logic.intent,
                editable: true,
                warnings: override?.validation.warnings || []
            });
        }

        for (const query of input.querySpecs || []) {
            const override = overridesByTarget.get(`query:${query.queryId}`) || overridesByTarget.get(`widget:${query.widgetId}`);
            views.push({
                formulaId: `formula-query-${query.queryId}`,
                targetType: 'query',
                targetId: query.queryId,
                title: query.title,
                language: 'sql',
                displayCode: override?.codeFormula || query.sql,
                editable: true,
                warnings: override?.validation.warnings || []
            });
        }

        for (const recommendation of input.mlRecommendations || []) {
            const override = overridesByTarget.get(`ml_recommendation:${recommendation.recommendationId}`);
            views.push({
                formulaId: `formula-ml-${recommendation.recommendationId}`,
                targetType: 'ml_recommendation',
                targetId: recommendation.recommendationId,
                title: recommendation.title,
                language: 'json',
                displayCode: override?.codeFormula || JSON.stringify({
                    taskType: recommendation.taskType,
                    targetColumn: recommendation.targetColumn,
                    featureColumns: recommendation.featureColumns,
                    launchMode: recommendation.launchMode
                }, null, 2),
                editable: true,
                warnings: override?.validation.warnings || []
            });
        }

        return views;
    }

    public applyOverrideToQueryConfigs(
        queryConfigs: Array<{ widgetId: string; sqlString: string }> = [],
        override: ParrotDecisionOverride
    ): Array<{ widgetId: string; sqlString: string }> {
        if (override.status === 'blocked' || !override.codeFormula || !['query', 'widget'].includes(override.targetType)) {
            return queryConfigs;
        }

        return queryConfigs.map((queryConfig) => (
            queryConfig.widgetId === override.targetId
                ? { ...queryConfig, sqlString: override.codeFormula! }
                : queryConfig
        ));
    }

    private validateSqlFormula(code: string, warnings: string[], errors: string[]): void {
        if (!code) return;

        const normalized = code.trim().toLowerCase();
        if (!normalized.startsWith('select') && !normalized.startsWith('with')) {
            errors.push('sql_override_must_be_read_only_select');
        }

        if (/\b(drop|delete|update|insert|alter|truncate|create|copy)\b/.test(normalized)) {
            errors.push('sql_override_contains_unsafe_operation');
        }

        if (!/\bfrom\b/.test(normalized)) {
            warnings.push('sql_override_has_no_from_clause');
        }

        if (normalized.includes('read_parquet') && !normalized.includes('where') && !/\b(count|avg|sum|min|max)\s*\(/.test(normalized)) {
            warnings.push('sql_override_may_scan_raw_projection_without_filter_or_aggregation');
        }
    }

    private isJsonLike(code: string): boolean {
        try {
            JSON.parse(code);
            return true;
        } catch {
            return false;
        }
    }

    private buildOverrideId(targetType: string, targetId: string, createdAt: string): string {
        const hash = createHash('sha256').update(`${targetType}:${targetId}:${createdAt}`).digest('hex');
        return `ovr-${hash.slice(0, 16)}`;
    }
}
