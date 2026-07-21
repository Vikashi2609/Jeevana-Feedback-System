// Only truly structural constants live here now.
// Teacher/section/subject assignments live in the `teachers` table
// and are editable live from the Admin dashboard.

export const CLASSES = ["VI", "VII", "VIII", "IX", "X"] as const;
export type ClassName = (typeof CLASSES)[number];

export const QUESTIONS: string[] = [
  "The teacher has good subject knowledge.",
  "Provides additional information apart from the textbook.",
  "Explains the concepts clearly.",
  "Ensures students are attentive and classes are interactive.",
  "Speaks clearly with proper pronunciation and voice modulation and teaches at the right speed.",
  "Does the Homework and Test Corrections on time.",
  "Marks the errors while correcting homework notebooks.",
  "Is easily approachable.",
  "Is impartial.",
  "Appreciates, encourages and respects students.",
];
