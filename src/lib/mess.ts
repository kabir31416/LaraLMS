/**
 * Mess / Hostel Management — frontend types, Bengali labels and small helpers.
 * Every number shown in the Mess UI comes from the backend (server-authoritative
 * ledger); nothing here recomputes money.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/apiClient";

export type Ref<T> = T | string | null | undefined;

export interface StudentRef {
  _id: string;
  name: string;
  registrationId?: string;
  currentRollNumber?: string;
  phone?: string;
  course?: string;
  currentBatchId?: { _id: string; name: string } | string | null;
}
export interface NamedRef { _id: string; name: string; code?: string }
export interface SeatRef { _id: string; seatNumber: string; seatType?: string; monthlyRent?: number; status?: string }
export interface RoomRef { _id: string; name: string; floor?: string; roomType?: string; status?: string }

export interface MessStaffRow {
  staffId: { _id: string; name: string; phone: string; staffType: string; staffId?: string; status: string } | string;
  responsibility: "manager" | "accountant" | "caretaker" | "support";
  assignedAt: string;
}

export interface Mess {
  _id: string;
  name: string;
  code: string;
  address?: string;
  contactNumber?: string;
  openingDate?: string;
  notes?: string;
  status: "active" | "inactive";
  staff: MessStaffRow[];
  roomCount?: number;
  totalSeats?: number;
  activeMembers?: number;
  seatCounts?: Record<SeatStatus, number>;
}

export type SeatStatus = "available" | "reserved" | "occupied" | "maintenance" | "inactive";

export interface Room {
  _id: string;
  messId: string;
  name: string;
  floor?: string;
  roomType?: string;
  totalSeats: number;
  facilities: string[];
  status: "active" | "maintenance" | "inactive";
  notes?: string;
  seatCount?: number;
  seatCounts?: Record<SeatStatus, number>;
}

export interface Seat {
  _id: string;
  messId: NamedRef | string;
  roomId: RoomRef | string;
  seatNumber: string;
  seatType?: string;
  monthlyRent: number;
  status: SeatStatus;
  currentStudentId?: StudentRef | null;
  currentMembershipId?: string;
  currentReservationId?: string;
  availableFrom?: string;
  notes?: string;
}

export type MembershipStatus = "pending" | "approved" | "active" | "on_leave" | "notice_given" | "left" | "cancelled";

export interface Balance {
  totalBilled: number;
  totalPaid: number;
  due: number;
  advance: number;
  depositRequired: number;
  depositCollected: number;
  depositBalance: number;
  depositPendingRefund: number;
}

export interface Membership {
  _id: string;
  membershipNo: string;
  studentId: StudentRef;
  messId: NamedRef;
  roomId: RoomRef;
  seatId: SeatRef;
  joiningDate: string;
  expectedLeavingDate?: string;
  leftDate?: string;
  monthlyRent: number;
  discount: number;
  securityDeposit: number;
  setupCharge: number;
  setupChargeBilled: boolean;
  billingStartDate: string;
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  notes?: string;
  documents?: { label: string; url: string }[];
  status: MembershipStatus;
  isOpen: boolean;
  holdsSeat: boolean;
  cancelReason?: string;
  seatHistory?: { messId: NamedRef; roomId: RoomRef; seatId: SeatRef; fromDate: string; toDate?: string; monthlyRent: number; reason?: string }[];
  statusHistory?: { status: MembershipStatus; at: string; note?: string }[];
  balance: Balance;
  createdAt: string;
}

export interface Reservation {
  _id: string;
  reservationNo: string;
  studentId: StudentRef;
  messId: NamedRef;
  roomId: RoomRef;
  seatId: SeatRef;
  reservationDate: string;
  expiryDate: string;
  advanceAmount: number;
  advancePaid?: number;
  status: "active" | "converted" | "expired" | "cancelled";
  membershipId?: string;
  notes?: string;
}

export interface BillItem { kind: "rent" | "setup" | "additional" | "late_fee"; label: string; amount: number }
export interface Bill {
  _id: string;
  billNo: string;
  membershipId: string;
  studentId: StudentRef;
  messId: NamedRef;
  roomId?: RoomRef;
  seatId?: SeatRef;
  period: string;
  issueDate: string;
  dueDate: string;
  items: BillItem[];
  discount: number;
  adjustment: number;
  adjustmentReason?: string;
  previousDue: number;
  currentCharges: number;
  totalPayable: number;
  paidAmount: number;
  dueAmount: number;
  status: "unpaid" | "partial" | "paid" | "cancelled";
  cancelReason?: string;
  notes?: string;
}

export interface MessPayment {
  _id: string;
  receiptNo: string;
  studentId: StudentRef;
  membershipId?: { _id: string; membershipNo: string } | string;
  reservationId?: { _id: string; reservationNo: string } | string;
  messId: NamedRef;
  purpose: "rent" | "deposit";
  amount: number;
  method: string;
  date: string;
  reference?: string;
  note?: string;
  balanceAfter?: { due: number; advance: number; depositBalance: number };
  status: "active" | "cancelled";
  cancelReason?: string;
  verified: boolean;
}

export interface DepositTx {
  _id: string;
  txNo: string;
  membershipId: { _id: string; membershipNo: string } | string;
  studentId: StudentRef;
  messId: NamedRef;
  type: "deduct" | "apply_to_due" | "refund";
  amount: number;
  reason?: string;
  date: string;
  status: "pending" | "approved" | "completed" | "rejected" | "cancelled";
  method?: string;
  reference?: string;
  settlementId?: string;
  rejectedReason?: string;
}

export interface Settlement {
  _id: string;
  settlementNo: string;
  membershipId: { _id: string; membershipNo: string } | string;
  studentId: StudentRef;
  messId: NamedRef;
  leavingDate: string;
  depositBalance: number;
  advanceBalance: number;
  outstandingDue: number;
  damageCharges: number;
  damageNote?: string;
  depositApplied: number;
  depositRefund: number;
  advanceRefund: number;
  refundableAmount: number;
  remainingDue: number;
  status: "pending" | "approved" | "completed" | "cancelled";
  refundMethod?: string;
  refundDate?: string;
  notes?: string;
}

export interface Expense {
  _id: string;
  expenseNo: string;
  messId: NamedRef;
  date: string;
  category: string;
  description?: string;
  amount: number;
  method: string;
  paidBy?: string;
  vendor?: string;
  invoiceNo?: string;
  attachment?: { url: string };
  complaintId?: { _id: string; ticketNo: string; title: string } | string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejectedReason?: string;
  addedBy?: string;
}

export interface Complaint {
  _id: string;
  ticketNo: string;
  kind: "complaint" | "maintenance";
  messId: NamedRef;
  roomId?: RoomRef;
  category: string;
  title: string;
  description?: string;
  priority: "low" | "normal" | "high" | "urgent";
  attachment?: { url: string };
  studentId?: StudentRef;
  date: string;
  assignedStaffId?: { _id: string; name: string; phone: string } | null;
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  history: { status: string; note?: string; at: string; byRole?: string }[];
}

export interface MessNotice {
  _id: string;
  messId: NamedRef;
  audience: "mess" | "member";
  studentId?: StudentRef;
  type: NoticeType;
  title: string;
  body: string;
  publishDate: string;
  expiryDate?: string;
  status: "active" | "archived";
  readCount?: number;
  isRead?: boolean;
  sms?: { requested: boolean; recipients: number; sent: number; failed: number };
}
export type NoticeType = "payment_reminder" | "rent_due" | "general" | "maintenance" | "emergency" | "renewal_leaving";

export interface MessSettings {
  defaultMessId?: string;
  billingCycle: "monthly";
  billingDay: number;
  dueDay: number;
  gracePeriodDays: number;
  defaultRent: number;
  defaultDeposit: number;
  currency: "BDT";
  receiptPrefix: string;
  billPrefix: string;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  prorationEnabled: boolean;
  discountApprovalRequired: boolean;
  refundApprovalRequired: boolean;
  expenseApprovalRequired: boolean;
  paymentMethods: string[];
  paymentSmsEnabled: boolean;
  roomTypes: string[];
  seatTypes: string[];
  complaintCategories: string[];
  maintenanceCategories: string[];
  expenseCategories: string[];
}

export interface Institution {
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  print: { signatureLabel: string; paperSize: "A4" | "Letter"; showLogoOnDocuments: boolean };
}

// -------------------- Labels --------------------

export const MESS_STATUS_LABELS: Record<Mess["status"], string> = { active: "সক্রিয়", inactive: "নিষ্ক্রিয়" };
export const ROOM_STATUS_LABELS: Record<Room["status"], string> = { active: "সক্রিয়", maintenance: "রক্ষণাবেক্ষণ", inactive: "নিষ্ক্রিয়" };
export const SEAT_STATUS_LABELS: Record<SeatStatus, string> = {
  available: "খালি",
  reserved: "সংরক্ষিত",
  occupied: "দখলকৃত",
  maintenance: "রক্ষণাবেক্ষণ",
  inactive: "নিষ্ক্রিয়",
};
export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  pending: "অপেক্ষমাণ",
  approved: "অনুমোদিত",
  active: "সক্রিয়",
  on_leave: "ছুটিতে",
  notice_given: "নোটিশ দিয়েছেন",
  left: "ছেড়ে গেছেন",
  cancelled: "বাতিল",
};
export const RESERVATION_STATUS_LABELS: Record<Reservation["status"], string> = { active: "সক্রিয়", converted: "সদস্যপদে রূপান্তরিত", expired: "মেয়াদোত্তীর্ণ", cancelled: "বাতিল" };
export const BILL_STATUS_LABELS: Record<Bill["status"], string> = { unpaid: "অপরিশোধিত", partial: "আংশিক", paid: "পরিশোধিত", cancelled: "বাতিল" };
export const PURPOSE_LABELS: Record<MessPayment["purpose"], string> = { rent: "ভাড়া / বকেয়া / অগ্রিম", deposit: "জামানত" };
export const DEPOSIT_TX_LABELS: Record<DepositTx["type"], string> = { deduct: "ক্ষতি/অন্যান্য কর্তন", apply_to_due: "বকেয়ায় সমন্বয়", refund: "ফেরত" };
export const DEPOSIT_TX_STATUS_LABELS: Record<DepositTx["status"], string> = { pending: "অপেক্ষমাণ", approved: "অনুমোদিত", completed: "সম্পন্ন", rejected: "প্রত্যাখ্যাত", cancelled: "বাতিল" };
export const SETTLEMENT_STATUS_LABELS: Record<Settlement["status"], string> = { pending: "অপেক্ষমাণ", approved: "অনুমোদিত", completed: "সম্পন্ন", cancelled: "বাতিল" };
export const EXPENSE_STATUS_LABELS: Record<Expense["status"], string> = { pending: "অনুমোদনের অপেক্ষায়", approved: "অনুমোদিত", rejected: "প্রত্যাখ্যাত", cancelled: "বাতিল" };
export const COMPLAINT_STATUS_LABELS: Record<Complaint["status"], string> = { open: "খোলা", in_progress: "চলমান", waiting: "অপেক্ষমাণ", resolved: "সমাধান হয়েছে", closed: "বন্ধ" };
export const COMPLAINT_PRIORITY_LABELS: Record<Complaint["priority"], string> = { low: "কম", normal: "সাধারণ", high: "উচ্চ", urgent: "জরুরি" };
export const COMPLAINT_KIND_LABELS: Record<Complaint["kind"], string> = { complaint: "অভিযোগ", maintenance: "রক্ষণাবেক্ষণ" };
export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  payment_reminder: "পেমেন্ট রিমাইন্ডার",
  rent_due: "ভাড়া বকেয়া নোটিশ",
  general: "সাধারণ নোটিশ",
  maintenance: "রক্ষণাবেক্ষণ নোটিশ",
  emergency: "জরুরি নোটিশ",
  renewal_leaving: "নবায়ন / ছাড়ার নোটিশ",
};
export const RESPONSIBILITY_LABELS: Record<MessStaffRow["responsibility"], string> = { manager: "মেস ম্যানেজার", accountant: "হিসাবরক্ষক", caretaker: "কেয়ারটেকার", support: "সহায়ক স্টাফ" };

/** Shared badge tone per status family — success/warning/destructive/muted, matching the ERP's existing badge colours. */
export function statusTone(status: string): string {
  if (["active", "available", "paid", "approved", "completed", "resolved", "converted"].includes(status)) return "bg-success/10 text-success border-success/20";
  if (["pending", "partial", "reserved", "on_leave", "notice_given", "in_progress", "waiting", "open"].includes(status)) return "bg-warning/10 text-warning border-warning/20";
  if (["unpaid", "cancelled", "rejected", "expired", "urgent", "inactive"].includes(status)) return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-muted text-muted-foreground";
}

