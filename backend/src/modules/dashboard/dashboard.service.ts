import { Types } from "mongoose";
import { Student } from "../students/student.model";
import { Batch } from "../batches/batch.model";
import { Payment } from "../payments/payment.model";

interface DueFacetRow {
  _id: string;
  total: number;
}

/** Last 6 calendar-month keys ("yyyy-MM"), same 30-day-step anchors the old client-side chart used. */
function last6MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 30);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/**
 * Admin summary — Module 4, extended in Modules 15-17 with Payment
 * aggregates. Attendance stats and notices stay on the frontend's mock
 * sources until Attendance/Notice (Modules 18-20, 25) land.
 *
 * Deliberately server-side aggregated rather than reusing the paginated
 * list endpoints: StudentContext/BatchContext/PaymentContext cap their list
 * fetch at 100 records for the table views, which would silently
 * under-count these totals once a coaching center passes 100 records.
 */
export async function getAdminSummary() {
  const today = new Date().toISOString().slice(0, 10);
  const monthKeys = last6MonthKeys();

  const [studentFacet] = await Student.aggregate<{
    totalStudents: { count: number }[];
    todayAdmissions: { count: number }[];
    dueByFeeType: DueFacetRow[];
  }>([
    {
      $facet: {
        totalStudents: [{ $count: "count" }],
        todayAdmissions: [{ $match: { admissionDate: today } }, { $count: "count" }],
        dueByFeeType: [{ $group: { _id: "$feeType", total: { $sum: "$due" } } }],
      },
    },
  ]);

  const totalStudents = studentFacet.totalStudents[0]?.count || 0;
  const todayAdmissions = studentFacet.todayAdmissions[0]?.count || 0;
  const packageDue = studentFacet.dueByFeeType.find((d) => d._id === "এককালীন")?.total || 0;
  const monthlyDue = studentFacet.dueByFeeType.find((d) => d._id === "মাসিক")?.total || 0;

  const [paymentFacet] = await Payment.aggregate<{
    todayCollection: { total: number }[];
    monthly: { _id: string; total: number }[];
  }>([
    {
      $facet: {
        todayCollection: [{ $match: { date: today } }, { $group: { _id: null, total: { $sum: "$paidAmount" } } }],
        monthly: [
          { $match: { date: { $gte: `${monthKeys[0]}-01` } } },
          { $group: { _id: { $substrCP: ["$date", 0, 7] }, total: { $sum: "$paidAmount" } } },
        ],
      },
    },
  ]);

  const todayCollection = paymentFacet.todayCollection[0]?.total || 0;
  const monthlyByKey = new Map(paymentFacet.monthly.map((m) => [m._id, m.total]));
  const monthlyCollection = monthKeys.map((key) => ({ month: key.slice(5), total: monthlyByKey.get(key) || 0 }));

  const [totalBatches, recentAdmissionDocs, recentPaymentDocs] = await Promise.all([
    Batch.countDocuments({}),
    Student.find({})
      .sort({ admissionDate: -1, createdAt: -1 })
      .limit(5)
      .select("name class course admissionDate registrationId"),
    Payment.find({})
      .sort({ date: -1, createdAt: -1 })
      .limit(5)
      .populate<{ studentId: { _id: Types.ObjectId; name: string } | null }>("studentId", "name"),
  ]);

  return {
    totalStudents,
    todayAdmissions,
    totalBatches,
    totalDue: packageDue + monthlyDue,
    packageDue,
    monthlyDue,
    todayCollection,
    monthlyCollection,
    recentAdmissions: recentAdmissionDocs.map((d) => ({
      id: String(d._id),
      name: d.name,
      class: d.class,
      course: d.course,
      admissionDate: d.admissionDate,
      registrationId: d.registrationId,
    })),
    recentPayments: recentPaymentDocs.map((p) => ({
      id: String(p._id),
      receiptNo: p.receiptNo,
      studentName: p.studentId?.name,
      date: p.date,
      paidAmount: p.paidAmount,
      method: p.method,
    })),
  };
}

/** Director summary — scoped to the batches this Staff record directs. */
export async function getDirectorSummary(staffId: string) {
  const batches = await Batch.find({ directorId: staffId })
    .populate<{ courseId: { _id: Types.ObjectId; name: string } | null }>("courseId", "name")
    .sort({ name: 1 });
  const batchIds = batches.map((b) => b._id);

  const counts = await Student.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { currentBatchId: { $in: batchIds } } },
    { $group: { _id: "$currentBatchId", count: { $sum: 1 } } },
  ]);
  const countByBatch = new Map(counts.map((c) => [String(c._id), c.count]));

  return {
    totalBatches: batches.length,
    totalStudents: counts.reduce((sum, c) => sum + c.count, 0),
    batches: batches.map((b) => ({
      id: String(b._id),
      name: b.name,
      courseId: b.courseId ? String(b.courseId._id) : undefined,
      courseName: b.courseId?.name,
      batchTime: b.batchTime,
      days: b.days,
      roomNumber: b.roomNumber,
      studentCount: countByBatch.get(String(b._id)) || 0,
    })),
  };
}
