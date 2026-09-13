/**
 * One-shot health check for the Student Portal and Staff Portal login
 * paths. Both auth.service.ts's studentLogin and staffLogin are pure
 * read-only lookups (Student / Staff collection respectively — no Role or
 * User document is read or written at login time; permissions are the
 * fixed default set in modules/rbac/permissions.ts), so the only thing
 * that determines whether someone can log in is whether their own record
 * has both a phone number and their portal ID (Roll Number / Staff ID) set.
 *
 * Roles are still listed below purely as a general sanity check (Admin
 * logins do still depend on them) — a missing "student"/"batch_director"
 * Role has no effect on either portal's login.
 *
 * Usage: npm run check-setup
 */
import { connectDB, disconnectDB } from "../config/db";
import { Role } from "../modules/rbac/role.model";
import { Student } from "../modules/students/student.model";
import { Staff } from "../modules/staff/staff.model";

async function main() {
  await connectDB();

  console.log("\n=== Roles (Admin logins only — irrelevant to Student/Staff Portal login) ===");
  const roles = await Role.find({});
  if (roles.length === 0) {
    console.log('❌ কোনো Role-ই নেই। "npm run seed" চালান — এটা admin/batch_director/student তিনটা role এবং প্রথম Admin ইউজার তৈরি করবে।');
  } else {
    for (const r of roles) console.log(`  - "${r.name}" (isSystem: ${r.isSystem}, permissions: ${r.permissions.length})`);
  }

  console.log("\n=== Students (this is all that matters for Student Portal login) ===");
  const totalStudents = await Student.countDocuments();
  const withCreds = await Student.countDocuments({ phone: { $exists: true, $ne: "" }, currentRollNumber: { $exists: true, $ne: "" } });
  console.log(`  মোট student: ${totalStudents}`);
  console.log(`  ফোন নম্বর + রোল নম্বর দুটোই আছে (তাই এখনই লগইন করতে পারবে) এমন student: ${withCreds}/${totalStudents}`);
  console.log('\n  বিস্তারিত তালিকার জন্য: npm run list-logins');

  console.log("\n=== Staff (Batch Director portal login — Admin/Teacher/Staff types have no portal yet) ===");
  const totalStaff = await Staff.countDocuments();
  const directors = await Staff.countDocuments({ staffType: "Batch Director" });
  const directorsWithCreds = await Staff.countDocuments({
    staffType: "Batch Director",
    phone: { $exists: true, $ne: "" },
    staffId: { $exists: true, $ne: "" },
  });
  console.log(`  মোট staff: ${totalStaff} (এর মধ্যে Batch Director: ${directors})`);
  console.log(`  ফোন নম্বর + স্টাফ আইডি দুটোই আছে (তাই এখনই লগইন করতে পারবে) এমন Batch Director: ${directorsWithCreds}/${directors}`);
  if (directors > directorsWithCreds) {
    console.log('  ℹ️  বাকিদের "স্টাফ" পেজ থেকে সম্পাদনা করে একটা স্টাফ আইডি বসিয়ে দিলেই লগইন চালু হয়ে যাবে।');
  }

  await disconnectDB();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
