/**
 * Lists every Student and whether they can currently log into the Student
 * Portal. Since auth.service.ts's studentLogin checks phone + Roll Number
 * directly against the live Student record (no separately-provisioned
 * login account or password to go stale), the only thing that determines
 * whether a student can log in is: do they have both fields set, right now.
 *
 * Usage: npm run list-logins
 */
import { connectDB, disconnectDB } from "../config/db";
import { Student } from "../modules/students/student.model";
import { toAsciiDigits } from "../common/utils/digits";

async function main() {
  await connectDB();

  const students = await Student.find({}).select("name phone currentRollNumber").sort({ createdAt: -1 }).limit(30);
  console.log(`\nমোট ${students.length}টি student (সাম্প্রতিক ৩০টি) — নিচে প্রতিটার লগইন-অবস্থা:\n`);

  for (const s of students) {
    console.log(`- ${s.name}`);
    console.log(`    phone: "${s.phone || "(নেই)"}"   currentRollNumber: "${s.currentRollNumber || "(নেই)"}"`);

    if (!s.phone || !s.currentRollNumber) {
      console.log("    ❌ ফোন বা রোল নম্বর নেই — লগইন করা সম্ভব না। এডিট করে দুটোই যোগ করুন।");
    } else {
      const normalizedRoll = toAsciiDigits(s.currentRollNumber);
      console.log(`    ✅ এখনই লগইন করতে পারবে — /login-এর "শিক্ষার্থী" ট্যাবে ফোন: "${s.phone}", রোল নম্বর: "${normalizedRoll}"`);
    }
    console.log("");
  }

  await disconnectDB();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
