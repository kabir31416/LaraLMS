import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileText, Info, LogIn, Search, ShieldCheck, UserPen, type LucideIcon } from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";

/**
 * Public /info landing page — pure navigation to the three existing public
 * tools (student search, marksheet, student entry). No data is loaded here
 * beyond the public institution branding in the shell.
 */
interface HubCard {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  needs: string[];
  cta: string;
}

const CARDS: HubCard[] = [
  {
    to: "/info/search",
    icon: Search,
    title: "শিক্ষার্থী তথ্য অনুসন্ধান",
    description: "মোবাইল নম্বর দিয়ে আপনার কোর্স, ব্যাচ, উপস্থিতি ও ফলাফলের সারাংশ দেখুন।",
    needs: ["ভর্তির সময় দেওয়া মোবাইল নম্বর"],
    cta: "অনুসন্ধান করুন",
  },
  {
    to: "/marksheet",
    icon: FileText,
    title: "মার্কশিট ও ফলাফল",
    description: "ব্যক্তিগত মার্কশিট বা পুরো ব্যাচের ফলাফল শিট দেখুন, প্রিন্ট বা PDF করুন।",
    needs: ["রেজিস্ট্রেশন নম্বর (ব্যক্তিগত)", "অথবা ব্যাচের নাম (ব্যাচ ভিত্তিক)"],
    cta: "ফলাফল দেখুন",
  },
  {
    to: "/studententry",
    icon: UserPen,
    title: "শিক্ষার্থী তথ্য পূরণ",
    description: "প্রোফাইল ছবি, ঠিকানা, অভিভাবক এবং HSC/SSC তথ্য হালনাগাদ করুন।",
    needs: ["রেজিস্ট্রেশন নম্বর / রোল", "মোবাইল নম্বর"],
    cta: "তথ্য পূরণ করুন",
  },
];

export default function PublicInfo() {
  return (
    <PublicShell
      width="lg"
      icon={Info}
      title="শিক্ষার্থী তথ্য কেন্দ্র"
      description="লগইন ছাড়াই আপনার তথ্য খুঁজুন, ফলাফল দেখুন বা প্রোফাইল হালনাগাদ করুন — নিচে থেকে একটি বেছে নিন।"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><c.icon className="h-6 w-6" aria-hidden /></span>
            <h2 className="mt-4 text-lg font-semibold">{c.title}</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
            <div className="mt-4 rounded-lg bg-muted/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">যা লাগবে</p>
              <ul className="mt-1.5 space-y-1">
                {c.needs.map((n) => <li key={n} className="flex items-start gap-1.5 text-xs"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />{n}</li>)}
              </ul>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">{c.cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">আপনার তথ্য নিরাপদ।</span> এখানে শুধু প্রতিষ্ঠান যে তথ্য প্রকাশের অনুমতি দিয়েছে তা দেখানো হয়; তথ্য পূরণের আগে রেজিস্ট্রেশন নম্বর ও মোবাইল দিয়ে যাচাই করা হয়।</p>
        </div>
        <Link to="/studentLogin" className="flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
          <LogIn className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span className="text-sm text-muted-foreground"><span className="font-medium text-foreground">সম্পূর্ণ তথ্য দেখতে চান?</span> শিক্ষার্থী পোর্টালে লগইন করে ফলাফল, উপস্থিতি, পেমেন্ট ও নোটিশ দেখুন →</span>
        </Link>
      </div>
    </PublicShell>
  );
}
