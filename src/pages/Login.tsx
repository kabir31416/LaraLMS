import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap } from "lucide-react";
import { useAuth, ApiClientError } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [staffPhone, setStaffPhone] = useState("");
  const [staffId, setStaffId] = useState("");

  const [studentPhone, setStudentPhone] = useState("");
  const [studentRoll, setStudentRoll] = useState("");

  const [submitting, setSubmitting] = useState(false);

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
      toast.error("ফোন নম্বর ও রোল নম্বর দিন");
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
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm border-none shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">লারা এলএমএস</CardTitle>
          <p className="text-sm text-muted-foreground">আপনার অ্যাকাউন্টে লগইন করুন</p>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "admin" | "staff" | "student")}>
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="admin">এডমিন</TabsTrigger>
              <TabsTrigger value="staff">স্টাফ</TabsTrigger>
              <TabsTrigger value="student">শিক্ষার্থী</TabsTrigger>
            </TabsList>

            <TabsContent value="admin">
              <form className="space-y-4" onSubmit={handleAdminSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="login-identifier">মোবাইল নম্বর / আইডি</Label>
                  <Input
                    id="login-identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">পাসওয়ার্ড</Label>
                  <Input
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
                  <Input
                    id="staff-phone"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-id">স্টাফ আইডি</Label>
                  <Input
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
                  <Input
                    id="student-phone"
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="student-roll">রোল নম্বর</Label>
                  <Input
                    id="student-roll"
                    value={studentRoll}
                    onChange={(e) => setStudentRoll(e.target.value)}
                    placeholder="যেমন: 07"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">ভর্তির সময় দেওয়া ফোন নম্বর ও রোল নম্বর মিললেই লগইন হয়ে যাবে — আলাদা পাসওয়ার্ড লাগবে না</p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "লগইন হচ্ছে..." : "লগইন"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link to="/info" className="text-primary hover:underline">শিক্ষার্থীর তথ্য খুঁজুন</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
};

export default Login;
