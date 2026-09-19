import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { useStaff } from "@/contexts/StaffContext";
import { STAFF_TYPES, STAFF_TYPE_LABELS, type Staff, type StaffType } from "@/types/staff";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { ADMISSION_RESULTS_MANAGE } from "@/lib/permissions";

/**
 * Only "Admin" still goes through the password-based User/Role login here —
 * that's real Admin auth and stays untouched. A "Batch Director" (or any
 * other staff type) no longer gets a login account created for them at
 * all: phone + Staff ID matching their own Staff record *is* the Staff
 * Portal login (auth.service.ts's staffLogin, a pure read-only lookup —
 * same design as the Student Portal). Keeping both doors open for the same
 * person was exactly what kept producing "already exists" conflicts.
 *
 * An Admin login is created UNCONDITIONALLY below (never behind an opt-in
 * checkbox) — a previous version let this be skipped, which silently
 * produced an Admin staff record with no way to ever log in, while a Batch
 * Director always "worked" simply because it has no password step at all.
 * The admin creating the account now types the password themself (with a
 * confirmation field) instead of a server-generated temp password shown
 * once in a toast and easy to lose.
 */
const LOGIN_ELIGIBLE: StaffType[] = ["Admin"];
const ROLE_NAME_BY_STAFF_TYPE: Partial<Record<StaffType, string>> = { Admin: "admin" };
const MIN_PASSWORD_LENGTH = 6;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editStaff?: Staff | null;
}

