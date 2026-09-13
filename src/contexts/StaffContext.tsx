import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Staff } from "@/types/staff";
import { api } from "@/lib/apiClient";

/** Staff is now backed by the real API (Phase 3, Module 13). Field names are translated at this boundary (phone <-> mobile, photoUrl <-> photo) so existing pages keep reading the same property names. */
interface ApiStaff {
  _id: string;
  name: string;
  photoUrl?: string;
  phone: string;
  email?: string;
  address?: string;
  staffType: Staff["staffType"];
  salary: number;
  joinDate: string;
  status: Staff["status"];
  staffId?: string;
}

function fromApi(doc: ApiStaff): Staff {
  return {
    id: doc._id,
    name: doc.name,
    photo: doc.photoUrl,
    mobile: doc.phone,
    email: doc.email,
    address: doc.address,
    staffType: doc.staffType,
    salary: doc.salary,
    joinDate: doc.joinDate,
    status: doc.status,
    staffId: doc.staffId,
  };
}

function toApiBody(data: Partial<Staff>): Record<string, unknown> {
  const body: Record<string, unknown> = { ...data };
  if ("mobile" in data) { body.phone = data.mobile; delete body.mobile; }
  if ("photo" in data) { body.photoUrl = data.photo; delete body.photo; }
  delete body.id;
  return body;
}

interface StaffContextType {
  staff: Staff[];
  loading: boolean;
  addStaff: (data: Omit<Staff, "id">) => Promise<Staff>;
  updateStaff: (id: string, data: Partial<Staff>) => Promise<Staff>;
  deleteStaff: (id: string) => Promise<void>;
  getStaff: (id: string) => Staff | undefined;
  getDirectors: () => Staff[];
  refreshStaff: () => Promise<void>;
}

const StaffContext = createContext<StaffContextType | null>(null);

const LIST_LIMIT = "?limit=100";

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshStaff = useCallback(async () => {
    const docs = await api.get<ApiStaff[]>(`/staff${LIST_LIMIT}`);
    setStaff(docs.map(fromApi));
  }, []);

  useEffect(() => {
    refreshStaff().catch(() => { /* not logged in yet, or offline */ }).finally(() => setLoading(false));
  }, [refreshStaff]);

  const addStaff = useCallback(async (data: Omit<Staff, "id">): Promise<Staff> => {
    const created = fromApi(await api.post<ApiStaff>("/staff", toApiBody(data)));
    setStaff((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateStaff = useCallback(async (id: string, data: Partial<Staff>): Promise<Staff> => {
    const updated = fromApi(await api.patch<ApiStaff>(`/staff/${id}`, toApiBody(data)));
    setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const deleteStaff = useCallback(async (id: string) => {
    await api.del(`/staff/${id}`);
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getStaff = useCallback((id: string) => staff.find((s) => s.id === id), [staff]);
  const getDirectors = useCallback(
    () => staff.filter((s) => s.staffType === "Batch Director" && s.status === "সক্রিয়"),
    [staff],
  );

  const value = useMemo(
    () => ({ staff, loading, addStaff, updateStaff, deleteStaff, getStaff, getDirectors, refreshStaff }),
    [staff, loading, addStaff, updateStaff, deleteStaff, getStaff, getDirectors, refreshStaff],
  );

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be within StaffProvider");
  return ctx;
}
