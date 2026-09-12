import { Types } from "mongoose";
import { Student } from "../students/student.model";
import { Batch } from "../batches/batch.model";
import { Payment } from "../payments/payment.model";
import { AttendanceEntry } from "../attendance/attendance.model";
import { OfflineExam } from "../exams/exam.model";

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

/** Last 7 calendar-day date keys ("yyyy-mm-dd"), oldest first. */
function last7DayKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

interface StatusFacetRow {
  _id: string;
  count: number;
}
interface ByStudentFacetRow {
  _id: Types.ObjectId;
  total: number;
  present: number;
}
interface ByDateFacetRow {
  _id: string;
  total: number;
  present: number;
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

  const dayKeys = last7DayKeys();
  const monthAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const [attendanceFacet] = await AttendanceEntry.aggregate<{
    today: StatusFacetRow[];
    trend: ByDateFacetRow[];
    byStudent: ByStudentFacetRow[];
  }>([
    {
      $facet: {
        today: [{ $match: { date: today } }, { $group: { _id: "$status", count: { $sum: 1 } } }],
        trend: [
          { $match: { date: { $gte: dayKeys[0] } } },
          { $group: { _id: "$date", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } } } },
        ],
        byStudent: [
          { $match: { date: { $gte: monthAgo } } },
          { $group: { _id: "$studentId", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } } } },
        ],
      },
    },
  ]);

  const todayPresent = attendanceFacet.today.find((s) => s._id === "Present")?.count || 0;
  const todayAbsent = attendanceFacet.today.find((s) => s._id === "Absent")?.count || 0;
  const todayAttendancePct = todayPresent + todayAbsent ? Math.round((todayPresent / (todayPresent + todayAbsent)) * 100) : 0;

  const trendByDate = new Map(attendanceFacet.trend.map((t) => [t._id, t.total ? Math.round((t.present / t.total) * 100) : 0]));
  const attendanceTrend = dayKeys.map((key) => ({ date: key.slice(5), pct: trendByDate.get(key) || 0 }));

  const rankedByStudent = attendanceFacet.byStudent
    .map((r) => ({ studentId: String(r._id), pct: r.total ? Math.round((r.present / r.total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);
  const rankedStudentDocs = await Student.find({ _id: { $in: rankedByStudent.map((r) => r.studentId) } }).select("name registrationId");
  const rankedNameById = new Map(rankedStudentDocs.map((d) => [String(d._id), { name: d.name, registrationId: d.registrationId }]));
  const withNames = rankedByStudent.map((r) => ({ ...r, ...rankedNameById.get(r.studentId) }));
  const topAttendance = withNames.slice(0, 10);
  const lowAttendance = withNames.filter((r) => r.pct > 0 && r.pct < 60).slice(0, 8);

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
    todayPresent,
    todayAbsent,
    todayAttendancePct,
    attendanceTrend,
    topAttendance,
    lowAttendance,
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
  const today = new Date().toISOString().slice(0, 10);
  const batches = await Batch.find({ directorId: staffId })
    .populate<{ courseId: { _id: Types.ObjectId; name: string } | null }>("courseId", "name")
    .sort({ name: 1 });
  const batchIds = batches.map((b) => b._id);

  const counts = await Student.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { currentBatchId: { $in: batchIds } } },
    { $group: { _id: "$currentBatchId", count: { $sum: 1 } } },
  ]);
  const countByBatch = new Map(counts.map((c) => [String(c._id), c.count]));

  const [attendanceFacet, myExamDocs] = await Promise.all([
    AttendanceEntry.aggregate<{
      today: StatusFacetRow[];
      overall: StatusFacetRow[];
      byStudent: ByStudentFacetRow[];
    }>([
      { $match: { batchId: { $in: batchIds } } },
      {
        $facet: {
          today: [{ $match: { date: today } }, { $group: { _id: "$status", count: { $sum: 1 } } }],
          overall: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          byStudent: [{ $group: { _id: "$studentId", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } } } }],
        },
      },
    ]),
    OfflineExam.find({ batchId: { $in: batchIds } }).sort({ createdAt: -1 }).limit(5),
  ]);
  const [facet] = attendanceFacet;

  const pctOf = (rows: StatusFacetRow[]) => {
    const present = rows.find((r) => r._id === "Present")?.count || 0;
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return total ? Math.round((present / total) * 100) : 0;
  };

  const lowAttendance = facet.byStudent
    .map((r) => ({ studentId: String(r._id), pct: r.total ? Math.round((r.present / r.total) * 100) : 0 }))
    .filter((r) => r.pct > 0 && r.pct < 60)
    .sort((a, b) => a.pct - b.pct);
  const lowAttendanceStudentDocs = await Student.find({ _id: { $in: lowAttendance.map((r) => r.studentId) } }).select("name registrationId");
  const lowAttendanceNameById = new Map(lowAttendanceStudentDocs.map((d) => [String(d._id), { name: d.name, registrationId: d.registrationId }]));

  return {
    totalBatches: batches.length,
    totalStudents: counts.reduce((sum, c) => sum + c.count, 0),
    todayAttendancePct: pctOf(facet.today),
    overallAttendancePct: pctOf(facet.overall),
    lowAttendance: lowAttendance.map((r) => ({ ...r, ...lowAttendanceNameById.get(r.studentId) })),
    myExams: myExamDocs.map((e) => ({
      id: String(e._id),
      batchId: String(e.batchId),
      title: e.title,
      fullMarks: e.fullMarks,
      date: e.date,
    })),
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