// -------------------- Helpers --------------------

export function tk(n: number | undefined | null): string {
  return `৳ ${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function refName(r: unknown, key = "name"): string {
  if (!r || typeof r !== "object") return "—";
  const v = (r as Record<string, unknown>)[key];
  return typeof v === "string" && v ? v : "—";
}

export function refId(r: unknown): string {
  if (!r) return "";
  if (typeof r === "string") return r;
  return String((r as { _id?: string })._id ?? "");
}

export function errMsg(err: unknown, fallback = "কাজটি সম্পন্ন করা যায়নি"): string {
  return err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : fallback;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function currentPeriod(): string {
  return todayISO().slice(0, 7);
}

/** One key per submission attempt — the backend's unique idempotency index turns a double-click into the same payment, never a second one. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === "all") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface PageMeta { page: number; limit: number; total: number; totalPages: number; [k: string]: unknown }

/**
 * Server-paginated list loader: refetches whenever `path` changes (the
 * caller builds `path` from its filters with `qs`). Stale responses from an
 * older filter set are dropped so a slow request can never overwrite a newer one.
 */
export function usePagedList<T>(path: string | null) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getWithMeta<T[]>(path);
      if (mine !== seq.current) return;
      setItems(res.data);
      setMeta((res.meta as PageMeta) ?? null);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(errMsg(err, "তথ্য লোড করা যায়নি"));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { items, meta, loading, error, reload: load };
}

export function useApiData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<T>(path);
      if (mine === seq.current) setData(res);
    } catch (err) {
      if (mine === seq.current) setError(errMsg(err, "তথ্য লোড করা যায়নি"));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, loading, error, reload: load, setData };
}
