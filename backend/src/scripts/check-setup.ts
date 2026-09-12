/**
 * One-shot health check for the Student Portal login path. Since
 * auth.service.ts's studentLogin is a pure read-only lookup against the
 * Student collection (no Role or User document is read or written at
 * login time — permissions are the fixed default set in
 * modules/rbac/permissions.ts), the only thing that determines whether a
 * student can log in is whether their record has both a phone number and a
 * Roll Number set.
 *
 * Roles are still listed below purely as a general sanity check (Admin/
 * Staff logins do still depend on them) — a missing "student" Role has no
 * effect on Student Portal login.
 *
 * Usage: npm run check-setup
 */
import { connectDB, disconnectDB } from "../config/db";
import { Role } from "../modules/rbac/role.model";
import { Student } from "../modules/students/student.model";

async function main() {
  await connectDB();

  console.log("\n=== Roles (Admin/Staff logins only — irrelevant to Student Portal login) ===");
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

  await disconnectDB();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
