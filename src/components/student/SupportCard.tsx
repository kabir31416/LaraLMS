import { Code2, LifeBuoy } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Developer / technical-support credit shown at the very bottom of the
 * Student Profile. The details are fixed in code on purpose: they are not
 * stored on the student record or in settings, so no student can edit them.
 */
const SUPPORT = {
  name: "Sahariar Kabir",
  designation: "Software Engineer",
  whatsappDisplay: "01999667701",
  whatsappUrl: "https://wa.me/8801999667701",
} as const;

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.99 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.44-9.44 9.44m8.04-17.48A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.3l5.7-1.5a11.3 11.3 0 0 0 5.76 1.47h.01c6.26 0 11.36-5.1 11.37-11.36 0-3.04-1.18-5.89-3.33-8.04" />
    </svg>
  );
}

export function SupportCard() {
  return (
    <Card role="region" className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.04] via-card to-card" aria-labelledby="support-card-title">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LifeBuoy className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <h2 id="support-card-title" className="text-base font-semibold">Need Help or Technical Support?</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">কারিগরি সহায়তা বা সিস্টেম-সংক্রান্ত যেকোনো সমস্যায় যোগাযোগ করুন — For technical assistance or system-related support, contact:</p>
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_auto_auto] sm:justify-start">
              <div className="flex items-center gap-1.5"><Code2 className="h-3.5 w-3.5 text-primary" aria-hidden /><dt className="sr-only">Developer</dt><dd className="font-semibold">{SUPPORT.name}</dd></div>
              <div><dt className="sr-only">Designation</dt><dd className="text-muted-foreground">{SUPPORT.designation}</dd></div>
              <div className="flex items-center gap-1.5"><dt className="text-muted-foreground">WhatsApp:</dt><dd className="font-medium tabular-nums">{SUPPORT.whatsappDisplay}</dd></div>
            </dl>
          </div>
        </div>
        <a
          href={SUPPORT.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0E7C3A] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0B6A31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`WhatsApp-এ ${SUPPORT.name}-এর সাথে যোগাযোগ করুন (${SUPPORT.whatsappDisplay})`}
        >
          <WhatsAppIcon className="h-4 w-4" />WhatsApp-এ যোগাযোগ
        </a>
      </div>
    </Card>
  );
}
