export type StaffType = "Admin" | "Teacher" | "Staff" | "Batch Director";
export type StaffStatus = "সক্রিয়" | "নিষ্ক্রিয়";

export const STAFF_TYPES: StaffType[] = ["Admin", "Teacher", "Staff", "Batch Director"];
export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  Admin: "অ্যাডমিন",
  Teacher: "শিক্ষক",
  Staff: "স্টাফ",
  "Batch Director": "ব্যাচ ডিরেক্টর",
};

export interface Staff {
  id: string;
  name: string;
  photo?: string;
  mobile: string;
  email?: string;
  address?: string;
  staffType: StaffType;
  salary: number;
  joinDate: string; // ISO
  status: StaffStatus;
}
