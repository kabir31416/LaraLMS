import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Eye, EyeOff, GraduationCap, Hash, IdCard, Loader2, Lock, Phone, ShieldCheck, UserCog, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth, ApiClientError, type AuthUser } from "@/contexts/AuthContext";
import { homeRouteFor } from "@/components/ProtectedRoute";
import { usePublicInstitution } from "@/lib/publicInstitution";

/**
 * The three role-specific login pages (/studentLogin, /staffLogin,
 * /adminLogin). One component, three configurations — and underneath, the
 * SAME three existing auth calls the old tabbed /login page used:
 *   - Student: /auth/student-login (phone + registration number)
 *   - Staff:   /auth/staff-login   (phone + Staff ID; Batch Director / Mess staff)
 *   - Admin:   /auth/login         (identifier + password, portal "admin" —
 *                                   the server refuses non-Admin accounts)
 * After sign-in the user goes to `?next=` (if any) or their role's home;
 * route guards and the server still decide what they may open.
 */

type Portal = "student" | "staff" | "admin";

const PORTALS: Record<Portal, { title: string; subtitle: string; icon: LucideIcon; points: string[] }> = {
  student: {
    title: "শিক্ষার্থী লগইন",
    subtitle: "ফলাফল, উপস্থিতি, ফি, ম্যাটেরিয়াল ও নোটিশ — সব এক জায়গায়",
    icon: GraduationCap,
    points: ["নিজের ফলাফল ও মার্কশিট", "উপস্থিতির হার ও ইতিহাস", "ফি, পেমেন্ট ও রসিদ"],
  },
  staff: {
    title: "স্টাফ লগইন",
    subtitle: "ব্যাচ ডিরেক্টর ও মেস স্টাফের কাজের পোর্টাল",
    icon: UserCog,
    points: ["নিয়োগকৃত ব্যাচ ও শিক্ষার্থী", "ফলাফল ও উপস্থিতি এন্ট্রি", "মেস পরিচালনা (অনুমতি অনুযায়ী)"],
  },
  admin: {
    title: "এডমিন লগইন",
    subtitle: "প্রতিষ্ঠান পরিচালনা, ফিন্যান্স, রিপোর্ট ও সেটিংস",
    icon: ShieldCheck,
    points: ["শিক্ষার্থী, ভর্তি ও ফি ব্যবস্থাপনা", "স্টাফ, একাডেমিক ও মেস", "রিপোর্ট, অডিট ও সেটিংস"],
  },
};

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
/** Same normalisation idea as the backend (Bengali digits, spaces, +88) — only for client-side validation; the raw value is still sent. */
function normalizePhone(v: string): string {
  const ascii = v.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d))).replace(/[\s-]/g, "");
  return ascii.startsWith("+880") ? `0${ascii.slice(4)}` : ascii.startsWith("880") ? `0${ascii.slice(3)}` : ascii;
}
const isPhone = (v: string) => /^01\d{9}$/.test(normalizePhone(v));

/** `next` only ever points back inside this app. */
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /Login|^\/login/.test(next)) return null;
  return next;
}

