# Carrom Quiz Battle — Architecture & Data Contracts (Phase 1 + plan for Phase 2/3)

## 1. Repository structure

```
carrom-quiz-battle/
  README.md                  — setup, run, test, deploy overview
  docs/
    architecture.md          — this file (architecture + data contracts)
    deployment.md            — Canvas App + PCF + SharePoint deploy guide (Phase 2)
    powerfx-formulas.md      — Power Fx snippets (Phase 2)
  app/                       — PHASE 1: standalone React+TS game (Vite). Runs & tests independently.
    src/game/                — pure game engine (no React): types, engine, questions, events, storage
    src/data/                — sample question bank (Learning + Strategy)
    src/components/          — Board, QuestionDialog, PlayerPanel, screens
    src/game/*.test.ts       — vitest unit tests for rules + events
  pcf/CarromQuizBoard/       — PHASE 2: PCF wrapper (pac pcf init + React 16.14), reuses app/src/game
  sharepoint/                — PHASE 2: PnP.PowerShell schema (4 lists) + seed questions
  canvas-app/                — PHASE 2: session bootstrap, connector calls, GameEventJson handling
  power-automate/            — PHASE 2 (only if needed): winner notification / audit flow
```

Phase 1 (`app/`) is intentionally dependency-free of Power Platform so rules can be built,
tested, and played now. The engine (`src/game/`) is UI-agnostic so the PCF control can
import it without rewriting the question system, and a physics engine can later replace
only the animation/shot module.

## 2. Technology decisions

| Concern | Phase 1 | Phase 2 (integration) |
|---|---|---|
| UI | React 18 + TypeScript (Vite) | PCF control pins React 16.14 + TS 4.9 per `pcf-scripts`; engine code is plain TS, compatible with both |
| Board | Inline SVG (real interactive objects, not an image) + CSS transitions | Same SVG reused inside PCF |
| Sound | WebAudio oscillator beeps (no binary assets) | Same |
| Tests | Vitest | Same suites run against PCF-imported engine |
| Persistence | localStorage (reload survival) | SharePoint `CarromSessions` becomes authoritative; localStorage stays as offline cache |
| Secrets | None. Phase 1 has no credentials | Power Apps connectors own SharePoint auth; correct answers stay server-side (see §7) |

## 3. Core domain model

```ts
type CoinColor = 'white' | 'black' | 'queen';
type CoinState = 'available' | 'pocketed';
interface Coin { id: string; color: CoinColor; state: CoinState; pos: { x: number; y: number } }

type QueenState = 'available' | 'pendingCover' | 'secured';
type Phase = 'ready' | 'asking' | 'animating' | 'finished';
type ShotType = 'straight' | 'cut' | 'bank' | 'defensive';
type Category = 'Learning' | 'Strategy';

interface Question {
  id: string; text: string; category: Category; difficulty: 1 | 2 | 3;
  options: [string, string, string, string]; correctIndex: 0|1|2|3;
  hint: string; isActive: boolean;
}
interface GameConfig {
  sessionId: string; playerNames: [string, string];
  targetScore: number; pointsPerCoin?: number; queenBonus?: number;
}
interface GameState {
  sessionId: string; coins: Coin[]; queenState: QueenState;
  queenPocketedBy?: 1 | 2;               // who pocketed queen, awaiting cover
  scores: [number, number]; currentPlayer: 1 | 2; phase: Phase;
  activeCoinId?: string; activeQuestion?: Question; activeShot?: ShotType;
  answeredActive: boolean;               // duplicate-submission guard
  usedQuestionIds: string[];
  winner?: 0 | 1 | 2;                    // 0 = draw
  processedEventKeys: string[];          // idempotency
  status: 'inProgress' | 'completed';
}
```

Board: standard 19 coins — 9 white (`W1..W9`), 9 black (`B1..B9`), 1 queen (`Q`).
Positions are fixed layout coordinates (center ring + outer ring), rendered in SVG.

## 4. State machine

States: `ready, asking, animating, finished` + orthogonal `queenState`.

```
ready --selectCoin(available)--> asking
asking --correct--> animating(pocket)    (pocket exactly one coin on animation end)
asking --wrong/expiry--> animating(miss) (coin slides off-target, stays in play)
animating(pocket) --completePocket--> ready      (same player retains turn)
animating(miss) --completeMiss--> ready          (turn passes exactly once)
ready --clockExpiry(idle)--> ready               (turn passes, no animation)
animating --completePocket+win--> finished
any --winCondition--> finished
```

Guards (illegal transitions throw / return error, never mutate):
- `selectCoin` requires `phase === 'ready'`; coin must exist and be `available`;
  queen requires `queenState === 'available'` (never while `pendingCover`).
