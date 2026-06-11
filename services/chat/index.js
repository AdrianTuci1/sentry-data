/**
 * Sentry Chat Agent — project-scoped AI assistant.
 *
 * Runs as a standalone service (Cloud Run or Modal).
 * Communicates with Sentry backend for context (org, project, data catalog).
 * Uses direct LLM API (OpenAI/Gemini) with function calling for tools.
 *
 * Flow:
 *   POST /chat/message → inject context → LLM with tools → SSE stream back
 */

import express from 'express';
import cors from 'cors';
import { Firestore } from '@google-cloud/firestore';

const app = express();
app.use(cors());
app.use(express.json());

const firestore = new Firestore();
const PORT = process.env.PORT || 8080;

// ═══════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'gemini';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api/v1';
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'dev-internal-token';

// ═══════════════════════════════════════════════════
// AUTH MIDDLEWARE — only accept requests from backend
// ═══════════════════════════════════════════════════

function requireInternalToken(req, res, next) {
  const token = req.headers['x-internal-token'];
  if (!token || token !== INTERNAL_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized — internal only' });
  }
  next();
}

const SYSTEM_PROMPT = `You are the Sentry AI Assistant, a project-scoped data agent. You help users connect data sources, explore analytics, and get insights.

CONTEXT YOU ALWAYS HAVE:
- Organization: {orgName} (plan: {orgPlan})
- Project: {projectName}
- Data catalog: {dataCatalog}
- Available widgets: {widgetList}
- Connected integrations: {integrations}

YOUR CAPABILITIES:
1. Guide users through connecting new data sources (Stripe, GA4, Shopify, etc.)
2. Answer questions about their data using analytics queries
3. Embed relevant widgets directly in the chat
4. Recommend connectors based on what's missing
5. Open integration modals for the user to enter credentials

RULES:
- Always check the data catalog before answering data questions
- If asked about data you don't have, suggest connecting the relevant source
- Use open_integration_modal when user wants to connect something
- Use show_widget when asked about metrics/charts
- Be concise. Romanian or English based on what the user uses.
- Never invent data. If you can't answer, say so and suggest a connector.`;

// ═══════════════════════════════════════════════════
// TOOL DEFINITIONS (LLM function calling)
// ═══════════════════════════════════════════════════

const TOOLS = [
  {
    name: 'open_integration_modal',
    description: 'Trigger the UI to open the connection form for a specific connector type. Use when user wants to connect a data source.',
    parameters: {
      type: 'object',
      properties: {
        connector_type: { type: 'string', enum: ['GA4', 'Stripe', 'Shopify', 'HubSpot', 'PostHog', 'Salesforce', 'BigQuery', 'Sentry', 'Slack', 'Klaviyo', 'Custom API'], description: 'The connector type to connect' },
      },
      required: ['connector_type'],
    },
  },
  {
    name: 'show_widget',
    description: 'Embed a dashboard widget directly in the chat. Use when user asks about specific metrics or wants to see data.',
    parameters: {
      type: 'object',
      properties: {
        widget_query_ref: { type: 'string', description: 'The query reference ID of the widget to show' },
        title: { type: 'string', description: 'Display title for the embedded widget' },
      },
      required: ['widget_query_ref', 'title'],
    },
  },
  {
    name: 'suggest_connectors',
    description: 'Suggest relevant connectors the user should add based on their current data gaps.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why these connectors are recommended' },
        connectors: { type: 'array', items: { type: 'string' }, description: 'List of connector names' },
      },
      required: ['connectors'],
    },
  },
  {
    name: 'run_analytics_query',
    description: 'Run an analytics query against the project data. Use when user asks a specific data question.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Natural language question to answer with data' },
        sql: { type: 'string', description: 'SQL query to run (BigQuery)' },
      },
      required: ['question', 'sql'],
    },
  },
  {
    name: 'navigate_to',
    description: 'Navigate the user to a specific section of the app.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['analytics', 'integrations', 'graph', 'settings', 'stats', 'billing'], description: 'Section to navigate to' },
      },
      required: ['section'],
    },
  },
];

// ═══════════════════════════════════════════════════
// CONTEXT LOADER
// ═══════════════════════════════════════════════════

async function loadContext(orgId, projectId, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const [org, catalog, spec, integrations] = await Promise.allSettled([
    fetch(`${BACKEND_URL}/organizations/${orgId}`, { headers }).then(r => r.json()).catch(() => null),
    fetch(`${BACKEND_URL}/organizations/${orgId}/projects/${projectId}/specs/data-catalog`, { headers }).then(r => r.json()).catch(() => null),
    fetch(`${BACKEND_URL}/organizations/${orgId}/projects/${projectId}/specs`, { headers }).then(r => r.json()).catch(() => null),
    fetch(`${BACKEND_URL}/organizations/${orgId}/projects/${projectId}/integrations`, { headers }).then(r => r.json()).catch(() => null),
  ]);

  return {
    orgName: org.value?.data?.name || org.value?.name || 'Unknown',
    orgPlan: org.value?.data?.plan || org.value?.plan || 'Starter',
    projectName: projectId,
    dataCatalog: catalog.value?.tables?.map(t => `${t.short_name} (${t.row_count} rows)`)?.join(', ') || 'No data yet',
    widgetList: spec.value?.widgets?.map(w => `${w.title || w.id} (${w.type})`)?.join(', ') || 'No widgets',
    integrations: integrations.value?.data?.map(i => i.name || i.type)?.join(', ') || 'None',
  };
}

