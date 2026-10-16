import { useEffect, useRef, useState } from 'react';
import Board, { missMidpoint, nearestPocket, waypointFor } from './components/Board';
import type { PocketAnim } from './components/Board';
import { Confetti, FxLayer, PlayerPanel, QueenBadge, Toast } from './components/Panels';
import type { Burst, Floater } from './components/Panels';
import ClassicMode from './components/ClassicMode';
import type { ClassicShotInfo } from './components/ClassicMode';
import QuestionDialog from './components/QuestionDialog';
import { createGameEvent } from './game/events';
import { openingSnapshot } from './game/classic';
import type { ClassicState } from './game/classic';
import {
  answerQuestion,
  completeAnimation,
  completeMiss,
  createGame,
  deserializeState,
  EngineError,
  expireIdleTurn,
  getCoin,
  makeId,
  selectCoin,
  serializeState,
} from './game/engine';
import { describeRows, findSessionByCode, roomCodeForSession, shouldAdopt } from './game/online';
import type { CoinPos, GameEvent, GameState, PlayerNumber, ShotType } from './game/types';
import { QuestionBank } from './game/questions';
import { sound } from './game/sound';
import {
  createClassicSession,
  createSessionRow,
  fetchSessionRow,
  joinSessionAsPlayer2,
  listOpenSessions,
  listTopChampions,
  loadActiveQuestions,
  patchClassicSession,
  patchSessionRow,
  readClassicSnapshot,
  saveAttempt,
  saveCoinEvent,
  writeClassicSnapshot,
} from './spGame';
import type { ChampionRow } from './spGame';
import './styles.css';

const SHOTS: { id: ShotType; label: string }[] = [
  { id: 'straight', label: 'Straight +10' },
  { id: 'cut', label: 'Cut +12' },
  { id: 'bank', label: 'Bank +15' },
  { id: 'defensive', label: 'Defensive +10' },
];

const SHOT_BONUS: Record<ShotType, number> = { straight: 0, cut: 2, bank: 5, defensive: 0 };
const SHOT_DESC: Record<ShotType, string> = {
  straight: 'Any difficulty, standard points',
  cut: 'Difficulty 2+, +2 bonus',
  bank: 'Hardest questions, +5 bonus',
  defensive: 'Easy questions, standard points',
};

/** Release stamp (version.ts is maintained by the push pipeline). */
import { APP_VERSION } from './version';

type Theme = 'classic' | 'midnight' | 'royal' | 'kingdom';
const THEMES: Theme[] = ['classic', 'midnight', 'royal', 'kingdom'];

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem('cqb-theme');
    if (t === 'midnight' || t === 'royal' || t === 'classic' || t === 'kingdom') return t;
  } catch {
    /* ignore */
  }
  return 'classic';
}

type BankState = { bank: QuestionBank; skipped: number } | null;

