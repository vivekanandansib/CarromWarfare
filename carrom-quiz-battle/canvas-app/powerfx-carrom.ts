// =============================================================================
// Carrom Quiz Battle — Canvas App Power Fx Reference
// =============================================================================
//
// Paste these formulas into the Canvas app in Power Apps Studio.
// Field mappings mirror app/src/game/sharepointSync.ts 1:1 (unit-tested there);
// if you change a column, update BOTH files.
//
// Lists: CarromQuestions, CarromSessions, CarromAttempts, CarromCoinEvents
// Control: CarromBattle.CarromQuizBoard  (name the instance: ctlBoard)
//
// v1 note: QuestionsJson INCLUDES CorrectOption so the PCF can score offline
// in a casual same-device game. Production upgrade: strip it (see §7 below)
// and validate in Power Automate. Helpers for that path are already tested in
// sharepointSync.ts (stripAnswerKey / resolveVerdict).
//
// =============================================================================

// ---------------------------------------------------------------------------
// App.OnStart — session bootstrap + question load
// ---------------------------------------------------------------------------

// Recoverable error surface
Set(VarSyncError, Blank());

// New session (Setup screen collects VarPlayer1/VarPlayer2/VarTarget first;
// defaults below let the board screen run standalone)
Set(VarSessionId, GUID());
If(IsBlank(VarPlayer1), Set(VarPlayer1, "Asha"));
If(IsBlank(VarPlayer2), Set(VarPlayer2, "Ravi"));
If(IsBlank(VarTarget) Or VarTarget <= 0, Set(VarTarget, 50));

// Load active questions (indexed IsActive query; invalid rows skipped by PCF)
ClearCollect(colQuestions,
    ShowColumns(
        Filter(CarromQuestions, IsActive = true),
        QuestionId, QuestionText, Category, Difficulty,
        OptionA, OptionB, OptionC, OptionD, CorrectOption, Hint
    )
);

// Empty-bank guard: board screen shows lblNoQuestions when this is 0
Set(VarQuestionsJSON,
    JSON(
        ForAll(colQuestions,
            {
                id: QuestionId,
                text: QuestionText,
                category: Category,
                difficulty: Difficulty,
                options: [OptionA, OptionB, OptionC, OptionD],
                correctIndex: CorrectOption,
                hint: Hint
            }
        ),
        JSONFormat.Compact
    )
);

Set(VarSessionConfigJSON,
    JSON(
        {
            sessionId: VarSessionId,
            player1: VarPlayer1,
            player2: VarPlayer2,
            targetScore: VarTarget,
            pointsPerCoin: 10,
            queenBonus: 20
        },
        JSONFormat.Compact
    )
);

// Resume support: latest unfinished session (summary grain: scores + turn).
// Mid-game BOARD layout resume needs the StateJson upgrade (§8); v1 resumes
// results/standings and starts a fresh board for a new session.
Set(VarResumeSession, First(Sort(Filter(CarromSessions, GameStatus = "inProgress"), StartedAt, SortOrder.Descending)));
Set(VarInitialStateJSON, Blank());

// Event cursor: ignore the bridge's empty initial state (sequence 0)
Set(VarLastSeq, 0);


// ---------------------------------------------------------------------------
// Board screen — control bindings (properties on ctlBoard)
// ---------------------------------------------------------------------------

// ctlBoard.QuestionsJson        = VarQuestionsJSON
// ctlBoard.SessionConfigJson    = VarSessionConfigJSON
// ctlBoard.InitialGameStateJson = VarInitialStateJSON
// ctlBoard.Visible              = CountRows(colQuestions) > 0
//
// lblNoQuestions.Visible = CountRows(colQuestions) = 0
// lblNoQuestions.Text    = "No active questions — add rows to CarromQuestions and restart."
//
// lblSyncError.Visible = !IsBlank(VarSyncError)
// lblSyncError.Text    = VarSyncError
// btnRetrySync.OnSelect  = Set(VarSyncError, Blank()); Set(VarLastSeq, VarLastSeq - 1);
//                          Select(ctlBoard)  // nudge: next OnChange reprocesses


