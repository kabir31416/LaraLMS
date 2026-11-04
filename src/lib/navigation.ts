import {
  LayoutDashboard, Users, UserPlus, DollarSign, ClipboardCheck, FileText, Award, BookOpen, Calculator, Settings,
  UserCog, Layers, Video, ClipboardList, Bell, BarChart3, User, ListChecks, FileSpreadsheet, BedDouble, Building2,
  Receipt, Coins, ShieldCheck, HandCoins, Wrench, TrendingUp, type LucideIcon,
} from "lucide-react";
import { hasPermission, type AuthUser } from "@/contexts/AuthContext";
import {
  MESS_BILLING_MANAGE, MESS_COMPLAINTS_MANAGE, MESS_EXPENSES_MANAGE, MESS_MEMBERS_MANAGE, MESS_NOTICES_MANAGE,
  MESS_PAYMENTS_COLLECT, MESS_REPORTS_READ, MESS_VIEW, SIDEBAR_MODULES,
} from "@/lib/permissions";

/**
 * Single navigation catalog — the sidebar, the Ctrl+K command palette and the
 * header breadcrumb all read from here, so a page can never appear in one
 * and be missing (or mislabelled) in another. Visibility rules are exactly
 * the ones the sidebar always used:
 *  - Admin items listed in SIDEBAR_MODULES require every key of that module
 *    (per-Admin restriction via User.deniedPermissions)
 *  - Mess staff items require their own permission
 *  - Batch Director / Student menus are fixed per role
 * The backend still enforces every page's API regardless of what's shown.
 */
export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: string;
  /** Extra words the command palette matches on (English/alternative names). */
  keywords?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ADMIN_GROUPS: NavGroup[] = [
  { label: "প্রধান", items: [{ title: "ড্যাশবোর্ড", url: "/", icon: LayoutDashboard, keywords: "dashboard home" }] },
  {
    label: "শিক্ষার্থী",
    items: [
      { title: "শিক্ষার্থী", url: "/students", icon: Users, keywords: "students list" },
      { title: "ভর্তি", url: "/admission", icon: UserPlus, keywords: "admission new student" },
      { title: "অ্যাডমিশন রেজাল্ট", url: "/admission-result", icon: ListChecks, keywords: "admission result chance" },
      { title: "ব্যাচ", url: "/batches", icon: Layers, keywords: "batch" },
    ],
  },
  {
    label: "একাডেমিক",
    items: [
      { title: "উপস্থিতি", url: "/attendance", icon: ClipboardCheck, keywords: "attendance" },
      { title: "এক্সাম", url: "/exams", icon: FileText, keywords: "exam" },
      { title: "রেজাল্ট এন্ট্রি", url: "/result-entry", icon: ClipboardList, keywords: "result entry marks" },
      { title: "ফলাফল ব্যবস্থাপনা", url: "/result-management", icon: FileSpreadsheet, keywords: "result management" },
      { title: "পারফরম্যান্স অ্যানালিটিক্স", url: "/analytics", icon: TrendingUp, keywords: "performance analytics at risk trend progress" },
      { title: "ভিডিও ক্লাস", url: "/videos", icon: Video, keywords: "video class" },
    ],
  },
  {
    label: "আর্থিক",
    items: [
      { title: "ফি ম্যানেজমেন্ট", url: "/fees", icon: DollarSign, keywords: "fee payment due" },
      { title: "হিসাব", url: "/accounts", icon: Calculator, keywords: "accounts income expense ledger" },
      { title: "ম্যাটেরিয়াল", url: "/books", icon: BookOpen, keywords: "material books stock" },
    ],
  },
  { label: "মেস / হোস্টেল", items: [{ title: "মেস / হোস্টেল", url: "/mess", icon: BedDouble, keywords: "mess hostel seat room" }] },
  {
    label: "প্রশাসন",
    items: [
      { title: "নোটিশ", url: "/notices", icon: Bell, keywords: "notice" },
      { title: "রিপোর্ট", url: "/reports", icon: BarChart3, keywords: "reports" },
      { title: "স্টাফ", url: "/staff", icon: UserCog, keywords: "staff employee" },
      { title: "সেটিংস", url: "/settings", icon: Settings, keywords: "settings" },
    ],
  },
];

