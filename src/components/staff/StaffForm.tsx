import { useState } from "react";
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

/**
 * Only "Admin" still goes through the password-based User/Role login here —
 * that's real Admin auth and stays untouched. A "Batch Director" (or any
 * other staff type) no longer gets a login account created for them at
 * all: phone + Staff ID matching their own Staff record *is* the Staff
 * Portal login (auth.service.ts's staffLogin, a pure read-only lookup —
 * same design as the Student Portal). Keeping both doors open for the same
 * person was exactly what kept producing "already exists" conflicts.
 */
const LOGIN_ELIGIBLE: StaffType[] = ["Admin"];
const ROLE_NAME_BY_STAFF_TYPE: Partial<Record<StaffType, string>> = { Admin: "admin" };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editStaff?: Staff | null;
}

export function StaffForm({ open, onOpenChange, editStaff }: Props) {
  const { addStaff, updateStaff } = useStaff();
  const isEdit = !!editStaff;

  const [form, setForm] = useState(() => init(editStaff));
  const [joinDate, setJoinDate] = useState<Date | undefined>(
    editStaff?.joinDate ? new Date(editStaff.joinDate) : new Date(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [createLogin, setCreateLogin] = useState(false);

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

  const handleSubmit = async () => {
    if (!form.name || !form.mobile || (!isEdit && !form.staffId.trim())) {
      toast.error("নাম, মোবাইল এবং স্টাফ আইডি প্রয়োজন");
      return;
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

    setSubmitting(true);
    try {
      let staffRecord: Staff;
      if (isEdit && editStaff) {
        staffRecord = await updateStaff(editStaff.id, data);
        toast.success("স্টাফ আপডেট হয়েছে");
      } else {
        staffRecord = await addStaff(data);
        toast.success("স্টাফ যোগ হয়েছে");
      }

      if (!isEdit && createLogin) {
        const roleId = await findRoleId(form.staffType);
        if (roleId) {
          const res = await api.post<{ tempPassword?: string }>("/users", {
            identifier: form.mobile,
            roleId,
            linkedStaffId: staffRecord.id,
          });
          toast.success(
            res.tempPassword
              ? `লগইন তৈরি হয়েছে। সাময়িক পাসওয়ার্ড: ${res.tempPassword}`
              : "লগইন তৈরি হয়েছে",
            { duration: 15000 },
          );
        }
      }

      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
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
            <p className="text-xs text-muted-foreground">মোবাইল নম্বর ও এই আইডি দিয়েই স্টাফ পোর্টালে লগইন করা যাবে (পাসওয়ার্ড লাগবে না)</p>
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
          {!isEdit && LOGIN_ELIGIBLE.includes(form.staffType) && (
            <div className="space-y-1.5 md:col-span-2 flex items-center gap-2 border rounded-lg p-3">
              <Checkbox checked={createLogin} onCheckedChange={(v) => setCreateLogin(!!v)} id="create-login" />
              <label htmlFor="create-login" className="text-sm cursor-pointer">
                একই সাথে এডমিন প্যানেল লগইন (পাসওয়ার্ড সহ) তৈরি করুন — শুধু এডমিনদের জন্য, সাময়িক পাসওয়ার্ড দেখানো হবে
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
