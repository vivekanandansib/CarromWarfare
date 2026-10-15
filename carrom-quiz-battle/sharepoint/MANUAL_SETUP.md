# SharePoint Manual Setup (no admin needed — site owner/member is enough)

Do this in `https://signatechservices0.sharepoint.com/sites/Powerapps`.
For each list: **Site contents → + New → List → Blank list** with the exact name.

## List 1: CarromQuestions

Add columns (**+ Add column**, in THIS order — order matters for the paste later):

| # | Name | Type | Settings |
|---|---|---|---|
| 1 | QuestionId | Single line of text | — |
| 2 | QuestionText | Multiple lines of text | Plain text |
| 3 | Category | Choice | Choices: `Learning`, `Strategy` (delete the default entries) |
| 4 | Difficulty | Number | 0 decimals |
| 5 | OptionA | Single line of text | — |
| 6 | OptionB | Single line of text | — |
| 7 | OptionC | Single line of text | — |
| 8 | OptionD | Single line of text | — |
| 9 | CorrectOption | Number | 0 decimals (0=A, 1=B, 2=C, 3=D) |
| 10 | Hint | Single line of text | — |
| 11 | IsActive | Yes/no | Default: Yes |

Then: **Settings (gear) → List settings → Indexed columns → Create a new index**:
index `QuestionId`, and index `IsActive`. (Enforce-unique is NOT needed here.)

### Seed the 14 questions (30 seconds via grid paste)

1. Open `SeedQuestions.tsv` (in this folder) in Notepad, **copy all 15 lines** (header + 14 rows).
2. Back in the list: **Edit in grid view** (top bar).
3. Click the first empty cell under **Title**, paste (Ctrl+V). All 14 rows fill in.
4. **Exit grid view**. You should see L-01…L-08, S-01…S-06.

## List 2: CarromSessions

| Name | Type | Settings |
|---|---|---|
| SessionId | Single line of text | More options → **Enforce unique values: Yes** (this auto-indexes it) |
| Player1Name | Single line of text | — |
| Player2Name | Single line of text | — |
| CurrentPlayer | Number | 0 decimals |
| Player1Score | Number | 0 decimals |
| Player2Score | Number | 0 decimals |
| GameStatus | Choice | `inProgress`, `completed` |
| StartedAt | Date and time | Date & Time |
| CompletedAt | Date and time | Date & Time |
| Winner | Number | 0 decimals |
| WinnerComputed | Yes/no | Default: No |
| StateJson | Multiple lines of text | Plain text |

## List 3: CarromAttempts

| Name | Type | Settings |
|---|---|---|
| AttemptId | Single line of text | — |
| SessionId | Single line of text | — |
| QuestionId | Single line of text | — |
| PlayerNumber | Number | 0 decimals |
| CoinId | Single line of text | — |
| SelectedOption | Number | 0 decimals |
| IsCorrect | Yes/no | — |
| AttemptedAt | Date and time | Date & Time |

Then List settings → Indexed columns → index `SessionId`, index `QuestionId`.

## List 4: CarromCoinEvents

| Name | Type | Settings |
|---|---|---|
| EventKey | Single line of text | **Enforce unique values: Yes** (critical — this is the anti-double-score key) |
| SessionId | Single line of text | — |
| CoinId | Single line of text | — |
| PlayerNumber | Number | 0 decimals |
| EventType | Choice | `coinPocketed`, `coverSecured`, `coverFailed` |
| PointsAwarded | Number | 0 decimals |
| EventAt | Date and time | Date & Time |

Then List settings → Indexed columns → index `SessionId`.

## Done — tell me

Reply **"lists done"** (plus a screenshot if anything looks off). Then I give you
the Canvas App assembly: new blank app → connect these 4 lists → add the already
deployed `CarromQuizBoard` control → paste the formulas from `canvas-app/powerfx-carrom.ts`.
