/**
 * One-shot health check for the Student Portal login path. Since
 * auth.service.ts's studentLogin checks phone + Roll Number directly
 * against the live Student record and creates its own linked User account
 * lazily on first successful login, the two things that actually matter
 * are: does the "student" system Role exist (created by `npm run seed`,
 * needed to assign correct permissions to that lazily-created account),
 * and do students actually have both a phone number and a Roll Number set.
 *
 * Usage: npm run check-setup
 */
import { connectDB, disconnectDB } from "../config/db";
import { Role } from "../modules/rbac/role.model";
import { Student } from "../modules/students/student.model";

async function main() {
  await connectDB();

  console.log("\n=== Roles ===");
  const roles = await Role.find({});
  if (roles.length === 0) {
    console.log('❌ কোনো Role-ই নেই। "npm run seed" চালান — এটা admin/batch_director/student তিনটা role এবং প্রথম Admin ইউজার তৈরি করবে।');
  } else {
    for (const r of roles) console.log(`  - "${r.name}" (isSystem: ${r.isSystem}, permissions: ${r.permissions.length})`);
  }
  const studentRole = roles.find((r) => r.name === "student");
  if (!studentRole) {
    console.log(
      '\n❌ "student" নামে কোনো Role পাওয়া যায়নি — একজন student প্রথমবার লগইন করার সময় এটা লাগবে সঠিক permission সেট করতে। "npm run seed" চালান।',
    );
  } else {
    console.log('\n✅ "student" role পাওয়া গেছে।');
  }

  console.log("\n=== Students ===");
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
