// ===== 17-report-generator.js =====
// ============================================================================
// CUSTOM REPORT GENERATOR — assembles the official lab report (matching the
// DPHE Zonal Lab "Physical/Chemical/Bacteriological Analysis of Water Sample"
// format) from already-registered Samples and their Test Records. Per-sample
// facts (address, caretaker, source) and lab identity (letterhead) are pulled
// automatically; only the per-report memo/reference fields and signatories
// are entered here, since those change with every memo.
// ============================================================================

function fmtResultValue(v) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

// The report is rendered into a fresh popup window (window.open("") +
// document.write) whose base URL is about:blank, not this site — so a
// relative logo path like "assets/logo_left.png" silently fails to load
// there (the onerror handler below then hides it). Resolve relative paths
// to an absolute URL against *this* document first; data URLs and
// already-absolute URLs pass through the URL constructor unchanged.
function resolveLogoUrl(src) {
  if (!src) return src;
  try {
    return new URL(src, document.baseURI).href;
  } catch (e) {
    return src;
  }
}

// Bengali-style list join: "A" / "A ও B" / "A, B এবং C" — the connector
// used throughout the forwarding letter's body sentence.
function bnJoinList(items) {
  const list = (items || []).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} এবং ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} এবং ${list[list.length - 1]}`;
}

// ============================================================================
// FORWARDING-LETTER-ONLY EN→BN TEXT CONVERSION — Lab Identity (letterhead)
// and the report's signatory designation are typically set up once, in
// English, via the Lab Identity Settings modal (getLabIdentity(),
// 01-data-service.js), and are reused as-is (in English) on the results
// table page, printed labels, etc. — that stays exactly as before. The
// Bengali Forwarding Letter cover page is the one place these need to read
// in Bengali, so this is a dictionary-based, best-effort EN→BN pass applied
// ONLY to the strings handed into buildForwardingLetterPageHtml() below —
// it does not touch labIdentity/getLabIdentity() itself, so every other
// report/page that reads the same settings is completely unaffected.
//
// This is NOT a general-purpose translator (no translation service is
// available/permitted here) — it's a lookup table of the standard DPHE
// organizational lines, common lab designations, administrative terms, and
// the 64 district names, matched whole-phrase first and then word-by-word.
// Anything not in the table (e.g. a street address, a person's name) is
// left exactly as typed — which is fine; an already-Bengali string is
// detected and passed through untouched too, so this is safe to apply even
// if the person has already typed some fields in Bengali.
// ============================================================================
const BN_ORG_PHRASE_MAP = {
  "government of the people's republic of bangladesh": "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার",
  "government of the peoples republic of bangladesh": "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার",
  "government of people's republic of bangladesh": "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার",
  "government of peoples republic of bangladesh": "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার",
  "peoples republic of bangladesh": "গণপ্রজাতন্ত্রী বাংলাদেশ",
  "government": "সরকার",
  "office of the senior chemist": "সিনিয়র কেমিস্টের কার্যালয়",
  "department of public health engineering (dphe)": "জনস্বাস্থ্য প্রকৌশল অধিদপ্তর (ডিপিএইচই)",
  "department of public health engineering": "জনস্বাস্থ্য প্রকৌশল অধিদপ্তর",
  "public health engineering": "জনস্বাস্থ্য প্রকৌশল",
  "zonal laboratory": "আঞ্চলিক পানি পরীক্ষাগার",
  "zonal lab": "আঞ্চলিক পানি পরীক্ষাগার",
  "water quality laboratory": "পানি গুণগত মান পরীক্ষাগার",
  "water quality testing laboratory": "পানি গুণগত মান পরীক্ষাগার",
  "senior chemist": "সিনিয়র কেমিস্ট",
  "assistant chemist": "সহকারী কেমিস্ট",
  "chief chemist": "প্রধান কেমিস্ট",
  "deputy chief chemist": "উপ-প্রধান কেমিস্ট",
  "chemist": "কেমিস্ট",
  "laboratory in-charge": "গবেষণাগার ইনচার্জ",
  "lab in-charge": "গবেষণাগার ইনচার্জ",
  "in-charge": "ইনচার্জ",
  "executive engineer": "নির্বাহী প্রকৌশলী",
  "superintending engineer": "তত্ত্বাবধায়ক প্রকৌশলী",
  "sub-divisional engineer": "উপ-বিভাগীয় প্রকৌশলী",
  "sub divisional engineer": "উপ-বিভাগীয় প্রকৌশলী",
  "assistant engineer": "সহকারী প্রকৌশলী",
  "sub-division": "উপ-বিভাগ",
  "division": "বিভাগ",
  "district": "জেলা",
  "upazila": "উপজেলা",
  "phone": "ফোন",
  "email": "ইমেইল",
  "dphe": "ডিপিএইচই"
};
// Bangladesh's 64 districts — commonly the last word(s) of a Lab Name /
// address field ("...Rangpur." / "Cox's Bazar Zonal Lab").
const BN_DISTRICT_MAP = {
  "bagerhat": "বাগেরহাট", "bandarban": "বান্দরবান", "barguna": "বরগুনা",
  "barishal": "বরিশাল", "barisal": "বরিশাল", "bhola": "ভোলা",
  "bogura": "বগুড়া", "bogra": "বগুড়া", "brahmanbaria": "ব্রাহ্মণবাড়িয়া",
  "chandpur": "চাঁদপুর", "chattogram": "চট্টগ্রাম", "chittagong": "চট্টগ্রাম",
  "chuadanga": "চুয়াডাঙ্গা", "cox's bazar": "কক্সবাজার", "coxs bazar": "কক্সবাজার",
  "cumilla": "কুমিল্লা", "comilla": "কুমিল্লা", "dhaka": "ঢাকা",
  "dinajpur": "দিনাজপুর", "faridpur": "ফরিদপুর", "feni": "ফেনী",
  "gaibandha": "গাইবান্ধা", "gazipur": "গাজীপুর", "gopalganj": "গোপালগঞ্জ",
  "habiganj": "হবিগঞ্জ", "jamalpur": "জামালপুর", "jashore": "যশোর",
  "jessore": "যশোর", "jhalokati": "ঝালকাঠি", "jhenaidah": "ঝিনাইদহ",
  "joypurhat": "জয়পুরহাট", "khagrachhari": "খাগড়াছড়ি", "khulna": "খুলনা",
  "kishoreganj": "কিশোরগঞ্জ", "kurigram": "কুড়িগ্রাম", "kushtia": "কুষ্টিয়া",
  "lakshmipur": "লক্ষ্মীপুর", "lalmonirhat": "লালমনিরহাট", "madaripur": "মাদারীপুর",
  "magura": "মাগুরা", "manikganj": "মানিকগঞ্জ", "meherpur": "মেহেরপুর",
  "moulvibazar": "মৌলভীবাজার", "munshiganj": "মুন্সিগঞ্জ", "mymensingh": "ময়মনসিংহ",
  "naogaon": "নওগাঁ", "narail": "নড়াইল", "narayanganj": "নারায়ণগঞ্জ",
  "narsingdi": "নরসিংদী", "natore": "নাটোর", "netrokona": "নেত্রকোণা",
  "nilphamari": "নীলফামারী", "noakhali": "নোয়াখালী", "pabna": "পাবনা",
  "panchagarh": "পঞ্চগড়", "patuakhali": "পটুয়াখালী", "pirojpur": "পিরোজপুর",
  "rajbari": "রাজবাড়ী", "rajshahi": "রাজশাহী", "rangamati": "রাঙামাটি",
  "rangpur": "রংপুর", "satkhira": "সাতক্ষীরা", "shariatpur": "শরীয়তপুর",
  "sherpur": "শেরপুর", "sirajganj": "সিরাজগঞ্জ", "sunamganj": "সুনামগঞ্জ",
  "sylhet": "সিলেট", "tangail": "টাঙ্গাইল", "thakurgaon": "ঠাকুরগাঁও"
};
// Longest-phrase-first, so "senior chemist" wins over a stray "chemist"
// entry, and "cox's bazar" wins over nothing else colliding with it.
const BN_ALL_PHRASES = Object.assign({}, BN_ORG_PHRASE_MAP, BN_DISTRICT_MAP);
const BN_PHRASE_KEYS_BY_LENGTH = Object.keys(BN_ALL_PHRASES).sort((a, b) => b.length - a.length);
function hasBengaliText(s) {
  return /[\u0980-\u09FF]/.test(s || "");
}
function bnifyOrgText(text) {
  const raw = (text || "").trim();
  if (!raw) return raw;
  // Already Bengali (or empty/whitespace) — leave untouched, don't risk
  // mangling something the person deliberately typed in Bengali already.
  if (hasBengaliText(raw)) return raw;
  // Whole-string exact match first (covers the standard header lines verbatim).
  const exact = BN_ALL_PHRASES[raw.toLowerCase()];
  if (exact) return exact;
  // Otherwise, phrase-by-phrase substitution over the raw text, longest
  // phrases first, case-insensitive, word-boundary matched — so partial
  // English words inside a longer unrecognized word aren't clobbered.
  // Anything not matched (addresses, personal names, etc.) passes through
  // exactly as typed.
  let out = raw;
  BN_PHRASE_KEYS_BY_LENGTH.forEach(key => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^A-Za-z'])(${escaped})($|[^A-Za-z'])`, "gi");
    out = out.replace(re, (m, pre, mid, post) => `${pre}${BN_ALL_PHRASES[key.toLowerCase()]}${post}`);
  });
  return out;
}

// ============================================================================
// FORWARDING LETTER (page 1) — the formal Bengali cover memo that precedes
// the results table, matching the lab's standard "Forwarding Lab" paper
// format. Pure function (no React) — returns an HTML *fragment* (a single
// <div class="letter-page">…</div>), not a full document, so buildReportHtml()
// below can splice it in as page 1 of the same print job/PDF ahead of the
// existing results page(s); `page-break-after` on the wrapper is what
// forces the results table onto its own page 2+.
//
// সূত্র (Reference: memo.refMemoNo/refMemoDate) is optional — a sample can
// be walk-in/self-referred with no forwarding memo from another office. If
// refMemoNo is blank, the সূত্রঃ line itself is dropped AND the opening
// clause switches from "উপর্যুক্ত বিষয় ও সূত্রের প্রেক্ষিতে" (given the
// above subject AND reference) to "উপর্যুক্ত বিষয়ের প্রেক্ষিতে" (given
// only the above subject) — কারণ তখন উল্লেখ করার মতো কোনো সূত্র নেই।
// ============================================================================
function buildForwardingLetterPageHtml({
  labIdentity,
  memo,
  sampleCount,
  exceedList,
  designation,
  recipient,
  logoLeft,
  logoRight
}) {
  const hasReference = !!(memo.refMemoNo || "").trim();
  const refPhrase = hasReference ? "উপর্যুক্ত বিষয় ও সূত্রের প্রেক্ষিতে" : "উপর্যুক্ত বিষয়ের প্রেক্ষিতে";
  const referenceLine = hasReference ? `<div class="letter-row"><span class="letter-label">সূত্রঃ</span><span>${memo.refMemoNo}${(memo.refMemoDate || "").trim() ? `, তারিখঃ ${memo.refMemoDate}` : ""}</span></div>` : "";
  const exceedSentence = exceedList.length > 0
    ? `পরীক্ষার ফলাফল পর্যালোচনায় দেখা যায় যে, ${bnJoinList(exceedList.map(e => `<b>${e.count}</b> সংখ্যক পানির নমুনায় '${e.name}' উপাদানের পরিমাণ`))} নির্ধারিত মাত্রার চেয়ে অধিক পাওয়া গেছে।`
    : `পরীক্ষার ফলাফল পর্যালোচনায় দেখা যায় যে, সকল নমুনার সকল উপাদানের পরিমাণ নির্ধারিত মাত্রার মধ্যে পাওয়া গেছে।`;
  // Header/letterhead + signatory text — bnifyOrgText() only (see its
  // comment above for exactly why/how): getLabIdentity()/labIdentity
  // itself, and every OTHER report/page that reads it, are untouched.
  const orgLine1Bn = bnifyOrgText(labIdentity.orgLine1);
  const orgLine2Bn = bnifyOrgText(labIdentity.orgLine2);
  const orgLine3Bn = bnifyOrgText(labIdentity.orgLine3);
  const labNameBn = bnifyOrgText(labIdentity.labName);
  const designationBn = bnifyOrgText(designation);
  return `<div class="letter-page">
    <table class="header-table"><tr>
      <td class="logo-cell">${logoLeft}</td>
      <td class="org-cell">
        <div class="line1">${orgLine1Bn}</div>
        <div class="line2">${orgLine2Bn}</div>
        <div class="line3">${orgLine3Bn}</div>
        <div class="lab-name">${labNameBn}</div>
        <div class="contact">${labIdentity.phone ? `ফোনঃ ${labIdentity.phone}` : ""}${labIdentity.phone && labIdentity.email ? ", " : ""}${labIdentity.email ? `ইমেইলঃ ${labIdentity.email}` : ""}</div>
      </td>
      <td class="logo-cell">${logoRight}</td>
    </tr></table>
    <div class="letter-row" style="justify-content:space-between;margin-top:18px;">
      <span><span class="letter-label">স্মারক নং-</span> ${memo.memoNo || ""}</span>
      <span><span class="letter-label">তারিখঃ</span> ${memo.date || ""}</span>
    </div>
    <div class="letter-row" style="margin-top:14px;"><span class="letter-label">বিষয়ঃ</span><span>পানি পরীক্ষার রিপোর্ট প্রদান প্রসঙ্গে।</span></div>
    ${referenceLine}
    <div class="letter-body">
      <p>${refPhrase} জানানো যাচ্ছে যে, আপনার দপ্তর কর্তৃক প্রেরিত <b>${sampleCount}</b> সংখ্যক পানির নমুনা গুণগত মান পরীক্ষা করা হয়। ${exceedSentence}</p>
      <p>এমতাবস্থায়, উক্ত পানির গুণগত মানের বিষয়টি আপনার সদয় অবগতি ও প্রয়োজনীয় ব্যবস্থা গ্রহণের জন্য অনুরোধ করা হলো।</p>
    </div>
    <div class="letter-attachment"><b>সংযুক্তিঃ</b> পানির গুণগত মান পরীক্ষার প্রতিবেদন।</div>
    <div class="letter-signature">
      <div>${designationBn}</div>
      <div>${orgLine3Bn}</div>
      <div>${labNameBn}</div>
    </div>
    <div class="letter-recipient">
      <div class="letter-recipient-label">প্রাপক</div>
      <div>${(recipient || "").split("\n").filter(l => l.trim()).join("<br>")}</div>
    </div>
  </div>`;
}

