/**
 * One-shot health check for the most common reason Student Portal logins
 * never get created: the "student" system Role doesn't exist (created by
 * `npm run seed`), so student.service.ts's syncStudentLogin() silently
 * bails out on every single student create/update — no error, no login,
 * just nothing happens. This makes that visible instead of guessing.
 *
 * Usage: npm run check-setup
 */
import { connectDB, disconnectDB } from "../config/db";
import { Role } from "../modules/rbac/role.model";
import { Student } from "../modules/students/student.model";
import { User } from "../modules/users/user.model";

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
      '\n❌ "student" নামে কোনো Role পাওয়া যায়নি — এটাই সবচেয়ে সম্ভাব্য কারণ কেন কোনো student-এর জন্য login স্বয়ংক্রিয়ভাবে তৈরি হচ্ছে না। "npm run seed" চালান।',
    );
  } else {
    console.log('\n✅ "student" role পাওয়া গেছে — auto-login-creation চলার কথা।');
  }

  console.log("\n=== Students ===");
  const totalStudents = await Student.countDocuments();
  const withCreds = await Student.countDocuments({ phone: { $exists: true, $ne: "" }, currentRollNumber: { $exists: true, $ne: "" } });
  console.log(`  মোট student: ${totalStudents}`);
  console.log(`  ফোন নম্বর + রোল নম্বর দুটোই আছে এমন student: ${withCreds}`);

  console.log("\n=== Users (logins) ===");
  const totalUsers = await User.countDocuments();
  const studentLogins = await User.countDocuments({ linkedStudentId: { $exists: true, $ne: null } });
  console.log(`  মোট User (login) রেকর্ড: ${totalUsers}`);
  console.log(`  কোনো student-এর সাথে লিংক করা login: ${studentLogins}`);

  if (withCreds > 0 && studentLogins === 0) {
    console.log(
      `\n⚠️  ${withCreds}টা student-এর ফোন+রোল নম্বর দুটোই আছে, কিন্তু একটাও student-লিংকড login নেই — এটাই মূল সমস্যার প্রমাণ। উপরে "student" role আছে কিনা দেখুন।`,
    );
  }

  await disconnectDB();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
