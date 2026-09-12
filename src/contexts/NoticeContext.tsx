import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Notice } from "@/types/notice";
import { api } from "@/lib/apiClient";
import { format } from "date-fns";

/** Notices are now backed by the real API (Phase 3, Module 25). Field names match exactly — no adapter needed. */
interface ApiNotice {
  _id: string;
  title: string;
  description: string;
  type: Notice["type"];
  targetId?: string;
  publishDate: string;
  expiryDate?: string;
  priority: Notice["priority"];
  pinned: boolean;
  createdAt: string;
}

function fromApi(doc: ApiNotice): Notice {
  return {
    id: doc._id, title: doc.title, description: doc.description, type: doc.type, targetId: doc.targetId,
    publishDate: doc.publishDate, expiryDate: doc.expiryDate, priority: doc.priority, pinned: doc.pinned, createdAt: doc.createdAt,
  };
}

interface Ctx {
  notices: Notice[];
  loading: boolean;
  addNotice: (n: Omit<Notice, "id" | "createdAt">) => Promise<Notice>;
  updateNotice: (id: string, n: Partial<Notice>) => Promise<Notice>;
  deleteNotice: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<Notice>;
}

const NoticeContext = createContext<Ctx | null>(null);

const LIST_LIMIT = "?limit=100";

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshNotices = useCallback(async () => {
    const docs = await api.get<ApiNotice[]>(`/notices${LIST_LIMIT}`);
    setNotices(docs.map(fromApi));
  }, []);

  useEffect(() => {
    refreshNotices().catch(() => { /* not logged in yet, or offline */ }).finally(() => setLoading(false));
  }, [refreshNotices]);

  const addNotice = useCallback(async (n: Omit<Notice, "id" | "createdAt">): Promise<Notice> => {
    const created = fromApi(await api.post<ApiNotice>("/notices", n));
    setNotices((p) => [created, ...p]);
    return created;
  }, []);

  const updateNotice = useCallback(async (id: string, n: Partial<Notice>): Promise<Notice> => {
    const updated = fromApi(await api.patch<ApiNotice>(`/notices/${id}`, n));
    setNotices((p) => p.map((x) => (x.id === id ? updated : x)));
    return updated;
  }, []);

  const deleteNotice = useCallback(async (id: string) => {
    await api.del(`/notices/${id}`);
    setNotices((p) => p.filter((x) => x.id !== id));
  }, []);

  const togglePin = useCallback(async (id: string): Promise<Notice> => {
    const updated = fromApi(await api.patch<ApiNotice>(`/notices/${id}/toggle-pin`));
    setNotices((p) => p.map((x) => (x.id === id ? updated : x)));
    return updated;
  }, []);

  const value = useMemo(() => ({ notices, loading, addNotice, updateNotice, deleteNotice, togglePin }), [notices, loading, addNotice, updateNotice, deleteNotice, togglePin]);

  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}

export function useNotices() {
  const ctx = useContext(NoticeContext);
  if (!ctx) throw new Error("useNotices must be within NoticeProvider");
  return ctx;
}

// Visibility helper
export interface NoticeAudience {
  role: "Admin" | "Batch Director" | "Student";
  courseId?: string;
  batchId?: string;
  directorBatchIds?: string[];
}

export function filterNoticesFor(notices: Notice[], aud: NoticeAudience): Notice[] {
  const today = format(new Date(), "yyyy-MM-dd");
  const active = notices.filter((n) => (!n.expiryDate || n.expiryDate >= today) && n.publishDate <= today);
  const visible = active.filter((n) => {
    if (aud.role === "Admin") return true;
    switch (n.type) {
      case "All":
        return aud.role === "Student";
      case "Staff":
        return false;
      case "Director":
        return aud.role === "Batch Director";
      case "Course":
        return aud.role === "Student" && n.targetId === aud.courseId;
      case "Batch":
        if (aud.role === "Student") return n.targetId === aud.batchId;
        if (aud.role === "Batch Director") return aud.directorBatchIds?.includes(n.targetId || "") ?? false;
        return false;
    }
  });
  return visible.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const pr = { Urgent: 0, Important: 1, Normal: 2 } as const;
    if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
    return b.publishDate.localeCompare(a.publishDate);
  });
}
