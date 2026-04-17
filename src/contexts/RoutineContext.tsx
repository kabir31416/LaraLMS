import React, { createContext, useContext, useState, useCallback } from "react";
import { RoutineEntry } from "@/types/routine";

const initialRoutines: RoutineEntry[] = [
  { id: "r1", day: "শনিবার", startTime: "09:00", endTime: "10:00", subject: "বাংলা", teacherId: "t1", room: "১০১", batches: ["ব্যাচ-২০২৬-A"], section: "সেকশন-A" },
  { id: "r2", day: "শনিবার", startTime: "10:00", endTime: "11:00", subject: "গণিত", teacherId: "t3", room: "১০২", batches: ["ব্যাচ-২০২৬-A", "ব্যাচ-২০২৬-B"] },
  { id: "r3", day: "রবিবার", startTime: "09:00", endTime: "10:00", subject: "ইংরেজি", teacherId: "t2", room: "১০১", batches: ["ব্যাচ-২০২৬-A"] },
  { id: "r4", day: "রবিবার", startTime: "11:00", endTime: "12:00", subject: "পদার্থ", teacherId: "t4", room: "২০১", batches: ["ব্যাচ-২০২৬-B"] },
  { id: "r5", day: "সোমবার", startTime: "09:00", endTime: "10:00", subject: "রসায়ন", teacherId: "t5", room: "২০২", batches: ["ব্যাচ-২০২৬-A", "ব্যাচ-২০২৫-A"] },
  { id: "r6", day: "সোমবার", startTime: "10:00", endTime: "11:00", subject: "বাংলা", teacherId: "t1", batches: ["ব্যাচ-২০২৫-B"] },
  { id: "r7", day: "মঙ্গলবার", startTime: "09:00", endTime: "10:00", subject: "গণিত", teacherId: "t3", room: "১০২", batches: ["ব্যাচ-২০২৬-A"] },
  { id: "r8", day: "বুধবার", startTime: "10:00", endTime: "11:00", subject: "ইংরেজি", teacherId: "t2", room: "১০১", batches: ["ব্যাচ-২০২৬-B", "ব্যাচ-২০২৫-A"] },
  { id: "r9", day: "বৃহস্পতিবার", startTime: "09:00", endTime: "10:00", subject: "পদার্থ", teacherId: "t4", room: "২০১", batches: ["ব্যাচ-২০২৬-A"] },
];

interface RoutineContextType {
  routines: RoutineEntry[];
  addRoutine: (data: Omit<RoutineEntry, "id">) => void;
  updateRoutine: (id: string, data: Omit<RoutineEntry, "id">) => void;
  deleteRoutine: (id: string) => void;
}

const RoutineContext = createContext<RoutineContextType | null>(null);

export function RoutineProvider({ children }: { children: React.ReactNode }) {
  const [routines, setRoutines] = useState<RoutineEntry[]>(initialRoutines);

  const addRoutine = useCallback((data: Omit<RoutineEntry, "id">) => {
    setRoutines((prev) => [...prev, { ...data, id: `r${Date.now()}` }]);
  }, []);

  const updateRoutine = useCallback((id: string, data: Omit<RoutineEntry, "id">) => {
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...data, id } : r)));
  }, []);

  const deleteRoutine = useCallback((id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return (
    <RoutineContext.Provider value={{ routines, addRoutine, updateRoutine, deleteRoutine }}>
      {children}
    </RoutineContext.Provider>
  );
}

export function useRoutines() {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error("useRoutines must be within RoutineProvider");
  return ctx;
}