// ---------------------------------------------------------------------------
// ctlBoard.OnChange — runs when EventSequence changes (THE output mechanism)
// ---------------------------------------------------------------------------
// Ordinary React callbacks do NOT trigger Power Apps. The control calls
// notifyOutputChanged() after every game event; the framework refreshes
// GameEventJson + EventSequence, which fires this OnChange. The monotonic
// counter (not the JSON text) is the reliable trigger.

If(
    Value(ctlBoard.EventSequence) > VarLastSeq,

    // 1. Advance the cursor FIRST so a failed Patch never replays silently
    Set(VarLastSeq, Value(ctlBoard.EventSequence));
    Set(VarEvent, ParseJSON(ctlBoard.GameEventJson));
    Set(VarEvType, Text(VarEvent.eventType));

    // 2. Persist by event type (mirrors sharepointSync.ts payloads)
    Switch(VarEvType,

        "sessionStarted",
        IfError(
            Patch(CarromSessions, Defaults(CarromSessions),
                {
                    Title: Text(VarEvent.sessionId),
                    SessionId: Text(VarEvent.sessionId),
                    Player1Name: VarPlayer1, Player2Name: VarPlayer2,
                    CurrentPlayer: 1, Player1Score: 0, Player2Score: 0,
                    GameStatus: "inProgress",
                    StartedAt: Now(), Winner: 0
                }
            ),
            Set(VarSyncError, "Could not create session row: " & FirstError.Message)
        ),

        "attemptMade",
        IfError(
            Patch(CarromAttempts, Defaults(CarromAttempts),
                {
                    Title: Text(VarEvent.eventId),
                    AttemptId: Text(VarEvent.eventId),
                    SessionId: Text(VarEvent.sessionId),
                    QuestionId: Text(VarEvent.questionId),
                    PlayerNumber: Value(VarEvent.playerNumber),
                    CoinId: Text(VarEvent.coinId),
                    SelectedOption: Value(VarEvent.selectedOption),
                    IsCorrect: Boolean(VarEvent.isCorrect),
                    AttemptedAt: Now()
                }
            ),
            Set(VarSyncError, "Could not save attempt: " & FirstError.Message)
        ),

        // Scoring events: IDEMPOTENT upsert on unique EventKey.
        // A replayed event finds the row and skips — never double-scores.
        "coinPocketed",
        If(IsBlank(LookUp(CarromCoinEvents, EventKey = Text(VarEvent.sessionId) & "-" & Text(VarEvent.eventId))),
            IfError(
                Patch(CarromCoinEvents, Defaults(CarromCoinEvents),
                    {
                        Title: Text(VarEvent.sessionId) & "-" & Text(VarEvent.eventId),
                        EventKey: Text(VarEvent.sessionId) & "-" & Text(VarEvent.eventId),
                        SessionId: Text(VarEvent.sessionId),
                        CoinId: Text(VarEvent.coinId),
                        PlayerNumber: Value(VarEvent.playerNumber),
                        EventType: "coinPocketed",
                        PointsAwarded: Value(VarEvent.pointsAwarded),
                        EventAt: Now()
                    }
                ),
                Set(VarSyncError, "Could not save coin event: " & FirstError.Message)
            )
        ),

        "coverSecured",
        If(IsBlank(LookUp(CarromCoinEvents, EventKey = Text(VarEvent.sessionId) & "-" & Text(VarEvent.eventId))),
            IfError(
                Patch(CarromCoinEvents, Defaults(CarromCoinEvents),
                    {
                        Title: Text(VarEvent.sessionId) & "-" & Text(VarEvent.eventId),
                        EventKey: Text(VarEvent.sessionId) & "-" & Text(VarEvent.eventId),
                        SessionId: Text(VarEvent.sessionId),
                        CoinId: Text(VarEvent.coinId),
                        PlayerNumber: Value(VarEvent.playerNumber),
                        EventType: "coverSecured",
                        PointsAwarded: Value(VarEvent.pointsAwarded),
                        EventAt: Now()
                    }
                ),
                Set(VarSyncError, "Could not save cover event: " & FirstError.Message)
            )
        ),

        "coverFailed",
        IfError(
            Patch(CarromCoinEvents, Defaults(CarromCoinEvents),
                {
                    Title: Text(VarEvent.sessionId) & "-" & Text(VarEvent.eventId),
                    EventKey: Text(VarEvent.sessionId) & "-" & Text(VarEvent.eventId),
                    SessionId: Text(VarEvent.sessionId),
                    CoinId: Text(VarEvent.coinId),
                    PlayerNumber: Value(VarEvent.playerNumber),
                    EventType: "coverFailed",
                    PointsAwarded: 0,
                    EventAt: Now()
                }
            ),
            Set(VarSyncError, "Could not save cover event: " & FirstError.Message)
        ),

        "gameFinished",
        IfError(
            Patch(
                LookUp(CarromSessions, SessionId = Text(VarEvent.sessionId)),
                {
                    Player1Score: Value(Index(VarEvent.score, 1).Value),
                    Player2Score: Value(Index(VarEvent.score, 2).Value),
                    CurrentPlayer: Value(VarEvent.currentPlayer),
                    GameStatus: "completed",
                    CompletedAt: Now()
                    // Winner: derive here from scores (higher wins; tie needs
                    // queen-holder lookup — simplest: Power Automate flow sets
                    // it from CarromCoinEvents coverSecured rows).
                }
            ),
            Set(VarSyncError, "Could not close session: " & FirstError.Message)
        )
    );

    // 3. Live scoreboard (no extra queries)
    Set(VarScore1, Value(Index(VarEvent.score, 1).Value));
    Set(VarScore2, Value(Index(VarEvent.score, 2).Value));
    Set(VarTurn, Value(VarEvent.currentPlayer));
    If(VarEvType = "gameFinished", Navigate(scrResults))
);


