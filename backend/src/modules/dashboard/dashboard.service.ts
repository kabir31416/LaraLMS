import { Types } from "mongoose";
import { Student } from "../students/student.model";
import { Batch } from "../batches/batch.model";

interface DueFacetRow {
  _id: string;
  total: number;
}

/**
 * Admin summary — Module 4. Only covers stat cards backed by data that
 * already has a real collection (Student, Batch). Today's collection,
 * attendance stats, and notices stay on the frontend's mock sources until
 * Payment/Attendance/Notice (Modules 15-20, 25) land, per the approved plan.
 *
 * Deliberately server-side aggregated rather than reusing the paginated
 * list endpoints: StudentContext/BatchContext cap their list fetch at 100
 * records for the table views, which would silently under-count these
 * totals once a coaching center passes 100 students.
 */
export async function getAdminSummary() {
  const today = new Date().toISOString().slice(0, 10);

  const [facet] = await Student.aggregate<{
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

  const totalStudents = facet.totalStudents[0]?.count || 0;
  const todayAdmissions = facet.todayAdmissions[0]?.count || 0;
  const packageDue = facet.dueByFeeType.find((d) => d._id === "এককালীন")?.total || 0;
  const monthlyDue = facet.dueByFeeType.find((d) => d._id === "মাসিক")?.total || 0;

  const [totalBatches, recentAdmissionDocs] = await Promise.all([
    Batch.countDocuments({}),
    Student.find({})
      .sort({ admissionDate: -1, createdAt: -1 })
      .limit(5)
      .select("name class course admissionDate registrationId"),
  ]);

  return {
    totalStudents,
    todayAdmissions,
    totalBatches,
    totalDue: packageDue + monthlyDue,
    packageDue,
    monthlyDue,
    recentAdmissions: recentAdmissionDocs.map((d) => ({
      id: String(d._id),
      name: d.name,
      class: d.class,
      course: d.course,
      admissionDate: d.admissionDate,
      registrationId: d.registrationId,
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
