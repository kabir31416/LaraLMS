import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStaff } from "@/contexts/StaffContext";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const { loginAsAdmin, loginAsDirector } = useAuth();
  const { getDirectors } = useStaff();
  const directors = getDirectors();
  const [directorId, setDirectorId] = useState<string>("");

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

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-none shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">লারা এলএমএস</CardTitle>
          <p className="text-sm text-muted-foreground">ডেমো লগইন — আপনার ভূমিকা নির্বাচন করুন</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> অ্যাডমিন লগইন
            </Label>
            <p className="text-xs text-muted-foreground">সম্পূর্ণ সিস্টেম অ্যাক্সেস</p>
            <Button className="w-full" onClick={handleAdmin}>অ্যাডমিন হিসেবে লগইন</Button>
          </div>

          <div className="border-t pt-6 space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <GraduationCap className="h-4 w-4 text-primary" /> ব্যাচ ডিরেক্টর লগইন
            </Label>
            <p className="text-xs text-muted-foreground">শুধুমাত্র নিজের ব্যাচ এবং শিক্ষার্থী দেখতে পারবেন</p>
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
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Login;
