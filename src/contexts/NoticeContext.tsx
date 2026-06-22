import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Notice } from "@/types/notice";
import { format } from "date-fns";

const KEY = "lara-notices-v1";

function seed(): Notice[] {
  const today = format(new Date(), "yyyy-MM-dd");
  return [
    {
      id: "n1",
      title: "মাসিক পরীক্ষার সময়সূচি প্রকাশিত",
      description: "আগামী ০১ তারিখ থেকে মাসিক পরীক্ষা শুরু হবে। সকল শিক্ষার্থীকে প্রস্তুতি নিতে অনুরোধ করা হলো।",
      type: "All",
      publishDate: today,
      priority: "Important",
      pinned: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "n2",
      title: "বিজ্ঞান কোর্সের অতিরিক্ত ক্লাস",
      description: "প্রতি বৃহস্পতিবার অতিরিক্ত ক্লাস হবে।",
      type: "Course",
      targetId: "c1",
      publishDate: today,
      priority: "Normal",
      pinned: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "n3",
      title: "ব্যাচ ডিরেক্টর মিটিং",
      description: "আগামী শনিবার দুপুর ১২টায় ব্যাচ ডিরেক্টর মিটিং অনুষ্ঠিত হবে।",
      type: "Director",
      publishDate: today,
      priority: "Urgent",
      pinned: false,
      createdAt: new Date().toISOString(),
    },
  ];
}

function load(): Notice[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Notice[];
  } catch { /* ignore */ }
  return seed();
}

interface Ctx {
  notices: Notice[];
  addNotice: (n: Omit<Notice, "id" | "createdAt">) => void;
  updateNotice: (id: string, n: Partial<Notice>) => void;
  deleteNotice: (id: string) => void;
  togglePin: (id: string) => void;
}

const NoticeContext = createContext<Ctx | null>(null);

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>(() => load());

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(notices)); } catch { /* ignore */ }
  }, [notices]);

  const addNotice = useCallback((n: Omit<Notice, "id" | "createdAt">) => {
    const item: Notice = { ...n, id: `n_${Date.now()}`, createdAt: new Date().toISOString() };
    setNotices((p) => [item, ...p]);
  }, []);

  const updateNotice = useCallback((id: string, n: Partial<Notice>) => {
    setNotices((p) => p.map((x) => (x.id === id ? { ...x, ...n } : x)));
  }, []);

  const deleteNotice = useCallback((id: string) => {
    setNotices((p) => p.filter((x) => x.id !== id));
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotices((p) => p.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)));
  }, []);

  const value = useMemo(() => ({ notices, addNotice, updateNotice, deleteNotice, togglePin }), [notices, addNotice, updateNotice, deleteNotice, togglePin]);

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