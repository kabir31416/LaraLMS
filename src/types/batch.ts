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
  course: string;
  batchTime: string; // e.g. "৫:০০ PM - ৭:০০ PM"
  days: WeekDay[];
  roomNumber: string;
  startDate: string; // ISO
  directorId?: string; // staff id (Batch Director)
  studentIds: string[];
}
