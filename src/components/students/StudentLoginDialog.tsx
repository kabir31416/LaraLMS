import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { Student } from "@/types/student";

interface Props {
  student: Student | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Student Portal login credential: phone number + Roll Number, checked
 * directly against the live Student record (auth.service.ts's
 * studentLogin) — there is no separate login account to create or reset
 * ahead of time anymore, so this is a pure info display, not an action.
 */
export function StudentLoginDialog({ student, onOpenChange }: Props) {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("কপি হয়েছে");
    } catch {
      toast.error("কপি করা যায়নি");
    }
  };

  if (!student) return null;
  const missing = !student.mobile || !student.rollNumber;

  return (
    <Dialog open={!!student} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{student.name} — লগইন তথ্য</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {missing ? (
            <p className="text-sm text-destructive">লগইনের জন্য মোবাইল নম্বর ও রোল নম্বর — দুটোই থাকা আবশ্যক।</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-xs text-muted-foreground">ফোন নম্বর</p>
                  <p className="font-mono font-medium">{student.mobile}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(student.mobile)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-xs text-muted-foreground">রোল নম্বর</p>
                  <p className="font-mono font-medium">{student.rollNumber}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(student.rollNumber || "")}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">
                শিক্ষার্থী `/login` পেজের "শিক্ষার্থী" ট্যাবে এই ফোন নম্বর ও রোল নম্বর দিয়েই সরাসরি লগইন করতে পারবে — আলাদা কোনো পাসওয়ার্ড বা সেটআপের প্রয়োজন নেই।
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বন্ধ করুন</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
