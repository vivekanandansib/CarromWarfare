// Question service: validation, active filter, no-repeat selection, category mix.

import type { Category, Question } from './types';

export interface CategoryMix {
  Learning: number;
  Strategy: number;
}

export function validateQuestion(q: Question): string[] {
  const errors: string[] = [];
  if (!q.id) errors.push('missing id');
  if (!q.text?.trim()) errors.push(`${q.id || '?'}: missing text`);
  if (q.category !== 'Learning' && q.category !== 'Strategy')
    errors.push(`${q.id}: bad category`);
  if (![1, 2, 3].includes(q.difficulty)) errors.push(`${q.id}: bad difficulty`);
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => !o?.trim()))
    errors.push(`${q.id}: need 4 non-empty options`);
  if (![0, 1, 2, 3].includes(q.correctIndex)) errors.push(`${q.id}: bad correctIndex`);
  if (!q.hint?.trim()) errors.push(`${q.id}: missing hint`);
  if (typeof q.isActive !== 'boolean') errors.push(`${q.id}: bad isActive`);
  return errors;
}

export class QuestionBank {
  private questions: Question[];

  constructor(questions: Question[]) {
    // Keep only valid + active records; invalid rows are skipped, never fatal.
    this.questions = questions.filter(
      (q) => q.isActive && validateQuestion(q).length === 0,
    );
  }

  get size(): number {
    return this.questions.length;
  }

  /** Next question honoring no-repeat-until-exhausted + queen-hard-first + category mix. */
  next(opts: {
    usedIds: string[];
    queenChallenge?: boolean;
    mix?: CategoryMix;
    previousCategory?: Category;
  }): Question | undefined {
    let pool = this.questions;
    if (opts.queenChallenge) {
      const hard = pool.filter((q) => q.difficulty === 3);
      if (hard.length > 0) pool = hard;
    } else if (opts.mix && opts.previousCategory) {
      // Simple alternation honoring mix: prefer the non-previous category when mix is balanced.
      const prefer: Category =
        opts.previousCategory === 'Learning' ? 'Strategy' : 'Learning';
      const preferred = pool.filter((q) => q.category === prefer);
      if (preferred.length > 0 && Math.random() < 0.8) pool = preferred;
    }
    let fresh = pool.filter((q) => !opts.usedIds.includes(q.id));
    if (fresh.length === 0) fresh = [...pool]; // pool exhausted → reshuffle
    if (fresh.length === 0) return undefined;
    return fresh[Math.floor(Math.random() * fresh.length)];
  }
}