// Builds the full printable HTML document for the report. Pure function —
// no React — so it's easy to hand straight to a print window, matching the
// existing printLabel() pattern in 10-inventory-logic.js.
//
// `reportMeta` (Workflow/Data-Integrity Upgrade Step 12 — Report
// Versioning) carries { reportNo, revisionNo, status, generatedAt,
// generatedBy } — printed as a visible Report No./Revision line so two
// printouts of the same Memo No. are never mistaken for the same document,
// and `reportType` ("partial" | "final") drives both the on-page label and
// which cells are allowed to show a value at all: for EVERY report type, a
// sample/test cell whose parameter hasn't actually reached "released" is
// printed as "-", never a live-but-not-yet-final value — the difference
// between Partial and Final is only which parameters were expected to be
// complete, not whether an incomplete one can leak through.
//
// `forwardingLetter` (optional) — { sampleCount, exceedList, designation } —
// when present, prepends the Bengali forwarding-letter cover page (see
// buildForwardingLetterPageHtml above) as page 1, ahead of the existing
// results page(s), inside the SAME document/print job.
function buildReportHtml({
  labIdentity,
  memo,
  selectedSamples,
  selectedTests,
  testRecords,
  subBatches,
  signatories,
  reportType,
  reportMeta,
  isSingleSampleLayout,
  forwardingLetter
}) {
  const sorted = [...selectedSamples].sort((a, b) => a.sampleCode < b.sampleCode ? -1 : a.sampleCode > b.sampleCode ? 1 : 0);
  const firstCode = sorted[0]?.sampleCode || "";
  const lastCode = sorted[sorted.length - 1]?.sampleCode || "";
  const sampleIdLine = sorted.length > 1 ? `${firstCode} To ${lastCode}, Total: ${String(sorted.length).padStart(2, "0")}` : `${firstCode}, Total: 01`;
  const logoLeftSrc = resolveLogoUrl(labIdentity.leftLogoDataUrl || labIdentity.leftLogoUrl || "assets/logo_left.png");
  const logoRightSrc = resolveLogoUrl(labIdentity.rightLogoDataUrl || labIdentity.rightLogoUrl || "assets/logo_right.png");
  const logoLeft = logoLeftSrc ? `<img src="${logoLeftSrc}" style="height:56px" onerror="this.style.display='none'">` : "";
  const logoRight = logoRightSrc ? `<img src="${logoRightSrc}" style="height:56px" onerror="this.style.display='none'">` : "";
  const forwardingLetterHtml = forwardingLetter ? buildForwardingLetterPageHtml({
    labIdentity,
    memo,
    sampleCount: forwardingLetter.sampleCount,
    exceedList: forwardingLetter.exceedList,
    designation: forwardingLetter.designation,
    recipient: forwardingLetter.recipient,
    logoLeft,
    logoRight
  }) : "";

  let reportContentHtml = "";
  if (isSingleSampleLayout && sorted.length === 1) {
    const s = sorted[0];
    const bodyRows = selectedTests.map((t, idx) => {
      const released = (typeof testStageForSample === "function" ? testStageForSample(s, t.id, testRecords, subBatches) : null) === "released";
      const found = released ? getSampleResultForTest(s, t.id, testRecords) : null;
      let val = found ? fmtResultValue(found.results?.[0]?.value ?? (found.results?.[0]?.error ? "-" : "-")) : "-";
      if (found?.results?.[0]?.error === "LOQ") val = "&lt;LOQ";
      const method = found ? t.method || "-" : "-";
      const loq = t.reportLimit ? t.reportLimit + (t.unit ? t.unit : "") : "-";
      return `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:left;">${t.name}</td>
        <td>${t.reportLimit || "-"}</td>
        <td>${val}</td>
        <td>${t.unit || "-"}</td>
        <td>${method}</td>
        <td>${loq}</td>
      </tr>`;
    }).join("");

    reportContentHtml = `
      <div class="report-title">Physical/Chemical/Bacteriological Analysis of Water Sample</div>
      <table class="info-table">
        <tr><td style="width:50%;">Sample ID: ${s.sampleCode}</td><td style="width:50%;">Receiving Date: ${memo.receivingDate || ""}</td></tr>
        <tr><td>Ref: Memo No: ${memo.refMemoNo || ""}${memo.refMemoDate ? ` & Dated: ${memo.refMemoDate}` : ""}</td><td>Sample Source: ${memo.sampleSource || ""}</td></tr>
        <tr><td>Sent by: ${memo.sentBy || ""}</td><td>Dist: ${s.district || ""}, Upazila: ${s.upazila || ""}</td></tr>
        <tr><td>Care Taker: ${s.clientName || ""}. <strong>Location: ${s.siteLocation || ""}</strong></td><td>Union/Pourashava: ${s.union || ""}, Vill/Ward: ${s.village || ""}</td></tr>
        <tr><td>Sample Collection Date: ${memo.collectionDate || "Not Mention"}</td><td>Date of Testing: ${memo.dateOfTesting || ""}</td></tr>
      </table>
      <div class="result-title" style="text-align:center; font-weight:bold; text-decoration:underline; margin: 14px 0 10px; font-size:14px; text-transform:uppercase;">Laboratory Test Results:</div>
      <table class="result-table">
        <thead>
          <tr>
            <th>Sl. #</th>
            <th>Water quality Parameters</th>
            <th>Bangladesh<br>Standard</th>
            <th>Concentration<br>Present</th>
            <th>Unit</th>
            <th>Analysis Method</th>
            <th>LOQ</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
  } else {
    const testHeaderCells = selectedTests.map(t => `<th colspan="2">${t.name}${t.reportLimit ? ` <br><span style="font-weight:400">${t.reportLimit}</span>` : ""}</th>`).join("");
    const testSubHeaderCells = selectedTests.map(() => `<th>Conc.</th><th>Method</th>`).join("");
    const bodyRows = sorted.map(s => {
      const cells = selectedTests.map(t => {
        const released = (typeof testStageForSample === "function" ? testStageForSample(s, t.id, testRecords, subBatches) : null) === "released";
        const found = released ? getSampleResultForTest(s, t.id, testRecords) : null;
        let val = found ? fmtResultValue(found.results?.[0]?.value ?? (found.results?.[0]?.error ? "-" : "-")) : "-";
        if (found?.results?.[0]?.error === "LOQ") val = "&lt;LOQ";
        const method = found ? t.method || "-" : "-";
        return `<td>${val}</td><td>${method}</td>`;
      }).join("");
      return `<tr>
        <td>${s.sampleCode}</td>
        <td>${s.clientName || "-"}</td>
        <td>${s.village || "-"}</td>
        <td>${s.union || "-"}</td>
        <td>${s.upazila || "-"}</td>
        ${cells}
      </tr>`;
    }).join("");

    reportContentHtml = `
      <div class="report-title">Physical/Chemical/Bacteriological Analysis of Water Sample</div>
      <table class="info-table">
        <tr><td>Sample ID: ${sampleIdLine}</td><td>District: ${memo.district || ""}</td></tr>
        <tr><td>Sent by: ${memo.sentBy || ""}</td><td>Sample Source: ${memo.sampleSource || ""}</td></tr>
        <tr><td>Ref: Memo No: ${memo.refMemoNo || ""}${memo.refMemoDate ? ` & Dated: ${memo.refMemoDate}` : ""}</td><td>Date of Testing: ${memo.dateOfTesting || ""}</td></tr>
        <tr><td>Collection Date: ${memo.collectionDate || "Not Mention"}</td><td>Receiving Date: ${memo.receivingDate || ""}</td></tr>
      </table>
      <div class="result-title">LABORATORY TEST RESULT</div>
      <table class="result-table">
        <thead>
          <tr>
            <th rowspan="2">Sample ID</th>
            <th rowspan="2">Caretaker Name</th>
            <th rowspan="2">Village/Ward</th>
            <th rowspan="2">Union/<br>Pourashava</th>
            <th rowspan="2">Upazila/City<br>corporation</th>
            ${testHeaderCells}
          </tr>
          <tr>${testSubHeaderCells}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
  }

  const signBlock = side => (signatories[side] || []).map((sig, i) => `
    <div style="margin-top:${i === 0 ? "4" : "14"}px;font-size:12px;">
      ${i + 1}.) Name: ${sig.name || ""}<br>
      Designation: ${sig.designation || ""}
      <div style="height:40px;"></div>
    </div>`).join("");
  return `<!DOCTYPE html><html><head><title>${memo.memoNo || "Lab Report"}</title><style>
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; margin: 0; padding: 24px; color: #111; font-size: 13px; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .header-table td { border: 2px solid #111; padding: 6px; vertical-align: middle; }
    .header-table .logo-cell { width: 70px; text-align: center; }
    .header-table .org-cell { text-align: center; font-weight: bold; }
    .org-cell .line1, .org-cell .line2, .org-cell .line3 { margin: 1px 0; }
    .org-cell .lab-name { margin: 2px 0; }
    .org-cell .contact { font-weight: normal; font-size: 11px; margin-top: 2px; }
    .memo-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 12px; }
    .report-title { text-align: center; font-weight: bold; text-decoration: underline; margin: 14px 0 8px; font-size: 14px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
    .info-table td { border: 1px solid #111; padding: 5px 8px; }
    .result-title { text-align: center; font-weight: bold; text-decoration: underline; margin: 10px 0 6px; font-size: 13px; }
    .result-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .result-table th, .result-table td { border: 1px solid #111; padding: 4px 6px; text-align: center; }
    .result-table th { background: #f2f2f2; }
    .note { font-size: 10px; margin-top: 8px; }
    .sign-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    .sign-table td { border: 1px solid #111; padding: 8px; vertical-align: top; width: 50%; }
    .sign-table .sign-title { font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
    .letter-page { font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', 'Noto Sans Bengali', Arial, sans-serif; page-break-after: always; }
    .letter-page .header-table td { border: 2px solid #111; }
    .letter-row { display: flex; align-items: baseline; gap: 6px; font-size: 14px; }
    .letter-label { font-weight: normal; white-space: nowrap; }
    .letter-body { margin-top: 16px; font-size: 14px; line-height: 1.9; text-align: justify; }
    .letter-body p { margin: 0 0 10px; }
    .letter-attachment { margin-top: 6px; font-size: 14px; }
    .letter-signature { margin-top: 60px; margin-left: auto; width: 260px; text-align: center; font-weight: bold; font-size: 14px; line-height: 1.6; }
    .letter-recipient { margin-top: 30px; text-align: left; font-size: 14px; line-height: 1.7; max-width: 280px; }
    .letter-recipient-label { font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
    @media print { body { padding: 10px; } }
  </style></head><body>
    ${forwardingLetterHtml}
    <table class="header-table"><tr>
      <td class="logo-cell">${logoLeft}</td>
      <td class="org-cell">
        <div class="line1">${labIdentity.orgLine1 || ""}</div>
        <div class="line2">${labIdentity.orgLine2 || ""}</div>
        <div class="line3">${labIdentity.orgLine3 || ""}</div>
        <div class="lab-name">${labIdentity.labName || ""}</div>
        <div class="contact">${labIdentity.phone ? `Phone: ${labIdentity.phone}` : ""}${labIdentity.phone && labIdentity.email ? ", " : ""}${labIdentity.email ? `E-mail: ${labIdentity.email}` : ""}</div>
      </td>
      <td class="logo-cell">${logoRight}</td>
    </tr></table>
    <div class="memo-row"><span>Memo No: ${memo.memoNo || ""}</span><span>Date: ${memo.date || ""}</span></div>
    ${reportMeta ? `<div class="memo-row" style="font-size:11px;">
      <span>Report No: ${reportMeta.reportNo || ""}${reportMeta.revisionNo ? ` &nbsp;&middot;&nbsp; Revision: ${reportMeta.revisionNo}` : " &middot; Revision: 0"}</span>
      <span>Generated: ${(reportMeta.generatedAt || "").slice(0, 10)} by ${reportMeta.generatedBy || ""}</span>
    </div>` : ""}
    <div style="text-align:center;">
      <span class="report-status-banner" style="font-weight:bold;font-size:12px;letter-spacing:1px;margin:2px 0 6px;color:${reportType === "final" ? "#111" : "#8a5a00"};border:1px solid ${reportType === "final" ? "#111" : "#8a5a00"};display:inline-block;padding:2px 10px;">
        ${reportType === "final" ? (reportMeta && reportMeta.revisionNo ? "FINAL REPORT — REVISED" : "FINAL REPORT") : "PARTIAL REPORT — NOT ALL PARAMETERS FINALIZED"}
      </span>
    </div>
    ${reportContentHtml}
    ${memo.notes ? `<div class="note">Note: ${memo.notes}</div>` : ""}
    <table class="sign-table"><tr>
      <td><div class="sign-title">Test Performed by: <span style="float:right;text-decoration:underline;">Signature</span></div>${signBlock("performedBy")}</td>
      <td><div class="sign-title">Countersigned/Approved by: <span style="float:right;text-decoration:underline;">Signature</span></div>${signBlock("approvedBy")}</td>
    </tr></table>
    <script>window.print();</script>
  </body></html>`;
}
// Opens the print popup immediately (synchronously, inside the click
// handler) so browsers don't treat it as an unrequested popup and block it —
// that only happens for window.open() calls made *after* an `await`. A tiny
// placeholder is written in the meantime, then swapped out for the real
// report by finishReportPrintWindow() once it's ready (e.g. once logos have
// been fetched — see resolveLabIdentityLogos() below).
function openReportPrintWindow() {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return null;
  w.document.write("<!DOCTYPE html><html><head><title>Preparing report…</title></head><body style=\"font-family:sans-serif;padding:40px;color:#666\">Preparing report…</body></html>");
  return w;
}
function finishReportPrintWindow(w, html) {
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
// Back-compat one-shot version (opens + writes immediately) — still used
// wherever the HTML is already fully built with no async logo fetch to wait
// on.
function printOfficialReport(html) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// The generated report is written into a fresh popup (about:blank origin),
// which can silently fail to load a logo referenced by URL — whether a
// relative repo path, a raw GitHub URL, or anything else that needs its own
// network fetch from that popup. Converting each logo to a self-contained
// base64 data: URL *before* it's ever put in the popup's HTML sidesteps that
// entirely: no fetch happens from the popup, so nothing there can block it.
// Falls back to the best absolute URL it can build if the fetch itself
// fails (e.g. offline, or a remote host without CORS headers) — same
// best-effort behavior as before, just no longer the *only* path.
async function fetchAsDataUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
async function resolveLogoForReport(src) {
  if (!src) return "";
  if (src.startsWith("data:")) return src;
  let absolute = src;
  try {
    absolute = new URL(src, document.baseURI).href;
  } catch (e) {
    // leave as-is; fetch() below will just fail and we fall back to it
  }
  try {
    return await fetchAsDataUrl(absolute);
  } catch (e) {
    // Best-effort fallback: hand back the resolved absolute URL so the
    // report at least attempts to load it directly, same as the old
    // behavior (the <img onerror> in buildReportHtml() hides it if that
    // still fails).
    return absolute;
  }
}
// Returns a copy of labIdentity with both logos resolved to guaranteed
// self-contained data: URLs wherever possible.
async function resolveLabIdentityLogos(labIdentity) {
  const [leftDataUrl, rightDataUrl] = await Promise.all([
    resolveLogoForReport(labIdentity.leftLogoDataUrl || labIdentity.leftLogoUrl || "assets/logo_left.png"),
    resolveLogoForReport(labIdentity.rightLogoDataUrl || labIdentity.rightLogoUrl || "assets/logo_right.png")
  ]);
  return {
    ...labIdentity,
    leftLogoDataUrl: leftDataUrl,
    leftLogoUrl: "",
    rightLogoDataUrl: rightDataUrl,
    rightLogoUrl: ""
  };
}
function SignatorySlot({
  index,
  value,
  onChange,
  users
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1.5 p-2 rounded mb-2",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: "",
    onChange: e => {
      const u = users.find(x => x.id === e.target.value);
      if (u) onChange({
        name: u.name,
        designation: u.designation || ""
      });
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Pick from Users…"), users.map(u => /*#__PURE__*/React.createElement("option", {
    key: u.id,
    value: u.id
  }, u.name, " (", u.designation || u.role, ")"))), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: `Name ${index}`,
    value: value.name,
    onChange: v => onChange({
      ...value,
      name: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Designation",
    value: value.designation,
    onChange: v => onChange({
      ...value,
      designation: v
    })
  }));
}
function CustomReportGeneratorPage({
  samples,
  setSamples,
  references,
  subBatches,
  testTypes,
  testRecords,
  parameters,
  users,
  session,
  permissionMatrix,
  goToSample,
  notify,
  forceMode
}) {
  const [q, setQ] = React.useState("");
  const [selectedSampleIds, setSelectedSampleIds] = React.useState([]);
  const [selectedTestIds, setSelectedTestIds] = React.useState([]);
  const [memo, setMemo] = React.useState({
    memoNo: "",
    date: todayStr(),
    sentBy: "",
    district: "",
    sampleSource: "",
    refMemoNo: "",
    refMemoDate: "",
    dateOfTesting: todayStr(),
    receivingDate: "",
    collectionDate: "",
    notes: ""
  });
  // ============================================================================
  // Bengali Forwarding Letter (page 1) — a formal cover memo ahead of the
  // existing English results table, matching the lab's standard "Forwarding
  // Lab" paper format. Reuses স্মারক নং/তারিখ (memo.memoNo/memo.date) and
  // সূত্র (memo.refMemoNo/memo.refMemoDate) already collected above — no
  // separate data entry for those. `forwardingDesignation` is the one new
  // field: the post that signs the letter (labIdentity already supplies the
  // department/lab-name lines under it, same as the existing report's
  // letterhead). See buildForwardingLetterPageHtml() below.
  // ============================================================================
  const [includeForwardingLetter, setIncludeForwardingLetter] = React.useState(true);
  const [forwardingDesignation, setForwardingDesignation] = React.useState("সিনিয়র কেমিস্ট");
  // প্রাপক (Recipient/Addressee) — free-text, 3-4 lines, entirely user-filled
  // (name/designation/office of whoever the letter is addressed to). Printed
  // bottom-left of the letter, level with the signature block on the right.
  const [forwardingRecipient, setForwardingRecipient] = React.useState("");
  const [signatories, setSignatories] = React.useState({
    performedBy: [{
      name: "",
      designation: ""
    }],
    approvedBy: [{
      name: "",
      designation: ""
    }]
  });
  const [selectionMode, setSelectionMode] = React.useState(forceMode || "individual"); // "individual" | "batch" | "subbatch"
  const [reportReferenceIds, setReportReferenceIds] = React.useState([]);
  const [reportSubBatchIds, setReportSubBatchIds] = React.useState([]);
  // ============================================================================
  // Workflow/Data-Integrity Upgrade Step 12 — Partial vs Final report type,
  // and Report Versioning (spec sections 13 & 14). `reportType` is what the
  // user is asking to generate; `issuedReports` is the persisted history for
  // whichever Memo No. is currently typed in, fetched on demand (same
  // lazy-load pattern as the Audit Log — see DataService.getAudit() in
  // 42-audit-log-ui.js) rather than folded into the app's startup load.
  // ============================================================================
  const [reportType, setReportType] = React.useState("final");
  const [issuedReports, setIssuedReports] = React.useState([]);
  const [loadingIssuedReports, setLoadingIssuedReports] = React.useState(false);
  const [confirmingRevision, setConfirmingRevision] = React.useState(false);
  // A sample only qualifies for reporting once at least one of its
  // requested tests has actually been RELEASED — matching the same rule
  // Archiving now uses (see isTestRecordArchivable in 13-testrecords-ui.js).
  // A batch/reference can contain a mix of released and not-yet-released
  // samples (some on_hold, rejected, cancelled, or simply still in review);
  // only the released ones are eligible to appear here at all, everywhere
  // below that lists or auto-selects samples.
  function releasedTestTypeIdsForSample(sample) {
    return (sample.requestedTests || []).filter(rt => testStageForSample(sample, rt.testTypeId, testRecords, subBatches) === "released").map(rt => rt.testTypeId);
  }
  const releasedSamples = React.useMemo(() => (samples || []).filter(s => releasedTestTypeIdsForSample(s).length > 0), [samples, testRecords, subBatches]);
  const filteredSamples = releasedSamples.filter(s => !q || `${s.sampleCode} ${s.clientName} ${s.siteLocation} ${s.village}`.toLowerCase().includes(q.toLowerCase()));
  // Reporting is done by Reference (the actual source paperwork — DPHE /
  // institution / walk-in letter+ref no.), not by whichever Sub-Batch
  // happened to test the samples. Only list References that have at least
  // one sample pointing at them.
  const referenceOptions = Array.from(new Set(releasedSamples.map(s => s.referenceId).filter(Boolean))).map(id => findReferenceById(references, id)).filter(Boolean).sort((a, b) => (a.refNo || "").localeCompare(b.refNo || ""));
  const reportSubBatchOptions = [...(subBatches || [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const selectedReportSubBatches = (subBatches || []).filter(sb => reportSubBatchIds.includes(sb.id));
  const selectedSamples = releasedSamples.filter(s => selectedSampleIds.includes(s.id));
  const availableTestIds = React.useMemo(() => {
    const ids = new Set();
    selectedSamples.forEach(s => releasedTestTypeIdsForSample(s).forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [selectedSampleIds]);
  React.useEffect(() => {
    // In Sub-Batch mode the test column is implied by the picked Sub-Batch
    // (set explicitly when it's chosen) — don't let this effect widen it
    // back out to every test type the member samples have ever requested.
    if (selectionMode === "subbatch") return;
    setSelectedTestIds(availableTestIds);
    // eslint-disable-next-line
  }, [availableTestIds.join(","), selectionMode]);
  const selectedTests = testTypes.filter(t => selectedTestIds.includes(t.id));

  // ---- Forwarding Letter body text: for each selected test/parameter,
  // how many of the selected (released) samples came back ABOVE that
  // Parameter's own Reference Limit Max — same Exceed/Non-Exceed rule
  // computeMonthlyProgressStats() already uses (mprExceedStatus below), so
  // this never disagrees with the Monthly Progress Report about what
  // counts as "exceeded". Parameters with zero exceedances are left out of
  // the letter's sentence entirely — only naming what's actually a
  // problem, same as the paper template. ----
  const forwardingExceedList = React.useMemo(() => {
    const out = [];
    selectedTests.forEach(t => {
      let count = 0;
      selectedSamples.forEach(s => {
        const released = testStageForSample(s, t.id, testRecords, subBatches) === "released";
        if (!released) return;
        const found = getSampleResultForTest(s, t.id, testRecords);
        const resultItem = found?.results?.[0];
        if (!resultItem || resultItem.value === undefined || resultItem.value === null || resultItem.value === "") return;
        const param = mprResolveParam(resultItem, t, parameters);
        if (mprExceedStatus(resultItem.value, param) === "Exceed") count += 1;
      });
      if (count > 0) out.push({ name: t.name, count });
    });
    return out;
  }, [selectedSampleIds.join(","), selectedTestIds.join(","), testRecords, subBatches, parameters]);

  // ---- Report completeness (Step 12): every selectedSample × selectedTest
  // combo that ISN'T actually "released" yet — used both to gate Final
  // Report generation and to show the user what's still outstanding before
  // they even hit Generate. ----
  const incompleteCombos = React.useMemo(() => {
    const out = [];
    selectedSamples.forEach(s => {
      selectedTests.forEach(t => {
        const rt = (s.requestedTests || []).find(r => r.testTypeId === t.id);
        if (!rt) return; // this sample never requested this column — not this report's concern
        const stage = testStageForSample(s, t.id, testRecords, subBatches);
        if (stage !== "released") out.push({ sampleCode: s.sampleCode, testTypeName: t.name, stage });
      });
    });
    return out;
  }, [selectedSampleIds.join(","), selectedTestIds.join(","), testRecords, subBatches]);
  // Auto-default: Final when everything's actually done, Partial otherwise —
  // but only auto-flip DOWN to partial (never silently upgrade a user's
  // deliberate "Partial" choice back to Final just because things caught up
  // between renders).
  React.useEffect(() => {
    if (incompleteCombos.length > 0 && reportType === "final") setReportType("partial");
    // eslint-disable-next-line
  }, [incompleteCombos.length]);

  // ---- Report Versioning: look up what's already been issued for this
  // Memo No. so a re-generation becomes an explicit, reasoned Revision
  // instead of a silent overwrite. Fetched on demand per Memo No. typed,
  // debounced by the effect dependency itself (only re-fires when memoNo
  // actually changes), not on every keystroke render. ----
  React.useEffect(() => {
    const memoNo = (memo.memoNo || "").trim();
    if (!memoNo) {
      setIssuedReports([]);
      return;
    }
    let cancelled = false;
    setLoadingIssuedReports(true);
    DataService.list("reports").then(all => {
      if (cancelled) return;
      const forThisMemo = (all || []).filter(r => r.memoNo === memoNo).sort((a, b) => (a.revisionNo || 0) - (b.revisionNo || 0));
      setIssuedReports(forThisMemo);
    }).catch(err => {
      console.error("Failed to load report history (non-fatal):", err);
      if (!cancelled) setIssuedReports([]);
    }).finally(() => {
      if (!cancelled) setLoadingIssuedReports(false);
    });
    return () => {
      cancelled = true;
    };
  }, [memo.memoNo]);
  const nextRevisionNo = issuedReports.length ? Math.max(...issuedReports.map(r => r.revisionNo || 0)) + 1 : 0;

  // Feature 4: Custom Report Auto-Populate Memo Fields
  React.useEffect(() => {
    if (selectedSamples.length === 0) return;

    function extractWaterPointAbbr(waterPointType) {
      const match = (waterPointType || "").match(/\(([^)]+)\)/);
      return match ? match[1] : "";
    }

    function formatDateList(sortedDates) {
      if (!sortedDates.length) return "";
      if (sortedDates.length === 1) return sortedDates[0];
      return `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`;
    }

    const unique = arr => [...new Set(arr.filter(Boolean))];

    const districtVals = unique(selectedSamples.map(s => s.district));
    const sourceVals = unique(selectedSamples.map(s => extractWaterPointAbbr(s.waterPointType)));
    
    const linkedRefs = unique(selectedSamples.map(s => s.referenceId))
      .map(id => findReferenceById(references, id)).filter(Boolean);
    const refNos = unique(linkedRefs.filter(r => !r.isAutoGenerated).map(r => r.refNo));
    const refDates = unique(linkedRefs.map(r => r.letterDate));
    // "Sent by" is the Client Name from the source paperwork (Reference /
    // Client Part — Reference.contactPerson), not the per-sample Customer
    // Name (Sample.clientName). Several selected samples can come from
    // different Client entries, so list each distinct Client Name once,
    // separated by semicolons.
    const sentByVals = unique(linkedRefs.map(r => r.contactPerson));

    const testDates = unique(selectedSamples.flatMap(s =>
      (testRecords || [])
        .filter(r => r.sampleId === s.id || (r.memberSampleIds || []).includes(s.id))
        .map(r => r.date)
    )).sort();

    const collDates = unique(selectedSamples.map(s => s.collectionDate)).sort();
    const recvDates = unique(selectedSamples.map(s => s.receivedDate)).sort();

    setMemo(prev => ({
      ...prev,
      sentBy: sentByVals.join("; "),
      district: districtVals.join("; "),
      sampleSource: sourceVals.join("; "),
      refMemoNo: refNos.join("; "),
      refMemoDate: refDates.join("; "),
      dateOfTesting: testDates.join("; "),
      collectionDate: formatDateList(collDates),
      receivingDate: formatDateList(recvDates),
    }));
  }, [selectedSampleIds.join(",")]);

  function toggleSample(id) {
    if (forceMode === "individual") {
      setSelectedSampleIds(prev => prev.includes(id) ? [] : [id]);
      return;
    }
    setSelectedSampleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleTest(id) {
    setSelectedTestIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  // Deselect one sample from an already-picked batch/sub-batch set without
  // having to uncheck the whole batch — the sample just drops out of the
  // report; the underlying Reference/Sub-Batch checkboxes stay checked since
  // most of that batch is still wanted.
  function removeSelectedSample(id) {
    setSelectedSampleIds(prev => prev.filter(x => x !== id));
  }
  function updateSignatory(side, idx, value) {
    setSignatories(prev => ({
      ...prev,
      [side]: prev[side].map((s, i) => i === idx ? value : s)
    }));
  }
  function addSignatory(side) {
    if (signatories[side].length >= 2) return;
    setSignatories(prev => ({
      ...prev,
      [side]: [...prev[side], {
        name: "",
        designation: ""
      }]
    }));
  }
  async function doGenerate(revisionReason) {
    // Open the popup right away (synchronously, in this click handler) so
    // it isn't blocked; fill it in once the logos are ready.
    const reportWindow = openReportPrintWindow();
    const labIdentity = await resolveLabIdentityLogos(getLabIdentity());
    const generatedAt = new Date().toISOString();
    const reportMeta = {
      reportNo: memo.memoNo.trim(),
      revisionNo: nextRevisionNo,
      generatedAt,
      generatedBy: session?.name || ""
    };
    const html = buildReportHtml({
      labIdentity,
      memo,
      selectedSamples,
      selectedTests,
      testRecords,
      subBatches,
      signatories,
      reportType,
      reportMeta,
      isSingleSampleLayout: forceMode === "individual",
      forwardingLetter: includeForwardingLetter ? {
        sampleCount: selectedSamples.length,
        exceedList: forwardingExceedList,
        designation: forwardingDesignation,
        recipient: forwardingRecipient
      } : null
    });
    finishReportPrintWindow(reportWindow, html);
    // Persist this issuance (Step 12 — Report Versioning) so the NEXT
    // generation with this same Memo No. knows it's a revision, not a
    // fresh report, and shows up in "Previously issued" below. A plain new
    // collection ("reports") — DataService/the GAS backend auto-provision
    // any collection name, same as auditLog did (see 01-data-service.js).
    const entry = {
      id: uid("rpt"),
      memoNo: reportMeta.reportNo,
      revisionNo: reportMeta.revisionNo,
      reportType,
      status: reportType === "final" ? (reportMeta.revisionNo > 0 ? "Revised" : "Final") : "Partial",
      generatedAt,
      generatedBy: session?.name || "",
      generatedByRole: session?.role || "",
      revisionReason: revisionReason || null,
      sampleIds: selectedSampleIds,
      sampleCodes: selectedSamples.map(s => s.sampleCode),
      testTypeIds: selectedTestIds,
      testTypeNames: selectedTests.map(t => t.name),
      incompleteCount: incompleteCombos.length
    };
    DataService.save("reports", entry).then(() => {
      setIssuedReports(prev => [...prev, entry]);
    }).catch(err => {
      console.error("Failed to persist report issuance record (non-fatal — the printout itself already happened):", err);
      notify?.("Report printed, but its version history couldn't be saved — the next generation for this Memo No. may not correctly detect it as a revision.", "warn");
    });
    DataService.appendAudit({
      eventType: "REPORT_GENERATED",
      entityType: "report",
      entityId: entry.id,
      entity: "report",
      action: reportMeta.revisionNo > 0 ? "report_revised" : "report_generated",
      performedBy: session?.name,
      role: session?.role,
      reason: revisionReason || null,
      note: `${entry.status} report generated for Memo No. ${reportMeta.reportNo} (Revision ${reportMeta.revisionNo}) — ${selectedSamples.length} sample(s), ${selectedTests.length} test column(s)${incompleteCombos.length ? `, ${incompleteCombos.length} parameter(s) not yet released` : ""}.`
    }).catch(err => console.error("Audit log write failed (non-fatal):", err));
    // Per the workflow doc, a report should only be generated after
    // approval — this is a soft check (warn, don't block) since not every
    // lab necessarily runs every parameter through the formal review step.
    if (setSamples) {
      const notYetApproved = [];
      // Same fix as markMembersInProgress()/doDeleteSubBatch() in
      // 21-sample-ui.js — compute every sample's update in one pure pass,
      // then persist all of them in a single bulk call instead of one
      // setSamples() round trip per sample (a report often covers a whole
      // batch at once).
      const changed = [];
      const nextSamples = selectedSamples.reduce((acc, sample) => {
        let updated = sample;
        selectedTests.forEach(t => {
          const rt = (sample.requestedTests || []).find(r => r.testTypeId === t.id);
          if (!rt) return; // this sample didn't request this column
          if (rt.status === "approved") {
            updated = setRequestedTestStatus(updated, t.id, "released", session);
          } else if (rt.status !== "released") {
            notYetApproved.push(`${sample.sampleCode} — ${t.name}`);
          }
        });
        if (updated === sample) return acc;
        changed.push(updated);
        return acc.map(s => s.id === sample.id ? updated : s);
      }, samples || selectedSamples);
      if (changed.length) setSamples(() => nextSamples, changed);
      if (notYetApproved.length) {
        notify?.(`Report generated — but ${notYetApproved.length} parameter(s) hadn't been through final approval yet, so they weren't marked Released: ${notYetApproved.slice(0, 5).join(", ")}${notYetApproved.length > 5 ? "…" : ""}.`, "warn");
      }
    }
    setConfirmingRevision(false);
  }
  function generate() {
    if (selectedSamples.length === 0) {
      notify?.("Select at least one sample first.", "warn");
      return;
    }
    if (selectedTests.length === 0) {
      notify?.("Select at least one test to include as a column.", "warn");
      return;
    }
    if (!(memo.memoNo || "").trim()) {
      notify?.("Memo No. is required to generate a report.", "warn");
      return;
    }
    if (!(memo.date || "").trim()) {
      notify?.("Date is required to generate a report.", "warn");
      return;
    }
    // Hard gate — a report can't be produced for a column that has no
    // result yet at all (as opposed to the softer "not approved yet"
    // check further down, which still lets the report print).
    const missingResults = [];
    selectedSamples.forEach(sample => {
      selectedTests.forEach(t => {
        const rt = (sample.requestedTests || []).find(r => r.testTypeId === t.id);
        if (!rt) return; // this sample never requested this column — not this gate's concern
        if (rt.status === "pending" || rt.status === "in_progress") {
          missingResults.push(`${sample.sampleCode} — ${t.name}`);
        }
      });
    });
    if (missingResults.length) {
      notify?.(`Can't generate — ${missingResults.length} selected parameter(s) don't have a result entered yet: ${missingResults.slice(0, 6).join(", ")}${missingResults.length > 6 ? "…" : ""}. Remove them from the selection, or enter their results first.`, "warn");
      return;
    }
    // Step 13 — a Final Report must not go out while any of its selected
    // parameters are still short of "released" (pending, in progress,
    // results entered, under review, on hold, or merely approved-but-not-
    // yet-released all count as incomplete here).
    if (reportType === "final" && incompleteCombos.length > 0) {
      notify?.(`Can't generate a FINAL report — ${incompleteCombos.length} selected parameter(s) haven't been released yet: ${incompleteCombos.slice(0, 6).map(c => `${c.sampleCode} — ${c.testTypeName} (${testStageLabel(c.stage)})`).join(", ")}${incompleteCombos.length > 6 ? "…" : ""}. Switch to Partial, or wait until they're released.`, "warn");
      return;
    }
    // Step 14 / spec §16 "Revise Report" — regenerating an already-issued
    // Memo No. requires an explicit reason, same required-reason contract
    // as every other sensitive action in this app.
    if (nextRevisionNo > 0) {
      setConfirmingRevision(true);
      return;
    }
    doGenerate(null);
  }
  // ---- Step 1 selection, built as plain variables (Individual / Batch-by-
  // Reference / Sub-Batch) instead of one giant nested expression. ----
  const modeSelectorRow = forceMode ? null : /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs mb-2",
    style: { color: C.muted }
  }, "How are you selecting samples?", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: { borderColor: C.border },
    value: selectionMode,
    onChange: e => {
      const mode = e.target.value;
      setSelectionMode(mode);
      setReportReferenceIds([]);
      setReportSubBatchIds([]);
      setSelectedSampleIds([]);
    }
  }, /*#__PURE__*/React.createElement("option", { value: "individual" }, "Individual Samples"), /*#__PURE__*/React.createElement("option", { value: "batch" }, "Batch (by Reference)"), /*#__PURE__*/React.createElement("option", { value: "subbatch" }, "Analytical Batch")));

  const individualModeBlock = selectionMode !== "individual" ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    className: "border rounded px-2 py-1.5 text-xs w-full mb-2",
    style: { borderColor: C.border },
    placeholder: "Search by sample code, client, site, village…",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedSampleIds(filteredSamples.map(s => s.id))
  }, "Select All Filtered"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedSampleIds([])
  }, "Clear")), /*#__PURE__*/React.createElement("div", {
    className: "max-h-56 overflow-y-auto rounded",
    style: { border: `1px solid ${C.border}` }
  }, filteredSamples.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2",
    style: { color: C.muted }
  }, "No samples match.") : /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["", "Sample", "Client", "Site / Village", "Reference", ""].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    className: "text-left px-2 py-1.5 sticky top-0",
    style: { background: C.card, borderBottom: `1px solid ${C.border}`, color: C.muted }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filteredSamples.map(s => {
    const ref = s.referenceId ? findReferenceById(references, s.referenceId) : null;
    return /*#__PURE__*/React.createElement("tr", {
      key: s.id,
      className: "cursor-pointer",
      style: { background: selectedSampleIds.includes(s.id) ? `${C.teal}14` : "transparent" },
      onClick: () => toggleSample(s.id)
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: selectedSampleIds.includes(s.id),
      onChange: () => toggleSample(s.id),
      onClick: e => e.stopPropagation()
    })), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5 font-semibold"
    }, s.sampleCode), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: { color: C.muted }
    }, s.clientName), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: { color: C.muted }
    }, `${s.siteLocation}${s.village ? ` · ${s.village}` : ""}`), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: { color: C.muted }
    }, ref ? referenceDisplayLabel(ref) : "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5"
    }, goToSample && /*#__PURE__*/React.createElement("button", {
      type: "button",
      title: "View full sample record",
      style: { color: C.info },
      onClick: e => {
        e.preventDefault();
        e.stopPropagation();
        goToSample(s.id);
      }
    }, "↗")));
  })))));

  function toggleReference(refId) {
    setReportReferenceIds(prev => {
      const next = prev.includes(refId) ? prev.filter(x => x !== refId) : [...prev, refId];
      setSelectedSampleIds(releasedSamples.filter(s => next.includes(s.referenceId)).map(s => s.id));
      // Auto-fill is now handled centrally by the useEffect above
      // whenever selectedSampleIds changes.
      return next;
    });
  }
  const batchModeBlock = selectionMode !== "batch" ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => {
      const allIds = referenceOptions.map(r => r.id);
      setReportReferenceIds(allIds);
      setSelectedSampleIds(releasedSamples.filter(s => allIds.includes(s.referenceId)).map(s => s.id));
    }
  }, "Select All References"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => {
      setReportReferenceIds([]);
      setSelectedSampleIds([]);
    }
  }, "Clear")), /*#__PURE__*/React.createElement("div", {
    className: "max-h-56 overflow-y-auto rounded mb-2",
    style: { border: `1px solid ${C.border}` }
  }, referenceOptions.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2",
    style: { color: C.muted }
  }, "No references available.") : referenceOptions.map(ref => /*#__PURE__*/React.createElement("div", {
    key: ref.id,
    className: "flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer",
    style: {
      background: reportReferenceIds.includes(ref.id) ? `${C.teal}14` : "transparent",
      borderBottom: `1px solid ${C.border}`
    },
    onClick: () => toggleReference(ref.id)
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: reportReferenceIds.includes(ref.id),
    onChange: () => toggleReference(ref.id),
    onClick: e => e.stopPropagation()
  }), /*#__PURE__*/React.createElement("span", null, `${referenceSourceMeta(ref.sourceType).label} — ${referenceDisplayLabel(ref)} (${releasedSamples.filter(s => s.referenceId === ref.id).length} samples)`)))), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 mb-2"
  }, selectedSamples.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    className: "text-[11px] pl-2 pr-1 py-0.5 rounded-full flex items-center gap-1",
    style: { background: C.bg, color: C.ink }
  }, `${s.sampleCode} · ${s.clientName}`, /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Remove this sample from the report",
    onClick: () => removeSelectedSample(s.id),
    style: { color: C.muted, lineHeight: 1 }
  }, "×")))));

  function applySubBatchSelection(ids) {
    const selected = (subBatches || []).filter(sb => ids.includes(sb.id));
    // Only member samples actually RELEASED for that sub-batch's test type
    // qualify — a sub-batch can be a mix of released/held/rejected members.
    const sampleIds = Array.from(new Set(selected.flatMap(sb => (sb.memberSampleIds || []).filter(sid => {
      const sample = releasedSamples.find(s => s.id === sid);
      return sample && releasedTestTypeIdsForSample(sample).includes(sb.testTypeId);
    }))));
    const testTypeIds = Array.from(new Set(selected.map(sb => sb.testTypeId).filter(Boolean)));
    setSelectedSampleIds(sampleIds);
    setSelectedTestIds(testTypeIds);
  }
  function toggleSubBatch(sbId) {
    setReportSubBatchIds(prev => {
      const next = prev.includes(sbId) ? prev.filter(x => x !== sbId) : [...prev, sbId];
      applySubBatchSelection(next);
      return next;
    });
  }
  const subBatchModeBlock = selectionMode !== "subbatch" ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => {
      const allIds = reportSubBatchOptions.map(sb => sb.id);
      setReportSubBatchIds(allIds);
      applySubBatchSelection(allIds);
    }
  }, "Select All Analytical Batches"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => {
      setReportSubBatchIds([]);
      setSelectedSampleIds([]);
      setSelectedTestIds([]);
    }
  }, "Clear")), /*#__PURE__*/React.createElement("div", {
    className: "max-h-56 overflow-y-auto rounded mb-2",
    style: { border: `1px solid ${C.border}` }
  }, reportSubBatchOptions.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2",
    style: { color: C.muted }
  }, "No analytical batches available.") : reportSubBatchOptions.map(sb => /*#__PURE__*/React.createElement("div", {
    key: sb.id,
    className: "flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer",
    style: {
      background: reportSubBatchIds.includes(sb.id) ? `${C.teal}14` : "transparent",
      borderBottom: `1px solid ${C.border}`
    },
    onClick: () => toggleSubBatch(sb.id)
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: reportSubBatchIds.includes(sb.id),
    onChange: () => toggleSubBatch(sb.id),
    onClick: e => e.stopPropagation()
  }), /*#__PURE__*/React.createElement("span", null, `${sb.label} — ${sb.testTypeName} (${(sb.memberSampleIds || []).length} samples) · ${sb.status}`)))), selectedReportSubBatches.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 mb-2"
  }, selectedSamples.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    className: "text-[11px] pl-2 pr-1 py-0.5 rounded-full flex items-center gap-1",
    style: { background: C.bg, color: C.ink }
  }, `${s.sampleCode} · ${s.clientName}`, /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Remove this sample from the report",
    onClick: () => removeSelectedSample(s.id),
    style: { color: C.muted, lineHeight: 1 }
  }, "×")))));

  const sampleSelectionSummaryLine = /*#__PURE__*/React.createElement("div", {
    className: "text-xs mt-2 font-semibold",
    style: { color: C.teal }
  }, `${selectedSampleIds.length} sample(s) selected`);

  const sampleSelectionSection = /*#__PURE__*/React.createElement(React.Fragment, null, modeSelectorRow, individualModeBlock, batchModeBlock, subBatchModeBlock, sampleSelectionSummaryLine);

  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Step 1 — Select Samples",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 15
    })
  }, sampleSelectionSection), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Step 2 — Select Tests (Report Columns)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 15
    })
  }, availableTestIds.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Selected samples have no requested tests.") : /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, testTypes.filter(t => availableTestIds.includes(t.id)).map(t => /*#__PURE__*/React.createElement("label", {
    key: t.id,
    className: "flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer",
    style: {
      border: `1px solid ${selectedTestIds.includes(t.id) ? C.teal : C.border}`,
      background: selectedTestIds.includes(t.id) ? `${C.teal}14` : "transparent"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedTestIds.includes(t.id),
    onChange: () => toggleTest(t.id)
  }), t.name, " (", t.method || "no method set", ")")))), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Step 3 — Memo / Reference Details",
    subtitle: "These vary per report — fill them in for this specific memo.",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "edit",
      size: 15
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: {
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))"
    }
  }, [["memoNo", "Memo No", null, true], ["date", "Date", "date", true], ["sentBy", "Sent by"], ["district", "District"], ["sampleSource", "Sample Source (e.g. STW-6)"], ["refMemoNo", "Ref: Memo No"], ["refMemoDate", "Ref: Memo Date"], ["dateOfTesting", "Date of Testing"], ["collectionDate", "Collection Date"], ["receivingDate", "Receiving Date"]].map(([key, label, type, required]) => /*#__PURE__*/React.createElement(TextField, {
    key: key,
    simple: true,
    label: required ? /*#__PURE__*/React.createElement("span", null, label, " ", /*#__PURE__*/React.createElement("span", {
      style: { color: C.warn }
    }, "*")) : label,
    type: type || "text",
    value: memo[key],
    error: required && !(memo[key] || "").trim() ? `${label} is required to generate a report.` : "",
    onChange: v => setMemo({
      ...memo,
      [key]: v
    })
  }))), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Notes (optional, printed below the table)",
    value: memo.notes,
    onChange: v => setMemo({
      ...memo,
      notes: v
    }),
    textarea: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 pt-3",
    style: { borderTop: `1px solid ${C.border}` }
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-1.5 text-xs font-medium cursor-pointer",
    style: { color: C.ink }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: includeForwardingLetter,
    onChange: e => setIncludeForwardingLetter(e.target.checked)
  }), "Include Bengali Forwarding Letter as page 1 (স্মারক নং, বিষয়, সূত্র, ফলাফল সারাংশ)"), includeForwardingLetter && /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2 mt-2",
    style: { gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Signing Designation (Bangla)",
    value: forwardingDesignation,
    onChange: v => setForwardingDesignation(v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "প্রাপক (Recipient — 3-4 lines, printed bottom-left of the letter)",
    value: forwardingRecipient,
    onChange: v => setForwardingRecipient(v),
    textarea: true,
    rows: 4,
    placeholder: "নাম\nপদবী\nদপ্তরের নাম\nঠিকানা"
  })), includeForwardingLetter && selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-2 px-2.5 py-2 rounded",
    style: { background: C.bg, color: C.muted }
  }, /*#__PURE__*/React.createElement("div", null, `Letter will report ${selectedSamples.length} sample(s) tested.`), forwardingExceedList.length > 0 ? /*#__PURE__*/React.createElement("div", null, "Exceeded parameters: ", forwardingExceedList.map(e => `${e.name} (${e.count})`).join(", ")) : /*#__PURE__*/React.createElement("div", null, "No parameter currently exceeds its limit among released results — letter will state all results are within limits."), !((memo.refMemoNo || "").trim()) && /*#__PURE__*/React.createElement("div", null, "No Ref: Memo No entered — সূত্রঃ line will be omitted and the opening line will read \"উপর্যুক্ত বিষয়ের প্রেক্ষিতে\"."))
  )), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Step 3.5 — Report Type & Version",
    subtitle: "Partial vs Final, and whether this Memo No. has already been issued before.",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flag",
      size: 15
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 mb-2"
  }, [["final", "Final Report", "Every selected parameter must be Released."], ["partial", "Partial Report", "Only Released parameters print a value; the rest show \"-\"."]].map(([val, label, hint]) => /*#__PURE__*/React.createElement("label", {
    key: val,
    className: "flex items-start gap-1.5 px-2.5 py-1.5 rounded text-xs cursor-pointer",
    style: {
      border: `1px solid ${reportType === val ? C.teal : C.border}`,
      background: reportType === val ? `${C.teal}14` : "transparent",
      minWidth: 200
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "reportType",
    checked: reportType === val,
    onChange: () => setReportType(val),
    disabled: val === "final" && incompleteCombos.length > 0,
    style: { marginTop: 2 }
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("div", {
    className: "font-semibold",
    style: { color: C.ink }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: { color: C.muted }
  }, hint))))), incompleteCombos.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] px-2 py-1.5 rounded mb-2",
    style: { background: C.warnBg, color: C.warn }
  }, `${incompleteCombos.length} selected parameter(s) not yet released — Final Report is disabled until they are: `, incompleteCombos.slice(0, 5).map(c => `${c.sampleCode}/${c.testTypeName} (${testStageLabel(c.stage)})`).join(", "), incompleteCombos.length > 5 ? "…" : ""), (memo.memoNo || "").trim() && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px]",
    style: { color: C.muted }
  }, loadingIssuedReports ? "Checking version history for this Memo No.…" : issuedReports.length === 0 ? "No report issued yet for this Memo No. — this will be Revision 0." : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-semibold mb-1",
    style: { color: C.ink }
  }, `Previously issued for this Memo No. — generating again will be Revision ${nextRevisionNo}:`), issuedReports.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id
  }, `Rev ${r.revisionNo} · ${r.status} · ${(r.generatedAt || "").slice(0, 10)} by ${r.generatedBy || "?"}${r.revisionReason ? ` — "${r.revisionReason}"` : ""}`))))), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Step 4 — Signatories",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 15
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Test Performed by"), signatories.performedBy.map((sig, i) => /*#__PURE__*/React.createElement(SignatorySlot, {
    key: i,
    index: i + 1,
    value: sig,
    onChange: v => updateSignatory("performedBy", i, v),
    users: users
  })), signatories.performedBy.length < 2 && /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => addSignatory("performedBy")
  }, "+ Add second signatory")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Countersigned/Approved by"), signatories.approvedBy.map((sig, i) => /*#__PURE__*/React.createElement(SignatorySlot, {
    key: i,
    index: i + 1,
    value: sig,
    onChange: v => updateSignatory("approvedBy", i, v),
    users: users
  })), signatories.approvedBy.length < 2 && /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => addSignatory("approvedBy")
  }, "+ Add second signatory")))), selectedSampleIds.length > 0 && (() => {
    const reportsGate = permGate(permissionMatrix, session, "reports", "create", notify, "generate reports");
    return reportsGate.visible && /*#__PURE__*/React.createElement("div", {
      className: "flex justify-end"
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: reportsGate.guard(generate)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "printer",
      size: 14
    }), `Generate & Print ${reportType === "final" ? "Final" : "Partial"} Report (`, selectedSampleIds.length, " sample", selectedSampleIds.length === 1 ? "" : "s", ")"));
  })(), confirmingRevision && /*#__PURE__*/React.createElement(ReasonRequiredModal, {
    title: `Revise Report — Memo No. ${memo.memoNo}`,
    description: `Memo No. "${memo.memoNo}" has already been issued (last: Revision ${nextRevisionNo - 1}). Generating again will be recorded as Revision ${nextRevisionNo} — both stay traceable in the version history, nothing is overwritten.`,
    confirmLabel: `Generate Revision ${nextRevisionNo}`,
    onClose: () => setConfirmingRevision(false),
    onConfirm: reason => doGenerate(reason)
  }));
}


