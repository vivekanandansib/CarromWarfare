# Carrom Quiz Battle — Deployment Guide

## LIVE (deployed 2026-10-14/15)

- **Play:** https://apps.powerapps.com/play/e/73f52288-2cbd-e6f3-b14d-6e12b85e8fdb/app/d202983a-b850-40ab-83e0-314f2a90ecee?tenantId=c1f700ef-8f79-4deb-8546-8712177d669e
- Code app id: `d202983a-b850-40ab-83e0-314f2a90ecee` · env id `73f52288-2cbd-e6f3-b14d-6e12b85e8fdb`
- Solution: **`CarromBattle`** v1.0 (unmanaged) · publisher prefix `cb`
- PCF control: `cb_CarromBattle.CarromQuizBoard` (pushed + published)
- SharePoint site: `https://signatechservices0.sharepoint.com/sites/Powerapps`
  (`CarromQuestions / CarromSessions / CarromAttempts / CarromCoinEvents`),
  via the connected `shared_sharepointonline` connection
- Source of truth for redeploys: this repo (`carrom-quiz-battle/`) — see §4.

## 0. What is done vs. not done (honest status)

| Step | Status |
|---|---|
| Standalone game build + 27 unit tests | ✅ Run green (`carrom-quiz-battle/app`) |
| SharePoint lists (manual UI, per `sharepoint/MANUAL_SETUP.md`) | ✅ Created by maker, verified via connector metadata read |
| **Code app `Carrom Quiz Battle` (React 19 + SharePoint connector)** | ✅ **Pushed live, in `CarromBattle` solution** (app id `d202983a-…`) |
| PCF `CarromQuizBoard` build + push + solution import | ✅ Done (`cb_CarromBattle.CarromQuizBoard`, solution v1.0) |
| Sync-contract tests (payloads, bridge, idempotency) | ✅ 9 tests green |
| Canvas App manual assembly | ⏭️ Superseded by the code app (formulas kept as reference) |
| Power Automate winner flow | 📝 Designed (spec in `power-automate/`), not deployed |

## 1. Prerequisites

- Node 18+, .NET SDK, Power Platform CLI (`pac`), PnP.PowerShell module.
- A Dataverse environment + a SharePoint site (e.g. `/sites/CarromBattle`).
- Publisher prefix (e.g. `cb`) for the PCF push.

## 2. SharePoint (5 min, needs tenant admin/site owner)

```powershell
Install-Module -Name PnP.PowerShell -Force -AllowClobber
Connect-PnPOnline -Url "https://<your-tenant>.sharepoint.com/sites/CarromBattle" -Interactive
cd carrom-quiz-battle/sharepoint
.\CreateCarromLists.ps1   # 4 lists, indexed/unique keys, idempotent
.\SeedCarromQuestions.ps1 # 14 questions, idempotent
```

Verify: 4 lists exist; `CarromQuestions` has 14 active rows; `EventKey` is unique-indexed.

## 3. PCF control (ran green locally)

```powershell
cd carrom-quiz-battle/pcf/CarromQuizBoard
npm install   # IMPORTANT: use the committed package-lock.json (known-good tree).
              # A fresh resolve with newer npm hit arborist "Invalid Version" +
              # @types/node-vs-TS4.9 issues; tsconfig pins skipLibCheck + narrow types.
npm run build # expect: bundle.js + ControlManifest.xml + css, no errors
```

Push + solution (needs `pac auth` profile against your environment):

```powershell
pac auth create --name CarromEnv --url https://<your-env>.crm.dynamics.com
pac pcf push --publisher-prefix cb --solution-name CarromBattle
```

Or add the built control to a solution in maker portal → Solutions → Add existing → More → Custom control.

## 4. Code app — Carrom Quiz Battle (deployed ✅)

The primary app. React 19 + `@microsoft/power-apps` connector services.

```powershell
# Node 22+ required (portable copy used here — no admin install):
$env:PATH = "<portable-node22>;" + $env:PATH
npm install -g @microsoft/power-apps @microsoft/power-apps-cli

cd carrom-quiz-battle/code-app
npm install
npm run build                       # tsc -b && vite build → dist/
pac code add-data-source --apiId shared_sharepointonline \
  --connectionId <sp-connection-id> \
  --dataset "https://<tenant>.sharepoint.com/sites/Powerapps" \
  --table "CarromQuestions"         # repeat for CarromSessions, CarromAttempts, CarromCoinEvents
pac code push --solutionName CarromBattle
# → returns the play URL
```

Notes: use `pac code` (not the npm `power-apps` wrapper) in non-TTY shells —
the npm CLI crashes with `ERR_TTY_INIT_FAILED` without a terminal. An existing
Connected `shared_sharepointonline` connection was reused (see `pac connection list`).

## 5. Canvas App (alternative, manual — superseded by the code app)

1. Create blank tablet Canvas App → add SharePoint connector → connect the 4 lists.
2. Add screens: `scrSetup` (names/target inputs), `scrBoard` (insert **Carrom Quiz Battle** custom control as `ctlBoard`), `scrResults`.
3. Paste formulas from `canvas-app/powerfx-carrom.ts`: `App.OnStart`, control bindings, `ctlBoard.OnChange`, results labels.
4. Play-test: correct pockets one coin; wrong passes turn; Queen cover; airplane-mode mid-game shows `VarSyncError` banner + Retry works.
5. File → Save → Publish. Share with players (SharePoint auth comes from the connector — **no secrets in code**).

## 5. Power Automate (optional, recommended)

Import/create `Carrom — Game Finished` per `power-automate/CarromWinnerFlow.md`
(trigger: `CarromSessions` marked completed → set Winner + announce). Per-attempt
flows are deliberately avoided (cost/latency); attempts patch directly from Canvas.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `QuestionsJson is empty` banner | `colQuestions` empty → check SharePoint connection + `IsActive` flags |
| `Invalid Version` on fresh `npm install` | Delete `node_modules`, restore committed `package-lock.json`, retry (do NOT free-resolve) |
| TS errors in `@types/node/*.d.ts` | Keep `skipLibCheck` + narrow `types` in `tsconfig.json` |
| Duplicate scores after replay | Check `EventKey` unique index on `CarromCoinEvents`; OnChange upserts via `LookUp` |
| Control shows stale game | `SessionConfigJson.sessionId` must change per game (GUID in OnStart) |
