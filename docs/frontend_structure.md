# Sentry Agentic Frontend Structure

## Overview
This document outlines the frontend architecture for the Sentry Agentic Service. The application mimics the "Gemini" interface but is specialized for ML workflows. It uses **Vite + React** and communicates with the backend via **WebSockets** and **REST APIs**.

## core Tech Stack
- **Framework:** React 18+
- **Build Tool:** Vite
- **Styling:** TailwindCSS (with custom "Gemini-like" theme variables)
- **State Management:** Zustand (for global store: user, active session, models) + TanStack Query (for async data)
- **Real-time:** Socket.io-client or native WebSockets
- **Visuals:** Framer Motion (animations), Recharts (metrics), Monaco Editor (code viewing)

## Directory Structure
```
sentry-frontend/
├── public/                 # Static assets
├── src/
│   ├── assets/             # Images, fonts, icons
│   ├── components/
│   │   ├── common/         # Buttons, Inputs, Modals (Atomic design)
│   │   ├── layout/         # Sidebar, MainLayout, Header
│   │   ├── chat/           # ChatBubble, InputArea, ThinkingIndicator
│   │   ├── visuals/        # DataVisualizer, DriftChart, TrainingLossGraph
│   │   └── sandbox/        # TerminalView, FileExplorer (E2B integration)
│   ├── context/            # AuthContext, WebSocketContext
│   ├── hooks/              # Custom hooks (useChat, useModelMetrics)
│   ├── pages/
│   │   ├── Home.jsx        # "How can I help you" initial state
│   │   ├── Session.jsx     # Active chat/agent session
│   │   └── Dashboard.jsx   # Grid of launched models and high-level stats
│   ├── services/           # API calls, WebSocket services
│   ├── stores/             # Zustand stores (useSessionStore, useUIStore)
│   ├── styles/             # Global CSS, Tailwind extensions
│   ├── utils/              # Formatters, constants
│   ├── App.jsx             # Main router and provider setup
│   └── main.jsx            # Entry point
└── vite.config.js          # Configuration
```

## Key Components

### 1. Main Layout
- **Sidebar (Left):**
  - **History:** List of past agent sessions.
  - **Deployed Models:** Section showing active models with mini-metrics (e.g., green dot for online, throughput number).
  - **Connectors:** Quick access to define Train/Test data sources.
- **Main Area (Center):**
  - **Chat Interface:**
    - "Gemini-style" input box centered initially, moves to bottom during chat.
    - Chat history with Markdown support.
  - **Action Window (Right/Overlay):**
    - A dynamic pane that changes based on context (e.g., "Data Discovery", "Training Progress", "Cost Estimation").
    - **Visualizer:** Tabs for Data Preview (Table), Feature Correlation (Heatmap), Model Performance (Curves).

### 2. User Flows & UI States

#### A. Initial State
- **Visual:** Clean, centered input box. Logo/Branding above.
- **Prompt:** "How can I help you today?"
- **Suggestions:** Chips below input (e.g., "Train a classifier", "Analyze S3 bucket").

#### B. Discovery Phase (Lakehouse Scan)
- **Action:** Agent scans S3/DuckDB.
- **Visual:** Left side chat shows "Scanning...". Right side "Action Window" shows a file tree or table of discovered datasets.
- **Interaction:** User selects files -> "Proceed".

#### C. Plan & Estimate (The Brain)
- **Action:** Agent proposes a plan (e.g., "Normalize data, Train XGBoost, Deploy").
- **Visual:** Markdown plan in chat.
- **Modal:** Pop-up or highlight for "Cost Warning" (e.g., "Estimated cost: $5.20 on Modal.com").
- **Control:** "Proceed" / "Edit Plan" buttons.

#### D. Execution (The Muscle)
- **Action:** Job running on E2B/Modal.
- **Visual:**
  - Real-time terminal output (collapsible).
  - Live metric updates in the "Action Window" (Loss curves updating via WebSocket).
  - Progress bars.

## Design System (Gemini-like)
- **Colors:** Deep charcoal backgrounds (#1e1e1e), soft blues/purples for accents (gradients), crisp white text.
- **Typography:** Inter or Roboto. Clean, readable.
- **Components:** Rounded corners, glassmorphism logic for overlays, subtle glow effects for "AI thinking".

## Integration Points
- **WebSockets:** `/ws/session/{id}` for streaming stdout from E2B and status updates.
- **API:** REST endpoints for listing models, fetching history, triggering Modal jobs.
