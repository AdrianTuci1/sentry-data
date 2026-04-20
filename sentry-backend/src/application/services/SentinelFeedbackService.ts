import { createHash } from 'crypto';
import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import {
    ParrotInteractionPolicyState,
    ParrotSentinelFeedbackEvent
} from '../../types/parrot';

export class SentinelFeedbackService {
    constructor(private readonly r2StorageService: R2StorageService) {}

    public async loadPolicyState(tenantId: string, projectId: string): Promise<ParrotInteractionPolicyState> {
        const key = this.r2StorageService.getS3Key(tenantId, projectId, 'feedback', 'sentinel-policy-state.json');
        const state = await this.r2StorageService.getJsonIfExists<ParrotInteractionPolicyState>(key);
        return state || this.emptyState();
    }

    public async recordFeedback(
        tenantId: string,
        projectId: string,
        input: Omit<ParrotSentinelFeedbackEvent, 'eventId' | 'occurredAt'> & { eventId?: string; occurredAt?: string }
    ): Promise<{ event: ParrotSentinelFeedbackEvent; policyState: ParrotInteractionPolicyState; eventUri: string; policyStateUri: string }> {
        const occurredAt = input.occurredAt || new Date().toISOString();
        const event: ParrotSentinelFeedbackEvent = {
            ...input,
            eventId: input.eventId || this.buildEventId(input.targetType, input.targetId, occurredAt),
            occurredAt,
            reward: this.clampReward(input.reward)
        };

        const eventResult = await this.r2StorageService.saveJson(
            tenantId,
            projectId,
            'feedback',
            event,
            'events',
            `${event.eventId}.json`
        );

        const currentState = await this.loadPolicyState(tenantId, projectId);
        const nextState = this.applyEvent(currentState, event);
        const stateResult = await this.r2StorageService.saveJson(
            tenantId,
            projectId,
            'feedback',
            nextState,
            'sentinel-policy-state.json'
        );

        return {
            event,
            policyState: nextState,
            eventUri: eventResult.uri,
            policyStateUri: stateResult.uri
        };
    }

    public hashActor(actorId?: string): string | undefined {
        if (!actorId) return undefined;
        return createHash('sha256').update(actorId).digest('hex').slice(0, 24);
    }

    private applyEvent(state: ParrotInteractionPolicyState, event: ParrotSentinelFeedbackEvent): ParrotInteractionPolicyState {
        const next: ParrotInteractionPolicyState = {
            ...state,
            updatedAt: new Date().toISOString(),
            eventCount: state.eventCount + 1,
            rewardScore: Number((state.rewardScore + event.reward).toFixed(4)),
            widgetWeights: { ...state.widgetWeights },
            sourceInterestWeights: { ...state.sourceInterestWeights },
            modelWeights: { ...state.modelWeights },
            quarantine: [...state.quarantine]
        };

        if (Math.abs(event.reward) > 1 || event.action === 'dismiss') {
            next.quarantine.push({
                eventId: event.eventId,
                reason: event.action === 'dismiss' ? 'dismissed_by_user' : 'reward_outside_expected_range',
                occurredAt: event.occurredAt
            });
            next.quarantine = next.quarantine.slice(-50);
            return next;
        }

        if (event.metadata.widgetType) {
            next.widgetWeights[event.metadata.widgetType] = this.clampWeight(
                (next.widgetWeights[event.metadata.widgetType] || 0) + event.reward * 0.05
            );
        }

        if (event.sourceId) {
            next.sourceInterestWeights[event.sourceId] = this.clampWeight(
                (next.sourceInterestWeights[event.sourceId] || 0) + event.reward * 0.04
            );
        }

        if (event.metadata.modelName && this.isSentinelModelName(event.metadata.modelName)) {
            next.modelWeights[event.metadata.modelName] = this.clampWeight(
                (next.modelWeights[event.metadata.modelName] || 0) + event.reward * 0.03
            );
        }

        return next;
    }

    private emptyState(): ParrotInteractionPolicyState {
        return {
            version: 1,
            updatedAt: new Date().toISOString(),
            eventCount: 0,
            rewardScore: 0,
            widgetWeights: {},
            sourceInterestWeights: {},
            modelWeights: {},
            quarantine: []
        };
    }

    private buildEventId(targetType: string, targetId: string, occurredAt: string): string {
        const hash = createHash('sha256').update(`${targetType}:${targetId}:${occurredAt}:${Math.random()}`).digest('hex');
        return `fb-${hash.slice(0, 18)}`;
    }

    private clampReward(value: number): number {
        if (!Number.isFinite(value)) return 0;
        return Math.max(-1, Math.min(1, value));
    }

    private clampWeight(value: number): number {
        return Math.max(-1, Math.min(1, Number(value.toFixed(4))));
    }

    private isSentinelModelName(value: string): value is keyof ParrotInteractionPolicyState['modelWeights'] {
        return ['CoverageRanker', 'DriftClassifier', 'QueryRiskModel', 'InteractionPolicyModel'].includes(value);
    }
}
