import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GraduationCap, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStaff } from "@/contexts/StaffContext";
import { useStudents } from "@/contexts/StudentContext";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const { loginAsAdmin, loginAsDirector, loginAsStudent } = useAuth();
  const { getDirectors } = useStaff();
  const { students } = useStudents();
  const directors = getDirectors();
  const [directorId, setDirectorId] = useState<string>("");
  const [sid, setSid] = useState("");
  const [smobile, setSmobile] = useState("");

  const handleAdmin = () => {
    loginAsAdmin();
    toast.success("অ্যাডমিন হিসেবে লগইন সফল");
    navigate("/");
  };

  const handleDirector = () => {
    if (!directorId) {
      toast.error("একজন ডিরেক্টর নির্বাচন করুন");
      return;
    }
    const d = directors.find((x) => x.id === directorId);
    if (!d) return;
    loginAsDirector(d.id, d.name);
    toast.success(`${d.name} হিসেবে লগইন সফল`);
    navigate("/director");
  };

  const handleStudent = () => {
    if (!sid.trim() || !smobile.trim()) {
      toast.error("Student ID এবং মোবাইল দিন");
      return;
    }
    const s = students.find((x) => x.studentId.toLowerCase() === sid.trim().toLowerCase() && x.mobile === smobile.trim());
    if (!s) {
      toast.error("শিক্ষার্থী পাওয়া যায়নি");
      return;
    }
    loginAsStudent(s.id, s.name);
    toast.success(`${s.name} হিসেবে লগইন সফল`);
    navigate("/student");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg border-none shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">লারা এলএমএস</CardTitle>
          <p className="text-sm text-muted-foreground">ডেমো লগইন — আপনার ভূমিকা নির্বাচন করুন</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="admin">অ্যাডমিন</TabsTrigger>
              <TabsTrigger value="director">ডিরেক্টর</TabsTrigger>
              <TabsTrigger value="student">শিক্ষার্থী</TabsTrigger>
            </TabsList>

            <TabsContent value="admin" className="space-y-3 pt-4">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" /> অ্যাডমিন লগইন
              </Label>
              <p className="text-xs text-muted-foreground">সম্পূর্ণ সিস্টেম অ্যাক্সেস</p>
              <Button className="w-full" onClick={handleAdmin}>অ্যাডমিন হিসেবে লগইন</Button>
            </TabsContent>

            <TabsContent value="director" className="space-y-3 pt-4">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <GraduationCap className="h-4 w-4 text-primary" /> ব্যাচ ডিরেক্টর লগইন
              </Label>
              <Select value={directorId} onValueChange={setDirectorId}>
                <SelectTrigger><SelectValue placeholder="ডিরেক্টর নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {directors.length === 0 ? (
                    <SelectItem value="none" disabled>কোনো ডিরেক্টর নেই</SelectItem>
                  ) : (
                    directors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button variant="outline" className="w-full" onClick={handleDirector} disabled={directors.length === 0}>
                ডিরেক্টর হিসেবে লগইন
              </Button>
            </TabsContent>

            <TabsContent value="student" className="space-y-3 pt-4">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4 text-primary" /> শিক্ষার্থী লগইন
              </Label>
              <Input placeholder="Student ID (যেমন LMS-01001)" value={sid} onChange={(e) => setSid(e.target.value)} />
              <Input placeholder="মোবাইল নম্বর" value={smobile} onChange={(e) => setSmobile(e.target.value)} />
              <Button className="w-full" onClick={handleStudent}>শিক্ষার্থী হিসেবে লগইন</Button>
              <p className="text-xs text-muted-foreground">ডেমো: <span className="font-mono">LMS-01001 / 01712345678</span></p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
};

export default Login;
