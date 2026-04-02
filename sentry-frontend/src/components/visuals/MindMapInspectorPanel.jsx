import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Code2,
    Sparkles
} from 'lucide-react';

const buildResponse = (payload, ui) => {
    const subject = payload?.subjectName || 'this layer';
    const summary = payload?.summary || `Parrot is reviewing ${subject}.`;
    const suggestions = payload?.suggestions || [];
    const findings = payload?.sentinelFindings || [];
    const openFindings = findings.filter((finding) => finding.status !== 'resolved');
    const resolvedFindings = findings.filter((finding) => finding.status === 'resolved');
    const firstRecommendationId = payload?.recommendationSummary?.[0]?.id || null;
    const accepted = firstRecommendationId ? ui.isRecommendationAccepted(firstRecommendationId) : false;

    const sections = [
        {
            title: null,
            paragraphs: [summary]
        }
    ];

    if (openFindings.length > 0) {
        sections.push({
            title: 'Sentinel',
            bullets: openFindings.map((finding) => `${finding.title}: ${finding.detail}`)
        });
    } else if (resolvedFindings.length > 0) {
        sections.push({
            title: 'Sentinel',
            bullets: resolvedFindings.map((finding) => finding.resolution || `${finding.title} was already aligned by Sentinel.`)
        });
    }

    if (suggestions.length > 0) {
        sections.push({
            title: 'PNE',
            bullets: suggestions.slice(0, 3).map((suggestion) => `${suggestion.title}: ${suggestion.rationale}`)
        });
    }

    if (payload?.codeArtifacts?.length > 0) {
        const artifact = payload.codeArtifacts[0];
        sections.push({
            title: 'Logic',
            paragraphs: [`The active logic is available as ${artifact.language?.toUpperCase() || 'code'}. Open code if you want to inspect the compiled path directly.`]
        });
    }

    sections.push({
        title: 'Next step',
        paragraphs: [
            accepted
                ? `This recommendation is already accepted for ${subject}.`
                : openFindings.length > 0
                    ? `Let Sentinel finish the open checks on ${subject} before promoting the next change.`
                    : suggestions.length > 0
                        ? `Review the recommendation and decide whether ${subject} should move to the next version.`
                        : `No immediate action is required on ${subject}.`
        ]
    });

    let statusLabel = 'Active';
    let StatusIcon = Sparkles;
    let statusClassName = 'text-[#A8C7FA]';

    if (accepted) {
        statusLabel = 'Accepted';
        StatusIcon = CheckCircle2;
        statusClassName = 'text-emerald-300';
    } else if (payload?.statusTone === 'recommended') {
        statusLabel = 'Suggested';
        StatusIcon = Clock3;
        statusClassName = 'text-amber-300';
    } else if (openFindings.length > 0) {
        statusLabel = 'Sentinel watching';
        StatusIcon = AlertTriangle;
        statusClassName = 'text-amber-300';
    } else if (resolvedFindings.length > 0) {
        statusLabel = 'Aligned';
        StatusIcon = CheckCircle2;
        statusClassName = 'text-emerald-300';
    }

    return {
        sections,
        statusLabel,
        StatusIcon,
        statusClassName
    };
};

const MindMapInspectorPanel = observer(({ editor, ui, onOpenCode }) => {
    const payload = editor.payload || {};

    const response = useMemo(
        () => buildResponse(payload, ui),
        [payload, ui]
    );

    const firstCodeArtifact = payload?.codeArtifacts?.[0] || null;

    return (
        <div className="h-full overflow-auto bg-[#1E1F20] text-[#E3E3E3]">
            <article className="mx-auto max-w-3xl px-8 py-8">
                <div className="mb-8 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] ${response.statusClassName}`}>
                            <response.StatusIcon size={13} />
                            <span>{response.statusLabel}</span>
                        </div>
                        <h2 className="mt-3 text-2xl font-medium text-white">{payload.subjectName || editor.title}</h2>
                    </div>

                    {firstCodeArtifact && (
                        <button
                            className="shrink-0 rounded-full border border-[#3C4043] px-3 py-2 text-xs text-[#C4C7C5] hover:border-[#A8C7FA] hover:text-white"
                            onClick={() => onOpenCode(firstCodeArtifact)}
                        >
                            <span className="inline-flex items-center gap-2">
                                <Code2 size={13} />
                                Open code
                            </span>
                        </button>
                    )}
                </div>

                <div className="space-y-8 text-[15px] leading-8 text-[#D6DADE]">
                    {response.sections.map((section, index) => (
                        <section key={`${section.title || 'intro'}-${index}`}>
                            {section.title && (
                                <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8E918F]">
                                    {section.title}
                                </h3>
                            )}

                            {section.paragraphs?.map((paragraph, paragraphIndex) => (
                                <p key={`${index}-paragraph-${paragraphIndex}`} className="text-[#D6DADE]">
                                    {paragraph}
                                </p>
                            ))}

                            {section.bullets?.length > 0 && (
                                <ul className="space-y-3">
                                    {section.bullets.map((bullet, bulletIndex) => (
                                        <li key={`${index}-bullet-${bulletIndex}`} className="pl-4 text-[#D6DADE]">
                                            <span className="mr-2 text-[#8E918F]">•</span>
                                            <span>{bullet}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            </article>
        </div>
    );
});

export default MindMapInspectorPanel;
