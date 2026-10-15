// PCF output bridge: the React layer never talks to Power Apps directly.
// It pushes GameEvents here; the control calls notifyOutputChanged() and
// getOutputs() returns { GameEventJson, EventSequence }. The Canvas App watches
// EventSequence (monotonic counter) and parses GameEventJson. Tested here,
// copied verbatim into the PCF project.
import type { GameEvent } from './types';

export class EventBridge {
  private seq = 0;
  private lastJson = '';

  push(ev: GameEvent): { gameEventJson: string; eventSequence: number } {
    this.seq++;
    this.lastJson = JSON.stringify(ev);
    return this.getOutputs();
  }

  getOutputs(): { gameEventJson: string; eventSequence: number } {
    return { gameEventJson: this.lastJson, eventSequence: this.seq };
  }

  get sequence(): number {
    return this.seq;
  }
}
