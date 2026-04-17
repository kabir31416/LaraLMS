export type Day = "শনিবার" | "রবিবার" | "সোমবার" | "মঙ্গলবার" | "বুধবার" | "বৃহস্পতিবার" | "শুক্রবার";

export const DAYS: Day[] = [
  "শনিবার",
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
];

export interface Teacher {
  id: string;
  name: string;
  subject: string;
}

export interface RoutineEntry {
  id: string;
  day: Day;
  startTime: string; // "HH:MM" 24h
  endTime: string;
  subject: string;
  teacherId: string;
  room?: string;
  batches: string[]; // batch names
  section?: string;
}

export const TEACHERS: Teacher[] = [
  { id: "t1", name: "রাহিম স্যার", subject: "বাংলা" },
  { id: "t2", name: "করিম স্যার", subject: "ইংরেজি" },
  { id: "t3", name: "হাসান স্যার", subject: "গণিত" },
  { id: "t4", name: "নাঈম স্যার", subject: "পদার্থ" },
  { id: "t5", name: "ফারুক স্যার", subject: "রসায়ন" },
];
