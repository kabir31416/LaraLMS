export type StaffType = "Admin" | "Teacher" | "Staff" | "Batch Director" | "Mess Manager" | "Mess Accountant" | "Mess Caretaker";
export type StaffStatus = "সক্রিয়" | "নিষ্ক্রিয়";

export const STAFF_TYPES: StaffType[] = ["Admin", "Teacher", "Staff", "Batch Director", "Mess Manager", "Mess Accountant", "Mess Caretaker"];
export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  Admin: "অ্যাডমিন",
  Teacher: "শিক্ষক",
  Staff: "স্টাফ",
  "Batch Director": "ব্যাচ ডিরেক্টর",
  "Mess Manager": "মেস ম্যানেজার",
  "Mess Accountant": "মেস হিসাবরক্ষক",
  "Mess Caretaker": "মেস কেয়ারটেকার",
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
  /** Staff Portal login credential — phone + staffId matching this record is the login itself (no password). */
  staffId?: string;
}
