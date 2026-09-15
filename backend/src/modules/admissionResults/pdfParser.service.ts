import { toAsciiDigits } from "../../common/utils/digits";
import { logger } from "../../logger/logger";

/**
 * Official admission-result PDF parser (Admission Result Management §3-4).
 *
 * Verified against a real BNMC (Bangladesh Nursing & Midwifery Council)
 * result PDF: a single file can legitimately contain SEVERAL programs back
 * to back (e.g. "BSc. in Nursing Admission Test : 2025-2026" for 20+ pages,
 * then "Diploma in Nursing Science & Midwifery Admission Test : 2025-2026",
 * then "Diploma in Midwifery Admission Test : 2025-2026"), each with its
 * own run of institute sections:
 *
 *   101: Dhaka Nursing College, Dhaka (100)
 *   1110217(M) 1110766(M) 1110801(M) ... (a multi-column grid, NOT one roll per line)
 *
 *   102: Rajshahi Nursing College, Rajshahi (100)
 *   ...
 *
 * so this parser never assumes "one roll per line" (it scans the whole text
 * slice between one institute heading and the next for every roll(TYPE)
 * occurrence, regardless of column layout) and never assumes "one program
 * per file" (it re-detects the current program from the text itself
 * whenever a title block naming an "Admission Test" appears, falling back
 * to the admin's own selection on the upload form only when the PDF has no
 * such title at all — e.g. the simpler single-program format some centres
 * use). Nothing here is specific to one PDF's exact wording beyond the
 * literal phrase "Admission Test", which is what every real result of this
 * kind is built around; if a future format drops that phrase entirely, the
 * detector just never fires and every row falls back to the upload form's
 * own Program/Session, which is exactly the safe degrade-to-manual behavior
 * required (§4 "parser should be modular / do not hard-code one PDF file").
 *
 * One more real-PDF quirk this parser accounts for: on the very first data
 * page, pdf-parse extracts that page's title block AFTER its institute
 * heading and roll grid rather than before (every later page has it in the
 * expected, preceding position). `flushTitleBuffer` backfills any entries
 * that were pushed before a program name was ever discovered, so this
 * ordering quirk doesn't leave the first institute section unattributed.
 */

export interface ParsedRollEntry {
  admissionRoll: string;
  instituteName: string;
  instituteCode?: string;
  seatCapacity?: number;
  selectionType: "Merit" | "Tribal";
  programName?: string; // detected from the PDF text; undefined when no title block was ever found
  sessionLabel?: string; // e.g. "2025-2026", detected alongside programName
}

export interface ParseErrorEntry {
  raw: string;
  reason: string;
}

export interface ParseResult {
  entries: ParsedRollEntry[];
  errors: ParseErrorEntry[];
  method: "text" | "ocr";
  rawTextLength: number;
}

const INSTITUTE_HEADING_RE = /^(\d{2,4}):\s*(.+?)\s*\((\d+)\)\s*$/;
const ROLL_RE = /(\d{4,10})\s*\(\s*(M|Tr)\s*\)/gi;
const ADMISSION_TEST_RE = /^(.*?)\bAdmission\s*Test\b\s*:?\s*(\d{4}\s*-\s*\d{4})?/i;

/**
 * Page furniture — repeats on every page, and a page's footer and the next
 * page's title routinely land on what pdf-parse reports as a single line of
 * text (a real observed case: "List of Selected Candidates Page 6 of 7
 * Sunday, March 1, 2026 BSc. in Nursing Admission Test : 2025-2026"), so
 * these are stripped as SUBSTRINGS rather than matched as whole-line
 * patterns — matching only whole lines would miss the boilerplate half of a
 * line like that and corrupt the program title with it.
 */
const BOILERPLATE_SUBSTRING_RES = [
  /list of selected candidates/gi,
  /according to roll number[^)]*\)/gi,
  /\(\s*m\s*:\s*merit\s*;?\s*tr\s*:\s*tribal\s*\)/gi,
  /page\s+\d+\s+of\s+\d+/gi,
  /(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*,\s*\w+\s+\d{1,2}\s*,\s*\d{4}/gi,
  /--\s*\d+\s*of\s*\d+\s*--/gi, // pdf-parse's own inter-page marker
];

/** Strips every known page-furniture phrase out of a line, wherever it appears, leaving only genuine content (which may be empty). */
function stripBoilerplate(line: string): string {
  let cleaned = line;
  for (const re of BOILERPLATE_SUBSTRING_RES) cleaned = cleaned.replace(re, " ");
  return cleaned.replace(/\s+/g, " ").trim();
}

function selectionTypeFrom(letter: string): "Merit" | "Tribal" {
  return letter.toUpperCase() === "TR" ? "Tribal" : "Merit";
}

/**
 * Walks the extracted text line by line, tracking the "current institute"
 * and "current program title" as it goes, and pulls every roll(M|Tr) out of
 * every non-heading line in between with one global regex pass per line
 * (safe for the real multi-column grid layout, since matches don't care
 * about column position). A roll line encountered before any institute
 * heading is recorded as a parse error rather than silently dropped or
 * mis-attributed (§3 "must not simply extract all numbers without
 * understanding institute sections").
 */