export default function App() {
  const [bankState, setBankState] = useState<BankState>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [shot, setShot] = useState<ShotType>('straight');
  const [pocketAnim, setPocketAnim] = useState<PocketAnim | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'good' | 'bad' | 'info' } | null>(null);
  const [spError, setSpError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [p1, setP1] = useState('Asha');
  const [p2, setP2] = useState('Ravi');
  const [target, setTarget] = useState(50);
  const [clockSecs, setClockSecs] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [pocketFlash, setPocketFlash] = useState<CoinPos | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const toastTimer = useRef<number>(0);
  const sessionRowId = useRef<string | null>(null);
  const expiredRef = useRef(false);
  const fxId = useRef(0);

  useEffect(() => {
    document.body.dataset.theme = theme;
    try {
      localStorage.setItem('cqb-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const spawnBurst = (x: number, y: number) => {
    const id = ++fxId.current;
    setBursts((b) => [...b, { id, x, y }]);
    window.setTimeout(() => setBursts((b) => b.filter((s) => s.id !== id)), 700);
  };

  const spawnFloater = (text: string, x: number, y: number, bonus = false) => {
    const id = ++fxId.current;
    setFloaters((f) => [...f, { id, text, x, y, bonus }]);
    window.setTimeout(() => setFloaters((f) => f.filter((s) => s.id !== id)), 1350);
  };

  const flashPocket = (at: CoinPos) => {
    setPocketFlash(at);
    window.setTimeout(() => setPocketFlash(null), 600);
  };
  // Online room state ('local' = same laptop; 'online' = host or guest seat)
  const [mode, setMode] = useState<'local' | 'online'>('local');
  const [playMode, setPlayMode] = useState<'local' | 'host' | 'join'>('local');
  const [mySeat, setMySeat] = useState<PlayerNumber>(1);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomLive, setRoomLive] = useState(false);
  const [roomRowId, setRoomRowId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [guestJoined, setGuestJoined] = useState(false);
  const [champs, setChamps] = useState<ChampionRow[] | null>(null);
  const [champsLoading, setChampsLoading] = useState(false);
  // Classic tab (same-device flick mode) + its session row
  const [appTab, setAppTab] = useState<'quiz' | 'classic'>('quiz');
  const classicRowId = useRef<string | null>(null);
  const lastWrittenRef = useRef<string | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const animRef = useRef<PocketAnim | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const load = await loadActiveQuestions();
        if (cancelled) return;
        if (load.questions.length === 0) {
          const detail =
            load.fetched === 0
              ? 'The list returned 0 rows — the grid paste may not have saved. Open CarromQuestions, check the 14 rows are there, then reload.'
              : `Fetched ${load.fetched} rows but all were skipped (${load.skipped}). ` +
                load.reasons.join(' | ');
          setLoadError(`No playable questions. ${detail}`);
          return;
        }
        setBankState({ bank: new QuestionBank(load.questions), skipped: load.skipped });
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load questions.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = (msg: string, tone: 'good' | 'bad' | 'info') => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  // Refs mirrored from state for the polling loop.
  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    animRef.current = pocketAnim;
  }, [pocketAnim]);

  /** Persist engine events to SharePoint; failures surface as a recoverable banner. */
  const persist = (events: GameEvent[], state: GameState) => {
    lastWrittenRef.current = serializeState(state);
    void (async () => {
      try {
        for (const e of events) {
          if (e.eventType === 'attemptMade') await saveAttempt(e);
          else if (
            e.eventType === 'coinPocketed' ||
            e.eventType === 'coverSecured' ||
            e.eventType === 'coverFailed'
          )
            await saveCoinEvent(e);
        }
        if (sessionRowId.current) await patchSessionRow(sessionRowId.current, state);
      } catch (e) {
        setSpError(
          e instanceof Error
            ? `${e.message} The game continues — progress may not be saved.`
            : 'SharePoint save failed. The game continues — progress may not be saved.',
        );
      }
    })();
  };

  const startGame = () => {
    if (!bankState || !p1.trim() || !p2.trim() || target <= 0) return;
    const g = createGame({
      sessionId: makeId('sess'),
      playerNames: [p1.trim(), p2.trim()],
      targetScore: target,
    });
    setGame(g);
    setPocketAnim(null);
    setPaused(false);
    setSpError(null);
    setTimeLeft(clockSecs);
    expiredRef.current = false;
    sessionRowId.current = null;
    void (async () => {
      try {
        sessionRowId.current = await createSessionRow(g);
      } catch (e) {
        setSpError(
          e instanceof Error
            ? `${e.message} The game continues — progress may not be saved.`
            : 'Could not create the session row.',
        );
      }
    })();
  };

  const handleSelect = (coinId: string) => {
    if (!game || !bankState || game.phase !== 'ready' || paused) return;
    if (mode === 'online' && game.currentPlayer !== mySeat) return;
    sound.select();
    try {
      const res = selectCoin(game, bankState.bank, coinId, shot);
      setGame(res.state);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Selection failed', 'bad');
    }
  };

  const handleExpireIdle = () => {
    if (!game || game.phase !== 'ready') return;
    sound.wrong();
    try {
      const res = expireIdleTurn(game);
      setGame(res.state);
      persist(res.events, res.state);
      const nextName = res.state.playerNames[res.state.currentPlayer - 1];
      flash(
        res.events.some((e) => e.eventType === 'coverFailed')
          ? `Time! The Queen returns — turn passes to ${nextName}.`
          : `Time! Turn passes to ${nextName}.`,
        'bad',
      );
    } catch {
      /* ignore */
    }
  };

  // Shot clock: reset on every turn/phase change; expiry forfeits the turn.
  useEffect(() => {
    setTimeLeft(clockSecs);
    expiredRef.current = false;
  }, [game?.phase, game?.currentPlayer, game?.sessionId, clockSecs, game === null]);

  useEffect(() => {
    if (!game || paused) return;
    if (game.phase !== 'ready' && game.phase !== 'asking') return;
    if (mode === 'online' && game.currentPlayer !== mySeat) return;
    if (timeLeft <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        if (game.phase === 'asking') handleAnswer(-1);
        else handleExpireIdle();
      }
      return;
    }
    if (timeLeft <= 5) sound.tick();
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  });

  // Online mirror: adopt remote snapshots (not our own echo, never mid-animation).
  useEffect(() => {
    if (mode !== 'online' || !game) return;
    const t = window.setInterval(() => {
      void (async () => {
        const g = gameRef.current;
        if (!g || animRef.current) return;
        try {
          const row = await fetchSessionRow(g.sessionId);
          if (!row) return;
          // Host lobby: guest claimed seat 2.
          if (row.Player2Name?.trim()) {
            setGuestJoined((was) => {
              if (!was && g.playerNames[1] !== row.Player2Name!.trim()) {
                setGame((cur) =>
                  cur ? { ...cur, playerNames: [cur.playerNames[0], row.Player2Name!.trim()] } : cur,
                );
                flash(`${row.Player2Name!.trim()} joined the room!`, 'good');
              }
              return true;
            });
          }
          const serverJson = row.StateJson;
          if (
            !shouldAdopt({
              serverJson,
              lastWrittenJson: lastWrittenRef.current,
              lastSeenJson: lastSeenRef.current,
            })
          )
            return;
          lastSeenRef.current = serverJson ?? null;
          const incoming = serverJson ? deserializeState(serverJson) : undefined;
          if (!incoming) return;
          setGame(incoming);
        } catch {
          /* keep playing on the local copy; next poll retries */
        }
      })();
    }, 2000);
    return () => window.clearInterval(t);
  }, [mode, game?.sessionId, flash]);

  const loadChampions = () => {
    if (champs || champsLoading) return;
    setChampsLoading(true);
    void (async () => {
      try {
        setChamps(await listTopChampions());
      } catch {
        setChamps([]);
      } finally {
        setChampsLoading(false);
      }
    })();
  };

  /** SharePoint sink for Classic Flick shots (same lists, mode tagged in StateJson). */
  /** Coin-event audit rows for a classic shot (session snapshot handled separately). */
  const persistClassicShot = async (s: ClassicState, info: ClassicShotInfo) => {
    const status = s.finished ? 'completed' : 'inProgress';
    const base = {
      score: [...s.scores] as [number, number],
      currentPlayer: s.currentPlayer,
      gameStatus: status as 'inProgress' | 'completed',
    };
    for (const id of info.pocketedNow) {
      if (id === 'Q') {
        if (info.queenEvent === 'pending') {
          await saveCoinEvent(
            createGameEvent(s.sessionId, 'coinPocketed', info.shooter, { coinId: 'Q', pointsAwarded: 0, ...base }),
          );
        } else if (info.queenEvent === 'secured') {
          await saveCoinEvent(
            createGameEvent(s.sessionId, 'coverSecured', info.shooter, { coinId: 'Q', pointsAwarded: 20, ...base }),
          );
        } else if (info.queenEvent === 'returned') {
          await saveCoinEvent(
            createGameEvent(s.sessionId, 'coverFailed', info.shooter, { coinId: 'Q', pointsAwarded: 0, ...base }),
          );
        }
      } else {
        await saveCoinEvent(
          createGameEvent(s.sessionId, 'coinPocketed', info.shooter, { coinId: id, pointsAwarded: 10, ...base }),
        );
      }
    }
  };

  const classicSink = {
    onSessionStart: (s: ClassicState) => {
      classicRowId.current = null;
      void (async () => {
        try {
          classicRowId.current = await createClassicSession(s.sessionId, s.playerNames, s.targetScore);
        } catch (e) {
          setSpError(e instanceof Error ? e.message : 'Could not create the classic session row.');
        }
      })();
    },
    onShot: (s: ClassicState, info: ClassicShotInfo) => {
      void (async () => {
        try {
          await persistClassicShot(s, info);
          if (classicRowId.current) await patchClassicSession(classicRowId.current, s);
        } catch (e) {
          setSpError(
            e instanceof Error
              ? `${e.message} The game continues — progress may not be saved.`
              : 'SharePoint save failed.',
          );
        }
      })();
    },
  };

  const classicOnlineShot = (s: ClassicState, info: ClassicShotInfo) => {
    void (async () => {
      try {
        await persistClassicShot(s, info);
      } catch (e) {
        setSpError(
          e instanceof Error
            ? `${e.message} The game continues — progress may not be saved.`
            : 'SharePoint save failed.',
        );
      }
    })();
  };

  // Classic online room (null = lobby; seat null = same laptop)
  const [classicGame, setClassicGame] = useState<null | {
    seat: 1 | 2 | null;
    sessionId: string;
    rowId: string;
    code: string;
    myName: string;
  }>(null);
  const [classicJoinCode, setClassicJoinCode] = useState('');
  const [classicJoinError, setClassicJoinError] = useState<string | null>(null);
  const [classicJoining, setClassicJoining] = useState(false);

  // Classic lobby: host waits with the code before starting; guest waits for Start.
  const [classicRoom, setClassicRoom] = useState<null | {
    sessionId: string;
    rowId: string;
    code: string;
  }>(null);
  const [classicGuest, setClassicGuest] = useState<string | null>(null);
  const [classicWaiting, setClassicWaiting] = useState<null | {
    sessionId: string;
    rowId: string;
    code: string;
  }>(null);
  const [guestSnap, setGuestSnap] = useState<import('./game/classic').ClassicSnapshot | null>(null);
  const [copied, setCopied] = useState(false);

  const startClassicLocal = () => {
    setClassicJoinError(null);
    setClassicRoom(null);
    setClassicWaiting(null);
    setGuestSnap(null);
    setClassicGame({ seat: null, sessionId: '', rowId: '', code: '', myName: '' });
  };

  const hostClassic = () => {
    if (!p1.trim() || target <= 0) return;
    setClassicJoinError(null);
    const sessionId = makeId('sess');
    void (async () => {
      try {
        const rowId = await createClassicSession(sessionId, [p1.trim(), ''], target);
        const opening = openingSnapshot(sessionId, [p1.trim(), 'Player 2'], target, 200, true);
        await writeClassicSnapshot(rowId, opening);
        setClassicRoom({ sessionId, rowId, code: roomCodeForSession(sessionId) });
        setClassicGuest(null);
      } catch (e) {
        setSpError(e instanceof Error ? e.message : 'Could not host the classic room.');
      }
    })();
  };

  const copyInvite = async (code: string) => {
    const text = `Join my Carrom Flick room! Code: ${code} — ${window.location.href}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // Host lobby: watch for the guest, then Start hands over to the live game.
  useEffect(() => {
    if (!classicRoom || classicGame) return;
    const t = window.setInterval(() => {
      void (async () => {
        try {
          const row = await fetchSessionRow(classicRoom.sessionId);
          if (row?.Player2Name?.trim()) setClassicGuest(row.Player2Name.trim());
        } catch {
          /* retry */
        }
      })();
    }, 2000);
    return () => window.clearInterval(t);
  }, [classicRoom, classicGame]);

  // Guest waiting room: start the game the moment the host presses Start.
  useEffect(() => {
    if (!classicWaiting || classicGame) return;
    const t = window.setInterval(() => {
      void (async () => {
        try {
          const snap = await readClassicSnapshot(classicWaiting.sessionId);
          if (snap && !snap.lobby) {
            setGuestSnap(snap);
            setClassicGame({
              seat: 2,
              sessionId: classicWaiting.sessionId,
              rowId: classicWaiting.rowId,
              code: classicWaiting.code,
              myName: p1.trim() || 'Guest',
            });
            setClassicWaiting(null);
          }
        } catch {
          /* retry */
        }
      })();
    }, 2000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classicWaiting, classicGame]);

  const joinClassic = () => {
    if (!p1.trim() || classicJoinCode.trim().length < 6) return;
    setClassicJoining(true);
    setClassicJoinError(null);
    void (async () => {
      try {
        let found = null;
        let scanned = 'none';
        for (let attempt = 0; attempt < 3 && !found; attempt++) {
          if (attempt > 0) await new Promise((r) => window.setTimeout(r, 2500));
          const rows = await listOpenSessions();
          scanned = `${rows.length} rows: ${describeRows(rows) || '—'}`;
          found = findSessionByCode(rows, classicJoinCode, 'classic');
        }
        if (!found || typeof found.ID !== 'number' || !found.SessionId)
          throw new Error(`No open classic room with code “${classicJoinCode.trim().toUpperCase()}” (scanned ${scanned}).`);
        if (found.Player2Name?.trim()) throw new Error('That room is already full.');
        await joinSessionAsPlayer2(found.ID, p1.trim());
        const snap = await readClassicSnapshot(found.SessionId);
        if (!snap) throw new Error('Room found, but the board is not ready yet — retry in a moment.');
        if (snap.lobby) {
          // Host hasn't started yet — wait in the waiting room.
          setClassicWaiting({
            sessionId: found.SessionId,
            rowId: String(found.ID),
            code: roomCodeForSession(found.SessionId),
          });
          flash('Room joined — waiting for the host to start…', 'info');
          return;
        }
        setGuestSnap(snap);
        setClassicGame({
          seat: 2,
          sessionId: found.SessionId,
          rowId: String(found.ID),
          code: roomCodeForSession(found.SessionId),
          myName: p1.trim(),
        });
      } catch (e) {
        setClassicJoinError(e instanceof Error ? e.message : 'Could not join the room.');
      } finally {
        setClassicJoining(false);
      }
    })();
  };

  const startOnlineHost = () => {
    if (!bankState || !p1.trim() || target <= 0) return;
    const g = createGame({
      sessionId: makeId('sess'),
      playerNames: [p1.trim(), 'Player 2'],
      targetScore: target,
    });
    setGame(g);
    setPocketAnim(null);
    setPaused(false);
    setSpError(null);
    setJoinError(null);
    setTimeLeft(clockSecs);
    expiredRef.current = false;
    setMode('online');
    setMySeat(1);
    setGuestJoined(false);
    setRoomCode(roomCodeForSession(g.sessionId));
    setRoomLive(false);
    const json = serializeState(g);
    lastWrittenRef.current = json;
    lastSeenRef.current = json;
    sessionRowId.current = null;
    void (async () => {
      try {
        const id = await createSessionRow(g, '');
        sessionRowId.current = id;
        setRoomRowId(id);
        setRoomLive(true);
      } catch (e) {
        setSpError(
          e instanceof Error
            ? `${e.message} The game continues — progress may not be saved.`
            : 'Could not create the session row.',
        );
      }
    })();
  };

  const joinOnline = () => {
    if (!bankState || !p1.trim() || !joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    void (async () => {
      try {
        // Retry: the host's row can lag a few seconds behind the room code display.
        let found = null;
        let scanned: string = 'none';
        for (let attempt = 0; attempt < 3 && !found; attempt++) {
          if (attempt > 0) await new Promise((r) => window.setTimeout(r, 2500));
          const rows = await listOpenSessions();
          scanned = `${rows.length} rows: ${describeRows(rows) || '—'}`;
          found = findSessionByCode(rows, joinCode);
        }
        const row = found;
        if (!row || typeof row.ID !== 'number' || !row.SessionId)
          throw new Error(
            `No open room with code “${joinCode.trim().toUpperCase()}” (scanned ${scanned}). ` +
              `Ask the host for their “Room live ✓ (#ID)” number — if that #ID is missing above, the guest is reading a different/stale view.`,
          );
        if (row.Player2Name?.trim()) throw new Error('That room is already full.');
        await joinSessionAsPlayer2(row.ID, p1.trim());
        const full = await fetchSessionRow(row.SessionId);
        const incoming = full?.StateJson ? deserializeState(full.StateJson) : undefined;
        if (!incoming) throw new Error('Room found, but the board is not ready yet — retry in a moment.');
        incoming.playerNames = [(full?.Player1Name || 'Player 1').trim(), p1.trim()];
        setGame(incoming);
        setPocketAnim(null);
        setPaused(false);
        setSpError(null);
        setTimeLeft(clockSecs);
        expiredRef.current = false;
        setMode('online');
        setMySeat(2);
        setGuestJoined(true);
        setRoomCode(roomCodeForSession(row.SessionId));
        lastSeenRef.current = full!.StateJson ?? null;
        lastWrittenRef.current = null;
        sessionRowId.current = String(row.ID);
        flash(`Joined ${incoming.playerNames[0]}'s room — you play second.`, 'good');
      } catch (e) {
        setJoinError(e instanceof Error ? e.message : 'Could not join the room.');
      } finally {
        setJoining(false);
      }
    })();
  };

  const handleAnswer = (index: number) => {
    if (!game || game.phase !== 'asking') return;
    if (mode === 'online' && game.currentPlayer !== mySeat) return;
    let res;
    try {
      res = answerQuestion(game, index);
    } catch (e) {
      if (e instanceof EngineError && e.code === 'DUPLICATE_ANSWER') return;
      flash(e instanceof Error ? e.message : 'Answer failed', 'bad');
      return;
    }
    persist(res.events, res.state);
    const wasCover = game.awaitingCover && game.activeCoinId !== 'Q';
    const coin = game.activeCoinId ? getCoin(game, game.activeCoinId) : undefined;
    if (res.correct) {
      sound.correct();
      sound.strike();
      setGame(res.state);
      if (coin) {
        const from = { ...coin.pos };
        const to = nearestPocket(from);
        setPocketAnim({
          kind: 'pocket',
          coin,
          from,
          mid: waypointFor(from, to, game.activeShot ?? 'straight'),
          to,
          durationMs: (game.activeShot ?? 'straight') === 'defensive' ? 1200 : 850,
        });
      }
      if (coin?.color === 'queen') flash('Queen pocketed! Cover her with another coin next turn.', 'info');
      else if (wasCover) flash('Cover incoming — pocket it to secure the Queen!', 'info');
    } else {
      sound.wrong();
      sound.strike();
      setGame(res.state);
      if (coin) {
        // Miss animation: the coin slides toward the pocket, veers off, stays in play.
        const from = { ...coin.pos };
        const to = nearestPocket(from);
        setPocketAnim({
          kind: 'miss',
          coin,
          from,
          mid: missMidpoint(from, to),
          to: from,
          durationMs: 1100,
        });
      }
      const q = game.activeQuestion;
      const right = q ? `"${q.options[q.correctIndex]}"` : '';
      const nextName = res.state.playerNames[res.state.currentPlayer - 1];
      flash(
        wasCover
          ? `Cover failed — the Queen returns! Turn passes to ${nextName}.`
          : `Wrong ${right ? `(correct: ${right}) ` : ''}— turn passes to ${nextName}.`,
        'bad',
      );
    }
  };

  const handleAnimDone = () => {
    if (!game || game.phase !== 'animating') {
      setPocketAnim(null);
      return;
    }
    if (game.animKind === 'miss') {
      try {
        const res = completeMiss(game);
        setPocketAnim(null);
        setGame(res.state);
        persist(res.events, res.state);
      } catch (e) {
        setPocketAnim(null);
        flash(e instanceof Error ? e.message : 'Miss failed', 'bad');
      }
      return;
    }
    try {
      const res = completeAnimation(game);
      const target = pocketAnim?.to;
      setPocketAnim(null);
      setGame(res.state);
      persist(res.events, res.state);
      if (target) {
        flashPocket(target);
        spawnBurst(target.x, target.y);
        spawnFloater(
          `+${res.pointsAwarded}`,
          target.x,
          target.y - 24,
          res.events.some((e) => e.eventType === 'coverSecured') ||
            (game.activeShot ? SHOT_BONUS[game.activeShot] > 0 : false),
        );
      }
      const types = res.events.map((e) => e.eventType);
      if (types.includes('gameFinished')) {
        sound.win();
      } else if (types.includes('coverSecured')) {
        sound.queen();
        flash(`Queen secured! +${res.pointsAwarded} pts (cover + bonus). You play again.`, 'good');
      } else {
        sound.rattle();
        if (res.state.queenState !== 'pendingCover')
          flash(`Pocketed! +${res.pointsAwarded} pts — you retain the turn.`, 'good');
      }
    } catch (e) {
      setPocketAnim(null);
      flash(e instanceof Error ? e.message : 'Pocket failed', 'bad');
    }
  };

  const backToMenu = () => {
    setGame(null);
    setMode('local');
    setRoomCode(null);
    setRoomLive(false);
    setRoomRowId(null);
    setGuestJoined(false);
    setMySeat(1);
    setJoinCode('');
    setJoinError(null);
    sessionRowId.current = null;
    lastWrittenRef.current = null;
    lastSeenRef.current = null;
  };

  const restart = () => {
    if (!game) return;
    if (mode === 'online') {
      backToMenu(); // online rematch = fresh room from the menu
      return;
    }
    const g = createGame({
      sessionId: makeId('sess'),
      playerNames: [game.playerNames[0], game.playerNames[1]],
      targetScore: game.targetScore,
    });
    setGame(g);
    setPocketAnim(null);
    setPaused(false);
    setTimeLeft(clockSecs);
    expiredRef.current = false;
    sessionRowId.current = null;
    void (async () => {
      try {
        sessionRowId.current = await createSessionRow(g);
      } catch (e) {
        setSpError(e instanceof Error ? e.message : 'Could not create the session row.');
      }
    })();
  };

  // ---- start screen / loading ----
  if (!bankState) {
    return (
      <div className="app">
        <div className="screen">
          <div className="hero">
            <h1>🎯 Carrom Quiz Battle</h1>
          </div>
          <div className="card">
            {loadError ? (
              <div className="error-banner" role="alert">
                {loadError}
              </div>
            ) : (
              <p>Loading questions from SharePoint…</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    if (appTab === 'classic') {
      if (!classicGame) {
        // Host lobby (room created, game not started) or guest waiting room.
        if (classicRoom || classicWaiting) {
          const hosting = !!classicRoom;
          const code = hosting ? classicRoom.code : classicWaiting!.code;
          const guestHere = hosting ? classicGuest : null;
          return (
            <div className="app">
              <div className="screen">
                <div className="hero">
                  <h1>🎲 Classic Flick</h1>
                  <p className="tagline">
                    {hosting ? 'Share the code, then start when ready.' : 'Waiting for the host to start…'}
                  </p>
                </div>
                <div className="card results">
                  <p className="muted">Room code</p>
                  <p>
                    <strong className="room-code">{code}</strong>
                  </p>
                  {hosting ? (
                    <>
                      <div className="btn-row center">
                        <button className="btn" onClick={() => void copyInvite(code)}>
                          {copied ? '✓ Copied!' : '⧉ Copy invite'}
                        </button>
                      </div>
                      <p aria-live="polite">
                        {guestHere ? `✅ ${guestHere} joined!` : 'Waiting for Player 2…'}
                      </p>
                      <div className="btn-row center">
                        <button
                          className="btn primary"
                          onClick={() =>
                            setClassicGame({
                              seat: 1,
                              sessionId: classicRoom.sessionId,
                              rowId: classicRoom.rowId,
                              code: classicRoom.code,
                              myName: p1.trim() || 'Host',
                            })
                          }
                          autoFocus
                        >
                          ▶ Start game
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            setClassicRoom(null);
                            setClassicGuest(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p aria-live="polite">The game begins when the host presses Start.</p>
                      <div className="btn-row center">
                        <button
                          className="btn"
                          onClick={() => {
                            setClassicWaiting(null);
                            setGuestSnap(null);
                          }}
                        >
                          Leave
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        }
        return (
          <div className="app">
            {spError && (
              <div className="error-banner" role="alert">
                {spError} <button onClick={() => setSpError(null)} aria-label="Dismiss error">✕</button>
              </div>
            )}
            <div className="screen">
              <div className="hero">
                <h1>🎲 Classic Flick</h1>
                <p className="tagline">Real flick physics. Same laptop, or online across two laptops.</p>
              </div>
              <div className="card">
                <h2>Play mode</h2>
                <div className="form-row">
                  <label>
                    Your name
                    <input value={p1} onChange={(e) => setP1(e.target.value)} maxLength={20} aria-label="Your name" />
                  </label>
                  <label>
                    Room code (to join)
                    <input
                      value={classicJoinCode}
                      onChange={(e) => setClassicJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      placeholder="ABC123"
                      aria-label="Classic room code"
                    />
                  </label>
                </div>
                {classicJoinError && (
                  <div className="error-banner" role="alert">
                    {classicJoinError}
                  </div>
                )}
                <div className="btn-row">
                  <button className="btn primary" onClick={startClassicLocal}>
                    🖥 This laptop
                  </button>
                  <button className="btn" onClick={hostClassic} disabled={!p1.trim()}>
                    🌐 Host online
                  </button>
                  <button
                    className="btn"
                    onClick={joinClassic}
                    disabled={!p1.trim() || classicJoinCode.trim().length < 6 || classicJoining}
                  >
                    {classicJoining ? 'Joining…' : '🔑 Join room'}
                  </button>
                </div>
                <div className="btn-row">
                  <button className="btn small" onClick={() => setAppTab('quiz')}>
                    ← Back to Quiz Battle
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }
      if (classicGame.seat === null) {
        return (
          <ClassicMode
            playerNames={[p1.trim() || 'Asha', p2.trim() || 'Ravi']}
            targetScore={target > 0 ? target : 50}
            clockSecs={clockSecs}
            sink={classicSink}
            onExit={() => {
              setClassicGame(null);
              setClassicRoom(null);
              setClassicWaiting(null);
              setGuestSnap(null);
              setClassicGuest(null);
              setAppTab('quiz');
            }}
          />
        );
      }
      return (
        <ClassicMode
          key={`${classicGame.sessionId}-p${classicGame.seat}`}
          sessionId={classicGame.sessionId}
          playerNames={
            classicGame.seat === 1
              ? [classicGame.myName, 'Player 2']
              : ['Player 1', classicGame.myName]
          }
          targetScore={target > 0 ? target : 50}
          clockSecs={clockSecs}
          sink={{ onShot: classicOnlineShot }}
          initialSnapshot={classicGame.seat === 2 ? guestSnap : null}
          publishOpening={classicGame.seat === 1}
          net={{
            mySeat: classicGame.seat,
            myName: classicGame.myName,
            readRoom: async () => {
              const row = await fetchSessionRow(classicGame.sessionId);
              if (!row) return null;
              const snapshot = await readClassicSnapshot(classicGame.sessionId);
              return { p1: row.Player1Name ?? '', p2: row.Player2Name ?? '', snapshot };
            },
            writeSnapshot: (snap) => writeClassicSnapshot(classicGame.rowId, snap),
          }}
          onExit={() => {
            setClassicGame(null);
            setClassicRoom(null);
            setClassicWaiting(null);
            setGuestSnap(null);
            setClassicGuest(null);
            setAppTab('quiz');
          }}
        />
      );
    }
    return (
      <div className="app">
        {spError && (
          <div className="error-banner" role="alert">
            {spError} <button onClick={() => setSpError(null)} aria-label="Dismiss error">✕</button>
          </div>
        )}
        <div className="screen">
          <div className="hero">
            <h1>🎯 Carrom Quiz Battle</h1>
            <p className="tagline">Pocket coins with your brain. Two players, one board, quiz-powered shots.</p>
          </div>
          <div className="card">
            <div className="shot-grid mode-pick" role="radiogroup" aria-label="Game">
              <button
                role="radio"
                aria-checked={true}
                className="shot active"
                onClick={() => undefined}
              >
                🎯 Quiz Battle
              </button>
              <button role="radio" aria-checked={false} className="shot" onClick={() => setAppTab('classic')}>
                🎲 Classic Flick
              </button>
            </div>
          </div>
          <div className="card">
            <h2>New game</h2>
            <div className="shot-grid mode-pick" role="radiogroup" aria-label="Play mode">
              {(
                [
                  ['local', '🖥 Same laptop'],
                  ['host', '🌐 Host online'],
                  ['join', '🔑 Join online'],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={playMode === m}
                  className={`shot${playMode === m ? ' active' : ''}`}
                  onClick={() => {
                    setPlayMode(m);
                    setJoinError(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="form-row">
              <label>
                {playMode === 'join' ? 'Your name' : 'Player 1'}
                <input value={p1} onChange={(e) => setP1(e.target.value)} maxLength={20} aria-label="Player 1 name" />
              </label>
              {playMode === 'local' && (
                <label>
                  Player 2
                  <input value={p2} onChange={(e) => setP2(e.target.value)} maxLength={20} aria-label="Player 2 name" />
                </label>
              )}
              {playMode === 'join' && (
                <label>
                  Room code
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="ABC123"
                    aria-label="Room code"
                  />
                </label>
              )}
              <label>
                Target score
                <input
                  type="number"
                  min={10}
                  max={190}
                  step={10}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  aria-label="Target score"
                />
              </label>
              <label>
                Shot clock
                <select value={clockSecs} onChange={(e) => setClockSecs(Number(e.target.value))} aria-label="Shot clock seconds">
                  <option value={15}>15s (quick)</option>
                  <option value={30}>30s (standard)</option>
                  <option value={45}>45s (relaxed)</option>
                  <option value={60}>60s (casual)</option>
                </select>
              </label>
            </div>
            {joinError && (
              <div className="error-banner" role="alert">
                {joinError}
              </div>
            )}
            <div className="btn-row">
              {playMode === 'local' && (
                <button
                  className="btn primary"
                  disabled={!p1.trim() || !p2.trim() || target <= 0}
                  onClick={startGame}
                >
                  Start battle
                </button>
              )}
              {playMode === 'host' && (
                <button
                  className="btn primary"
                  disabled={!p1.trim() || target <= 0}
                  onClick={startOnlineHost}
                >
                  Host online game
                </button>
              )}
              {playMode === 'join' && (
                <button
                  className="btn primary"
                  disabled={!p1.trim() || joinCode.trim().length < 6 || joining}
                  onClick={joinOnline}
                >
                  {joining ? 'Joining…' : 'Join room'}
                </button>
              )}
            </div>
            {bankState.skipped > 0 && (
              <p className="muted">{bankState.skipped} invalid question rows were skipped.</p>
            )}
          </div>
          <div className="card">
            <h2>🏆 Champions</h2>
            {!champs ? (
              <div className="btn-row">
                <button className="btn" onClick={loadChampions} disabled={champsLoading}>
                  {champsLoading ? 'Loading…' : 'Show leaderboard'}
                </button>
              </div>
            ) : champs.length === 0 ? (
              <p className="muted">No finished games yet — be the first champion!</p>
            ) : (
              <ol className="champs">
                {champs.map((c) => (
                  <li key={c.sessionId}>
                    <strong>
                      {c.winner === 0 ? 'Draw' : c.winner === 1 ? c.p1 : c.p2}
                    </strong>{' '}
                    <span className="muted">
                      {c.p1} {c.s1} — {c.s2} {c.p2}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="card">
            <h2>How to play</h2>
            <ol className="rules">
              <li>Either player may select <strong>any available coin</strong> on their turn.</li>
              <li>Each turn has a <strong>shot clock</strong> — strike (pick + answer) in time or the turn passes.</li>
              <li>Answer the question: <strong>correct</strong> pockets the coin and you play again; <strong>wrong</strong> sends the coin off-target and passes the turn.</li>
              <li>Shots matter: <strong>Straight +10</strong> (any), <strong>Cut +12</strong> (medium+), <strong>Bank +15</strong> (hardest), <strong>Defensive +10</strong> (easy).</li>
              <li>The red <strong>Queen</strong> needs a hard question + a <strong>cover</strong>: pocket another coin next turn or she returns! Cover bonus <strong>+20</strong>.</li>
              <li>Every turn is saved to SharePoint (sessions, attempts, coin events).</li>
              <li>Online rooms: host shares the 6-letter code, the guest joins from another laptop — same rules, mirrored board.</li>
            </ol>
          </div>
          <p className="muted" style={{ textAlign: 'center' }}>
            Build {APP_VERSION} · Classic Flick + Modern Kingdom board
          </p>
        </div>
      </div>
    );
  }

  if (game.phase === 'finished') {
    const [s1, s2] = game.scores;
    return (
      <div className="app">
        <Confetti pieces={game.winner === 0 ? 30 : 80} />
        {spError && (
          <div className="error-banner" role="alert">
            {spError} <button onClick={() => setSpError(null)} aria-label="Dismiss error">✕</button>
          </div>
        )}
        <div className="screen">
          <div className="card results">
            <h1>
              {game.winner === 0
                ? 'A hard-fought draw!'
                : `🏆 ${game.winner === 1 ? game.playerNames[0] : game.playerNames[1]} wins!`}
            </h1>
            <p className="final-score">
              {game.playerNames[0]} <strong>{s1}</strong> — <strong>{s2}</strong> {game.playerNames[1]}
            </p>
            <p className="muted">Results saved to SharePoint.</p>
            <div className="btn-row center">
              <button className="btn primary" onClick={restart} autoFocus>
                Play again
              </button>
              <button className="btn" onClick={backToMenu}>
                Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const me = game.currentPlayer;
  const isMyTurn = mode === 'local' || game.currentPlayer === mySeat;
  const opponentName = game.playerNames[mySeat === 1 ? 1 : 0];
  const boardDisabled = paused || game.phase !== 'ready' || pocketAnim !== null || !isMyTurn;
  const activeCoin = game.activeCoinId ? getCoin(game, game.activeCoinId) : undefined;
  const strikerX = activeCoin ? Math.min(290, Math.max(110, activeCoin.pos.x)) : 200;
  const pocketed = game.coins.filter((c) => c.state === 'pocketed').length;

  return (
    <div className="app">
      {spError && (
        <div className="error-banner" role="alert">
          {spError} <button onClick={() => setSpError(null)} aria-label="Dismiss error">✕</button>
        </div>
      )}
      <header className="topbar">
        <h1 className="logo">🎯 Carrom Quiz Battle</h1>
        {(game.phase === 'ready' || game.phase === 'asking') &&
          !paused &&
          (mode === 'local' || game.currentPlayer === mySeat) && (
            <span
              className={`clock-pill${timeLeft <= 5 ? ' low' : ''}`}
              role="timer"
              aria-label={`${timeLeft} seconds left to strike`}
            >
              ⏱ {timeLeft}s
            </span>
          )}
        <div className="top-actions">
          <QueenBadge queenState={game.queenState} />
          <span className="theme-pick" role="radiogroup" aria-label="Board theme">
            {THEMES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={theme === t}
                aria-label={`${t} theme`}
                title={`${t} theme`}
                className={`theme-dot ${t}${theme === t ? ' active' : ''}`}
                onClick={() => setTheme(t)}
              />
            ))}
          </span>
          <button className="btn small" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn small" onClick={restart}>
            ↺ Restart
          </button>
          <button className="btn small" onClick={backToMenu}>
            Menu
          </button>
        </div>
      </header>

      <Toast msg={toast?.msg ?? null} tone={toast?.tone ?? 'info'} />

      <main className="layout">
        <div className="board-col">
          <div className="board-stack" style={{ position: 'relative' }}>
            <Board
              coins={game.coins}
              queenState={game.queenState}
              activeCoinId={game.activeCoinId}
              disabled={boardDisabled}
              pocketAnim={pocketAnim}
              strikerX={strikerX}
              aimTo={game.phase === 'asking' && isMyTurn && activeCoin ? activeCoin.pos : null}
              pocketFlash={pocketFlash}
              onSelect={handleSelect}
              onAnimDone={handleAnimDone}
            />
            <FxLayer bursts={bursts} floaters={floaters} />
          </div>
          <p className="board-hint" aria-live="polite">
            {paused
              ? 'Paused — press Resume to continue.'
              : !isMyTurn
                ? `Waiting for ${opponentName}… (room ${roomCode ?? ''})`
                : game.phase === 'asking'
                  ? 'Answer the question to shoot…'
                  : game.phase === 'animating'
                    ? game.animKind === 'miss'
                      ? 'Off target…'
                      : 'Pocketing…'
                    : game.awaitingCover
                      ? `${game.playerNames[me - 1]} must cover the Queen — pick another coin!`
                      : `${game.playerNames[me - 1]}, pick any available coin. Pocketed ${pocketed}/19.`}
          </p>
        </div>

        <aside className="side-col">
          {mode === 'online' && roomCode && (
            <section className="card room" aria-label="Online room">
              <h2>
                {mySeat === 1
                  ? guestJoined
                    ? `🌐 ${opponentName} is in!`
                    : '🌐 Waiting for Player 2…'
                  : `🌐 Room ${roomCode}`}
              </h2>
              {mySeat === 1 && !guestJoined && (
                <p>
                  Room code: <strong className="room-code">{roomCode}</strong>
                  <br />
                  <span className="muted">
                    {roomLive ? `Room live ✓${roomRowId ? ` (#${roomRowId})` : ''} — share the code.` : 'Saving room…'}
                  </span>
                </p>
              )}
              {mySeat === 2 && <p className="muted">You are Player 2 · {game.playerNames[0]} hosts.</p>}
            </section>
          )}
          <PlayerPanel
            name={game.playerNames[0]}
            score={game.scores[0]}
            player={1}
            isTurn={me === 1}
            mustCover={me === 1 && game.awaitingCover}
            target={game.targetScore}
          />
          <PlayerPanel
            name={game.playerNames[1]}
            score={game.scores[1]}
            player={2}
            isTurn={me === 2}
            mustCover={me === 2 && game.awaitingCover}
            target={game.targetScore}
          />
          <section className="card shots" aria-label="Shot selection">
            <h2>Shot style</h2>
            <div className="shot-grid" role="radiogroup" aria-label="Shot style">
              {SHOTS.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={shot === s.id}
                  className={`shot${shot === s.id ? ' active' : ''}`}
                  onClick={() => setShot(s.id)}
                  disabled={game.phase !== 'ready'}
                  title={SHOT_DESC[s.id]}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="muted">Harder shots ask harder questions and pay bonus points.</p>
          </section>
        </aside>
      </main>

      {paused && (
        <div className="modal-backdrop">
          <div className="modal narrow" role="dialog" aria-modal="true" aria-label="Paused">
            <h2>Paused</h2>
            <div className="btn-row center">
              <button className="btn primary" onClick={() => setPaused(false)} autoFocus>
                ▶ Resume
              </button>
              <button className="btn" onClick={restart}>
                ↺ Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {game.phase === 'asking' && game.activeQuestion && game.activeCoinId && !paused && isMyTurn && (
        <QuestionDialog
          question={game.activeQuestion}
          coinId={game.activeCoinId}
          shot={game.activeShot ?? 'straight'}
          points={10 + SHOT_BONUS[game.activeShot ?? 'straight']}
          playerName={game.playerNames[me - 1]}
          isCover={game.awaitingCover && game.activeCoinId !== 'Q'}
          onAnswer={handleAnswer}
        />
      )}
    </div>
  );
}
