import React, { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { observer } from 'mobx-react-lite';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Sparkles
} from 'lucide-react';

const buildResponse = (payload, ui) => {
    const subject = payload?.subjectName || 'this layer';
    const summary = payload?.summary || `Parrot is reviewing ${subject}.`;
    const description = payload?.description || '';
    const suggestions = payload?.suggestions || [];
    const findings = payload?.sentinelFindings || [];
    const openFindings = findings.filter((finding) => finding.status !== 'resolved');
    const resolvedFindings = findings.filter((finding) => finding.status === 'resolved');
    const firstRecommendationId = payload?.recommendationSummary?.[0]?.id || null;
    const accepted = firstRecommendationId ? ui.isRecommendationAccepted(firstRecommendationId) : false;

    const sections = [
        {
            title: 'Description',
            paragraphs: [description, summary].filter(Boolean)
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
        const artifacts = payload.codeArtifacts.slice(0, 3);
        sections.push({
            title: 'Logic',
            paragraphs: [`The active logic is available below as ${artifacts[0]?.language?.toUpperCase() || 'code'}.`],
            codeBlocks: artifacts.map((artifact) => ({
                label: artifact.title,
                language: artifact.language,
                code: artifact.code
            }))
        });
    }

    if (payload?.processSteps?.length > 0) {
        sections.push({
            title: 'Process',
            bullets: payload.processSteps.map((step) => `${step.title}: ${step.detail}`),
            codeBlocks: payload.processSteps.map((step) => ({
                label: `${step.title} · ${step.language?.toUpperCase() || 'CODE'}`,
                language: step.language,
                code: step.code
            }))
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

const normalizeEditorLanguage = (language) => {
    if (language === 'pandas') {
        return 'python';
    }

    if (language === 'text') {
        return 'plaintext';
    }

    return language || 'plaintext';
};

const getEditorHeight = (code = '') => {
    const lineCount = String(code).split('\n').length;
    const visibleLines = Math.min(Math.max(lineCount, 4), 18);
    return `${(visibleLines * 22) + 20}px`;
};

const getCodeBlockPath = (block, language) => {
    const normalizedId = (block.id || block.label || 'artifact')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .toLowerCase();

    const extensionByLanguage = {
        python: 'py',
        sql: 'sql',
        yaml: 'yaml',
        json: 'json',
        plaintext: 'txt'
    };

    const extension = extensionByLanguage[language] || 'txt';
    return `mindmap/${normalizedId}.${extension}`;
};

const InspectorCodeBlock = ({ block }) => {
    const language = normalizeEditorLanguage(block.language);
    const [draftCode, setDraftCode] = useState(() => block.code || '');

    return (
        <div className="overflow-hidden rounded-2xl border border-[#31343A] bg-[#141619]">
            <div className="flex items-center justify-between border-b border-[#2A2D31] px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-[#8E918F]">
                <span>{block.label}</span>
                <span>{block.language || 'code'}</span>
            </div>
            <Editor
                path={getCodeBlockPath(block, language)}
                height={getEditorHeight(draftCode)}
                language={language}
                value={draftCode}
                theme="vs-dark"
                onMount={(editorInstance) => {
                    const formatAction = editorInstance.getAction('editor.action.formatDocument');
                    if (formatAction) {
                        formatAction.run().catch(() => {});
                    }
                }}
                onChange={(value) => setDraftCode(value || '')}
                options={{
                    readOnly: false,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    glyphMargin: false,
                    folding: false,
                    lineDecorationsWidth: 10,
                    overviewRulerBorder: false,
                    overviewRulerLanes: 0,
                    renderLineHighlight: 'none',
                    padding: { top: 10, bottom: 10 },
                    fontSize: 12,
                    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}
            />
        </div>
    );
};

const MindMapInspectorPanel = observer(({ editor, ui }) => {
    const payload = useMemo(() => editor.payload || {}, [editor.payload]);

    const response = useMemo(
        () => buildResponse(payload, ui),
        [payload, ui]
    );

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

                            {section.codeBlocks?.length > 0 && (
                                <div className="mt-4 space-y-4">
                                    {section.codeBlocks.map((block, blockIndex) => (
                                        <InspectorCodeBlock
                                            key={`${index}-code-${block.id || blockIndex}-${block.language || 'text'}-${block.code || ''}`}
                                            block={block}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            </article>
        </div>
    );
});

export default MindMapInspectorPanel;
