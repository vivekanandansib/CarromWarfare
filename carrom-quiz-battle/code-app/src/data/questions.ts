// Sample question bank: Learning + Carrom Strategy (incl. hard queen challenges).
import type { Question } from '../game/types';

export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 'L-01', text: 'Which gas do plants absorb for photosynthesis?',
    category: 'Learning', difficulty: 1,
    options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
    correctIndex: 1, hint: 'It is what we exhale.', isActive: true,
  },
  {
    id: 'L-02', text: 'What is 12 × 8?',
    category: 'Learning', difficulty: 1,
    options: ['84', '92', '96', '108'],
    correctIndex: 2, hint: '10×8 + 2×8.', isActive: true,
  },
  {
    id: 'L-03', text: 'Which planet is known as the Red Planet?',
    category: 'Learning', difficulty: 1,
    options: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
    correctIndex: 1, hint: 'Named after the god of war.', isActive: true,
  },
  {
    id: 'L-04', text: 'What is the largest ocean on Earth?',
    category: 'Learning', difficulty: 2,
    options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
    correctIndex: 3, hint: 'It covers a third of the surface.', isActive: true,
  },
  {
    id: 'L-05', text: 'Which element has the chemical symbol Fe?',
    category: 'Learning', difficulty: 2,
    options: ['Fluorine', 'Iron', 'Lead', 'Tin'],
    correctIndex: 1, hint: 'From the Latin ferrum.', isActive: true,
  },
  {
    id: 'L-06', text: 'In which year did the first moon landing occur?',
    category: 'Learning', difficulty: 2,
    options: ['1965', '1969', '1972', '1959'],
    correctIndex: 1, hint: 'Apollo 11.', isActive: true,
  },
  {
    id: 'S-01', text: 'In carrom, where must the striker be placed before a shot?',
    category: 'Strategy', difficulty: 1,
    options: ['Anywhere on the board', 'On the baseline within the circles', 'In a pocket', 'On the center spot'],
    correctIndex: 1, hint: 'Think of the foul lines at each side.', isActive: true,
  },
  {
    id: 'S-02', text: 'What is a “bank shot” in carrom?',
    category: 'Strategy', difficulty: 2,
    options: ['Hitting the coin directly', 'Bouncing the striker off a cushion first', 'Flicking with two fingers', 'Pocketing two coins at once'],
    correctIndex: 1, hint: 'Use the frame like a mirror.', isActive: true,
  },
  {
    id: 'S-03', text: 'When should you prefer a defensive shot?',
    category: 'Strategy', difficulty: 2,
    options: ['When no safe pocket is available', 'Always — it scores double', 'Only on the first turn', 'Never, it is a foul'],
    correctIndex: 0, hint: 'Leave your opponent nothing easy.', isActive: true,
  },
  {
    id: 'S-04', text: 'After pocketing the queen, what must you do to keep her?',
    category: 'Strategy', difficulty: 2,
    options: ['Nothing — she is yours', 'Pocket another coin on your next turn (cover)', 'Win the next two turns', 'Answer three bonus questions'],
    correctIndex: 1, hint: 'It is called the cover.', isActive: true,
  },
  {
    id: 'S-05', text: 'A striker rebounds off two cushions before hitting the coin. What is this called?',
    category: 'Strategy', difficulty: 3,
    options: ['Straight shot', 'Cut shot', 'Double-bank shot', 'Foul shot'],
    correctIndex: 2, hint: 'Bank, twice.', isActive: true,
  },
  {
    id: 'S-06', text: 'Your opponent’s coin blocks the pocket line. Which shot cuts around it with the finest angle?',
    category: 'Strategy', difficulty: 3,
    options: ['Straight drive', 'Fine cut shot', 'Defensive block', 'Center flick'],
    correctIndex: 1, hint: 'Graze the edge, not the face.', isActive: true,
  },
  {
    id: 'L-07', text: 'Which mathematician is credited with the laws of motion and gravity?',
    category: 'Learning', difficulty: 3,
    options: ['Einstein', 'Galileo', 'Newton', 'Kepler'],
    correctIndex: 2, hint: 'The apple story.', isActive: true,
  },
  {
    id: 'L-08', text: 'What is the binary representation of decimal 13?',
    category: 'Learning', difficulty: 3,
    options: ['1011', '1101', '1110', '1001'],
    correctIndex: 1, hint: '8 + 4 + 1.', isActive: true,
  },
];