// ═══════════════════════════════════════════════════
// LLM CALL (with function calling + streaming)
// ═══════════════════════════════════════════════════

function buildSystemPrompt(context) {
  return SYSTEM_PROMPT
    .replace('{orgName}', context.orgName)
    .replace('{orgPlan}', context.orgPlan)
    .replace('{projectName}', context.projectName)
    .replace('{dataCatalog}', context.dataCatalog)
    .replace('{widgetList}', context.widgetList)
    .replace('{integrations}', context.integrations);
}

async function* streamLLMResponse(messages, systemPrompt) {
  if (LLM_PROVIDER === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
        tools: TOOLS.map(t => ({ type: 'function', function: t })),
        tool_choice: 'auto',
        stream: true,
      }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: 'text', content: delta.content };
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                yield { type: 'tool_call', id: tc.id, name: tc.function?.name, args: tc.function?.arguments };
              }
            }
          } catch {}
        }
      }
    }
  } else {
    // Gemini
    const { GoogleGenAI } = await import('@google/genai');
    const genai = new GoogleGenAI({ apiKey: LLM_API_KEY });

    const chat = genai.chats.create({
      model: LLM_MODEL,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: TOOLS }],
      },
      history: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });

    const lastMsg = messages[messages.length - 1];
    const result = await chat.sendMessageStream({ message: lastMsg.content });

    for await (const chunk of result) {
      if (chunk.text) {
        yield { type: 'text', content: chunk.text };
      }
      if (chunk.functionCalls) {
        for (const fc of chunk.functionCalls) {
          yield { type: 'tool_call', id: fc.id, name: fc.name, args: JSON.stringify(fc.args) };
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════
// TOOL EXECUTORS
// ═══════════════════════════════════════════════════

async function executeToolCall(name, args, orgId, projectId, token) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  switch (name) {
    case 'open_integration_modal':
      return { type: 'action', action: 'open_integration_modal', connector: args.connector_type };

    case 'show_widget':
      return { type: 'widget', queryRef: args.widget_query_ref, title: args.title };

    case 'suggest_connectors':
      return { type: 'suggestion', reason: args.reason, connectors: args.connectors };

    case 'run_analytics_query':
      try {
        const res = await fetch(
          `${BACKEND_URL}/organizations/${orgId}/projects/${projectId}/analytics/query`,
          { method: 'POST', headers, body: JSON.stringify({ sql: args.sql }) }
        );
        const data = await res.json();
        return { type: 'query_result', question: args.question, result: data };
      } catch {
        return { type: 'error', message: 'Query failed. Check the data source.' };
      }

    case 'navigate_to':
      return { type: 'action', action: 'navigate', section: args.section };

    default:
      return { type: 'error', message: `Unknown tool: ${name}` };
  }
}

// ═══════════════════════════════════════════════════
// CONVERSATION PERSISTENCE (Firestore)
// ═══════════════════════════════════════════════════

function conversationRef(orgId, projectId, sessionId) {
  return firestore
    .collection('organizations').doc(orgId)
    .collection('projects').doc(projectId)
    .collection('chatSessions').doc(sessionId);
}

async function loadConversation(orgId, projectId, sessionId) {
  const doc = await conversationRef(orgId, projectId, sessionId).get();
  return doc.exists ? doc.data().messages || [] : [];
}

async function saveConversation(orgId, projectId, sessionId, messages) {
  await conversationRef(orgId, projectId, sessionId).set({
    messages,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

// ═══════════════════════════════════════════════════
// INTERNAL SSE ENDPOINT — called by backend proxy only
// ═══════════════════════════════════════════════════

app.post('/internal/message', requireInternalToken, async (req, res) => {
  const { orgId, projectId, sessionId, message, backendToken } = req.body;
  // backendToken is the user's JWT from the main backend — used to call backend APIs on user's behalf

  if (!orgId || !projectId || !sessionId || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // Load context
    const context = await loadContext(orgId, projectId, backendToken);
    const history = await loadConversation(orgId, projectId, sessionId);
    const systemPrompt = buildSystemPrompt(context);

    // Build messages array
    const messages = [
      ...history.slice(-20), // last 20 messages for context window
      { role: 'user', content: message },
    ];

    // Stream LLM response
    let assistantContent = '';
    const toolCalls = [];

    for await (const event of streamLLMResponse(messages, systemPrompt)) {
      if (event.type === 'text') {
        assistantContent += event.content;
        send({ type: 'text', content: event.content });
      } else if (event.type === 'tool_call') {
        toolCalls.push(event);
      }
    }

    // Execute tool calls
    for (const tc of toolCalls) {
      const args = JSON.parse(tc.args || '{}');
      const result = await executeToolCall(tc.name, args, orgId, projectId, backendToken);
      send({ type: 'tool_result', id: tc.id, ...result });
    }

    // Save to Firestore
    if (assistantContent || toolCalls.length > 0) {
      const newMessages = [
        ...history,
        { role: 'user', content: message },
        {
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
      ];
      await saveConversation(orgId, projectId, sessionId, newMessages);
    }

    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// Health
app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Chat Agent running on :${PORT}`);
  console.log(`  LLM: ${LLM_PROVIDER}/${LLM_MODEL}`);
});
