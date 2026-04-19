import { PaymentMethod } from "./accounts";

export type BranchLedgerType = "expense" | "income"; // expense = sent to branch, income = received from branch
export type BranchItemType = "বই" | "ভর্তি ফর্ম" | "অন্যান্য";

export interface BranchLedgerEntry {
  id: string;
  date: string; // ISO
  branchId: string;
  branchName: string;
  type: BranchLedgerType;
  // For expense (sent to branch)
  itemType?: BranchItemType;
  description?: string;
  quantity?: number;
  // For income (received)
  method?: PaymentMethod;
  amount: number;
  note?: string;
}