// ============================================================================
// MONTHLY PROGRESS REPORT OF WATER QUALITY TEST
// Matches the DPHE Zonal Lab paper format supplied as the reference doc: one
// row-pair (Exceed / Non-Exceed) per Client Type ("Name of Requested
// Organization/Project"), broken down by Arsenic (As) / Iron (Fe) /
// Chloride (Cl) / Others, with "During this month" and cumulative "From
// July/<FY start year>" columns for Samples Tested, Parameters Tested, and
// Revenue. Pure aggregation lives in computeMonthlyProgressStats() — no
// React — so it's unit-testable on its own; buildMonthlyProgressReportHtml()
// turns that into the printable popup document, following the exact same
// openReportPrintWindow()/resolveLabIdentityLogos()/finishReportPrintWindow()
// pattern the rest of this file and 18-archive-ui.js already use, so this
// report downloads/prints the same way every other official report does.
// ============================================================================

const MPR_CLIENT_TYPES = ["ADP", "Non-ADP", "Calamity", "Monitoring", "VVIP", "Others", "Unspecified"];
const MPR_CATEGORIES = ["As", "Fe", "Cl", "Others"];

function mprClientType(sampleObj, references) {
  if (!sampleObj) return "Unspecified";
  let ct = "";
  if (sampleObj.referenceId) {
    const ref = (references || []).find(r => r.id === sampleObj.referenceId);
    if (ref && ref.clientType) ct = ref.clientType;
  }
  if (!ct && sampleObj.clientType) ct = sampleObj.clientType;
  ct = (ct || "").trim();
  if (!ct) return "Unspecified";
  if (ct === "ADP") return "ADP";
  if (ct === "Non-ADP") return "Non-ADP";
  if (ct === "Calamity") return "Calamity";
  if (ct === "Monitoring") return "Monitoring";
  if (ct === "VVIP") return "VVIP";
  if (ct.startsWith("Others")) return "Others";
  return "Unspecified";
}

