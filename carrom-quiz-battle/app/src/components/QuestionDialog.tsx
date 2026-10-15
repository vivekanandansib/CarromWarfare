import { useEffect, useRef, useState } from 'react';
import type { Question, ShotType } from '../game/types';

interface Props {
  question: Question;
  coinId: string;
  shot: ShotType;
  points: number;
  playerName: string;
  isCover: boolean;
  onAnswer: (index: number) => void;
}

const SHOT_LABEL: Record<ShotType, string> = {
  straight: 'Straight shot',
  cut: 'Cut shot',
  bank: 'Bank shot',
  defensive: 'Defensive shot',
};

export default function QuestionDialog({ question, coinId, shot, points, playerName, isCover, onAnswer }: Props) {
  const [showHint, setShowHint] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const firstBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstBtn.current?.focus();
  }, []);

  const submit = (i: number) => {
    if (picked !== null) return; // duplicate-submission guard (UI level too)
    setPicked(i);
    // brief beat so the pick is visible before the dialog closes
    setTimeout(() => onAnswer(i), 260);
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="q-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.stopPropagation(); // must answer; Esc does not skip
        }}
      >
        <div className="modal-tags">
          <span className={`tag ${question.category === 'Learning' ? 'tag-learn' : 'tag-strat'}`}>
            {question.category}
          </span>
          <span className="tag tag-diff">
            {question.difficulty === 3 ? 'Hard' : question.difficulty === 2 ? 'Medium' : 'Easy'}
          </span>
          <span className="tag tag-shot">{SHOT_LABEL[shot]} challenge</span>
          {isCover && <span className="tag tag-cover">Queen cover — must pocket!</span>}
        </div>
        <h2 id="q-title" className="modal-q">
          {question.text}
        </h2>
        <p className="modal-sub">
          {playerName} · coin <strong>{coinId}</strong> · +{points} pts for a correct answer
        </p>
        <div className="options" role="group" aria-label="Answer options">
          {question.options.map((opt, i) => (
            <button
              key={i}
              ref={i === 0 ? firstBtn : undefined}
              className={`option${picked === i ? ' picked' : ''}`}
              onClick={() => submit(i)}
              disabled={picked !== null}
            >
              <span className="opt-letter">{'ABCD'[i]}</span> {opt}
            </button>
          ))}
        </div>
        <button className="hint-btn" onClick={() => setShowHint((s) => !s)} aria-expanded={showHint}>
          {showHint ? 'Hide hint' : 'Show hint'}
        </button>
        {showHint && <p className="hint">💡 {question.hint}</p>}
      </div>
    </div>
  );
}
