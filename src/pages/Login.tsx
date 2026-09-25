import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, Shield, UserCog, Phone, Lock, IdCard, Hash } from "lucide-react";
import { useAuth, ApiClientError } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import type { PublicInstitutionInfo } from "@/types/academic";
import { toast } from "sonner";

/** Same absolute-icon-inside-Input pattern already used in Topbar's search box and PublicInfo's search field — kept local since it's only three lines and only this file needs it as a wrapper. */
function IconInput({ icon: Icon, ...props }: { icon: typeof Phone } & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input className="pl-9" {...props} />
    </div>
  );
}

/**
 * Three tabs, three different auth calls underneath.
 * - Admin: identifier+password (/auth/login, the real User/Role model) —
 *   lands on "/", the only route an Admin role is allowed into.
 * - Staff: phone + Staff ID checked directly against the live Staff record
 *   (/auth/staff-login) — no password, no login account at all
 *   (auth.service.ts's staffLogin is a pure read-only lookup, same design
 *   as the Student Portal below). Lands on "/director" — currently the
 *   only staff type with a real portal home page is Batch Director;
 *   staffLogin itself rejects any other staff type with a clear error.
 * - Student: phone + Roll Number checked directly against the live Student
 *   record (/auth/student-login) — lands on "/student".
 */
const Login = () => {
  const navigate = useNavigate();
  const { login, studentLogin, staffLogin } = useAuth();
  const [tab, setTab] = useState<"admin" | "staff" | "student">("admin");
  const [institution, setInstitution] = useState<PublicInstitutionInfo | null>(null);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [staffPhone, setStaffPhone] = useState("");
  const [staffId, setStaffId] = useState("");

  const [studentPhone, setStudentPhone] = useState("");
  const [studentRoll, setStudentRoll] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Same public, no-login branding endpoint PublicInfo.tsx/Marksheet.tsx
  // already use — a coaching centre that's set its own name/logo sees it
  // here too, instead of a generic "LaraLMS" mark, on the first screen
  // every user (Admin, Staff, Student) actually sees.
  useEffect(() => {
    api.get<PublicInstitutionInfo>("/public/institution").then(setInstitution).catch(() => {});
  }, []);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error("সব তথ্য দিন");
      return;
    }
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      toast.success("লগইন সফল");
      navigate("/");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "লগইন ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffPhone.trim() || !staffId.trim()) {
      toast.error("ফোন নম্বর ও স্টাফ আইডি দিন");
      return;
    }
    setSubmitting(true);
    try {
      await staffLogin(staffPhone.trim(), staffId.trim());
      toast.success("লগইন সফল");
      navigate("/director");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "লগইন ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentPhone.trim() || !studentRoll.trim()) {
      toast.error("ফোন নম্বর ও রেজিস্ট্রেশন নম্বর দিন");
      return;
    }
    setSubmitting(true);
    try {
      await studentLogin(studentPhone.trim(), studentRoll.trim());
      toast.success("লগইন সফল");
      navigate("/student");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "লগইন ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-muted/50 to-muted/20 p-4">
      <Card className="w-full max-w-sm border-none shadow-xl">
        <CardHeader className="text-center pb-2">
          {institution?.logoUrl ? (
            <img src={institution.logoUrl} alt={institution.name} className="mx-auto w-14 h-14 rounded-2xl object-cover shadow-sm mb-2" />
          ) : (
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-sm mb-2">
              <GraduationCap className="w-8 h-8 text-primary-foreground" />
            </div>
          )}
          <CardTitle className="text-xl">{institution?.name || "লারা এলএমএস"}</CardTitle>
          <p className="text-sm text-muted-foreground">আপনার অ্যাকাউন্টে লগইন করুন</p>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "admin" | "staff" | "student")}>
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="admin" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> এডমিন</TabsTrigger>
              <TabsTrigger value="staff" className="gap-1.5"><UserCog className="h-3.5 w-3.5" /> স্টাফ</TabsTrigger>
              <TabsTrigger value="student" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> শিক্ষার্থী</TabsTrigger>
            </TabsList>

            <TabsContent value="admin">
              <form className="space-y-4" onSubmit={handleAdminSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="login-identifier">মোবাইল নম্বর / আইডি</Label>
                  <IconInput
                    icon={IdCard}
                    id="login-identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">পাসওয়ার্ড</Label>
                  <IconInput
                    icon={Lock}
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "লগইন হচ্ছে..." : "লগইন"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="staff">
              <form className="space-y-4" onSubmit={handleStaffSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-phone">ফোন নম্বর</Label>
                  <IconInput
                    icon={Phone}
                    id="staff-phone"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-id">স্টাফ আইডি</Label>
                  <IconInput
                    icon={IdCard}
                    id="staff-id"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    placeholder="যেমন: T-01"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">নিয়োগের সময় দেওয়া ফোন নম্বর ও স্টাফ আইডি মিললেই লগইন হয়ে যাবে — আলাদা পাসওয়ার্ড লাগবে না</p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "লগইন হচ্ছে..." : "লগইন"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="student">
              <form className="space-y-4" onSubmit={handleStudentSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="student-phone">ফোন নম্বর</Label>
                  <IconInput
                    icon={Phone}
                    id="student-phone"
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="student-roll">রেজিস্ট্রেশন নম্বর</Label>
                  <IconInput
                    icon={Hash}
                    id="student-roll"
                    value={studentRoll}
                    onChange={(e) => setStudentRoll(e.target.value)}
                    placeholder="যেমন: 07"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">ভর্তির সময় দেওয়া ফোন নম্বর ও রেজিস্ট্রেশন নম্বর মিললেই লগইন হয়ে যাবে — আলাদা পাসওয়ার্ড লাগবে না</p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "লগইন হচ্ছে..." : "লগইন"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-sm text-muted-foreground mt-4 space-x-3">
            <Link to="/info" className="text-primary hover:underline">শিক্ষার্থীর তথ্য খুঁজুন</Link>
            <span className="text-border">|</span>
            <Link to="/studententry" className="text-primary hover:underline">তথ্য আপডেট করুন</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
};

export default Login;