// Which of the 4 report columns a Parameter's exceed/non-exceed count falls
// under. Matched by Parameter Code first (exact, case-insensitive — "As",
// "Fe", "Cl"), then by name keyword, so labs that used a different code
// scheme still land correctly. Anything else with a usable Reference Limit
// falls into "Others".
function mprParamCategory(param, fallbackName) {
  const code = param ? (param.code || "").trim().toLowerCase() : "";
  const name = (param ? (param.name || "") : (fallbackName || "")).trim().toLowerCase();
  if (code === "as" || /arsenic/.test(name)) return "As";
  if (code === "fe" || /iron/.test(name)) return "Fe";
  if (code === "cl" || /chloride/.test(name)) return "Cl";
  return "Others";
}

function mprHasLimit(v) {
  return v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
}
function mprHasAnyLimit(param) {
  return !!param && (mprHasLimit(param.refLimitMin) || mprHasLimit(param.refLimitMax));
}

// Exceed / Non-Exceed is a direct comparison of the entered result against
// the Parameter's own Reference Limit Max (Test Configuration → Parameters
// → Limits) — NOT the full System Remark engine in 22a-remark-engine.js
// (which also factors in LOD/LOQ/detection-range/dilution, for a different
// purpose). IMPORTANT: a Parameter with NO Max limit configured is still a
// real released, tested parameter and MUST still be counted toward the
// Total — there's simply nothing it could have exceeded, so it defaults to
// "Non-Exceed" rather than being dropped. Only a result with no usable
// numeric value at all (nothing entered yet) returns null (excluded —
// genuinely not tested/evaluable yet).
//
// BUGFIX: this used to ALSO flag a result as "Exceed" whenever it fell
// below the Parameter's Reference Limit Min (num < min). For contaminant
// parameters like Iron/Manganese, Reference Limit Min is configured to
// describe the acceptable/aesthetic RANGE (e.g. Iron 0.3–1.0 mg/L,
// Manganese 0.05–0.1 mg/L) — a result BELOW that range is not a violation,
// it's simply cleaner water than the range's lower bound. Treating "below
// min" as "Exceed" made every low, well-within-standard Iron/Manganese
// result (e.g. 0.01–0.06 mg/L) get wrongly counted as exceeding, both in
// the Monthly Progress Report's Exceed column and — worse — in the
// Bengali Forwarding Letter, whose sentence explicitly reads "...
// নির্ধারিত মাত্রার চেয়ে অধিক পাওয়া গেছে" ("...found to be MORE than the
// prescribed limit"), which is simply false for a low result. Arsenic
// wasn't affected because it typically has only a Max limit configured
// (no Min), so this only ever showed up for parameters like Iron/
// Manganese that also carry a Min. "Exceed" here now means only "above
// the Reference Limit Max" — a Min, if configured, is informational only
// for this rollup (the System Remark engine still reports "Below Standard
// Reference Limit" separately for day-to-day result review).
function mprExceedStatus(value, param) {
  const num = value === "" || value === null || value === undefined ? NaN : Number(value);
  if (!Number.isFinite(num)) return null;
  if (!mprHasAnyLimit(param)) return "Non-Exceed"; // no Bangladesh Standard configured to violate
  const max = mprHasLimit(param.refLimitMax) ? Number(param.refLimitMax) : null;
  const exceeds = max !== null && num > max;
  return exceeds ? "Exceed" : "Non-Exceed";
}

