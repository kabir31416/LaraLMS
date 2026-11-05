import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { AdmitMeta, CardInstitution, CardSettings, CardStudent, ExamSchedule } from "@/types/cards";
import { EXAM_TYPE_LABEL, formatDateBn, formatDuration, formatTime12 } from "@/types/cards";

/**
 * Student ID Card (CR80, 85.60 × 53.98 mm, landscape or portrait, front +
 * optional back) and Admit Card (A4, full or half page). These components are
 * used BOTH for the on-screen live preview and — through renderToStaticMarkup —
 * for the print window, so what is previewed is exactly what prints. All
 * sizes are physical units (mm/pt); React escapes every value.
 *
 * Identity fields: "স্টুডেন্ট আইডি" is the permanent system Student ID
 * (student.studentId = Student.registrationId); "রেজিস্ট্রেশন নম্বর" is the
 * academic registration number (student.registrationNumber). Never swapped.
 */

// ---------------------------------------------------------------- colour helpers

function hexToRgb(hex: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "1e3a8a";
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(hex: string, to: [number, number, number], ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  const m = (a: number, z: number) => Math.round(a + (z - a) * ratio);
  return `rgb(${m(r, to[0])}, ${m(g, to[1])}, ${m(b, to[2])})`;
}
/** CSS variables for the brand colour — set on each card root. */
export function brandVars(primary: string): CSSProperties {
  return {
    ["--p" as string]: primary,
    ["--p-dark" as string]: mix(primary, [0, 0, 0], 0.35),
    ["--p-soft" as string]: mix(primary, [255, 255, 255], 0.88),
    ["--p-tint" as string]: mix(primary, [255, 255, 255], 0.94),
    ["--p-line" as string]: mix(primary, [255, 255, 255], 0.7),
  };
}

// ---------------------------------------------------------------- shared CSS (preview + print)

export const CARD_CSS = `
.lc-id,.lc-id *,.lc-admit,.lc-admit *{box-sizing:border-box}
.lc-id{position:relative;overflow:hidden;background:#fff;color:#0f172a;font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif;border-radius:3mm;line-height:1.25;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lc-id.land{width:85.6mm;height:53.98mm}
.lc-id.port{width:53.98mm;height:85.6mm}
.lc-id .band{background:linear-gradient(135deg,var(--p) 0%,var(--p-dark) 100%);color:#fff;display:flex;align-items:center;gap:2mm;padding:0 3mm}
.lc-id.land .band{height:12.5mm}
.lc-id.port .band{height:17mm;flex-direction:column;justify-content:center;gap:.6mm;text-align:center;padding:0 2.5mm}
.lc-id .logo{width:8.6mm;height:8.6mm;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;box-shadow:0 0 0 .35mm rgba(255,255,255,.35)}
.lc-id.port .logo{width:7.4mm;height:7.4mm}
.lc-id .logo img{width:86%;height:86%;object-fit:contain}
.lc-id .logo b{color:var(--p);font-size:9pt}
.lc-id .inst{min-width:0}
.lc-id .inst .n{font-weight:700;font-size:8.6pt;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lc-id.port .inst .n{font-size:7.6pt;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lc-id .inst .t{font-size:5.2pt;letter-spacing:.35mm;text-transform:uppercase;opacity:.9;font-weight:600}
.lc-id .wm{position:absolute;right:-6mm;bottom:-8mm;width:30mm;height:30mm;border-radius:50%;background:var(--p-tint);z-index:0}
.lc-id .body{position:relative;z-index:1;display:flex;gap:3mm;padding:2.6mm 3mm 0}
.lc-id.port .body{flex-direction:column;align-items:center;gap:1.6mm;padding-top:2.4mm}
.lc-id .photo{width:19mm;height:23.5mm;border-radius:1.6mm;border:.45mm solid var(--p);background:var(--p-soft);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--p);font-size:14pt;font-weight:700}
.lc-id.port .photo{width:20mm;height:24mm}
.lc-id .photo img{width:100%;height:100%;object-fit:cover}
.lc-id .info{min-width:0;flex:1}
.lc-id.port .info{width:100%;text-align:center}
.lc-id .name{font-size:9pt;font-weight:700;color:var(--p-dark);line-height:1.15;margin-bottom:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lc-id.port .name{white-space:normal;font-size:8.6pt}
.lc-id .rows{display:grid;grid-template-columns:auto 1fr;column-gap:1.6mm;row-gap:.25mm;font-size:6.3pt}
.lc-id.port .rows{text-align:left;padding:0 1mm}
.lc-id .rows dt{color:#64748b;white-space:nowrap}
.lc-id .rows dd{margin:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lc-id .rows dd.mono{font-variant-numeric:tabular-nums;letter-spacing:.1mm}
.lc-id .blood{display:inline-block;padding:0 1mm;border-radius:.8mm;background:#fee2e2;color:#b91c1c;font-weight:700}
.lc-id .foot{position:absolute;left:0;right:0;bottom:0;height:5.4mm;background:var(--p-soft);border-top:.35mm solid var(--p-line);display:flex;align-items:center;justify-content:space-between;padding:0 3mm;font-size:5.6pt;color:var(--p-dark);z-index:1}
.lc-id .foot b{font-weight:700}
.lc-id .qr-mini{position:absolute;right:2.4mm;bottom:6.4mm;width:11mm;height:11mm;background:#fff;padding:.5mm;border-radius:.8mm;z-index:2}
.lc-id .qr-mini svg,.lc-id .qr svg,.lc-admit .qr svg{width:100%;height:100%;display:block}
.lc-id .back{position:relative;z-index:1;padding:2.6mm 3mm 0;font-size:5.8pt;color:#334155;display:flex;gap:2.6mm;height:calc(100% - 5.4mm)}
.lc-id.port .back{flex-direction:column;gap:1.6mm}
.lc-id .back .col{flex:1;min-width:0;display:flex;flex-direction:column;gap:1.1mm}
.lc-id .back h4{margin:0;font-size:6.4pt;color:var(--p-dark);font-weight:700}
.lc-id .back ol{margin:0;padding-left:3mm}
.lc-id .back li{margin:0 0 .2mm}
.lc-id .back .ret{border:.3mm dashed var(--p-line);border-radius:1.2mm;padding:1mm 1.4mm;background:var(--p-tint)}
.lc-id .back .side{width:20mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;gap:1mm}
.lc-id.port .back .side{width:100%;flex-direction:row;align-items:flex-end}
.lc-id .qr{width:17mm;height:17mm;background:#fff;padding:.6mm;border:.3mm solid var(--p-line);border-radius:1mm}
.lc-id .qr-cap{font-size:4.8pt;color:#64748b}
.lc-id .sig{width:100%;border-top:.3mm solid #94a3b8;padding-top:.4mm;font-size:5.2pt;color:#475569;text-align:center}
.lc-id.port .sig{width:24mm}
.lc-id .preview-tag,.lc-admit .preview-tag{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);font-size:15pt;font-weight:800;color:rgba(185,28,28,.18);letter-spacing:1mm;z-index:5;pointer-events:none;white-space:nowrap}

.lc-admit{position:relative;background:#fff;color:#0f172a;font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif;width:186mm;min-height:270mm;padding:7mm 8mm;border:.5mm solid var(--p);border-radius:2mm;display:flex;flex-direction:column;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:10pt;line-height:1.4;overflow:hidden}
.lc-admit.half{min-height:0;height:133mm;padding:4.5mm 6mm;font-size:8.6pt}
.lc-admit .hd{display:flex;align-items:center;gap:4mm;padding-bottom:3mm;border-bottom:.6mm solid var(--p)}
.lc-admit.half .hd{padding-bottom:2mm;gap:3mm}
.lc-admit .hd .logo{width:18mm;height:18mm;object-fit:contain}
.lc-admit.half .hd .logo{width:12mm;height:12mm}
.lc-admit .hd .inst{flex:1;min-width:0}
.lc-admit .hd .inst .n{font-size:17pt;font-weight:700;color:var(--p-dark);line-height:1.15}
.lc-admit.half .hd .inst .n{font-size:12.5pt}
.lc-admit .hd .inst .m{font-size:8.6pt;color:#475569}
.lc-admit.half .hd .inst .m{font-size:7.4pt}
.lc-admit .qr{width:22mm;height:22mm;flex-shrink:0;text-align:center}
.lc-admit.half .qr{width:16mm;height:16mm}
.lc-admit .qr-cap{font-size:6.2pt;color:#64748b;text-align:center;margin-top:.5mm}
.lc-admit .title{margin:4mm 0 3mm;display:flex;align-items:center;justify-content:space-between;gap:4mm;background:linear-gradient(135deg,var(--p) 0%,var(--p-dark) 100%);color:#fff;border-radius:1.6mm;padding:2.4mm 4mm}
.lc-admit.half .title{margin:2.4mm 0 2mm;padding:1.6mm 3mm}
.lc-admit .title h1{margin:0;font-size:16pt;letter-spacing:1.2mm;font-weight:800;line-height:1.1}
.lc-admit.half .title h1{font-size:12pt}
.lc-admit .title h1 small{display:block;font-size:9pt;letter-spacing:0;font-weight:600;opacity:.9}
.lc-admit.half .title h1 small{font-size:7.6pt}
.lc-admit .title .no{text-align:right;font-size:8.4pt;opacity:.95}
.lc-admit .title .no b{display:block;font-size:11pt;letter-spacing:.3mm;font-variant-numeric:tabular-nums}
.lc-admit.half .title .no b{font-size:9pt}
.lc-admit .exam-name{font-size:13.5pt;font-weight:700;color:var(--p-dark);margin:0 0 3mm;display:flex;flex-wrap:wrap;align-items:center;gap:2mm}
.lc-admit.half .exam-name{font-size:10.5pt;margin-bottom:1.6mm}
.lc-admit .chip{font-size:8pt;font-weight:600;background:var(--p-soft);color:var(--p-dark);border-radius:5mm;padding:.3mm 2.4mm}
.lc-admit .grid{display:flex;gap:5mm;align-items:flex-start}
.lc-admit.half .grid{gap:3.5mm}
.lc-admit table{border-collapse:collapse;width:100%}
.lc-admit td{border:.3mm solid #cbd5e1;padding:1.6mm 2.4mm;vertical-align:top}
.lc-admit.half td{padding:.8mm 1.8mm}
.lc-admit td.k{width:36mm;background:var(--p-tint);color:#334155;font-weight:600;white-space:nowrap}
.lc-admit.half td.k{width:30mm}
.lc-admit td.v{font-weight:600}
.lc-admit td.v.mono{font-variant-numeric:tabular-nums;letter-spacing:.2mm}
.lc-admit .photo{width:32mm;height:40mm;border:.5mm solid var(--p);border-radius:1.2mm;overflow:hidden;background:var(--p-tint);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--p);font-size:22pt;font-weight:700}
.lc-admit.half .photo{width:24mm;height:30mm;font-size:16pt}
.lc-admit .photo img{width:100%;height:100%;object-fit:cover}
.lc-admit h3{font-size:10.5pt;color:var(--p-dark);margin:4mm 0 1.6mm;display:flex;align-items:center;gap:1.6mm}
.lc-admit.half h3{font-size:8.8pt;margin:2mm 0 1mm}
.lc-admit h3:before{content:"";width:1.2mm;height:4mm;border-radius:.6mm;background:var(--p)}
.lc-admit .ex{display:grid;grid-template-columns:repeat(4,1fr);border:.3mm solid #cbd5e1;border-radius:1.2mm;overflow:hidden}
.lc-admit .ex div{padding:1.8mm 2.4mm;border-right:.3mm solid #e2e8f0;border-bottom:.3mm solid #e2e8f0}
.lc-admit.half .ex div{padding:1mm 1.8mm}
.lc-admit .ex span{display:block;font-size:7.6pt;color:#64748b}
.lc-admit.half .ex span{font-size:6.6pt}
.lc-admit .ex b{font-size:10pt}
.lc-admit.half .ex b{font-size:8.4pt}
.lc-admit .ex .wide{grid-column:span 2}
.lc-admit .ins{border:.3mm solid var(--p-line);background:var(--p-tint);border-radius:1.2mm;padding:2mm 3mm 2mm 7mm;margin:0;font-size:9pt}
.lc-admit.half .ins{font-size:7.4pt;padding:1mm 2mm 1mm 5.5mm}
.lc-admit .ins li{margin:.4mm 0}
.lc-admit .sigs{margin-top:auto;padding-top:12mm;display:flex;justify-content:space-between;align-items:flex-end;gap:6mm}
.lc-admit.half .sigs{padding-top:6mm}
.lc-admit .sigs .s{flex:1;text-align:center;border-top:.35mm solid #64748b;padding-top:1mm;font-size:8.6pt;color:#334155}
.lc-admit.half .sigs .s{font-size:7.4pt}
.lc-admit .seal{width:24mm;height:24mm;border:.35mm dashed #94a3b8;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7.6pt;color:#94a3b8;flex-shrink:0}
.lc-admit.half .seal{width:16mm;height:16mm;font-size:6.4pt}
.lc-admit .ft{margin-top:3mm;padding-top:1.6mm;border-top:.3mm solid #e2e8f0;display:flex;justify-content:space-between;gap:4mm;font-size:7.4pt;color:#64748b}
.lc-admit.half .ft{margin-top:1.6mm;font-size:6.4pt}
.lc-admit .preview-tag{font-size:40pt}
`;

// ---------------------------------------------------------------- ID card

export interface IdCardProps {
  student: CardStudent;
  institution: CardInstitution;
  settings: CardSettings;
  validUntil?: string | null;
  qrSvg?: string | null;
  /** Unissued card shown as a preview (watermarked). */
  preview?: boolean;
  version?: number;
}

const initial = (name: string) => name.trim().charAt(0) || "?";

function Logo({ institution }: { institution: CardInstitution }) {
  return <div className="logo">{institution.showLogo && institution.logoUrl ? <img src={institution.logoUrl} alt="" /> : <b>{initial(institution.shortName || institution.name)}</b>}</div>;
}

function validityText(settings: CardSettings, student: CardStudent, validUntil?: string | null): ReactNode {
  if (settings.validityMode === "none") return student.session ? <>সেশন: <b>{student.session}</b></> : null;
  if (validUntil) return <>মেয়াদ: <b>{formatDateBn(validUntil)}</b> পর্যন্ত</>;
  return student.session ? <>সেশন: <b>{student.session}</b></> : null;
}

export function IdCardFront({ student, institution, settings, validUntil, qrSvg, preview }: IdCardProps) {
  const land = settings.idCardLayout !== "portrait";
  const rows: [string, string | null, string?][] = [
    ["স্টুডেন্ট আইডি", student.studentId, "mono"],
    ["রেজি. নম্বর", student.registrationNumber, "mono"],
    ["কোর্স", student.course],
    ["ব্যাচ", student.batch],
    ["মোবাইল", student.phone, "mono"],
  ];
  const showMiniQr = !!qrSvg && !settings.idCardShowBack;
  return (
    <div className={`lc-id ${land ? "land" : "port"}`} style={brandVars(settings.primaryColor)} data-card="id-front">
      <div className="band">
        <Logo institution={institution} />
        <div className="inst">
          <div className="n">{institution.name}</div>
          <div className="t">Student ID Card · পরিচয়পত্র</div>
        </div>
      </div>
      <div className="wm" aria-hidden />
      <div className="body">
        <div className="photo">{student.photo ? <img src={student.photo} alt="" /> : initial(student.name)}</div>
        <div className="info">
          <div className="name">{student.name}</div>
          <dl className="rows">
            {rows.filter(([, v]) => v).map(([k, v, cls]) => (
              <FragmentRow key={k} k={k} v={v!} cls={cls} />
            ))}
            {student.bloodGroup && <FragmentRow k="রক্তের গ্রুপ" v={<span className="blood">{student.bloodGroup}</span>} />}
          </dl>
        </div>
      </div>
      {showMiniQr && <div className="qr-mini" dangerouslySetInnerHTML={{ __html: qrSvg! }} />}
      <div className="foot">
        <span>{validityText(settings, student, validUntil)}</span>
        <span>{institution.phone ? <>☎ {institution.phone}</> : institution.website}</span>
      </div>
      {preview && <div className="preview-tag">PREVIEW</div>}
    </div>
  );
}

function FragmentRow({ k, v, cls }: { k: string; v: ReactNode; cls?: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className={cls}>{v}</dd>
    </>
  );
}

export function IdCardBack({ student, institution, settings, qrSvg, preview }: IdCardProps) {
  const land = settings.idCardLayout !== "portrait";
  const rules = settings.idCardRules.split("\n").map((r) => r.trim()).filter(Boolean).slice(0, land ? 4 : 5);
  const contact = [institution.phone && `☎ ${institution.phone}`, institution.email, institution.website].filter(Boolean) as string[];
  return (
    <div className={`lc-id ${land ? "land" : "port"}`} style={brandVars(settings.primaryColor)} data-card="id-back">
      <div className="back">
        <div className="col">
          <div className="ret">
            <h4>কার্ডটি পাওয়া গেলে ফেরত দিন</h4>
            <div>{institution.name}</div>
            {institution.address && <div>{institution.address}</div>}
            {contact.length > 0 && <div>{contact.join(" · ")}</div>}
          </div>
          {rules.length > 0 && (
            <div>
              <h4>নিয়মাবলি</h4>
              <ol>{rules.map((r) => <li key={r}>{r}</li>)}</ol>
            </div>
          )}
          {settings.idCardShowEmergencyContact && student.emergencyContact && (
            <div><h4 style={{ display: "inline" }}>জরুরি যোগাযোগ: </h4><b>{student.emergencyContact}</b></div>
          )}
        </div>
        <div className="side">
          {qrSvg ? (
            <div>
              <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <div className="qr-cap">যাচাই করতে স্ক্যান করুন</div>
            </div>
          ) : <div />}
          <div className="sig">{institution.signatureLabel}</div>
        </div>
      </div>
      <div className="foot">
        <span>স্টুডেন্ট আইডি: <b>{student.studentId}</b></span>
        <span>{institution.shortName || ""}</span>
      </div>
      {preview && <div className="preview-tag">PREVIEW</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Admit card

export interface AdmitCardProps {
  exam: ExamSchedule;
  student: CardStudent;
  institution: CardInstitution;
  settings: CardSettings;
  admit: AdmitMeta | null;
  qrSvg?: string | null;
  half?: boolean;
}

export function AdmitCard({ exam, student, institution, settings, admit, qrSvg, half }: AdmitCardProps) {
  const studentRows: [string, string | null, boolean?][] = [
    ["শিক্ষার্থীর নাম", student.name],
    ["স্টুডেন্ট আইডি", student.studentId, true],
    ["রেজিস্ট্রেশন নম্বর", student.registrationNumber, true],
    ["কোর্স", student.course],
    ["ব্যাচ", student.batch],
  ];
  const examCells: [string, string | null, boolean?][] = [
    ["তারিখ", formatDateBn(exam.date, true), true],
    ["শুরুর সময়", formatTime12(exam.startTime) || null],
    ["শেষের সময়", formatTime12(exam.endTime) || null],
    ["সময়কাল", formatDuration(exam.durationMinutes) || null],
    ["কেন্দ্র / কক্ষ", exam.venue, true],
    ["বিষয়", exam.subject?.name ?? null],
    ["সেশন", exam.session?.name ?? null],
  ];
  const instructions = (exam.instructions ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const meta = [institution.address, institution.phone && `ফোন: ${institution.phone}`, institution.email, institution.website].filter(Boolean).join(" · ");
  const isPreview = !admit || (exam.status !== "published" && exam.status !== "completed");
  return (
    <div className={`lc-admit${half ? " half" : ""}`} style={brandVars(settings.primaryColor)} data-card="admit">
      <div className="hd">
        {institution.showLogo && institution.logoUrl && <img className="logo" src={institution.logoUrl} alt="" />}
        <div className="inst">
          <div className="n">{institution.name}</div>
          {meta && <div className="m">{meta}</div>}
        </div>
        {qrSvg && (
          <div>
            <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div className="qr-cap">যাচাই করুন</div>
          </div>
        )}
      </div>
      <div className="title">
        <h1>ADMIT CARD<small>প্রবেশপত্র</small></h1>
        <div className="no">অ্যাডমিট কার্ড নম্বর<b>{admit?.cardNo ?? "—"}</b></div>
      </div>
      <div className="exam-name">{exam.name}<span className="chip">{EXAM_TYPE_LABEL[exam.examType]}</span></div>
      <div className="grid">
        <table>
          <tbody>
            {studentRows.filter(([, v]) => v).map(([k, v, mono]) => (
              <tr key={k}><td className="k">{k}</td><td className={`v${mono ? " mono" : ""}`}>{v}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="photo">{student.photo ? <img src={student.photo} alt="" /> : initial(student.name)}</div>
      </div>
      <h3>পরীক্ষার তথ্য</h3>
      <div className="ex">
        {examCells.filter(([, v]) => v).map(([k, v, wide]) => (
          <div key={k} className={wide ? "wide" : undefined}><span>{k}</span><b>{v}</b></div>
        ))}
      </div>
      {instructions.length > 0 && (
        <>
          <h3>পরীক্ষার্থীদের জন্য নির্দেশনা</h3>
          <ol className="ins">{instructions.slice(0, half ? 4 : 10).map((l, i) => <li key={i}>{l}</li>)}</ol>
        </>
      )}
      <div className="sigs">
        <div className="s">পরীক্ষার্থীর স্বাক্ষর</div>
        <div className="seal">সিল</div>
        <div className="s">{institution.signatureLabel}<br />(অনুমোদিত স্বাক্ষর)</div>
      </div>
      <div className="ft">
        <span>এই প্রবেশপত্র ছাড়া পরীক্ষায় অংশগ্রহণ করা যাবে না।</span>
        <span>{admit ? `ইস্যু: ${formatDateBn(admit.generatedAt.slice(0, 10))}` : "প্রিভিউ — এখনো ইস্যু হয়নি"}</span>
      </div>
      {isPreview && <div className="preview-tag">{exam.status === "draft" ? "খসড়া · PREVIEW" : "PREVIEW"}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- on-screen preview wrapper

const MM = 96 / 25.4;

/**
 * Shows a card at physical size, shrunk (never enlarged beyond `maxScale`) to
 * fit its container — CSS zoom, so the layout height shrinks with it.
 */
export function FitCard({ children, widthMm, maxScale = 1.6, className }: { children: ReactNode; widthMm: number; maxScale?: number; className?: string }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!box) return;
    const update = () => setScale(Math.min(maxScale, Math.max(0.2, box.clientWidth / (widthMm * MM))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, [box, widthMm, maxScale]);
  return (
    <div ref={setBox} className={className} style={{ width: "100%" }}>
      <style>{CARD_CSS}</style>
      <div style={{ zoom: scale, width: `${widthMm}mm`, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
