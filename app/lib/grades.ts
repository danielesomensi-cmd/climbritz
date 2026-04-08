/**
 * Kilter Board difficulty-to-grade mapping.
 * Mirrors backend/app/utils/kilter_parser.py::GRADES.
 */

export interface Grade {
  difficulty: number;
  font: string;
  v: string;
}

export const GRADES: Grade[] = [
  { difficulty: 10, font: '4a', v: 'V0' },
  { difficulty: 11, font: '4b', v: 'V0' },
  { difficulty: 12, font: '4c', v: 'V0' },
  { difficulty: 13, font: '5a', v: 'V1' },
  { difficulty: 14, font: '5b', v: 'V1' },
  { difficulty: 15, font: '5c', v: 'V2' },
  { difficulty: 16, font: '6a', v: 'V3' },
  { difficulty: 17, font: '6a+', v: 'V3' },
  { difficulty: 18, font: '6b', v: 'V4' },
  { difficulty: 19, font: '6b+', v: 'V4' },
  { difficulty: 20, font: '6c', v: 'V5' },
  { difficulty: 21, font: '6c+', v: 'V5' },
  { difficulty: 22, font: '7a', v: 'V6' },
  { difficulty: 23, font: '7a+', v: 'V7' },
  { difficulty: 24, font: '7b', v: 'V8' },
  { difficulty: 25, font: '7b+', v: 'V8' },
  { difficulty: 26, font: '7c', v: 'V9' },
  { difficulty: 27, font: '7c+', v: 'V10' },
  { difficulty: 28, font: '8a', v: 'V11' },
  { difficulty: 29, font: '8a+', v: 'V12' },
  { difficulty: 30, font: '8b', v: 'V13' },
];

export const MIN_DIFFICULTY = GRADES[0].difficulty;
export const MAX_DIFFICULTY = GRADES[GRADES.length - 1].difficulty;

/** Parse a "6a/V3" style grade string from the API into its two halves. */
export function splitGrade(gradeString: string): { font: string; v: string } {
  const [font, v] = gradeString.split('/');
  return { font: font ?? gradeString, v: v ?? '' };
}

/** Look up a Grade record by its numeric difficulty (nearest match). */
export function gradeByDifficulty(difficulty: number): Grade | undefined {
  return GRADES.find((g) => g.difficulty === Math.round(difficulty));
}
