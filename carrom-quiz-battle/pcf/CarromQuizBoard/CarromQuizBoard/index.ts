// =============================================================================
// CarromQuizBoard — PCF control entry point (virtual React control)
// Inputs  (bound): QuestionsJson, SessionConfigJson, InitialGameStateJson?
// Outputs (bound): GameEventJson (v1.0 JSON) + EventSequence (monotonic counter)
// Output mechanism: React layer calls onEvent -> bridge.push() ->
// notifyOutputChanged(); framework pulls getOutputs(). Canvas App watches
// EventSequence and parses GameEventJson (see canvas-app/powerfx-carrom.ts).
// React callbacks alone do NOT reach Power Apps — notifyOutputChanged is required.
// =============================================================================
import * as React from 'react';
import CarromPcfHost, { PcfSessionConfig } from './CarromPcfHost';
import { EventBridge } from './game/eventBridge';
import { deserializeState } from './game/engine';
import { QuestionBank, validateQuestion } from './game/questions';
import type { GameEvent, GameState, Question } from './game/types';
import { IInputs, IOutputs } from './generated/ManifestTypes';

interface ParsedInputs {
  signature: string;
  config?: PcfSessionConfig;
  bank: QuestionBank;
  resumeState?: GameState;
  inputError: string | null;
}

function checksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${s.length}-${(h >>> 0).toString(36)}`;
}

function parseConfig(raw: string | null): PcfSessionConfig {
  if (!raw) throw new Error('SessionConfigJson is empty — bind it to the session config.');
  const c = JSON.parse(raw) as Partial<PcfSessionConfig>;
  if (!c.sessionId || !c.player1?.trim() || !c.player2?.trim())
    throw new Error('SessionConfigJson needs sessionId, player1, player2.');
  if (!c.targetScore || c.targetScore <= 0)
    throw new Error('SessionConfigJson needs a positive targetScore.');
  return {
    sessionId: c.sessionId,
    player1: c.player1.trim(),
    player2: c.player2.trim(),
    targetScore: c.targetScore,
    pointsPerCoin: c.pointsPerCoin ?? 10,
    queenBonus: c.queenBonus ?? 20,
  };
}

function parseQuestions(raw: string | null): { bank: QuestionBank; skipped: number } {
  if (!raw) return { bank: new QuestionBank([]), skipped: 0 };
  const arr = JSON.parse(raw) as {
    id: string; text: string; category: string; difficulty: number;
    options: string[]; correctIndex?: number; hint: string;
  }[];
  if (!Array.isArray(arr)) throw new Error('QuestionsJson must be a JSON array.');
  const valid: Question[] = [];
  let skipped = 0;
  for (const r of arr) {
    const q: Question = {
      id: r.id,
      text: r.text,
      category: r.category as Question['category'],
      difficulty: r.difficulty as Question['difficulty'],
      options: (r.options ?? []) as Question['options'],
      // v1: the Canvas App includes the key. Production upgrade holds it back
      // and validates via Power Automate (see docs/architecture.md §7).
      correctIndex: (r.correctIndex ?? -1) as Question['correctIndex'],
      hint: r.hint,
      isActive: true,
    };
    if (validateQuestion(q).length === 0) valid.push(q);
    else skipped++;
  }
  return { bank: new QuestionBank(valid), skipped };
}

export class CarromQuizBoard implements ComponentFramework.ReactControl<IInputs, IOutputs> {
  private _notifyOutputChanged!: () => void;
  private _bridge = new EventBridge();
  private _lastSignature = '';
  private _parsed: ParsedInputs | null = null;

  constructor() {
    // no-op
  }

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
  ): void {
    this._notifyOutputChanged = notifyOutputChanged;
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    const qRaw = context.parameters.QuestionsJson.raw;
    const cRaw = context.parameters.SessionConfigJson.raw;
    const rRaw = context.parameters.InitialGameStateJson.raw;
    const signature = [qRaw ?? '', cRaw ?? '', rRaw ? checksum(rRaw) : 'new'].join('|');

    if (signature !== this._lastSignature || !this._parsed) {
      this._lastSignature = signature;
      this._parsed = this._parseAll(qRaw, cRaw, rRaw);
    }
    const p = this._parsed;

    if (!p.config || p.inputError) {
      return React.createElement(
        'div',
        { className: 'carrom-pcf' },
        React.createElement(
          'div',
          { className: 'error-banner', role: 'alert' },
          p.inputError ?? 'Invalid session configuration.',
        ),
      );
    }

    return React.createElement(CarromPcfHost, {
      key: `${p.config.sessionId}|${rRaw ? checksum(rRaw) : 'new'}`,
      bank: p.bank,
      config: p.config,
      resumeState: p.resumeState,
      inputError: p.bank.size === 0 ? 'No valid questions — check QuestionsJson.' : null,
      onEvent: this._handleEvent.bind(this),
    });
  }

  public getOutputs(): IOutputs {
    const o = this._bridge.getOutputs();
    return {
      GameEventJson: o.gameEventJson,
      EventSequence: o.eventSequence,
    };
  }

  public destroy(): void {
    // virtual control: framework unmounts; nothing to clean up
  }

  private _handleEvent(ev: GameEvent): void {
    this._bridge.push(ev);
    this._notifyOutputChanged();
  }

  private _parseAll(
    qRaw: string | null,
    cRaw: string | null,
    rRaw: string | null,
  ): ParsedInputs {
    const signature = [qRaw ?? '', cRaw ?? '', rRaw ?? ''].join('|');
    try {
      const config = parseConfig(cRaw);
      const { bank, skipped } = parseQuestions(qRaw);
      let resumeState: GameState | undefined;
      if (rRaw) {
        const s = deserializeState(rRaw);
        // Only resume snapshots of the SAME session; otherwise start fresh.
        if (s && s.sessionId === config.sessionId && s.status === 'inProgress') resumeState = s;
      }
      if (bank.size === 0) {
        return {
          signature,
          config,
          bank,
          inputError:
            skipped > 0
              ? `QuestionsJson had no valid rows (${skipped} skipped).`
              : 'QuestionsJson is empty — load active questions first.',
        };
      }
      return { signature, config, bank, resumeState, inputError: null };
    } catch (e) {
      return {
        signature,
        bank: new QuestionBank([]),
        inputError: e instanceof Error ? e.message : 'Could not parse control inputs.',
      };
    }
  }
}
