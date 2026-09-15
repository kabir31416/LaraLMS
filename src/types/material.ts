import type { MasterDataStatus } from "@/types/academic";

/**
 * Coaching Material Inventory & Student Distribution — replaces the old
 * library-style Book/BranchStock/BookIssue/StockHistory model entirely (no
 * author/publisher/ISBN/edition, no lending/return workflow, no Branch
 * coupling). Mirrors backend/src/modules/materials/*.model.ts.
 */

export interface MaterialType {
  id: string;
  name: string;
  status: MasterDataStatus;
  displayOrder: number;
}

export interface Material {
  id: string;
  name: string;
  materialType: string;
  courseId: string;
  subjectId?: string;
  isPaid: boolean;
  price: number;
  openingStock: number;
  currentStock: number;
  minimumStock: number;
  status: MasterDataStatus;
  description?: string;
}

export const STOCK_MOVEMENT_TYPES = ["IN", "DISTRIBUTION", "ADJUSTMENT", "REVERSAL"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_ADJUSTMENT_REASONS = ["পরিমাণ গণনা সংশোধন", "ক্ষতিগ্রস্ত", "হারিয়ে গেছে", "অন্যান্য"] as const;
export type StockAdjustmentReason = (typeof STOCK_ADJUSTMENT_REASONS)[number];

export interface StockMovement {
  id: string;
  materialId: string;
  materialName: string;
  movementType: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId?: string;
  reason?: string;
  createdAt: string;
}

export interface MaterialDistributionItem {
  materialId: string;
  materialName: string;
  materialType: string;
  isPaid: boolean;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type DistributionStatus = "ACTIVE" | "REVERSED";

export interface MaterialDistribution {
  id: string;
  studentId: string;
  registrationId?: string;
  studentRoll?: string;
  studentName: string;
  phone?: string;
  batchId?: string;
  batchName?: string;
  courseId?: string;
  courseName?: string;
  items: MaterialDistributionItem[];
  totalQuantity: number;
  totalPaidAmount: number;
  paymentId?: string;
  distributionDate: string;
  status: DistributionStatus;
  reversedAt?: string;
  reversalReason?: string;
  note?: string;
  distributedByName: string;
  createdAt: string;
}

export interface DuplicateWarning {
  materialId: string;
  materialName: string;
  previousDistributions: { date: string; quantity: number }[];
}

export interface DashboardStats {
  totalMaterials: number;
  totalStock: number;
  distributedToday: number;
  distributedThisMonth: number;
  lowStockCount: number;
  outOfStockCount: number;
  mostDistributed: { materialId: string; materialName: string; totalQuantity: number }[];
  recentDistributions: MaterialDistribution[];
}

export const DUPLICATE_DISTRIBUTION_RULES = ["allow", "warn", "block"] as const;
export type DuplicateDistributionRule = (typeof DUPLICATE_DISTRIBUTION_RULES)[number];

export interface MaterialSettings {
  duplicateDistributionRule: DuplicateDistributionRule;
  defaultMinimumStock: number;
}

export interface StudentMaterialHistoryRow {
  distributionId: string;
  date: string;
  materialName: string;
  materialType: string;
  quantity: number;
  isPaid: boolean;
  unitPrice: number;
  lineTotal: number;
  distributedBy: string;
  status: DistributionStatus;
}

export interface StockReportRow {
  materialId: string;
  name: string;
  materialType: string;
  courseName?: string;
  currentStock: number;
  minimumStock: number;
  status: MasterDataStatus;
  lowStock: boolean;
  outOfStock: boolean;
}

export interface DistributionReportRow {
  date: string;
  studentName: string;
  studentRoll?: string;
  registrationId?: string;
  courseName?: string;
  batchName?: string;
  materialName: string;
  quantity: number;
  isPaid: boolean;
  price: number;
  distributedBy: string;
}

export interface StudentWiseReportRow {
  studentId: string;
  studentName: string;
  studentRoll?: string;
  courseName?: string;
  batchName?: string;
  totalMaterials: number;
  totalQuantity: number;
  totalPaidValue: number;
}

export interface MaterialWiseReportRow {
  materialId: string;
  name: string;
  totalStock: number;
  totalDistributed: number;
  remainingStock: number;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