- `answer` requires `phase === 'asking'` and `answeredActive === false` (duplicate guard).
- `completeAnimation` requires `phase === 'animating'`.
- All scoring goes through `applyCoinEvent` with an `eventKey`; a repeated key is ignored
  (duplicate events never award duplicate points — acceptance #6).

Turn rules: correct normal pocket → same player retains turn. Wrong answer → turn passes.
Queen pocket → same player must cover next turn (see §5).

Win conditions (checked after every pocket):
1. A player's score ≥ `targetScore` → that player wins (higher score wins if both pass).
2. Board cleared (no `available` coins and queen not `pendingCover`) → higher score wins;
   tie-break: holder of secured queen wins; else draw (`winner = 0`).

## 5. Queen + cover (independent of animation code)

Pure functions in `engine.ts`; animation only reads `queenState`.

1. `selectCoin(Q)` (queen `available`) → asks a **hard** question (`difficulty 3` preferred).
2. Correct → queen coin `pocketed`, `queenState = pendingCover`, `queenPocketedBy = player`,
   phase `animating` → `ready`, **same player retains turn**, no bonus yet.
3. That player must select a **different available non-queen coin** next turn and answer correctly
   → cover coin pocketed (+10), queen `secured`, **+20 queen bonus** to that player.
4. Cover answer wrong → queen **returns to board** (`available`, coin `available`),
   no bonus, turn passes.
5. Queen can never be selected while `pendingCover` (guard).
6. `queenState` is always one of `available | pendingCover | secured` and shown in the UI badge.

## 6. Shot types + shot clock (real effects)

| Shot | Question pool | Points per pocket |
|---|---|---|
| straight | any difficulty | +10 |
| cut | difficulty ≥ 2 | +12 |
| bank | hardest available (difficulty 3) | +15 |
| defensive | difficulty 1 | +10 |

Queen challenges always draw the hardest questions regardless of shot. The Queen
cover bonus stays flat at +20. Turn rules are unchanged by shot.

**Shot clock** (configurable 15/30/45/60s, default 30s — tournament time limits,
extended for quiz reading): each turn must complete (select + answer) in time.
Expiry with a question open counts as a wrong answer (miss animation, turn
passes, cover fails). Expiry with no coin selected passes the turn silently —
except during a pending cover, where it returns the Queen. The clock pauses
with the game and never runs during animations. Timing lives in the UI layer;
the engine exposes `answerQuestion(-1)` (never correct), `completeMiss`, and
`expireIdleTurn` — all covered by unit tests.

## 7. Question service

`QuestionBank` class (`src/game/questions.ts`):
- `validate(q)` — 4 non-empty options, `correctIndex` in range, known category, hint present, `isActive` boolean.
- Only `isActive` questions are served; invalid records are skipped (never crash on bad data).
- No-repeat within session until pool exhausted, then the used-set resets (reshuffle).
- `nextFor(coin, queenState, difficulty?)`: queen → hardest available; else honors
  configurable category mix (default 50/50 Learning/Strategy) and avoids repeats.
- Empty bank → `selectCoin` returns a recoverable error; UI shows "No questions available" and stays in `ready`.

Production note: the sample bank ships answers client-side for the standalone game.
In production the client must NOT receive `correctIndex`; answers are validated by a
trusted operation (Power Automate flow / Dataverse custom API) and the PCF emits an
attempt event, then applies the authoritative verdict. The event schema already carries
`questionId + selectedOption` separately from any verdict for this upgrade.

## 8. GameEventJson contract (PCF output, schema versioned)

```json
{
  "schemaVersion": "1.0",
  "eventId": "evt-<uuid>",
  "sessionId": "sess-...",
  "eventType": "coinPocketed | coverSecured | coverFailed | attemptMade | turnChanged | gameFinished | sessionStarted",
  "playerNumber": 1,
  "coinId": "W3",
  "questionId": "L-04",
  "selectedOption": 2,
  "isCorrect": true,
  "pointsAwarded": 10,
  "score": [30, 20],
  "currentPlayer": 1,
  "gameStatus": "inProgress"
}
```

PCF output mechanism (exact, Phase 2): control exposes a **bound output property**
`GameEventJson: SingleLine.Text` + a `Whole.None` monotonic counter `EventSequence`.
The React layer never calls Power Apps directly; it calls `notifyOutputChanged()`,
and `getOutputs()` returns `{ GameEventJson: <latest JSON>, EventSequence: n }`.
Canvas App formula (documented in `powerfx-formulas.md`):

```
If(Value(CarromQuizBoard.EventSequence) > VarLastSeq,
  Set(VarLastSeq, Value(CarromQuizBoard.EventSequence));
  Set(VarEvent, ParseJSON(CarromQuizBoard.GameEventJson));
  Patch(CarromAttempts, ...); Patch(CarromCoinEvents, ...); Patch(CarromSessions, ...)
)
```

Idempotency: `EventKey = sessionId & "-" & eventId`; `CarromCoinEvents.EventKey` is unique —
a replayed event patches the same row, never double-scores.

## 9. SharePoint data model (Phase 2)

- **CarromQuestions**: QuestionId(Text, indexed), Title, QuestionText(Note), Category(Choice:
  Learning/Strategy), Difficulty(Number 1-3), OptionA-D(Text), CorrectOption(Number 0-3),
  Hint(Text), IsActive(Yes/No, indexed).
- **CarromSessions**: SessionId(Text, indexed/unique), Player1Name, Player2Name,
  CurrentPlayer(Number), Player1Score, Player2Score(Number), GameStatus(Choice:
  inProgress/completed), StartedAt, CompletedAt(DateTime), Winner(Number),
  WinnerComputed(Yes/No, flow re-entry guard), StateJson(Note, future full-board snapshots).
- **CarromAttempts**: AttemptId(Text), SessionId(Text, indexed), QuestionId(Text, indexed),
  PlayerNumber(Number), CoinId(Text), SelectedOption(Number), IsCorrect(Yes/No), AttemptedAt.
- **CarromCoinEvents**: EventKey(Text, indexed/unique), SessionId(Text, indexed),
  CoinId(Text), PlayerNumber(Number), EventType(Choice), PointsAwarded(Number), EventAt.
- All cross-list joins use stable `SessionId`/`QuestionId` text keys — no Lookup columns.

## 10. Acceptance mapping (where each criterion is proven)

1. Either player selects any available coin → `engine.test.ts` "open selection".
2. Correct pockets exactly one coin → test + `completeAnimation` pockets single `activeCoinId`.
3. Wrong passes turn exactly once → test asserts single toggle + `answeredActive` guard.
4/5. Queen cover success/fail → dedicated tests.
6. Duplicate events → `applyCoinEvent` dedup test.
7. Empty bank / failed persistence → `QuestionBank` empty test; `storage.ts` try/catch with error banner.
8. Reload persistence → `storage.ts` save/load + manual reload check.
9. PCF build/package → Phase 2 `pac pcf build` + solution packaging (NOT claimed until run).
10. Keyboard + tablet → coins are `<button>`s, dialog is focus-trapped-ish with Esc, layout ≥768px two-column, <768px stacked.

## 11. Limitations (honest, Phase 1)
- No real physics: shots are animation paths, not simulated collisions.
- The PCF `CarromQuizBoard` embeds the v1 engine (flat +10, no clock, no miss
  animation). Resync with the v2 engine is planned; the code app is current.
- No authoritative server scoring: answers validated in-client (production must move to §7 note).
- No Canvas App import/publish performed in Phase 1; no SharePoint lists created yet.
- Sound is synthesized beeps; no screen-reader live-region audit yet beyond aria labels.

## 12. Online rooms — two laptops (code app)

Same-laptop play is unchanged. Online rooms reuse the `CarromSessions` row as
transport — no new columns, no admin, no custom server:

- Host creates a session and gets a **6-letter room code** derived deterministically
  from the sessionId (`online.ts: roomCodeForSession`, tested). Guest finds the room
  by code among in-progress sessions and claims seat 2 (`Player2Name`).
- `StateJson` carries the full `GameState`. After every transition the acting device
  writes it; the other polls the row every 2s and adopts genuinely new snapshots
  (`shouldAdopt`: never our own echo, never mid-animation, never unchanged).
- Turns strictly alternate, so only the current player's device writes — no merges,
  no conflicts. Board, dialog, and clock are gated to `currentPlayer === mySeat`.
- Both devices run the same engine, so rules/Queen/clock behave identically.
- Attempts and coin events are written by the acting device; `EventKey` dedups replays.
- Known limits: no presence/heartbeat (a closed laptop just stops moving — the other
  waits), no rematch in-room (Play again returns to the menu for a fresh room),
  one guest per room (a second join overwrites the seat).

## 13. Classic Flick — real carrom mode (same device)

A second game next to Quiz Battle: slingshot striker, live 2D physics
(`game/physics.ts`: friction, elastic coin collisions, cushion restitution, pocket
capture, striker fouls), turn rules (`game/classic.ts`: pocket-retains-turn,
foul forfeits points, Queen + cover, target/board-clear wins — all unit-tested).

- Shots are real: drag back and release (pointer) or arrows + Enter (keyboard).
- Same look, sounds, clock, bursts, and SharePoint audit rows (sessions, coin
  events; attempts are quiz-only) with `mode: 'classic'` tagged in `StateJson`.
- Classic is **same-device only** in v1 — physics positions don't travel over the
  polling transport yet. Online rooms remain quiz-mode.