const DIRECTOR_GROUPS: NavGroup[] = [
  { label: "প্রধান", items: [{ title: "ডিরেক্টর ড্যাশবোর্ড", url: "/director", icon: LayoutDashboard, keywords: "dashboard" }] },
  {
    label: "আমার ব্যাচ",
    items: [
      { title: "আমার শিক্ষার্থী", url: "/director/students", icon: Users, keywords: "students" },
      { title: "রেজাল্ট এন্ট্রি", url: "/director/results", icon: ClipboardList, keywords: "result entry attendance" },
      { title: "ফলাফল ব্যবস্থাপনা", url: "/director/result-management", icon: FileSpreadsheet, keywords: "result management" },
      { title: "পারফরম্যান্স অ্যানালিটিক্স", url: "/director/analytics", icon: TrendingUp, keywords: "performance analytics at risk trend" },
      { title: "অ্যাডমিশন রেজাল্ট", url: "/director/admission-result", icon: ListChecks, keywords: "admission result" },
    ],
  },
  {
    label: "একাডেমিক",
    items: [
      { title: "এক্সাম", url: "/exams", icon: FileText, keywords: "exam" },
      { title: "ভিডিও ক্লাস", url: "/videos", icon: Video, keywords: "video" },
    ],
  },
];

const STUDENT_GROUPS: NavGroup[] = [
  { label: "ওভারভিউ", items: [{ title: "ড্যাশবোর্ড", url: "/student", icon: LayoutDashboard, keywords: "dashboard home" }] },
  {
    label: "একাডেমিক",
    items: [
      { title: "ফলাফল ও মার্কশিট", url: "/student/results", icon: Award, keywords: "results marksheet grade exam" },
      { title: "উপস্থিতি", url: "/student/attendance", icon: ClipboardCheck, keywords: "attendance" },
      { title: "ভিডিও ক্লাস", url: "/student/videos", icon: Video, keywords: "video class lecture" },
      { title: "ম্যাটেরিয়াল", url: "/student/books", icon: BookOpen, keywords: "material book sheet" },
    ],
  },
  { label: "আর্থিক", items: [{ title: "ফি ও পেমেন্ট", url: "/student/payments", icon: DollarSign, keywords: "payment fee due receipt" }] },
  { label: "যোগাযোগ", items: [{ title: "নোটিশ", url: "/student/notices", icon: Bell, keywords: "notice announcement" }] },
  {
    label: "আমার তথ্য",
    items: [
      { title: "প্রোফাইল", url: "/student/profile", icon: User, keywords: "profile" },
      { title: "মেস / হোস্টেল", url: "/student/mess", icon: BedDouble, keywords: "mess hostel seat bill" },
    ],
  },
];

const MESS_STAFF_GROUPS: NavGroup[] = [
  {
    label: "মেস",
    items: [
      { title: "মেস ড্যাশবোর্ড", url: "/mess", icon: LayoutDashboard, permission: MESS_VIEW, keywords: "dashboard" },
      { title: "রুম ও সিট", url: "/mess/setup", icon: Building2, permission: MESS_VIEW, keywords: "room seat" },
      { title: "সদস্য ও ভর্তি", url: "/mess/members", icon: Users, permission: MESS_MEMBERS_MANAGE, keywords: "members admission" },
    ],
  },
  {
    label: "আর্থিক",
    items: [
      { title: "বিলিং", url: "/mess/billing", icon: Receipt, permission: MESS_BILLING_MANAGE, keywords: "bill" },
      { title: "পেমেন্ট", url: "/mess/payments", icon: Coins, permission: MESS_PAYMENTS_COLLECT, keywords: "payment" },
      { title: "জামানত ও নিষ্পত্তি", url: "/mess/deposits", icon: ShieldCheck, permission: MESS_PAYMENTS_COLLECT, keywords: "deposit settlement" },
      { title: "খরচ", url: "/mess/expenses", icon: HandCoins, permission: MESS_EXPENSES_MANAGE, keywords: "expense" },
    ],
  },
  {
    label: "পরিচালনা",
    items: [
      { title: "অভিযোগ ও রক্ষণাবেক্ষণ", url: "/mess/complaints", icon: Wrench, permission: MESS_COMPLAINTS_MANAGE, keywords: "complaint maintenance" },
      { title: "নোটিশ", url: "/mess/notices", icon: Bell, permission: MESS_NOTICES_MANAGE, keywords: "notice" },
      { title: "রিপোর্ট", url: "/mess/reports", icon: BarChart3, permission: MESS_REPORTS_READ, keywords: "reports" },
    ],
  },
];

