import { ParrotOutputManifest, ReverseEtlReceipt, ReverseEtlStreamPlan } from '../../types/parrot';

export class ReverseEtlHeadService {
    public buildPlan(existing?: ReverseEtlStreamPlan): ReverseEtlStreamPlan {
        const limits = {
            maxUnverifiedVms: existing?.limits.maxUnverifiedVms ?? 2,
            stopOnErrors: existing?.limits.stopOnErrors ?? ['not allowed', 'too many requests'],
            consecutiveErrorThreshold: existing?.limits.consecutiveErrorThreshold ?? 3,
            requireManualVerificationAfterLimit: existing?.limits.requireManualVerificationAfterLimit ?? true
        };

        const dnsStatus: ReverseEtlStreamPlan['dnsTxtVerification']['status'] = existing?.dnsTxtVerification.verified
            ? 'verified'
            : 'pending_dns_verification';

        const dnsTxtVerification = {
            required: true,
            recordName: existing?.dnsTxtVerification.recordName ?? '_stats-parrot',
            domain: existing?.dnsTxtVerification.domain,
            verified: existing?.dnsTxtVerification.verified ?? false,
            verifiedAt: existing?.dnsTxtVerification.verifiedAt,
            status: dnsStatus
        };

        const activeVmCount = existing?.activeVmCount ?? 0;
        const status: ReverseEtlStreamPlan['status'] = dnsTxtVerification.verified
            ? 'ready'
            : activeVmCount >= limits.maxUnverifiedVms
                ? 'limited'
                : 'pending_dns_verification';

        return {
            enabled: true,
            vmMode: 'user_owned',
            dnsTxtVerification,
            deliveryTargets: existing?.deliveryTargets ?? [],
            limits,
            activeVmCount,
            status
        };
    }

    public buildOutputManifest(requestId: string, discovery: any, reverseEtl: ReverseEtlStreamPlan): ParrotOutputManifest {
        return {
            request_id: requestId,
            mode: 'parrot_os',
            dashboards: Array.isArray(discovery?.insight) ? discovery.insight.length : 0,
            insights: Array.isArray(discovery?.group) ? discovery.group.length : 0,
            reverse_etl: {
                status: reverseEtl.status,
                delivery_targets: reverseEtl.deliveryTargets,
                active_vm_count: reverseEtl.activeVmCount,
                dns_verified: reverseEtl.dnsTxtVerification.verified
            },
            emitted_at: new Date().toISOString()
        };
    }

    public buildReceipts(reverseEtl: ReverseEtlStreamPlan): ReverseEtlReceipt[] {
        const emittedAt = new Date().toISOString();
        if (reverseEtl.deliveryTargets.length === 0) {
            return [
                {
                    target: 'reverse_etl_head',
                    status: 'skipped',
                    reason: reverseEtl.dnsTxtVerification.verified ? 'no_delivery_targets_configured' : 'dns_txt_verification_required',
                    emittedAt
                }
            ];
        }

        const targetStatus = reverseEtl.dnsTxtVerification.verified ? 'pending' : 'skipped';
        const reason = reverseEtl.dnsTxtVerification.verified ? undefined : 'dns_txt_verification_required';

        return reverseEtl.deliveryTargets.map((target) => ({
            target,
            status: targetStatus,
            reason,
            emittedAt
        }));
    }

    public shouldStopForError(message: string, reverseEtl: ReverseEtlStreamPlan): boolean {
        const normalized = message.toLowerCase();
        return reverseEtl.limits.stopOnErrors.some((errorToken) => normalized.includes(errorToken.toLowerCase()));
    }
}