function Field({ id, label, icon: Icon, error, hint, children }: { id: string; label: string; icon: LucideIcon; error?: string; hint?: string; children: (props: { id: string; className: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        {children({ id, className: cn("h-11 pl-9", error && "border-destructive focus-visible:ring-destructive/30"), "aria-invalid": !!error, "aria-describedby": describedBy })}
      </div>
      {error ? <p id={`${id}-error`} className="text-xs text-destructive">{error}</p> : hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function PortalLogin({ portal }: { portal: Portal }) {
  const cfg = PORTALS[portal];
  const { user, initializing, login, studentLogin, staffLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const institution = usePublicInstitution();
  const [a, setA] = useState(""); // phone / identifier
  const [b, setB] = useState(""); // reg no / staff id / password
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ a?: string; b?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = `${cfg.title} — ${institution?.name || "LaraLMS"}`;
  }, [cfg.title, institution?.name]);

  // Already signed in → straight to that user's own home.
  if (!initializing && user) return <Navigate to={homeRouteFor(user.role)} replace />;

  const validate = () => {
    const e: { a?: string; b?: string } = {};
    if (portal === "admin") {
      if (a.trim().length < 3) e.a = "মোবাইল নম্বর বা আইডি লিখুন";
      if (!b) e.b = "পাসওয়ার্ড লিখুন";
    } else {
      if (!a.trim()) e.a = "মোবাইল নম্বর লিখুন";
      else if (!isPhone(a)) e.a = "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)";
      if (!b.trim()) e.b = portal === "student" ? "রেজিস্ট্রেশন নম্বর লিখুন" : "স্টাফ আইডি লিখুন";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      let signedIn: AuthUser;
      if (portal === "student") signedIn = await studentLogin(normalizePhone(a), b.trim());
      else if (portal === "staff") signedIn = await staffLogin(normalizePhone(a), b.trim());
      else signedIn = await login(a.trim(), b, "admin");
      navigate(safeNext(params.get("next")) ?? homeRouteFor(signedIn.role), { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "লগইন ব্যর্থ হয়েছে — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন");
    } finally {
      setSubmitting(false);
    }
  };

  const Icon = cfg.icon;
  const others = (["student", "staff", "admin"] as Portal[]).filter((p) => p !== portal);

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-[hsl(224_64%_22%)] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]" />
        <div aria-hidden className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/40 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-3">
          {institution?.logoUrl ? <img src={institution.logoUrl} alt="" className="h-10 w-10 rounded-lg bg-white object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20"><GraduationCap className="h-5 w-5" aria-hidden /></span>}
          <span className="leading-tight"><span className="block font-semibold">{institution?.name || "LaraLMS"}</span><span className="block text-xs text-white/60">LaraLMS কোচিং ম্যানেজমেন্ট</span></span>
        </Link>
        <div className="relative max-w-md">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20"><Icon className="h-6 w-6" aria-hidden /></span>
          <h2 className="mt-5 text-3xl font-bold leading-snug">{cfg.title}</h2>
          <p className="mt-2 text-white/70">{cfg.subtitle}</p>
          <ul className="mt-8 space-y-3">
            {cfg.points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm text-white/85"><span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden />{p}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} {institution?.name || "LaraLMS"}</p>
      </aside>

      {/* Form */}
      <section className="flex min-h-screen flex-col px-4 py-6 sm:px-8 lg:min-h-0 lg:justify-center lg:py-12">
        <div className="mx-auto w-full max-w-[420px]">
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden />হোমপেজ</Link>

          <div className="mt-6 flex items-center gap-3 lg:hidden">
            {institution?.logoUrl ? <img src={institution.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5" aria-hidden /></span>}
            <span className="font-semibold leading-tight">{institution?.name || "LaraLMS"}</span>
          </div>

          <div className="mt-6 lg:mt-0">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary"><Icon className="h-3.5 w-3.5" aria-hidden />{portal === "student" ? "শিক্ষার্থী পোর্টাল" : portal === "staff" ? "স্টাফ পোর্টাল" : "এডমিন পোর্টাল"}</span>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{cfg.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{cfg.subtitle}</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
            {formError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{formError}</span>
              </div>
            )}

            <Field id={`${portal}-a`} label={portal === "admin" ? "মোবাইল নম্বর / আইডি" : "মোবাইল নম্বর"} icon={portal === "admin" ? IdCard : Phone} error={errors.a}>
              {(p) => <Input {...p} value={a} onChange={(e) => setA(e.target.value)} placeholder="01XXXXXXXXX" inputMode={portal === "admin" ? "text" : "tel"} autoComplete="username" autoFocus />}
            </Field>

            {portal === "admin" ? (
              <Field id="admin-password" label="পাসওয়ার্ড" icon={Lock} error={errors.b}>
                {(p) => (
                  <>
                    <Input {...p} className={cn(p.className, "pr-11")} type={showPassword ? "text" : "password"} value={b} onChange={(e) => setB(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"} aria-pressed={showPassword}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </>
                )}
              </Field>
            ) : (
              <Field
                id={`${portal}-b`}
                label={portal === "student" ? "রেজিস্ট্রেশন নম্বর" : "স্টাফ আইডি"}
                icon={portal === "student" ? Hash : IdCard}
                error={errors.b}
                hint={portal === "student" ? "ভর্তির সময় দেওয়া মোবাইল নম্বর ও রেজিস্ট্রেশন নম্বর মিললেই লগইন — আলাদা পাসওয়ার্ড নেই।" : "নিয়োগের সময় দেওয়া মোবাইল নম্বর ও স্টাফ আইডি মিললেই লগইন — আলাদা পাসওয়ার্ড নেই।"}
              >
                {(p) => <Input {...p} value={b} onChange={(e) => setB(e.target.value)} placeholder={portal === "student" ? "যেমন: 07" : "যেমন: T-01"} autoComplete="off" />}
              </Field>
            )}

            <Button type="submit" className="h-11 w-full text-base" disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />লগইন হচ্ছে...</> : "লগইন করুন"}
            </Button>

            {portal === "admin" && <p className="text-center text-xs text-muted-foreground">পাসওয়ার্ড ভুলে গেলে সুপার অ্যাডমিন স্টাফ ম্যানেজমেন্ট থেকে নতুন পাসওয়ার্ড দিতে পারবেন।</p>}
            {portal === "student" && (
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/info" className="text-primary hover:underline">শিক্ষার্থীর তথ্য খুঁজুন</Link>
                <span className="mx-2 text-border">|</span>
                <Link to="/studententry" className="text-primary hover:underline">তথ্য আপডেট করুন</Link>
              </p>
            )}
          </form>

          <div className="mt-10 border-t pt-5">
            <p className="text-xs text-muted-foreground">অন্য পোর্টাল</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {others.map((o) => {
                const OIcon = PORTALS[o].icon;
                return (
                  <Link key={o} to={`/${o}Login`} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm hover:border-primary/40 hover:text-primary">
                    <OIcon className="h-4 w-4" aria-hidden />{PORTALS[o].title}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export const StudentLoginPage = () => <PortalLogin portal="student" />;
export const StaffLoginPage = () => <PortalLogin portal="staff" />;
export const AdminLoginPage = () => <PortalLogin portal="admin" />;