// Same id-first / name-fallback join the System Remark engine uses
// (resolveParameterConfig in 22a-remark-engine.js), reused here so the two
// features never disagree about which Parameter a result row belongs to.
function mprResolveParam(resultItem, testType, parameters) {
  return typeof resolveParameterConfig === "function"
    ? resolveParameterConfig(resultItem, testType, parameters)
    : null;
}

function mprMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const MPR_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function mprMonthLabel(mk) {
  if (!mk) return "";
  const [y, m] = mk.split("-").map(Number);
  return `${MPR_MONTH_NAMES[m - 1]}/${y}`;
}
// Every "YYYY-MM" from FY-baseline July onward through (and including) the
// given "as-of" month, most-recent first — used to populate the Month
// dropdown.
function mprMonthOptions(baselineFyStartYear, asOfMonthKey) {
  const [asY, asM] = asOfMonthKey.split("-").map(Number);
  const out = [];
  let y = baselineFyStartYear, m = 7;
  while (y < asY || (y === asY && m <= asM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out.reverse();
}

// Best-known "release date" for a sample — same fallback the fiscal-year
// dashboards already use (30-dashboard.js / 14c-analytics-pages-2.js): the
// latest released parameter's own timestamp if the data model carries one,
// else the sample's own updatedAt/collectionDate.
function mprSampleDate(s) {
  const rts = (s.requestedTests || []).filter(rt => rt.status === "released" && rt.updatedAt);
  const best = rts.reduce((b, rt) => (!b || rt.updatedAt > b.updatedAt) ? rt : b, null);
  return best ? best.updatedAt : (s.updatedAt || s.collectionDate);
}

/**
 * computeMonthlyProgressStats(args)
 * Pure aggregation — no React — so it's unit-testable on its own.
 * @param {object} args
 *   samples, references, testRecords, testTypes, parameters — live app data
 *   archived — rows from the "archived_records" collection (optional)
 *   selectedMonth — "YYYY-MM" the report is being run for
 */
function computeMonthlyProgressStats({ samples, references, testRecords, testTypes, parameters, archived, selectedMonth }) {
  const monthKey = selectedMonth || mprMonthKey(todayStr());
  const [selYear, selMon] = monthKey.split("-").map(Number);
  const fiscalYear = getFiscalYear(`${selYear}-${String(selMon).padStart(2, "0")}-01`);
  const fyStartYear = Number(fiscalYear.split("-")[0]);
  const fyStartLabel = `July/${fyStartYear}`;
  const fyStart = `${fyStartYear}-07-01`;
  const cumEndStr = new Date(selYear, selMon, 0).toISOString().slice(0, 10); // last day of selected month

  const blankCat = () => ({ As: { exceed: 0, nonExceed: 0 }, Fe: { exceed: 0, nonExceed: 0 }, Cl: { exceed: 0, nonExceed: 0 }, Others: { exceed: 0, nonExceed: 0 } });
  const blankBucket = () => ({ samples: 0, revenue: 0, byCat: blankCat() });
  const acc = {};
  MPR_CLIENT_TYPES.forEach(ct => { acc[ct] = { duringMonth: blankBucket(), cumulative: blankBucket() }; });
  const bdStdSets = { As: new Set(), Fe: new Set(), Cl: new Set(), Others: new Set() };

  function inCumWindow(dateStr) {
    if (!dateStr) return false;
    const d = String(dateStr).slice(0, 10);
    return d >= fyStart && d <= cumEndStr;
  }
  function inMonth(dateStr) {
    return mprMonthKey(dateStr) === monthKey;
  }

  (samples || []).forEach(s => {
    const releasedRts = (s.requestedTests || []).filter(rt => rt.status === "released");
    if (!releasedRts.length) return;
    const ct = mprClientType(s, references);
    const sampleDate = mprSampleDate(s);
    const inM = inMonth(sampleDate);
    const inC = inCumWindow(sampleDate);
    if (!inM && !inC) return;

    if (inM) acc[ct].duringMonth.samples += 1;
    if (inC) acc[ct].cumulative.samples += 1;

    releasedRts.forEach(rt => {
      const testType = (testTypes || []).find(t => t.id === rt.testTypeId);
      if (!testType) return;
      const info = getSampleResultForTest(s, rt.testTypeId, testRecords);
      if (!info) return;
      // Fallback price if a result's Parameter can't be resolved at all:
      // the originating test record's own unitCost snapshot (which itself
      // was set from the linked Parameter's Standard Fee at save time).
      const rec = (testRecords || []).find(x => x.id === info.recordId);
      // Fee applicability — checked PER MEMBER for an Analytical Batch
      // record (rec.memberResults), not just the record-wide flag. This is
      // what makes a mixed batch — some first-time samples billed, some
      // retested samples fee-waived — price correctly here too, exactly
      // matching what Add Test Record actually billed (13-testrecords-ui.js).
      // Falls back to the record-level flag for legacy/single-sample
      // records that have no per-member breakdown.
      let feeOk;
      if (rec && Array.isArray(rec.memberResults)) {
        const member = rec.memberResults.find(m => m.sampleId === s.id);
        feeOk = member ? member.feeApplicable !== false : rec.feeApplicable !== false;
      } else {
        feeOk = !rec || rec.feeApplicable !== false;
      }
      (info.results || []).forEach(r => {
        const param = mprResolveParam(r, testType, parameters);
        let status = mprExceedStatus(r.value, param);
        // A below-LOD/LOQ reading has no numeric value but is definitely
        // not exceeding the Bangladesh Standard, so count it Non-Exceed —
        // it's a real released, tested parameter, same as any other.
        if (!status && (r.error === "LOD" || r.error === "LOQ")) {
          status = "Non-Exceed";
        }
        if (!status) return; // nothing entered yet — genuinely not tested
        const cat = mprParamCategory(param, r.name);
        if (param && param.refStandard && param.refStandard.trim()) bdStdSets[cat].add(param.refStandard.trim());
        const key = status === "Exceed" ? "exceed" : "nonExceed";
        if (inM) acc[ct].duringMonth.byCat[cat][key] += 1;
        if (inC) acc[ct].cumulative.byCat[cat][key] += 1;

        // Revenue — priced per test, straight off THIS parameter's own
        // Standard Fee (live value on the Parameters tab — "Reference
        // Standard"'s neighbouring field), summed once for every counted
        // parameter instance above. This is deliberately per-parameter,
        // not per test record or per sample: e.g. 100 samples tested for
        // Fe @ ৳200 + 100 for Mn @ ৳300 + 50 for As @ ৳450 must add up to
        // 100×200 + 100×300 + 50×450, not some blended per-record or
        // per-sample average.
        if (feeOk) {
          const fee = param && mprHasLimit(param.standardFee) ? Number(param.standardFee) : (rec ? Number(rec.unitCost) || 0 : 0);
          if (fee) {
            if (inM) acc[ct].duringMonth.revenue += fee;
            if (inC) acc[ct].cumulative.revenue += fee;
          }
        }
      });
    });
  });

  // Archived (purged) records only carry enough to count toward the
  // Parameters Tested totals — they don't retain raw result values, so
  // they can't be split into Exceed/Non-Exceed or by As/Fe/Cl/Others. They
  // land under "Others / Non-Exceed" so the Total Parameters Tested figure
  // doesn't silently under-count what the paper report expects; the print
  // footnote calls this limitation out explicitly.
  (archived || []).forEach(a => {
    const archDate = a.archivedAt || a.updatedAt;
    const inM = inMonth(archDate);
    const inC = inCumWindow(archDate);
    if (!inM && !inC) return;
    const snaps = (a.archivedSampleSnapshots && a.archivedSampleSnapshots.length) ? a.archivedSampleSnapshots : [{ id: a.id, referenceId: a.referenceId, clientType: a.clientType }];
    snaps.forEach(snap => {
      const ct = mprClientType(snap, references);
      if (inM) { acc[ct].duringMonth.samples += 1; acc[ct].duringMonth.byCat.Others.nonExceed += 1; }
      if (inC) { acc[ct].cumulative.samples += 1; acc[ct].cumulative.byCat.Others.nonExceed += 1; }
    });
  });

  function bucketTotal(b) {
    return MPR_CATEGORIES.reduce((sum, cat) => sum + b.byCat[cat].exceed + b.byCat[cat].nonExceed, 0);
  }

  const rows = MPR_CLIENT_TYPES.map(ct => ({
    clientType: ct,
    duringMonth: { ...acc[ct].duringMonth, total: bucketTotal(acc[ct].duringMonth) },
    cumulative: { ...acc[ct].cumulative, total: bucketTotal(acc[ct].cumulative) }
  })).filter(row => row.duringMonth.samples > 0 || row.cumulative.samples > 0 || row.duringMonth.total > 0 || row.cumulative.total > 0);

  const totals = rows.reduce((t, row) => {
    ["duringMonth", "cumulative"].forEach(k => {
      t[k].samples += row[k].samples;
      t[k].revenue += row[k].revenue;
      t[k].total += row[k].total;
      MPR_CATEGORIES.forEach(cat => {
        t[k].byCat[cat].exceed += row[k].byCat[cat].exceed;
        t[k].byCat[cat].nonExceed += row[k].byCat[cat].nonExceed;
      });
    });
    return t;
  }, { duringMonth: { ...blankBucket(), total: 0 }, cumulative: { ...blankBucket(), total: 0 } });

  const bdStandardByCategory = {};
  MPR_CATEGORIES.forEach(cat => { bdStandardByCategory[cat] = [...bdStdSets[cat]].join("; "); });

  return { monthKey, monthLabel: mprMonthLabel(monthKey), fiscalYear, fyStartLabel, rows, totals, bdStandardByCategory };
}

function mprFmtCount(n) {
  return n ? String(n) : "-";
}
function mprFmtRevenue(n) {
  return n ? `${Math.round(n).toLocaleString("en-US")}/-` : "-";
}

// Builds the inner <table> (and the "Bangladesh Standard" legend under it)
// shared by both the on-screen preview and the printable popup, so the two
// are always in sync.
function buildMonthlyProgressReportTableHtml(stats) {
  const thStyle = "border:1px solid #111;padding:4px 6px;text-align:center;font-weight:bold;background:#f2f2f2;";
  const tdStyle = "border:1px solid #111;padding:4px 6px;text-align:center;";
  const tdLeft = tdStyle + "text-align:left;font-weight:600;";

  const rowsHtml = stats.rows.length === 0
    ? `<tr><td colspan="14" style="${tdStyle}font-style:italic;color:#666;">No released samples found for ${stats.monthLabel}.</td></tr>`
    : stats.rows.map((row, idx) => {
        const sl = String(idx + 1).padStart(2, "0");
        function catCell(bucket, cat, key) {
          return `<td style="${tdStyle}">${mprFmtCount(bucket.byCat[cat][key])}</td>`;
        }
        const exceedRow = `<tr>
          <td rowspan="2" style="${tdStyle}">${sl}</td>
          <td rowspan="2" style="${tdLeft}">${row.clientType}</td>
          <td rowspan="2" style="${tdStyle}">${mprFmtCount(row.duringMonth.samples)}</td>
          <td rowspan="2" style="${tdStyle}">${mprFmtCount(row.cumulative.samples)}</td>
          <td style="${tdStyle}">Exceed</td>
          ${MPR_CATEGORIES.map(cat => catCell(row.duringMonth, cat, "exceed")).join("")}
          <td rowspan="2" style="${tdStyle}">${mprFmtCount(row.duringMonth.total)}</td>
          <td rowspan="2" style="${tdStyle}">${mprFmtCount(row.cumulative.total)}</td>
          <td rowspan="2" style="${tdStyle}">${mprFmtRevenue(row.duringMonth.revenue)}</td>
          <td rowspan="2" style="${tdStyle}">${mprFmtRevenue(row.cumulative.revenue)}</td>
          <td rowspan="2" style="${tdStyle}"></td>
        </tr>`;
        const nonExceedRow = `<tr>
          <td style="${tdStyle}">Non-Exceed</td>
          ${MPR_CATEGORIES.map(cat => catCell(row.duringMonth, cat, "nonExceed")).join("")}
        </tr>`;
        return exceedRow + nonExceedRow;
      }).join("");

  const totalRow = stats.rows.length === 0 ? "" : `<tr style="background:#f0f9ff;font-weight:bold;">
    <td colspan="2" style="${tdLeft}border-top:2px solid #111;">Total</td>
    <td style="${tdStyle}border-top:2px solid #111;">${mprFmtCount(stats.totals.duringMonth.samples)}</td>
    <td style="${tdStyle}border-top:2px solid #111;">${mprFmtCount(stats.totals.cumulative.samples)}</td>
    <td style="${tdStyle}border-top:2px solid #111;"></td>
    ${MPR_CATEGORIES.map(cat => `<td style="${tdStyle}border-top:2px solid #111;">${mprFmtCount(stats.totals.duringMonth.byCat[cat].exceed + stats.totals.duringMonth.byCat[cat].nonExceed)}</td>`).join("")}
    <td style="${tdStyle}border-top:2px solid #111;">${mprFmtCount(stats.totals.duringMonth.total)}</td>
    <td style="${tdStyle}border-top:2px solid #111;">${mprFmtCount(stats.totals.cumulative.total)}</td>
    <td style="${tdStyle}border-top:2px solid #111;">${mprFmtRevenue(stats.totals.duringMonth.revenue)}</td>
    <td style="${tdStyle}border-top:2px solid #111;">${mprFmtRevenue(stats.totals.cumulative.revenue)}</td>
    <td style="${tdStyle}border-top:2px solid #111;"></td>
  </tr>`;

  const legend = `<div style="font-size:11px;margin-top:8px;">
    <strong>Bangladesh Standard</strong> — ${MPR_CATEGORIES.map(cat => `${cat}: ${stats.bdStandardByCategory[cat] ? stats.bdStandardByCategory[cat] : "&mdash;"}`).join(" &nbsp;|&nbsp; ")}
  </div>`;

  return `<table style="width:100%;border-collapse:collapse;font-size:11px;">
    <thead>
      <tr>
        <th rowspan="2" style="${thStyle}">SL.<br>No.</th>
        <th rowspan="2" style="${thStyle}">Name of Requested<br>Organization/ Project</th>
        <th colspan="2" style="${thStyle}">Number of Sample Tested</th>
        <th colspan="5" style="${thStyle}">Number of Parameter Tested (During this Month)</th>
        <th colspan="2" style="${thStyle}">Total Number of<br>Parameter Tested</th>
        <th colspan="2" style="${thStyle}">Revenue (TK.)</th>
        <th rowspan="2" style="${thStyle}">Remarks</th>
      </tr>
      <tr>
        <th style="${thStyle}">During this<br>month</th>
        <th style="${thStyle}">${stats.fyStartLabel}</th>
        <th style="${thStyle}">Bangladesh<br>Standard</th>
        <th style="${thStyle}">As</th>
        <th style="${thStyle}">Fe</th>
        <th style="${thStyle}">Cl</th>
        <th style="${thStyle}">Others</th>
        <th style="${thStyle}">During this<br>month</th>
        <th style="${thStyle}">${stats.fyStartLabel}</th>
        <th style="${thStyle}">During this<br>month</th>
        <th style="${thStyle}">${stats.fyStartLabel}</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}${totalRow}</tbody>
  </table>${legend}`;
}

// Builds the full printable HTML document — same letterhead/CSS pattern as
// buildReportHtml() above, so the popup this opens looks and behaves like
// every other official report this app prints.
function buildMonthlyProgressReportHtml({ labIdentity, stats, signatory }) {
  const resolveLogoUrl = src => {
    if (!src) return src;
    try { return new URL(src, document.baseURI).href; } catch (e) { return src; }
  };
  const logoLeftSrc = resolveLogoUrl(labIdentity.leftLogoDataUrl || labIdentity.leftLogoUrl || "assets/logo_left.png");
  const logoRightSrc = resolveLogoUrl(labIdentity.rightLogoDataUrl || labIdentity.rightLogoUrl || "assets/logo_right.png");
  const logoLeft = logoLeftSrc ? `<img src="${logoLeftSrc}" style="height:56px" onerror="this.style.display='none'">` : "";
  const logoRight = logoRightSrc ? `<img src="${logoRightSrc}" style="height:56px" onerror="this.style.display='none'">` : "";
  const tableHtml = buildMonthlyProgressReportTableHtml(stats);
  const sig = signatory || {};

  return `<!DOCTYPE html><html><head><title>Monthly Progress Report - ${stats.monthLabel}</title><style>
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; margin: 0; padding: 24px; color: #111; font-size: 13px; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .header-table td { border: 2px solid #111; padding: 6px; vertical-align: middle; }
    .header-table .logo-cell { width: 70px; text-align: center; }
    .header-table .org-cell { text-align: center; font-weight: bold; }
    .org-cell .line1, .org-cell .line2, .org-cell .line3 { margin: 1px 0; }
    .org-cell .lab-name { margin: 2px 0; }
    .org-cell .contact { font-weight: normal; font-size: 11px; margin-top: 2px; }
    .report-title { text-align: center; font-weight: bold; text-decoration: underline; margin: 14px 0 4px; font-size: 14px; }
    .month-line { text-align: center; font-weight: bold; margin: 0 0 12px; font-size: 13px; }
    table th, table td { word-break: break-word; }
    .sign-block { margin-top: 40px; text-align: right; font-size: 12px; line-height: 1.5; }
    @media print { body { padding: 10px; } }
  </style></head><body>
    <table class="header-table"><tr>
      <td class="logo-cell">${logoLeft}</td>
      <td class="org-cell">
        <div class="line1">${labIdentity.orgLine1 || ""}</div>
        <div class="line2">${labIdentity.orgLine2 || ""}</div>
        <div class="line3">${labIdentity.orgLine3 || ""}</div>
        <div class="lab-name">${labIdentity.labName || ""}</div>
        <div class="contact">${labIdentity.phone ? "Phone: " + labIdentity.phone : ""}${labIdentity.phone && labIdentity.email ? ", " : ""}${labIdentity.email ? "E-mail: " + labIdentity.email : ""}</div>
      </td>
      <td class="logo-cell">${logoRight}</td>
    </tr></table>
    <div class="report-title">Monthly Progress Report of Water Quality Test</div>
    <div class="month-line">Name of the Month: ${stats.monthLabel}</div>
    ${tableHtml}
    <div class="sign-block">
      ${sig.designation || "Senior Chemist"}<br>
      ${sig.line1 || labIdentity.labName || ""}${sig.line2 ? "<br>" + sig.line2 : ""}
    </div>
    <script>window.print();</script>
  </body></html>`;
}

function buildChemicalUsageReportHtml({ labIdentity, startDate, endDate, tableHtml, signatory }) {
  const resolveLogoUrl = src => {
    if (!src) return src;
    try { return new URL(src, document.baseURI).href; } catch (e) { return src; }
  };
  const logoLeftSrc = resolveLogoUrl(labIdentity.leftLogoDataUrl || labIdentity.leftLogoUrl || "assets/logo_left.png");
  const logoRightSrc = resolveLogoUrl(labIdentity.rightLogoDataUrl || labIdentity.rightLogoUrl || "assets/logo_right.png");
  const logoLeft = logoLeftSrc ? `<img src="${logoLeftSrc}" style="height:56px" onerror="this.style.display='none'">` : "";
  const logoRight = logoRightSrc ? `<img src="${logoRightSrc}" style="height:56px" onerror="this.style.display='none'">` : "";
  const sig = signatory || {};

  return `<!DOCTYPE html><html><head><title>Chemical Inventory Usage Report</title><style>
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; margin: 0; padding: 24px; color: #111; font-size: 13px; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .header-table td { border: 2px solid #111; padding: 6px; vertical-align: middle; }
    .header-table .logo-cell { width: 70px; text-align: center; }
    .header-table .org-cell { text-align: center; font-weight: bold; }
    .org-cell .line1, .org-cell .line2, .org-cell .line3 { margin: 1px 0; }
    .org-cell .lab-name { margin: 2px 0; }
    .org-cell .contact { font-weight: normal; font-size: 11px; margin-top: 2px; }
    .report-title { text-align: center; font-weight: bold; text-decoration: underline; margin: 14px 0 4px; font-size: 14px; }
    .month-line { text-align: center; font-weight: bold; margin: 0 0 12px; font-size: 13px; }
    table th, table td { word-break: break-word; }
    .sign-block { margin-top: 40px; text-align: right; font-size: 12px; line-height: 1.5; }
    .report-content { margin-top: 20px; }
    @media print { body { padding: 10px; } }
  </style></head><body>
    <table class="header-table"><tr>
      <td class="logo-cell">${logoLeft}</td>
      <td class="org-cell">
        <div class="line1">${labIdentity.orgLine1 || ""}</div>
        <div class="line2">${labIdentity.orgLine2 || ""}</div>
        <div class="line3">${labIdentity.orgLine3 || ""}</div>
        <div class="lab-name">${labIdentity.labName || ""}</div>
        <div class="contact">${labIdentity.phone ? "Phone: " + labIdentity.phone : ""}${labIdentity.phone && labIdentity.email ? ", " : ""}${labIdentity.email ? "E-mail: " + labIdentity.email : ""}</div>
      </td>
      <td class="logo-cell">${logoRight}</td>
    </tr></table>
    <div class="report-title">Chemical Inventory Usage Report</div>
    <div class="month-line">Period: ${startDate} to ${endDate}</div>
    <div class="report-content">
      ${tableHtml}
    </div>
    <div class="sign-block">
      ${sig.designation || "Senior Chemist"}<br>
      ${sig.line1 || labIdentity.labName || ""}${sig.line2 ? "<br>" + sig.line2 : ""}
    </div>
    <script>window.print();</script>
  </body></html>`;
}

function buildEquipmentUsageReportHtml({ labIdentity, startDate, endDate, tableHtml, signatory }) {
  const resolveLogoUrl = src => {
    if (!src) return src;
    try { return new URL(src, document.baseURI).href; } catch (e) { return src; }
  };
  const logoLeftSrc = resolveLogoUrl(labIdentity.leftLogoDataUrl || labIdentity.leftLogoUrl || "assets/logo_left.png");
  const logoRightSrc = resolveLogoUrl(labIdentity.rightLogoDataUrl || labIdentity.rightLogoUrl || "assets/logo_right.png");
  const logoLeft = logoLeftSrc ? `<img src="${logoLeftSrc}" style="height:56px" onerror="this.style.display='none'">` : "";
  const logoRight = logoRightSrc ? `<img src="${logoRightSrc}" style="height:56px" onerror="this.style.display='none'">` : "";
  const sig = signatory || {};

  return `<!DOCTYPE html><html><head><title>Equipment Utilization & Maintenance Report</title><style>
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; margin: 0; padding: 24px; color: #111; font-size: 13px; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .header-table td { border: 2px solid #111; padding: 6px; vertical-align: middle; }
    .header-table .logo-cell { width: 70px; text-align: center; }
    .header-table .org-cell { text-align: center; font-weight: bold; }
    .org-cell .line1, .org-cell .line2, .org-cell .line3 { margin: 1px 0; }
    .org-cell .lab-name { margin: 2px 0; }
    .org-cell .contact { font-weight: normal; font-size: 11px; margin-top: 2px; }
    .report-title { text-align: center; font-weight: bold; text-decoration: underline; margin: 14px 0 4px; font-size: 14px; }
    .month-line { text-align: center; font-weight: bold; margin: 0 0 12px; font-size: 13px; }
    table th, table td { word-break: break-word; }
    .sign-block { margin-top: 40px; text-align: right; font-size: 12px; line-height: 1.5; }
    .report-content { margin-top: 20px; }
    @media print { body { padding: 10px; } }
  </style></head><body>
    <table class="header-table"><tr>
      <td class="logo-cell">${logoLeft}</td>
      <td class="org-cell">
        <div class="line1">${labIdentity.orgLine1 || ""}</div>
        <div class="line2">${labIdentity.orgLine2 || ""}</div>
        <div class="line3">${labIdentity.orgLine3 || ""}</div>
        <div class="lab-name">${labIdentity.labName || ""}</div>
        <div class="contact">${labIdentity.phone ? "Phone: " + labIdentity.phone : ""}${labIdentity.phone && labIdentity.email ? ", " : ""}${labIdentity.email ? "E-mail: " + labIdentity.email : ""}</div>
      </td>
      <td class="logo-cell">${logoRight}</td>
    </tr></table>
    <div class="report-title">Equipment Utilization & Maintenance Report</div>
    <div class="month-line">Period: ${startDate} to ${endDate}</div>
    <div class="report-content">
      ${tableHtml}
    </div>
    <div class="sign-block">
      ${sig.designation || "Senior Chemist"}<br>
      ${sig.line1 || labIdentity.labName || ""}${sig.line2 ? "<br>" + sig.line2 : ""}
    </div>
    <script>window.print();</script>
  </body></html>`;
}

