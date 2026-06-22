export type NoticeType = "All" | "Course" | "Batch" | "Staff" | "Director";
export type NoticePriority = "Normal" | "Important" | "Urgent";

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  All: "সকল শিক্ষার্থী",
  Course: "কোর্স অনুযায়ী",
  Batch: "ব্যাচ অনুযায়ী",
  Staff: "শুধু স্টাফ",
  Director: "শুধু ব্যাচ ডিরেক্টর",
};

export const PRIORITY_LABELS: Record<NoticePriority, string> = {
  Normal: "সাধারণ",
  Important: "গুরুত্বপূর্ণ",
  Urgent: "জরুরি",
};

export interface Notice {
  id: string;
  title: string;
  description: string;
  type: NoticeType;
  targetId?: string; // course id / batch id
  publishDate: string;
  expiryDate?: string;
  priority: NoticePriority;
  pinned: boolean;
  createdAt: string;
}