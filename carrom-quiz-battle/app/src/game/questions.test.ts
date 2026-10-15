import { describe, expect, it } from 'vitest';
import { QuestionBank, validateQuestion } from './questions';
import type { Question } from './types';

const VALID: Question = {
  id: 'T-1',
  text: 'Sample?',
  category: 'Learning',
  difficulty: 1,
  options: ['a', 'b', 'c', 'd'],
  correctIndex: 0,
  hint: 'hint',
  isActive: true,
};

describe('question validation', () => {
  it('accepts a valid record', () => {
    expect(validateQuestion(VALID)).toEqual([]);
  });

  it('rejects bad records before use', () => {
    expect(validateQuestion({ ...VALID, options: ['a', 'b', 'c', ''] as never }).length).toBeGreaterThan(0);
    expect(validateQuestion({ ...VALID, correctIndex: 7 as never }).length).toBeGreaterThan(0);
    expect(validateQuestion({ ...VALID, category: 'X' as never }).length).toBeGreaterThan(0);
  });

  it('skips inactive and invalid records', () => {
    const bank = new QuestionBank([
      VALID,
      { ...VALID, id: 'T-2', isActive: false },
      { ...VALID, id: 'T-3', options: ['x'] as never },
    ]);
    expect(bank.size).toBe(1);
  });
});

describe('question selection', () => {
  it('does not repeat until the pool is exhausted', () => {
    const bank = new QuestionBank([
      VALID,
      { ...VALID, id: 'T-2' },
    ]);
    const used: string[] = [];
    const q1 = bank.next({ usedIds: used })!;
    used.push(q1.id);
    const q2 = bank.next({ usedIds: used })!;
    expect(q2.id).not.toBe(q1.id);
    used.push(q2.id);
    const q3 = bank.next({ usedIds: used })!;
    expect([q1.id, q2.id]).toContain(q3.id); // reshuffle after exhaustion
  });

  it('queen challenges prefer hard questions', () => {
    const bank = new QuestionBank([
      VALID,
      { ...VALID, id: 'T-H', difficulty: 3 },
    ]);
    const q = bank.next({ usedIds: [], queenChallenge: true })!;
    expect(q.difficulty).toBe(3);
  });

  it('empty bank returns undefined', () => {
    expect(new QuestionBank([]).next({ usedIds: [] })).toBeUndefined();
  });
});
