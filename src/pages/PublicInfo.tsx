import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Search, FileText, UserPlus, ChevronRight } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { PublicInstitutionInfo } from "@/types/academic";

/**
 * Public /info navigation hub (Public /info Redesign audit §2) — replaces
 * the old single-purpose search page (now PublicStudentSearch.tsx at
 * /info/search) with a central hub of exactly 3 cards, each reusing an
 * existing route unchanged: /info/search (Student Search, mobile-only),
 * /marksheet, and /studententry. No new API, no duplicated logic — this
 * page is pure navigation. Not wrapped in ProtectedRoute — reachable
 * without an account, same as every page it links to.
 */
interface HubCard {
  to: string;
  icon: typeof Search;
  title: string;
  description: string;
}

const CARDS: HubCard[] = [
  { to: "/info/search", icon: Search, title: "শিক্ষার্থী তথ্য অনুসন্ধান", description: "মোবাইল নম্বর দিয়ে আপনার তথ্য খুঁজুন" },
  { to: "/marksheet", icon: FileText, title: "মার্কশিট", description: "আপনার পরীক্ষার ফলাফল দেখুন ও ডাউনলোড করুন" },
  { to: "/studententry", icon: UserPlus, title: "শিক্ষার্থী তথ্য পূরণ", description: "প্রোফাইল তথ্য ও ছবি হালনাগাদ করুন" },
];

export default function PublicInfo() {
  const [institution, setInstitution] = useState<PublicInstitutionInfo | null>(null);

  useEffect(() => {
    api.get<PublicInstitutionInfo>("/public/institution").then(setInstitution).catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-2xl mx-auto space-y-4 py-10">
        <div className="text-center space-y-2">
          {institution?.logoUrl ? (
            <img src={institution.logoUrl} alt={institution.name} className="mx-auto w-14 h-14 rounded-2xl object-cover shadow-sm" />
          ) : (
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-sm">
              <GraduationCap className="w-8 h-8 text-primary-foreground" />
            </div>
          )}
          {institution?.name && <p className="text-sm font-semibold text-primary">{institution.name}</p>}
          <h1 className="text-2xl font-bold">শিক্ষার্থী তথ্য কেন্দ্র</h1>
          <p className="text-sm text-muted-foreground">নিচের যেকোনো একটি অপশন বেছে নিন — লগইন প্রয়োজন নেই</p>
        </div>

        <div className="space-y-3">
          {CARDS.map(({ to, icon: Icon, title, description }) => (
            <Link key={to} to={to} className="block">
              <Card className="border-none shadow-sm hover:shadow-md transition-shadow active:scale-[0.99]">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">লগইন পেইজে ফিরে যান</Link>
        </div>
      </div>
    </main>
  );
}
