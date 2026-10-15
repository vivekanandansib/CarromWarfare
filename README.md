# 🎯 Carrom Quiz Battle (CarromWarfare)

A two-player, turn-based **quiz + carrom** game. Pick a coin → answer a question → pocket it.
Play on the **same laptop**, or **online across two laptops** via room codes. Queen needs a
cover. Wrong answers send the coin off-target. Every turn runs on a shot clock — and every
shot style changes the questions and the points.

**▶️ Play (live):**
https://apps.powerapps.com/play/e/73f52288-2cbd-e6f3-b14d-6e12b85e8fdb/app/d202983a-b850-40ab-83e0-314f2a90ecee?tenantId=c1f700ef-8f79-4deb-8546-8712177d669e

## How it plays

| Shot | Questions | Points |
|---|---|---|
| Straight +10 | any difficulty | 10 |
| Cut +12 | difficulty ≥ 2 | 12 |
| Bank +15 | hardest available | 15 |
| Defensive +10 | difficulty 1 only | 10 |

- ⏱ Configurable shot clock (15/30/45/60s). Expiry forfeits the turn.
- 👑 Queen (red): hard question → pocket → **cover** with another coin next turn (+20 bonus) or she returns.
- 🌐 Online rooms: host gets a 6-letter code, guest joins from another laptop, board mirrors every ~2s.
- Same-laptop 2-player, pause/restart, keyboard + tablet friendly.

## Repo map

```
carrom-quiz-battle/
  app/          — standalone React+TS game (Vite) + 40 unit tests
  code-app/     — Power Apps code app (React 19 + SharePoint connector) — the live app
  pcf/          — CarromQuizBoard PCF control (reusable Canvas component)
  sharepoint/   — list schema scripts + manual setup guide + question seed
  canvas-app/   — Power Fx reference formulas (alternative hosting)
  power-automate/ — winner-flow design spec
  solution/     — CarromBattle Dataverse solution project
  docs/         — architecture + data contracts, deployment runbook
```

## Run locally

```powershell
cd carrom-quiz-battle/app
npm install; npm test; npm run dev   # http://localhost:5173
```

## Live deployment (already done)

- Power Apps code app `Carrom Quiz Battle` (app id `d202983a-…`) in solution **`CarromBattle`** v1.0
- PCF control `cb_CarromBattle.CarromQuizBoard` pushed + published
- SharePoint lists `CarromQuestions / CarromSessions / CarromAttempts / CarromCoinEvents`
  on `/sites/Powerapps`, wired as code-app data sources

Details + runbook: [`carrom-quiz-battle/docs/deployment.md`](carrom-quiz-battle/docs/deployment.md).
Architecture + contracts: [`carrom-quiz-battle/docs/architecture.md`](carrom-quiz-battle/docs/architecture.md).
