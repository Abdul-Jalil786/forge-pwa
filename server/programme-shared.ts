// Typed server-side loader for the shared programme module.
//
// public/programme-shared.js is the single source of truth for exercise
// id->name and the training schedule (see that file). The browser loads it as a
// <script>; the server loads it here. public/ is served from
// process.cwd()/public at runtime (see index.ts static serving), so we resolve
// it there — this keeps ONE definition instead of a hand-copied server mirror.
import path from "path";

interface ProgrammeLabel { name: string; pattern: string; }
interface ProgrammeShared {
  EXERCISE_NAMES: Record<string, string>;
  LEGACY_EXERCISE_NAMES: Record<string, string>;
  exerciseName(id: string): string | null;
  PROGRAMME_LABELS: Record<string, ProgrammeLabel>;
  programmeLabel(programId: string): ProgrammeLabel;
  trainingDayInCycle(dateStr: string, startDate?: string): number;
  sessionTypeForDate(programId: string, dateStr: string, startDate?: string): string | null;
  deloadWeekInfo(programmeStartDate: string | null | undefined, dateStr: string): { weekInCycle: number; isDeload: boolean } | null;
  DEFAULT_TRAINING_START: string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const shared: ProgrammeShared = require(path.join(process.cwd(), "public", "programme-shared.js"));

export const EXERCISE_NAMES = shared.EXERCISE_NAMES;

// Display name for an exercise id (current or legacy); falls back to the raw id
// so a caller never renders an empty string.
export function exerciseName(id: string): string {
  return shared.exerciseName(id) || id;
}

// programId + date (+ training anchor) -> WORKOUTS session key, or null (rest).
export function sessionTypeForDate(
  programId: string,
  dateStr: string,
  startDate?: string
): string | null {
  return shared.sessionTypeForDate(programId, dateStr, startDate);
}

// Human-readable { name, pattern } for a programme id (falls back to the default).
export function programmeLabel(programId: string): ProgrammeLabel {
  return shared.programmeLabel(programId || "upper-lower-4d");
}

// Scheduled-deload week info (every 5th week, per-user programmeStartDate anchor).
export function deloadWeekInfo(programmeStartDate: string | null | undefined, dateStr: string) {
  return shared.deloadWeekInfo(programmeStartDate, dateStr);
}
