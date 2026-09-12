import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Send } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Student } from "@/types/student";
import { toAsciiDigits } from "@/lib/format";

interface Props {
  student: Student | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Student Portal login credential convention: identifier = mobile number,
 * password = Roll Number (Phase 3 addendum). Since the password is always
 * derived from a field already shown elsewhere in the app, there's nothing
 * to "reveal" from the server — this dialog just displays it plainly and
 * offers to (re)create the actual login account, which now also texts the
 * credential to the student via the configured SMS gateway.
 */
export function StudentLoginDialog({ student, onOpenChange }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("কপি হয়েছে");
    } catch {
      toast.error("কপি করা যায়নি");
    }
  };

  // POST /users is idempotent per student now — the backend resets the
  // existing login when one is already linked to this student, so there's
  // no need to look it up here first (that separate lookup-then-branch was
  // itself a source of bugs: any miss on the lookup fell through to a
  // plain create, which used to fail with a raw, unhelpful duplicate-key
  // error instead of just fixing the existing login).
  const handleCreateOrReset = async () => {
    if (!student || !student.mobile || !student.rollNumber) return;
    setSubmitting(true);
    try {
      const roles = await api.get<{ _id: string; name: string }[]>("/roles");
      const studentRoleId = roles.find((r) => r.name === "student")?._id;
      if (!studentRoleId) {
        toast.error("Student role খুঁজে পাওয়া যায়নি");
        return;
      }
      await api.post("/users", {
        identifier: student.mobile,
        password: toAsciiDigits(student.rollNumber),
        roleId: studentRoleId,
        linkedStudentId: student.id,
      });
      toast.success("লগইন তৈরি/আপডেট হয়েছে — শিক্ষার্থীর মোবাইলে SMS পাঠানো হয়েছে", { duration: 8000 });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "CONFLICT") {
        toast.error("এই মোবাইল নম্বরে অন্য একটি অ্যাকাউন্ট (অন্য শিক্ষার্থী/স্টাফ) আগে থেকেই আছে");
      } else {
        toast.error(err instanceof ApiClientError ? err.message : "লগইন তৈরি/আপডেট ব্যর্থ হয়েছে");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!student) return null;
  const missing = !student.mobile || !student.rollNumber;
  const loginPassword = student.rollNumber ? toAsciiDigits(student.rollNumber) : "";

  return (
    <Dialog open={!!student} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{student.name} — লগইন তথ্য</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {missing ? (
            <p className="text-sm text-destructive">লগইন তৈরির জন্য মোবাইল নম্বর ও রোল নম্বর থাকা আবশ্যক — আগে এডিট করে যোগ করুন।</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-xs text-muted-foreground">মোবাইল নম্বর (আইডি)</p>
                  <p className="font-mono font-medium">{student.mobile}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(student.mobile)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-xs text-muted-foreground">পাসওয়ার্ড (রোল নম্বর, ইংরেজি সংখ্যায়)</p>
                  <p className="font-mono font-medium">{loginPassword}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(loginPassword)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">
                রোল নম্বর বাংলা সংখ্যায় (যেমন ০৭) দেওয়া থাকলেও লগইন পাসওয়ার্ড সবসময় ইংরেজি সংখ্যায় (07) — এখানে যা দেখানো হচ্ছে ঠিক তা-ই টাইপ করতে হবে।
                নিচের বাটনে ক্লিক করলে এই তথ্য দিয়ে লগইন অ্যাকাউন্ট তৈরি/আপডেট হবে এবং শিক্ষার্থীর মোবাইলে SMS পাঠানো হবে।
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বন্ধ করুন</Button>
          <Button onClick={handleCreateOrReset} disabled={missing || submitting}>
            <Send className="h-4 w-4 mr-1" /> {submitting ? "পাঠানো হচ্ছে..." : "তৈরি/রিসেট করুন (SMS সহ)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
