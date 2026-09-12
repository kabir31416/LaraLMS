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
import { passwordFromPhone } from "@/lib/format";

/**
 * Two tabs sharing the same /auth/login call underneath — the backend
 * doesn't distinguish "staff login" from "student login" at all (it's
 * always just identifier+password). This split exists purely to remove a
 * real source of confusion: the generic "মোবাইল নম্বর / আইডি" label reads
 * ambiguously to a student, who might reasonably type their Registration
 * ID there instead of their phone number. The Student tab spells out
 * exactly which two values are the credential.
 */
const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [tab, setTab] = useState<"staff" | "student">("staff");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [studentPhone, setStudentPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const doLogin = async (id: string, pass: string) => {
    if (!id.trim() || !pass) {
      toast.error("সব তথ্য দিন");
      return;
    }
    setSubmitting(true);
    try {
      await login(id.trim(), pass);
      toast.success("লগইন সফল");
      navigate("/");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "লগইন ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(identifier, password);
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only the phone number is asked for — the password (its last 6
    // digits) is derived automatically, the same way
    // student.service.ts's syncStudentLogin sets it server-side. This
    // removes the one remaining way a student could type a mismatched
    // credential.
    doLogin(studentPhone, passwordFromPhone(studentPhone));
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
                  <p className="text-xs text-muted-foreground">শুধু আপনার মোবাইল নম্বর দিন — আলাদা পাসওয়ার্ড লাগবে না</p>
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
