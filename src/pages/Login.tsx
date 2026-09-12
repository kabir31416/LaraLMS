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
 * Two tabs, two different auth calls underneath. Staff/Admin still use
 * identifier+password (/auth/login). The Student tab uses a dedicated
 * /auth/student-login that checks phone + Roll Number directly against the
 * live Student record instead of a separately-maintained password — no
 * login account has to be created/kept in sync ahead of time by an admin
 * at all (auth.service.ts's studentLogin creates one transparently on
 * first successful match, purely to reuse the same session machinery).
 */
const Login = () => {
  const navigate = useNavigate();
  const { login, studentLogin } = useAuth();
  const [tab, setTab] = useState<"staff" | "student">("staff");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [studentPhone, setStudentPhone] = useState("");
  const [studentRoll, setStudentRoll] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const handleStaffSubmit = async (e: React.FormEvent) => {
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
      navigate("/");
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as "staff" | "student")}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="staff">স্টাফ / এডমিন</TabsTrigger>
              <TabsTrigger value="student">শিক্ষার্থী</TabsTrigger>
            </TabsList>

            <TabsContent value="staff">
              <form className="space-y-4" onSubmit={handleStaffSubmit}>
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
