# Power Automate — `Carrom — Game Finished` (design spec, not deployed)

## Why only this flow

Attempts, coin events, and session rows are patched **directly from the Canvas App**
(connector, sync, no flow-run cost). A flow per attempt would add latency to every
turn and explode run consumption. Exactly one workflow is justified: post-game
bookkeeping + announcement, off the critical turn path.

## Trigger

**When an item is created or modified** (SharePoint connector)
- Site: `/sites/CarromBattle`, List: `CarromSessions`
- Trigger condition (Settings → Trigger Conditions), so it fires once per game:
  `@and(equals(triggerOutputs()?['body/GameStatus']?['Value'], 'completed'), not(equals(triggerOutputs()?['body/Winner'], 0)))`
  — hmm, Winner starts 0/blank and Canvas leaves tie-breaks open, so gate on status
  only, then compute Winner inside:

  `@equals(triggerOutputs()?['body/GameStatus']?['Value'], 'completed')`
- Add a `WinnerComputed` Yes/No column check to prevent re-entry: condition
  `WinnerComputed = false` (set true at the end). *(Add this column when creating
  the flow; schema script covers v1 columns.)*

## Steps

1. **Get session** — `Get item` on `CarromSessions` by trigger ID.
2. **List cover events** — `Get items` on `CarromCoinEvents`
   Filter Query: `SessionId eq '<SessionId>' and EventType eq 'coverSecured'`.
3. **Compute Winner** (Compose actions, no code):
   - `P1 = Player1Score`, `P2 = Player2Score`.
   - If `P1 ≠ P2` → Winner = higher scorer (1/2).
   - Else if exactly one `coverSecured` row → Winner = its `PlayerNumber`.
   - Else Winner = 0 (draw).
   - Expression sketch: `if(not(equals(outputs('P1'), outputs('P2'))), if(greater(outputs('P1'), outputs('P2')), 1, 2), if(equals(length(body('List_cover_events')?['value']), 1), first(body('List_cover_events')?['value'])?['PlayerNumber'], 0))`
4. **Update item** — set `Winner`, `CompletedAt = utcNow()`, `WinnerComputed = true`.
5. **Announce** — Post in Teams / send mail:
   `🏆 <WinnerName> won Carrom Warfare <P1>–<P2>!` (draw → 🤝 message).

## Failure handling

- Configure run-after on failure → send admin mail with session ID; game data is
  already safe in SharePoint (flow never owns scoring).
- Concurrency control on trigger: Degree of Parallelism = 1 (same session can't
  double-process).

## Deploy

Create manually from this spec in make.powerautomate.com (5 min), or export to a
solution alongside the PCF control. Status: **designed, not deployed** (no tenant).
