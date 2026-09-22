export type WeekDay =
  | "শনিবার"
  | "রবিবার"
  | "সোমবার"
  | "মঙ্গলবার"
  | "বুধবার"
  | "বৃহস্পতিবার"
  | "শুক্রবার";

export const WEEK_DAYS: WeekDay[] = [
  "শনিবার",
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
];

export interface Batch {
  id: string;
  name: string;
  courseId: string; // real Course id (Phase 1 §3 fix — used to be the course name)
  batchTime: string; // e.g. "৫:০০ PM - ৭:০০ PM"
  days: WeekDay[];
  roomNumber?: string;
  startDate: string; // ISO
  directorIds: string[]; // staff ids (Batch Directors — a batch may have more than one)
  // No studentIds here anymore — a batch's roster is whoever has
  // Student.batchId === this batch's id (kept in sync by the enrollment
  // API on enroll/transfer/withdraw), not an array owned by the batch.
}
