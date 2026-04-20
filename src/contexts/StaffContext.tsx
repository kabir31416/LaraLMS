import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Staff } from "@/types/staff";

const initialStaff: Staff[] = [
  {
    id: "s1",
    name: "মাহমুদ আলী",
    mobile: "01711000001",
    email: "mahmud@lara.edu",
    address: "ঢাকা",
    staffType: "Admin",
    salary: 45000,
    joinDate: "2024-01-15",
    status: "সক্রিয়",
  },
  {
    id: "s2",
    name: "রহিম স্যার",
    mobile: "01711000002",
    email: "rahim@lara.edu",
    address: "রাজশাহী",
    staffType: "Teacher",
    salary: 30000,
    joinDate: "2024-02-01",
    status: "সক্রিয়",
  },
  {
    id: "s3",
    name: "করিম স্যার",
    mobile: "01711000003",
    staffType: "Teacher",
    salary: 28000,
    joinDate: "2024-03-10",
    status: "সক্রিয়",
  },
  {
    id: "s4",
    name: "সাইফুল ইসলাম",
    mobile: "01711000004",
    email: "saiful@lara.edu",
    staffType: "Batch Director",
    salary: 35000,
    joinDate: "2024-01-20",
    status: "সক্রিয়",
  },
  {
    id: "s5",
    name: "নাসরিন আক্তার",
    mobile: "01711000005",
    email: "nasrin@lara.edu",
    staffType: "Batch Director",
    salary: 35000,
    joinDate: "2024-04-01",
    status: "সক্রিয়",
  },
  {
    id: "s6",
    name: "জাহিদ হাসান",
    mobile: "01711000006",
    staffType: "Staff",
    salary: 18000,
    joinDate: "2024-05-12",
    status: "সক্রিয়",
  },
];

interface StaffContextType {
  staff: Staff[];
  addStaff: (data: Omit<Staff, "id">) => Staff;
  updateStaff: (id: string, data: Partial<Staff>) => void;
  deleteStaff: (id: string) => void;
  getStaff: (id: string) => Staff | undefined;
  getDirectors: () => Staff[];
}

const StaffContext = createContext<StaffContextType | null>(null);

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<Staff[]>(initialStaff);

  const addStaff = useCallback((data: Omit<Staff, "id">): Staff => {
    const s: Staff = { ...data, id: `s${Date.now()}` };
    setStaff((prev) => [s, ...prev]);
    return s;
  }, []);

  const updateStaff = useCallback((id: string, data: Partial<Staff>) => {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  }, []);

  const deleteStaff = useCallback((id: string) => {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getStaff = useCallback((id: string) => staff.find((s) => s.id === id), [staff]);
  const getDirectors = useCallback(
    () => staff.filter((s) => s.staffType === "Batch Director" && s.status === "সক্রিয়"),
    [staff],
  );

  const value = useMemo(
    () => ({ staff, addStaff, updateStaff, deleteStaff, getStaff, getDirectors }),
    [staff, addStaff, updateStaff, deleteStaff, getStaff, getDirectors],
  );

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be within StaffProvider");
  return ctx;
}
