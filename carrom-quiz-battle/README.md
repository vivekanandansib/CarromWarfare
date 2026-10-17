# Carrom Warfare

Two-player, turn-based quiz + carrom game. Pick a coin → answer a question → pocket it.
Queen needs a cover. First to the target score wins.

- **Phase 1 (done, playable):** standalone React+TS app in `app/` — real engine, tests, persistence.
- **Phase 2 (deployed to Power Platform):**
  - Power Apps **code app** `Carrom Warfare` in `code-app/` — React 19 + SharePoint
    connector (4 lists as data sources), pushed to the `CarromBattle` solution.
    **Play:** https://apps.powerapps.com/play/e/73f52288-2cbd-e6f3-b14d-6e12b85e8fdb/app/d202983a-b850-40ab-83e0-314f2a90ecee?tenantId=c1f700ef-8f79-4deb-8546-8712177d669e
  - PCF `CarromQuizBoard` in `pcf/` (builds green, pushed + in solution) — reusable
    embedded control for Canvas apps.
  - SharePoint schema + seed in `sharepoint/`, winner-flow spec in `power-automate/`,
    deploy guide in `docs/deployment.md`.

## Run (Phase 1)

Prerequisites: Node 18+.

```powershell
cd carrom-quiz-battle/app
npm install
npm test      # vitest unit tests (rules, queen+cover, idempotency, questions)
npm run build # tsc + vite production build
npm run dev   # local play at http://localhost:5173
```

## How it plays

- Either player selects any available coin (Tab + Enter works, tablet touch targets ≥44px).
- Each turn runs on a **shot clock** (15/30/45/60s) — expiry forfeits the turn.
- Correct → animated pocket, same player continues. Wrong → **miss animation** (coin slides off-target, stays in play), turn passes, correct answer revealed.
- Shots matter: **Straight +10** (any) · **Cut +12** (medium+) · **Bank +15** (hardest) · **Defensive +10** (easy). No physics simulated.
- Queen (red): hard question → pocket → **must pocket another coin next turn** or she returns. Cover bonus +20.
- Same laptop or **online rooms** (6-letter code, board mirrors every ~2s). Pause/restart included.

## Repo map

```
docs/architecture.md   — architecture + data contracts + SharePoint/PCF plan
docs/deployment.md     — deploy runbook + honest done/not-done table
app/src/game/          — pure engine: types, engine, questions, events, storage, sound
app/src/data/          — sample Learning + Strategy question bank
app/src/components/    — Board (SVG), QuestionDialog, Panels, Screens
app/src/game/*.test.ts — 40 acceptance-mapped unit tests (rules, queen, shots, clock, online, sync)
pcf/CarromQuizBoard/   — PCF control (reuses app engine/UI; npm run build green)
sharepoint/            — CreateCarromLists.ps1 + SeedCarromQuestions.ps1 (PnP)
canvas-app/            — powerfx-carrom.ts formula reference (mirrors sharepointSync.ts)
power-automate/        — CarromWinnerFlow.md (design spec)
```

## Limitations (honest)

- Shots are animated paths, not simulated physics.
- Answers are validated in-client; production must validate server-side (see architecture §7).
- No Power Apps import/publish or SharePoint provisioning has been performed in Phase 1.
