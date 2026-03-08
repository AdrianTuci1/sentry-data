# Setup Servicii Externe (E2B, Modal, R2)

Acest document descrie arhitectura și principiile de integrare pentru serviciile externe în Central Backend.

## 1. Abstracția Sandbox-urilor pentru Agenți (Agent Execution)
**Problemă:** Vrem să folosim **E2B** pentru free tier, dar trebuie să avem posibilitatea de a schimba ușor către **Modal** pentru execuția agenților.
**Soluție:** Vom folosi **Strategia/Adapter Pattern**.
- Construim o interfață comună `ISandboxProvider` care definește metode precum:
  - `startSandbox(config): Promise<string>`
  - `executeTask(sandboxId, code/script): Promise<Result>`
  - `stopSandbox(sandboxId): Promise<void>`
- Implementăm `E2BSandboxProvider` și `ModalSandboxProvider`.
- Injectăm provider-ul dorit prin Dependency Injection în `AgentService`. Configurarea (variabile de mediu) va dicta care provider va fi injectat la runtime (ex. `USE_SANDBOX=e2b`).

## 2. Abstracția pentru ML Inference
**Problemă:** Inferența pentru Machine Learning se va rula *întotdeauna* în **Modal**.
**Soluție:**
- Vom crea `ModalInferenceProvider` (sau `MLInferenceService`) dedicat pentru a trimite request-uri către funcțiile/aplicațiile Modal deja deployate.

## 3. Stocare: Cloudflare R2
**Problemă:** Lipsa unui director de configurare și a unei integrări ierarhice pentru R2.
**Soluție:**
- Creăm `src/config` unde stocăm credențialele validate și logica legată de configurarea serviciilor externe.
- Implementăm `R2StorageService` care împachetează instanța S3 Client din AWS SDK, configurată special pentru endpoint-ul Cloudflare. Acesta va avea rolul de a gestiona rutele pentru fișierele Parquet (rezultate din Meltano) și eventualele modele ML.

## 4. Refactoring OOP pentru Core (`app.ts` și `server.ts`)
- **`app.ts`**: În loc să avem o funcție `createApp()`, vom avea o clasă `App`. Constructorul acesteia va inițializa Express, middleware-urile și rutele.
- **`server.ts`**: Va deveni clasa `Server` care preia clasa `App` și containerul DI, ocupându-se exclusiv de pornirea serverului de rețea (listen), prinderea evenimentelor sistemului și gracefully shutting down.

## 5. Rute și Controller de Bază
- Adăugăm directoare clare de rutare care se înregistrează dinamic, separând `WebhookController` (pentru Meltano/E2B triggers) de API-ul standard. Vom asigura o structură OOP unde Controllerele sunt date direct în `App` via DI.