export function StaffForm({ open, onOpenChange, editStaff }: Props) {
  const { addStaff, updateStaff, deleteStaff } = useStaff();
  const isEdit = !!editStaff;

  const [form, setForm] = useState(() => init(editStaff));
  const [joinDate, setJoinDate] = useState<Date | undefined>(
    editStaff?.joinDate ? new Date(editStaff.joinDate) : new Date(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // React's `submitting` state only disables the button from the NEXT
  // render onward — two clicks (or an Enter-key repeat) dispatched in the
  // same tick can both slip past it and fire two create requests before the
  // first one even resolves. This ref is checked synchronously, so the
  // second call is rejected immediately, before either network request.
  const busyRef = useRef(false);

  // This dialog instance stays mounted across opens (Staff.tsx never remounts
  // it), so without this a password typed for one new Admin would still be
  // sitting in state the next time the "new staff" dialog is opened.
  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  // Per-Admin "Admission Result" toggle (User.deniedPermissions) — only
  // relevant for staffType "Admin", since that's the only type with a real
  // password login at all. Defaults to allowed (true), matching the
  // backward-compatible default every existing Admin already has.
  const [admissionResultAllowed, setAdmissionResultAllowed] = useState(true);
  const [existingAdminUserId, setExistingAdminUserId] = useState<string | undefined>(undefined);

  // Editing an existing Admin: look up their login (if one exists) so the
  // toggle reflects their actual current permission instead of always
  // defaulting to "allowed".
  useEffect(() => {
    if (!open || !isEdit || !editStaff || editStaff.staffType !== "Admin") return;
    let cancelled = false;
    (async () => {
      try {
        const users = await api.get<{ _id: string; deniedPermissions?: string[] }[]>(`/users?linkedStaffId=${editStaff.id}`);
        if (cancelled) return;
        const existing = users[0];
        setExistingAdminUserId(existing?._id);
        setAdmissionResultAllowed(!existing?.deniedPermissions?.includes(ADMISSION_RESULTS_MANAGE));
      } catch {
        // No login found (or lookup failed) — leave the default (allowed, no login to edit).
      }
    })();
    return () => { cancelled = true; };
  }, [open, isEdit, editStaff]);

  // Only fetched when actually needed (creating a login), so a plain staff
  // add never requires Role-management permission.
  const findRoleId = async (staffType: StaffType): Promise<string | undefined> => {
    const roleName = ROLE_NAME_BY_STAFF_TYPE[staffType];
    if (!roleName) return undefined;
    const roles = await api.get<{ _id: string; name: string }[]>("/roles");
    return roles.find((r) => r.name === roleName)?._id;
  };

  function init(s?: Staff | null) {
    if (s) {
      return {
        name: s.name,
        photo: s.photo || "",
        mobile: s.mobile,
        email: s.email || "",
        address: s.address || "",
        staffType: s.staffType as StaffType,
        salary: s.salary,
        status: s.status,
        staffId: s.staffId || "",
      };
    }
    return {
      name: "",
      photo: "",
      mobile: "",
      email: "",
      address: "",
      staffType: "Teacher" as StaffType,
      salary: 0,
      status: "সক্রিয়" as Staff["status"],
      staffId: "",
    };
  }

  const update = (k: string, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  const isNewAdmin = !isEdit && LOGIN_ELIGIBLE.includes(form.staffType);

  const handleSubmit = async () => {
    if (busyRef.current) return;
    if (!form.name || !form.mobile || (!isEdit && !form.staffId.trim())) {
      toast.error("নাম, মোবাইল এবং স্টাফ আইডি প্রয়োজন");
      return;
    }
    if (isNewAdmin) {
      if (!password || password.length < MIN_PASSWORD_LENGTH) {
        toast.error(`পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে`);
        return;
      }
      if (password !== confirmPassword) {
        toast.error("পাসওয়ার্ড ও নিশ্চিতকরণ পাসওয়ার্ড মিলছে না");
        return;
      }
    }
    const data: Omit<Staff, "id"> = {
      name: form.name,
      photo: form.photo || undefined,
      mobile: form.mobile,
      email: form.email || undefined,
      address: form.address || undefined,
      staffType: form.staffType,
      salary: Number(form.salary) || 0,
      joinDate: joinDate ? format(joinDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      status: form.status,
      staffId: form.staffId.trim() || undefined,
    };

    busyRef.current = true;
    setSubmitting(true);
    try {
      if (isEdit && editStaff) {
        await updateStaff(editStaff.id, data);
        const deniedPermissions = admissionResultAllowed ? [] : [ADMISSION_RESULTS_MANAGE];
        if (existingAdminUserId) {
          // Existing Admin login — only the Admission Result permission can change here (role/password reset stay untouched).
          await api.patch(`/users/${existingAdminUserId}`, { deniedPermissions });
        }
        toast.success("স্টাফ আপডেট হয়েছে");
        onOpenChange(false);
        return;
      }

      const staffRecord = await addStaff(data);

      if (!isNewAdmin) {
        toast.success("স্টাফ যোগ হয়েছে");
        onOpenChange(false);
        return;
      }

      // New Admin: the Staff row alone is useless without a working login,
      // so the two are treated as one atomic operation from the operator's
      // point of view — no "স্টাফ যোগ হয়েছে" toast until the login is
      // ALSO confirmed. If the login step fails for any reason (including a
      // genuine duplicate identifier), the just-created Staff row is rolled
      // back so this never leaves behind an orphaned Admin with no way to
      // log in and no confusing "succeeded, then failed" toast sequence.
      try {
        const deniedPermissions = admissionResultAllowed ? [] : [ADMISSION_RESULTS_MANAGE];
        const roleId = await findRoleId(form.staffType);
        if (!roleId) throw new Error("Admin রোল খুঁজে পাওয়া যায়নি — RBAC সেটিংস পরীক্ষা করুন।");
        await api.post("/users", {
          identifier: form.mobile,
          password,
          roleId,
          linkedStaffId: staffRecord.id,
          deniedPermissions,
        });
      } catch (loginErr) {
        try {
          await deleteStaff(staffRecord.id);
        } catch {
          // Rollback itself failed — surface the ORIGINAL error below regardless;
          // an orphaned Staff row with no login is a lesser problem than
          // silently swallowing the real cause.
        }
        throw loginErr;
      }

      toast.success("এডমিন তৈরি হয়েছে — মোবাইল ও পাসওয়ার্ড দিয়ে লগইন করা যাবে");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "স্টাফ সম্পাদনা" : "নতুন স্টাফ"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <Label>নাম *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="পূর্ণ নাম" />
          </div>
          <div className="space-y-1.5">
            <Label>মোবাইল *</Label>
            <Input value={form.mobile} onChange={(e) => update("mobile", e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
          <div className="space-y-1.5">
            <Label>স্টাফ আইডি *</Label>
            <Input value={form.staffId} onChange={(e) => update("staffId", e.target.value)} placeholder="যেমন: T-01" />
            <p className="text-xs text-muted-foreground">
              {form.staffType === "Admin"
                ? "এডমিনের জন্য এই আইডি শুধু পরিচয় হিসেবে ব্যবহৃত হয় — লগইন হয় মোবাইল ও পাসওয়ার্ড দিয়ে (নিচে দেখুন)"
                : "মোবাইল নম্বর ও এই আইডি দিয়েই স্টাফ পোর্টালে লগইন করা যাবে (পাসওয়ার্ড লাগবে না)"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>ইমেইল</Label>
            <Input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>ছবি (URL)</Label>
            <Input value={form.photo} onChange={(e) => update("photo", e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>ঠিকানা</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="ঠিকানা" />
          </div>
          <div className="space-y-1.5">
            <Label>স্টাফ টাইপ</Label>
            <Select value={form.staffType} onValueChange={(v) => update("staffType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAFF_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{STAFF_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>বেতন (৳)</Label>
            <Input type="number" value={form.salary} onChange={(e) => update("salary", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>যোগদান তারিখ</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !joinDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {joinDate ? format(joinDate, "dd MMMM yyyy", { locale: bn }) : "তারিখ"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={joinDate} onSelect={setJoinDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label>স্ট্যাটাস</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="সক্রিয়">সক্রিয়</SelectItem>
                <SelectItem value="নিষ্ক্রিয়">নিষ্ক্রিয়</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isNewAdmin && (
            <>
              <div className="space-y-1.5">
                <Label>পাসওয়ার্ড *</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষর`} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label>পাসওয়ার্ড নিশ্চিত করুন *</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="পুনরায় পাসওয়ার্ড লিখুন" autoComplete="new-password" />
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2 -mt-2">
                মোবাইল নম্বর ও এই পাসওয়ার্ড দিয়ে এডমিন প্যানেলে লগইন করা যাবে — এডমিনের জন্য লগইন সবসময় তৈরি হয়।
              </p>
            </>
          )}
          {/* Per-Admin "Admission Result" permission toggle — shown while creating a new Admin login, or editing an Admin who already has one. Super Admin (the built-in admin role itself) always keeps full access; this only ever narrows one specific Admin's own login. */}
          {(isNewAdmin || (isEdit && !!existingAdminUserId)) && (
            <div className="space-y-1.5 md:col-span-2 flex items-center gap-2 border rounded-lg p-3">
              <Checkbox checked={admissionResultAllowed} onCheckedChange={(v) => setAdmissionResultAllowed(!!v)} id="admission-result-allowed" />
              <label htmlFor="admission-result-allowed" className="text-sm cursor-pointer">
                অ্যাডমিশন রেজাল্ট ব্যবহারের অনুমতি — বন্ধ করলে এই এডমিন সাইডবারে অ্যাডমিশন রেজাল্ট দেখতে বা ব্যবহার করতে পারবেন না
              </label>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>বাতিল</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "সংরক্ষণ হচ্ছে..." : isEdit ? "আপডেট" : "সংরক্ষণ"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
