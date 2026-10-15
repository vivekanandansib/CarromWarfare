// Carrom Quiz Battle — domain types (UI-agnostic, shared with future PCF wrapper)

export type CoinColor = 'white' | 'black' | 'queen';
export type CoinState = 'available' | 'pocketed';
export type QueenState = 'available' | 'pendingCover' | 'secured';
export type Phase = 'ready' | 'asking' | 'animating' | 'finished';
export type ShotType = 'straight' | 'cut' | 'bank' | 'defensive';
export type Category = 'Learning' | 'Strategy';
export type PlayerNumber = 1 | 2;

export interface CoinPos {
  x: number;
  y: number;
}

export interface Coin {
  id: string;
  color: CoinColor;
  state: CoinState;
  pos: CoinPos;
}

export interface Question {
  id: string;
  text: string;
  category: Category;
  difficulty: 1 | 2 | 3;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  hint: string;
  isActive: boolean;
}

export interface GameConfig {
  sessionId: string;
  playerNames: [string, string];
  targetScore: number;
  pointsPerCoin?: number;
  queenBonus?: number;
}

export interface GameState {
  sessionId: string;
  playerNames: [string, string];
  targetScore: number;
  pointsPerCoin: number;
  queenBonus: number;
  coins: Coin[];
  queenState: QueenState;
  /** Player who pocketed the queen and must cover (only set while pendingCover). */
  queenPocketedBy?: PlayerNumber;
  scores: [number, number];
  currentPlayer: PlayerNumber;
  phase: Phase;
  activeCoinId?: string;
  activeQuestion?: Question;
  activeShot?: ShotType;
  /** True once the active question has been answered — blocks duplicate submissions. */
  answeredActive: boolean;
  usedQuestionIds: string[];
  winner?: 0 | PlayerNumber;
  /** Idempotency ledger for scoring events. */
  processedEventKeys: string[];
  status: 'inProgress' | 'completed';
  /** True while the current player must play a cover coin (queen pendingCover). */
  awaitingCover: boolean;
}

export type GameEventType =
  | 'sessionStarted'
  | 'attemptMade'
  | 'coinPocketed'
  | 'coverSecured'
  | 'coverFailed'
  | 'turnChanged'
  | 'gameFinished';

export interface GameEvent {
  schemaVersion: '1.0';
  eventId: string;
  sessionId: string;
  eventType: GameEventType;
  playerNumber: PlayerNumber;
  coinId?: string;
  questionId?: string;
  selectedOption?: number;
  isCorrect?: boolean;
  pointsAwarded?: number;
  score: [number, number];
  currentPlayer: PlayerNumber;
  gameStatus: 'inProgress' | 'completed';
}
