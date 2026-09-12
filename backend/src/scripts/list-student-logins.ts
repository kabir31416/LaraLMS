/**
 * Cross-references every Student against the Users collection so you can
 * see, at a glance, exactly which students have a working login and what
 * their real phone/roll-number credential is — no need to guess or
 * remember a specific student's data to test with (check-login.ts needs
 * you to already know an identifier to check; this needs nothing).
 *
 * Usage: npm run list-logins
 */
import { connectDB, disconnectDB } from "../config/db";
import { Student } from "../modules/students/student.model";
import { User } from "../modules/users/user.model";
import { toAsciiDigits } from "../common/utils/digits";

async function main() {
  await connectDB();

  const students = await Student.find({}).select("name phone currentRollNumber").sort({ createdAt: -1 }).limit(30);
  console.log(`\nমোট ${students.length}টি student (সাম্প্রতিক ৩০টি) — নিচে প্রতিটার লগইন-অবস্থা:\n`);

  for (const s of students) {
    const hasCreds = !!s.phone && !!s.currentRollNumber;
    const expectedPassword = s.currentRollNumber ? toAsciiDigits(s.currentRollNumber) : null;
    const normalizedPhone = s.phone ? s.phone.trim().toLowerCase() : null;
    const user = normalizedPhone ? await User.findOne({ identifier: normalizedPhone }) : null;
    const linkedToThis = !!(user && String(user.linkedStudentId || "") === String(s._id));

    console.log(`- ${s.name}`);
    console.log(`    phone: "${s.phone || "(নেই)"}"   currentRollNumber: "${s.currentRollNumber || "(নেই)"}"   লগইন পাসওয়ার্ড হওয়া উচিত: "${expectedPassword ?? "-"}"`);

    if (!hasCreds) {
      console.log("    ⚠️  ফোন বা রোল নম্বর নেই — লগইন তৈরি করা সম্ভব না।");
    } else if (!user) {
      console.log("    ❌ এই ফোন নম্বরে কোনো লগইন অ্যাকাউন্ট নেই — Students পেজে গিয়ে \"লগইন তথ্য\" → \"তৈরি/রিসেট করুন\" ক্লিক করুন।");
    } else if (!linkedToThis) {
      console.log("    ⚠️  এই ফোন নম্বরে লগইন আছে কিন্তু ভিন্ন কোনো রেকর্ডের সাথে লিংক করা — সম্ভবত এই ফোন নম্বরটি অন্য কোনো student/staff-ও ব্যবহার করছে।");
    } else {
      console.log(`    ✅ লগইন ঠিকভাবে আছে — সঠিক ক্রেডেনশিয়াল: ফোন "${s.phone}", পাসওয়ার্ড "${expectedPassword}"`);
    }
    console.log("");
  }

  await disconnectDB();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