export function parseAdmissionResultText(rawText: string): { entries: ParsedRollEntry[]; errors: ParseErrorEntry[] } {
  const entries: ParsedRollEntry[] = [];
  const errors: ParseErrorEntry[] = [];

  let currentInstitute: { name: string; code?: string; seatCapacity?: number } | null = null;
  let currentProgramName: string | undefined;
  let currentSessionLabel: string | undefined;
  let titleBuffer: string[] = [];

  const lines = rawText.split(/\r?\n/);

  const flushTitleBuffer = () => {
    if (titleBuffer.length === 0) return;
    const joined = titleBuffer.join(" ").replace(/\s+/g, " ").trim();
    const m = ADMISSION_TEST_RE.exec(joined);
    if (m) {
      const hadNoProgramYet = currentProgramName === undefined;
      const name = m[1].trim().replace(/[:.\s]+$/, "");
      if (name) currentProgramName = name;
      if (m[2]) currentSessionLabel = m[2].replace(/\s+/g, "");
      // The very first page of a real PDF was observed to emit its title
      // block AFTER that page's institute heading and roll grid (pdf-parse
      // extracts the header/footer text following the table body on that
      // page, not preceding it, unlike every later page). Any entries
      // pushed before the program name was ever known therefore belong to
      // this same title — backfill them now rather than leaving them
      // permanently unattributed.
      if (hadNoProgramYet && currentProgramName) {
        for (const entry of entries) {
          if (entry.programName === undefined) {
            entry.programName = currentProgramName;
            if (currentSessionLabel) entry.sessionLabel = currentSessionLabel;
          }
        }
      }
    }
    titleBuffer = [];
  };

  for (const rawLine of lines) {
    const line = stripBoilerplate(rawLine);
    if (!line) continue;

    const headingMatch = INSTITUTE_HEADING_RE.exec(line);
    if (headingMatch) {
      flushTitleBuffer(); // any accumulated title text belongs to the section that's about to start
      currentInstitute = {
        code: headingMatch[1],
        name: headingMatch[2].trim(),
        seatCapacity: Number(headingMatch[3]),
      };
      continue;
    }

    ROLL_RE.lastIndex = 0;
    const rollMatches = Array.from(line.matchAll(ROLL_RE));
    if (rollMatches.length > 0) {
      flushTitleBuffer(); // a roll line means we're past any title block for this section
      if (!currentInstitute) {
        errors.push({ raw: line, reason: "Institute heading not found before this roll line" });
        continue;
      }
      for (const rm of rollMatches) {
        entries.push({
          admissionRoll: toAsciiDigits(rm[1]).trim(),
          instituteName: currentInstitute.name,
          instituteCode: currentInstitute.code,
          seatCapacity: currentInstitute.seatCapacity,
          selectionType: selectionTypeFrom(rm[2]),
          programName: currentProgramName,
          sessionLabel: currentSessionLabel,
        });
      }
      continue;
    }

    // Neither a heading nor a roll line — a candidate piece of a program
    // title block (e.g. "Diploma in Nursing Science & Midwifery" wrapped
    // onto its own line before "Admission Test : 2025-2026").
    titleBuffer.push(line);
    // A title block is never more than a couple of lines long in practice;
    // cap it so an unrelated stretch of unrecognized text can't accumulate
    // forever and get misread as a title once it happens to contain the
    // phrase "Admission Test" much later.
    if (titleBuffer.length > 6) titleBuffer.shift();
  }
  flushTitleBuffer();

  return { entries, errors };
}

/** Direct text-layer extraction — works for the overwhelming majority of official result PDFs, which are generated documents, not scans. */
async function extractTextLayer(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

/** A PDF is treated as "no usable text layer" (→ OCR) when what came back is too sparse to be real content — a scanned page's text layer is empty or near-empty, not merely short. */
function hasUsableText(text: string): boolean {
  const meaningful = text.replace(/\s+/g, "").length;
  return meaningful > 200;
}

/**
 * Renders each page to a PNG (via pdf-parse's own getScreenshot — pure npm,
 * no system binary required) and runs Tesseract OCR over each image,
 * concatenating the results in page order.
 *
 * Requires the `eng` Tesseract trained-data file to be reachable — by
 * default tesseract.js fetches it from a CDN on first use. In a
 * network-restricted deployment this fetch will fail; set `TESSDATA_PATH`
 * to a local directory containing `eng.traineddata` (downloadable once from
 * the tesseract-ocr/tessdata_fast project) to run fully offline. This is a
 * real, working code path — not a stub — but it does depend on one of
 * those two things being true in production, exactly like any OCR feature.
 */
async function extractTextViaOcr(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const Tesseract = await import("tesseract.js");
  const parser = new PDFParse({ data: buffer });
  try {
    const shot = await parser.getScreenshot({ scale: 2 });
    const langPath = process.env.TESSDATA_PATH;
    const worker = await Tesseract.createWorker("eng", undefined, langPath ? { langPath, cachePath: langPath } : undefined);
    try {
      const pageTexts: string[] = [];
      for (const page of shot.pages) {
        if (!page.data) continue;
        const { data } = await worker.recognize(Buffer.from(page.data));
        pageTexts.push(data.text || "");
      }
      return pageTexts.join("\n-- page break --\n");
    } finally {
      await worker.terminate();
    }
  } finally {
    await parser.destroy();
  }
}

export async function parseAdmissionResultPdf(buffer: Buffer): Promise<ParseResult> {
  let method: "text" | "ocr" = "text";
  let text = "";
  try {
    text = await extractTextLayer(buffer);
  } catch (err) {
    logger.warn({ err }, "PDF text-layer extraction failed, falling back to OCR");
  }

  if (!hasUsableText(text)) {
    method = "ocr";
    text = await extractTextViaOcr(buffer);
  }

  const { entries, errors } = parseAdmissionResultText(text);
  return { entries, errors, method, rawTextLength: text.length };
}
