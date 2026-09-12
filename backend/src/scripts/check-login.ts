/**
 * Direct database diagnostic for "why can't this account log in" — bypasses
 * the HTTP API and frontend entirely, so it tells you the ground truth
 * (does this identifier exist, what's its status, does this exact password
 * match its stored hash) instead of another layer of guessing.
 *
 * Usage: npm run check-login -- "<identifier>" "<password>"
 */
import { connectDB, disconnectDB } from "../config/db";
import { User } from "../modules/users/user.model";
import { Role } from "../modules/rbac/role.model";
import { Student } from "../modules/students/student.model";
import { comparePassword } from "../common/utils/password";

async function main() {
  const [, , identifierArg, passwordArg] = process.argv;
  if (!identifierArg || !passwordArg) {
    console.error('Usage: npm run check-login -- "<identifier>" "<password>"');
    process.exit(1);
  }

  await connectDB();

  const normalized = identifierArg.trim().toLowerCase();
  console.log(`\nচেক করা হচ্ছে identifier = "${normalized}"\n`);

  const user = await User.findOne({ identifier: normalized }).select("+passwordHash");

  if (!user) {
    console.log(`❌ এই identifier দিয়ে কোনো লগইন অ্যাকাউন্ট পাওয়া যায়নি — মানে "তৈরি/রিসেট করুন" বাটনটা আসলে এই identifier দিয়ে কখনো সফল হয়নি।\n`);
    const allUsers = await User.find({}).select("identifier status linkedStudentId linkedStaffId").sort({ createdAt: -1 }).limit(20);
    if (allUsers.length === 0) {
      console.log("ডাটাবেসে কোনো User রেকর্ডই নেই।");
    } else {
      console.log("ডাটাবেসে এই মুহূর্তে থাকা সব লগইন identifier (সাম্প্রতিক ২০টি):");
      for (const u of allUsers) {
        const link = u.linkedStudentId ? `student:${u.linkedStudentId}` : u.linkedStaffId ? `staff:${u.linkedStaffId}` : "কোনো লিংক নেই";
        console.log(`  - "${u.identifier}" (status: ${u.status}, ${link})`);
      }
      console.log(
        '\nℹ️  যদি "01712345678" বা "07" এর মতো উদাহরণ-সংখ্যা দিয়ে টেস্ট করে থাকেন — সেগুলো শুধু placeholder ছিল। ' +
          "npm run list-logins চালিয়ে আপনার ডাটাবেসের আসল student-দের ফোন/রোল নম্বর দেখুন।",
      );
    }
    await disconnectDB();
    process.exit(0);
  }

  console.log(`✅ লগইন অ্যাকাউন্ট পাওয়া গেছে:`);
  console.log(`   identifier      : "${user.identifier}"`);
  console.log(`   status          : ${user.status}`);
  console.log(`   mustChangePwd   : ${user.mustChangePassword}`);
  console.log(`   failedLoginCount: ${user.failedLoginCount}`);

  const role = await Role.findById(user.roleId);
  console.log(`   role            : ${role?.name || "(পাওয়া যায়নি)"}`);

  if (user.linkedStudentId) {
    const student = await Student.findById(user.linkedStudentId);
    if (student) {
      console.log(`   linked student  : ${student.name}`);
      console.log(`     student.phone           : "${student.phone}"`);
      console.log(`     student.currentRollNumber: "${student.currentRollNumber}"`);
    } else {
      console.log(`   linked student  : ⚠️ linkedStudentId আছে কিন্তু কোনো Student পাওয়া যায়নি`);
    }
  } else {
    console.log(`   linked student  : (কোনো linkedStudentId নেই — এটা Student login নয়)`);
  }

  if (user.status === "locked") {
    console.log(`\n⚠️ অ্যাকাউন্টটি LOCKED — লগইন করলে "Invalid credentials" না বরং "This account is locked" দেখানো উচিত। যদি "Invalid credentials" ই দেখাচ্ছে, তাহলে locked স্ট্যাটাসটাই কারণ নয়।`);
  }

  const matches = await comparePassword(passwordArg, user.passwordHash);
  console.log(`\nপাসওয়ার্ড "${passwordArg}" মিলিয়ে দেখা হলো: ${matches ? "✅ মিলেছে" : "❌ মেলেনি"}`);

  if (matches && user.status !== "locked") {
    console.log("\n➡️  এই identifier + password দিয়ে /auth/login সফল হওয়া উচিত। যদি তারপরও ব্রাউজারে ব্যর্থ হয়, সমস্যাটা ফ্রন্টএন্ড ফর্মে (যেমন কোনো hidden character/autocomplete) — ব্যাকএন্ড/ডেটাবেজে না।");
  } else if (!matches) {
    console.log("\n➡️  এই password দিয়ে হ্যাশ মেলেনি — অর্থাৎ যে password টা স্টুডেন্ট/অ্যাডমিন টাইপ করছে সেটা আসলে ডাটাবেজে সংরক্ষিত password থেকে আলাদা। উপরে দেখানো currentRollNumber-এর সাথে হুবহু মিলিয়ে আবার চেষ্টা করুন (toAsciiDigits অ্যাপ্লাই করে — বাংলা সংখ্যা থাকলে ইংরেজিতে রূপান্তর করে)।");
  }

  await disconnectDB();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