// ---------------------------------------------------------------------------
// scrResults — labels bound to VarScore1/VarScore2/VarTurn + session lookup
// ---------------------------------------------------------------------------

// lblFinal.Text = VarPlayer1 & " " & VarScore1 & " — " & VarScore2 & " " & VarPlayer2
// btnAgain.OnSelect = Set(VarSessionId, GUID()); /* rebuild VarSessionConfigJSON as in OnStart; */ Navigate(scrBoard)


// ---------------------------------------------------------------------------
// §7 Production upgrade: hold back answer keys (server-side verdict)
// ---------------------------------------------------------------------------
//
// 1. In OnStart, build VarQuestionsJSON WITHOUT correctIndex, and keep a
//    private collection:
//      ClearCollect(colAnswerKeys, ShowColumns(colQuestions, QuestionId, CorrectOption));
// 2. The PCF then emits attemptMade WITHOUT knowing correctness. Add a
//    Power Automate flow "CarromValidateAttempt" (manual trigger:
//    sessionId, questionId, selectedOption, attemptId) that looks up
//    CarromQuestions and returns isCorrect. Canvas calls it, then feeds the
//    verdict back via a new VerdictJson control input (control enhancement).
// 3. Tested helpers: stripAnswerKey() / resolveVerdict() in sharepointSync.ts.


// ---------------------------------------------------------------------------
// §8 Upgrade: full mid-game board resume via StateJson
// ---------------------------------------------------------------------------
//
// 1. Add a Multiline-Text column StateJson to CarromSessions.
// 2. Extend the control with a GameStateJson output (full serializeState() on
//    every event) and Patch it into the session row in OnChange.
// 3. On reload, set VarInitialStateJSON to that snapshot; the control resumes
//    the exact board via InitialGameStateJson (already supported in index.ts).
