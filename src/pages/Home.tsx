import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, BedDouble, BookOpenCheck, ClipboardCheck, FileSearch, GraduationCap, Globe, MapPin, Phone, ShieldCheck, UserCog, Wallet, type LucideIcon } from "lucide-react";
import { usePublicInstitution } from "@/lib/publicInstitution";

/**
 * Public homepage — a login portal chooser. Shows only public branding
 * (/public/institution); nothing protected is fetched or shown here.
 */
const PORTALS: { to: string; title: string; text: string; cta: string; icon: LucideIcon; tone: string }[] = [
  { to: "/studentLogin", title: "শিক্ষার্থী", text: "ফলাফল, উপস্থিতি, ফি, ম্যাটেরিয়াল ও নোটিশ", cta: "শিক্ষার্থী লগইন", icon: GraduationCap, tone: "bg-primary text-primary-foreground" },
  { to: "/staffLogin", title: "স্টাফ", text: "ব্যাচ ডিরেক্টর ও মেস স্টাফের কাজ", cta: "স্টাফ লগইন", icon: UserCog, tone: "bg-sky-600 text-white" },
  { to: "/adminLogin", title: "এডমিন", text: "প্রতিষ্ঠান, ফিন্যান্স, রিপোর্ট ও সেটিংস", cta: "এডমিন লগইন", icon: ShieldCheck, tone: "bg-[hsl(224_64%_22%)] text-white" },
];

const FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: Award, label: "ফলাফল ও মার্কশিট" },
  { icon: ClipboardCheck, label: "উপস্থিতি" },
  { icon: Wallet, label: "ফি ও রসিদ" },
  { icon: BookOpenCheck, label: "ম্যাটেরিয়াল" },
  { icon: BedDouble, label: "মেস / হোস্টেল" },
];

export default function Home() {
  const institution = usePublicInstitution();
  const name = institution?.name || "LaraLMS";
  useEffect(() => {
    document.title = `${name} — লগইন পোর্টাল`;
  }, [name]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            {institution?.logoUrl ? <img src={institution.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5" aria-hidden /></span>}
            <span className="min-w-0 leading-tight"><span className="block truncate font-semibold">{name}</span><span className="block text-[11px] text-muted-foreground">LaraLMS</span></span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/info" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex">তথ্য খুঁজুন</Link>
            <Link to="/marksheet" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex">মার্কশিট</Link>
            <Link to="/studentLogin" className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary/90">লগইন</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div aria-hidden className="absolute inset-0 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)] opacity-60" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />কোচিং ম্যানেজমেন্ট পোর্টাল
              </span>
              <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                {name}
                <span className="mt-2 block text-primary">শেখা, ফলাফল ও হিসাব — এক জায়গায়</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                শিক্ষার্থী, স্টাফ ও এডমিন — প্রত্যেকের জন্য আলাদা নিরাপদ পোর্টাল। নিচে আপনার পোর্টাল বেছে নিয়ে লগইন করুন।
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {FEATURES.map((f) => (
                  <span key={f.label} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-muted-foreground"><f.icon className="h-3.5 w-3.5 text-primary" aria-hidden />{f.label}</span>
                ))}
              </div>
            </div>

            <div className="grid gap-3" aria-label="লগইন পোর্টাল">
              {PORTALS.map((p) => (
                <Link
                  key={p.to}
                  to={p.to}
                  className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${p.tone}`}><p.icon className="h-6 w-6" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{p.cta}</span>
                    <span className="block text-sm text-muted-foreground">{p.text}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-3 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <Link to="/info" className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:border-primary/40">
            <FileSearch className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
            <span><span className="block font-medium">শিক্ষার্থীর তথ্য খুঁজুন</span><span className="block text-sm text-muted-foreground">রেজিস্ট্রেশন নম্বর দিয়ে পাবলিক তথ্য</span></span>
          </Link>
          <Link to="/marksheet" className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:border-primary/40">
            <Award className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
            <span><span className="block font-medium">মার্কশিট</span><span className="block text-sm text-muted-foreground">প্রকাশিত ফলাফল দেখুন</span></span>
          </Link>
          <Link to="/studententry" className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:border-primary/40">
            <ClipboardCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
            <span><span className="block font-medium">তথ্য আপডেট করুন</span><span className="block text-sm text-muted-foreground">শিক্ষার্থীর তথ্য জমা / হালনাগাদ</span></span>
          </Link>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <p className="font-medium text-foreground">{name}</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              {institution?.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{institution.address}</span>}
              {institution?.phone && <a href={`tel:${institution.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3.5 w-3.5" aria-hidden />{institution.phone}</a>}
              {institution?.website && <a href={institution.website.startsWith("http") ? institution.website : `https://${institution.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><Globe className="h-3.5 w-3.5" aria-hidden />{institution.website}</a>}
            </p>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} {name} • Powered by LaraLMS</p>
        </div>
      </footer>
    </div>
  );
}