/** url -> permission keys, built once from the shared SIDEBAR_MODULES catalog — Admin items not in this map (e.g. Dashboard) always show. */
const PERMISSIONS_BY_URL = new Map<string, string[]>(SIDEBAR_MODULES.flatMap((m) => m.urls.map((url) => [url, m.permissions] as const)));

export function navGroupsFor(user: AuthUser | null): NavGroup[] {
  if (!user) return [];
  const source = user.role === "Batch Director" ? DIRECTOR_GROUPS
    : user.role === "Student" ? STUDENT_GROUPS
    : user.role === "Mess Staff" ? MESS_STAFF_GROUPS
    : ADMIN_GROUPS;
  return source
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.permission) return hasPermission(user, item.permission);
        if (user.role !== "Admin") return true;
        const perms = PERMISSIONS_BY_URL.get(item.url);
        return !perms || perms.every((p) => hasPermission(user, p));
      }),
    }))
    .filter((g) => g.items.length > 0);
}

/** Root URLs whose NavLink must match exactly (otherwise "/" would be active everywhere). */
export const EXACT_ROOTS = new Set(["/", "/director", "/student", "/mess"]);

/** Titles for routes that aren't sidebar items themselves (detail/print pages), used by the header breadcrumb. */
const EXTRA_TITLES: [RegExp, string][] = [
  [/^\/students\/[^/]+$/, "শিক্ষার্থীর প্রোফাইল"],
  [/^\/admission\/import/, "বাল্ক ভর্তি (Excel)"],
  [/^\/admission\/pending/, "অপেক্ষমাণ শিক্ষার্থী"],
  [/^\/chance-results/, "চান্স রেজাল্ট"],
  [/^\/director\/chance-results/, "চান্স রেজাল্ট"],
  [/^\/mess\/setup/, "মেস ও রুম/সিট"],
  [/^\/mess\/members\/[^/]+$/, "সদস্য প্রোফাইল"],
  [/^\/mess\/members/, "সদস্য ও ভর্তি"],
  [/^\/mess\/billing/, "বিলিং"],
  [/^\/mess\/payments/, "পেমেন্ট"],
  [/^\/mess\/deposits/, "জামানত ও নিষ্পত্তি"],
  [/^\/mess\/expenses/, "খরচ"],
  [/^\/mess\/complaints/, "অভিযোগ ও রক্ষণাবেক্ষণ"],
  [/^\/mess\/notices/, "নোটিশ"],
  [/^\/mess\/reports/, "রিপোর্ট"],
  [/^\/mess\/settings/, "মেস সেটিংস"],
];

/** Breadcrumb trail for the current path: [group label, page title]. */
export function breadcrumbFor(user: AuthUser | null, pathname: string): { group?: string; title: string } | null {
  const groups = navGroupsFor(user);
  let best: { group: string; item: NavItem } | null = null;
  for (const g of groups) {
    for (const item of g.items) {
      const match = EXACT_ROOTS.has(item.url) ? pathname === item.url : pathname === item.url || pathname.startsWith(`${item.url}/`);
      if (match && (!best || item.url.length > best.item.url.length)) best = { group: g.label, item };
    }
  }
  const extra = EXTRA_TITLES.find(([rx]) => rx.test(pathname));
  if (extra) {
    const isMess = pathname.startsWith("/mess");
    return { group: isMess ? "মেস / হোস্টেল" : best?.group, title: extra[1] };
  }
  if (best) return { group: best.group === best.item.title ? undefined : best.group, title: best.item.title };
  if (pathname.startsWith("/mess")) return { group: "মেস / হোস্টেল", title: "মেস ড্যাশবোর্ড" };
  return null;
}
