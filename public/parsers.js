/* Card-export parsers. Pure functions: rows (array of arrays from SheetJS) -> {statements, txns, warnings}.
   Works in the browser (window.KupaParsers) and in Node (module.exports) for tests. */
(function (root) {
  'use strict';

  const clean = (v) => (v == null ? '' : String(v).replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim());
  const num = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/[₪$€£,\s‎‏‪-‮]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  function toISODate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') { // Excel serial
      const d = new Date(Math.round((v - 25569) * 86400000));
      return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    const m = String(v).trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (!m) return null;
    let y = +m[3]; if (y < 100) y += 2000;
    return iso(y, +m[2], +m[1]);
  }

  const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  function parseInstallment(text) {
    const m = clean(text).match(/תשלום\s*(\d+)\s*מתוך\s*(\d+)/);
    return m ? { n: +m[1], of: +m[2] } : null;
  }

  const CUR = { '₪': 'ILS', 'ש"ח': 'ILS', 'שח': 'ILS', '$': 'USD', 'דולר': 'USD', '€': 'EUR', 'אירו': 'EUR', '£': 'GBP' };
  const curCode = (s) => CUR[clean(s)] || (clean(s) ? clean(s) : 'ILS');

  /* ---------- Isracard / Amex (same portal export) ---------- */
  function isIsracard(rows) {
    return rows.some((r) => r && clean(r[0]) === 'תאריך רכישה' && r.some((c) => clean(c).startsWith("מס' שובר")));
  }

  function parseIsracard(rows) {
    const out = { issuer: 'isracard', statements: [], txns: [], warnings: [] };
    let monthYear = null; // from "נובמבר 2026"
    let st = null; let cols = null; let inTable = false;

    const finishStatement = () => { if (st) out.statements.push(st); st = null; inTable = false; };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      const a = clean(r[0]);
      // statement month, e.g. row: ['פירוט עסקאות', null, 'אוקטובר 2026']
      for (const c of r) {
        const m = clean(c).match(new RegExp('^(' + HEB_MONTHS.join('|') + ')\\s+(\\d{4})$'));
        if (m) monthYear = { m: HEB_MONTHS.indexOf(m[1]) + 1, y: +m[2] };
      }
      // card header: "AMEX FLYCARD PREMIUM - 6013" ... "₪ 37,442.89"
      const cardM = a.match(/^(.*?)\s*-\s*(\d{4})$/);
      if (cardM && r.slice(1).some((c) => /₪/.test(clean(c)))) {
        finishStatement();
        const totalCell = r.slice(1).map(clean).find((c) => /₪/.test(c));
        st = { card: cardM[2], cardName: cardM[1] || 'כרטיס', headerTotal: num(totalCell), billingDate: null, rowsTotal: 0, count: 0, statedTotal: null };
        continue;
      }
      if (st && !st.billingDate) {
        for (const c of r) {
          const m = clean(c).match(/לחיוב ב-?\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/);
          if (m) {
            let y = m[3] ? +m[3] : (monthYear ? monthYear.y : new Date().getFullYear());
            if (y < 100) y += 2000;
            st.billingDate = iso(y, +m[2], +m[1]);
          }
        }
      }
      if (a === 'תאריך רכישה') {
        if (!st) { st = { card: '????', cardName: 'כרטיס', headerTotal: null, billingDate: null, rowsTotal: 0, count: 0, statedTotal: null }; out.warnings.push('לא זוהה מספר כרטיס בקובץ'); }
        cols = {};
        r.forEach((c, j) => { cols[clean(c)] = j; });
        inTable = true;
        continue;
      }
      if (inTable) {
        const b = clean(r[1]);
        if (/^סה"כ/.test(b)) { st.statedTotal = num(r[cols['סכום חיוב']]); inTable = false; continue; }
        const date = toISODate(r[cols['תאריך רכישה']]);
        if (!date) { if (!r.some((c) => clean(c))) inTable = false; continue; }
        const chargeCur = curCode(r[cols['מטבע חיוב']]);
        const detail = clean(r[cols['פירוט נוסף']]);
        const t = {
          issuer: 'isracard', card: st.card, date, merchant: b,
          amountOrig: num(r[cols['סכום עסקה']]), currency: curCode(r[cols['מטבע עסקה']]),
          amount: num(r[cols['סכום חיוב']]), chargeCurrency: chargeCur,
          voucher: clean(r[cols["מס' שובר"]]), notes: detail, sector: '',
          inst: parseInstallment(detail), pending: false, billingDate: null,
          abroad: /חו"ל/.test(detail) || curCode(r[cols['מטבע עסקה']]) !== 'ILS',
          standing: /הוראת קבע/.test(detail),
        };
        if (chargeCur !== 'ILS') out.warnings.push(`עסקה ב-${b} חויבה במטבע ${chargeCur} — נספרת כפי שהיא`);
        st.rowsTotal += t.amount || 0; st.count++;
        t._st = st;
        out.txns.push(t);
      }
    }
    finishStatement();
    for (const t of out.txns) { t.billingDate = t._st.billingDate; delete t._st; }
    for (const s of out.statements) s.rowsTotal = Math.round(s.rowsTotal * 100) / 100;
    // keys: voucher is unique per transaction; installments repeat it, so add n
    for (const t of out.txns) t.key = ['isr', t.card, t.voucher || (t.date + '|' + t.merchant + '|' + t.amountOrig), t.inst ? t.inst.n : 0].join('|');
    return out;
  }

  /* ---------- Isracard / Amex "Export" (.xls) — several cards per file, domestic + abroad sections ---------- */
  function isIsracardExport(rows) {
    return rows.some((r) => r && /-\s*\d{4}$/.test(clean(r[0])) && clean(r[1]) === 'מועד חיוב') ||
      rows.some((r) => r && clean(r[0]) === 'תאריך רכישה' && r.some((c) => clean(c) === 'מספר שובר'));
  }

  function parseIsracardExport(rows) {
    const out = { issuer: 'isracard', format: 'export', statements: [], txns: [], warnings: [] };
    let st = null; let mode = null; let cols = null;
    const newSt = (card, name, billing) => ({ card, cardName: name, headerTotal: null, billingDate: billing, rowsTotal: 0, count: 0, statedTotal: null, _dom: null, _abr: null });
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      const a = clean(r[0]); const b = clean(r[1]);
      const cardM = a.match(/^(.*?)\s*-\s*(\d{4})$/);
      if (cardM && b === 'מועד חיוב') {
        if (st) out.statements.push(st);
        st = newSt(cardM[2], cardM[1], toISODate(r[2]));
        mode = null; continue;
      }
      if (/^עסקאות בארץ/.test(a)) { mode = 'dom'; cols = null; continue; }
      if (/^עסקאות בחו/.test(a)) { mode = 'abr'; cols = null; continue; }
      if (a === 'תאריך רכישה') { cols = {}; r.forEach((c, j) => { if (clean(c)) cols[clean(c)] = j; }); continue; }
      if (!st || !cols) continue;
      // section totals (checked before dates: the domestic total row starts with a date)
      if (/^סך חיוב/.test(b)) { st._dom = (st._dom || 0) + (num(r[cols['סכום חיוב']]) || 0); cols = null; continue; }
      if (r.some((c) => clean(c) === 'TOTAL FOR DATE')) { st._abr = (st._abr || 0) + (num(r[cols['סכום מקורי']]) || 0); continue; }
      const date = toISODate(r[cols['תאריך רכישה']]);
      if (!date) continue;
      let t;
      if (mode === 'abr') {
        const cur = curCode(r[cols['מטבע מקור']]);
        t = { issuer: 'isracard', card: st.card, date, merchant: clean(r[cols['שם בית עסק']]),
          amountOrig: num(r[cols['סכום מקורי']]), currency: cur, amount: num(r[cols['סכום חיוב']]), chargeCurrency: curCode(r[cols['מטבע לחיוב']]),
          voucher: '', notes: 'חו"ל', sector: '', inst: null, pending: false,
          billingDate: toISODate(r[cols['תאריך חיוב']]) || st.billingDate, abroad: true, standing: false };
      } else {
        const detail = clean(r[cols['פירוט נוסף']]);
        t = { issuer: 'isracard', card: st.card, date, merchant: clean(r[cols['שם בית עסק']]),
          amountOrig: num(r[cols['סכום עסקה']]), currency: curCode(r[cols['מטבע מקור']]), amount: num(r[cols['סכום חיוב']]), chargeCurrency: curCode(r[cols['מטבע לחיוב']]),
          voucher: clean(r[cols['מספר שובר']]), notes: detail, sector: '', inst: parseInstallment(detail), pending: false,
          billingDate: st.billingDate, abroad: /חו"ל|חו˝ל/.test(detail), standing: /הוראת קבע/.test(detail) };
      }
      st.rowsTotal += t.amount || 0; st.count++;
      out.txns.push(t);
    }
    if (st) out.statements.push(st);
    for (const x of out.statements) {
      x.rowsTotal = Math.round(x.rowsTotal * 100) / 100;
      if (x._dom != null || x._abr != null) x.statedTotal = Math.round(((x._dom || 0) + (x._abr || 0)) * 100) / 100;
      delete x._dom; delete x._abr;
    }
    const seen = {};
    for (const t of out.txns) {
      const base = t.voucher ? ['isx', t.card, t.voucher, t.inst ? t.inst.n : 0].join('|')
        : ['isx', t.card, t.date, t.merchant, t.amountOrig, t.currency].join('|');
      seen[base] = (seen[base] || 0) + 1;
      t.key = base + (t.voucher ? '' : '|' + seen[base]);
    }
    return out;
  }

  /* ---------- Cal / Diners ---------- */
  function isCal(rows) {
    return rows.slice(0, 8).some((r) => r && /המסתיים ב-?\s*\d{4}/.test(clean(r[0]))) ||
      rows.some((r) => r && clean(r[0]).replace(/\s/g, '') === 'תאריךעסקה' && r.some((c) => clean(c).replace(/\s/g, '') === 'סכוםחיוב'));
  }

  function parseCal(rows) {
    const out = { issuer: 'cal', statements: [], txns: [], warnings: [] };
    const st = { card: '????', cardName: 'כאל', headerTotal: null, billingDate: null, rowsTotal: 0, count: 0, statedTotal: null, pendingILS: null };
    let cols = null; let headerFound = false;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      const a = clean(r[0]);
      let m = a.match(/המסתיים ב-?\s*(\d{4})/);
      if (m) { st.card = m[1]; const n = a.match(/לכרטיס\s+(.*?)\s+המסתיים/); if (n) st.cardName = n[1]; continue; }
      m = a.match(/לחיוב ב-?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*:\s*([\d,.]+)/);
      if (m) { let y = +m[3]; if (y < 100) y += 2000; st.billingDate = iso(y, +m[2], +m[1]); st.statedTotal = num(m[4]); continue; }
      if (!headerFound && a.replace(/\s/g, '') === 'תאריךעסקה') {
        cols = {}; r.forEach((c, j) => { cols[clean(c).replace(/\s/g, '')] = j; });
        headerFound = true; continue;
      }
      if (headerFound) {
        const date = toISODate(r[cols['תאריךעסקה']]);
        if (!date) continue;
        const notes = clean(r[cols['הערות']]);
        const type = clean(r[cols['סוגעסקה']]);
        const charge = num(r[cols['סכוםחיוב']]);
        const orig = num(r[cols['סכוםעסקה']]);
        const pending = /בקליטה/.test(notes) || charge == null;
        const merchant = clean(r[cols['שםביתעסק']]);
        const foreign = /\b(USA|USD|GBR|DEU|FRA|NLD|IRL)\b|\.COM\//i.test(merchant) || /חו"ל/.test(notes + type);
        const t = {
          issuer: 'cal', card: st.card, date, merchant,
          amountOrig: orig, currency: foreign ? '?' : 'ILS',
          amount: pending ? (foreign ? null : orig) : charge, chargeCurrency: 'ILS',
          voucher: '', notes: [type, notes].filter(Boolean).join(' · '), sector: clean(r[cols['ענף']]),
          inst: parseInstallment(notes) || parseInstallment(type), pending,
          billingDate: st.billingDate, billingEst: pending, abroad: foreign, standing: /הוראת קבע/.test(type + notes),
        };
        if (!pending) { st.rowsTotal += charge || 0; st.count++; }
        out.txns.push(t);
      }
    }
    st.rowsTotal = Math.round(st.rowsTotal * 100) / 100;
    out.statements.push(st);
    // no voucher in Cal exports: key on content + occurrence index for identical rows
    const seen = {};
    for (const t of out.txns) {
      const base = ['cal', t.card, t.date, t.merchant, t.amountOrig, t.inst ? t.inst.n : 0].join('|');
      seen[base] = (seen[base] || 0) + 1;
      t.key = base + '|' + seen[base];
    }
    const pend = out.txns.filter((t) => t.pending);
    if (pend.length) out.warnings.push(`${pend.length} עסקאות עדיין "בקליטה" — ייובאו כזמניות ויתעדכנו בייבוא הבא`);
    if (pend.some((t) => t.amount == null)) out.warnings.push('עסקת מט"ח בקליטה — הסכום בש"ח עוד לא ידוע ולא ייספר עד שתתעדכן');
    return out;
  }

  /* ---------- Cal "פירוט עסקאות וזיכויים" — many cards, many months, one sheet; ILS amount + billing date per row ---------- */
  const norm = (c) => clean(c).replace(/\s/g, '');
  function isCalTxList(rows) {
    return rows.slice(0, 10).some((r) => r && norm(r[0]) === 'תאריךעסקה' && r.some((c) => norm(c) === 'כרטיס') && r.some((c) => norm(c) === 'מועדחיוב'));
  }
  const FX = { '$': 'USD', '€': 'EUR', '£': 'GBP' };
  function addMonthsISO(iso, k) {
    const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 + k, +iso.slice(8, 10)));
    return d.toISOString().slice(0, 10);
  }

  function parseCalTxList(rows) {
    const out = { issuer: 'cal', format: 'txlist', statements: [], txns: [], warnings: [] };
    let cols = null; let stated = null; const raw = [];
    for (const r of rows) {
      if (!r) continue;
      if (!cols && norm(r[0]) === 'תאריךעסקה') { cols = {}; r.forEach((c, j) => { if (clean(c)) cols[norm(c)] = j; }); continue; }
      if (!cols) continue;
      if (r.some((c) => /^סה"כ עסקאות/.test(clean(c)))) { const i = r.findIndex((c) => /^סה"כ עסקאות/.test(clean(c))); stated = num(r[i + 1]); continue; }
      const date = toISODate(r[cols['תאריךעסקה']]);
      if (!date) continue;
      raw.push(r);
    }
    let skipped = 0;
    for (const r of raw) {
      const cardTxt = clean(r[cols['כרטיס']]);
      const m4 = cardTxt.match(/(\d{4})\s*$/);
      const notes = clean(r[cols['הערות']]);
      const type = clean(r[cols['סוגעסקה']]);
      const amount = num(r[cols['סכוםבש"ח']]);
      const pending = /בקליטה/.test(notes);
      if (amount == null) { skipped++; continue; }
      const fx = notes.match(/סכום העסקה הוא\s*([\d.,]+)\s*(\S+)/);
      const instOf = (notes.match(/ב-?\s*(\d+)\s*תשלומים/) || [])[1];
      out.txns.push({
        issuer: 'cal', card: m4 ? m4[1] : '????', cardName: cardTxt.replace(/\s*\d{4}\s*$/, '') || 'כאל',
        date: toISODate(r[cols['תאריךעסקה']]), merchant: clean(r[cols['שםביתעסק']]),
        amountOrig: fx ? num(fx[1]) : amount, currency: fx ? (FX[fx[2]] || fx[2]) : 'ILS', amount, chargeCurrency: 'ILS',
        voucher: '', notes: [type, notes].filter(Boolean).join(' · '), sector: '',
        inst: instOf ? { n: 0, of: +instOf } : null, pending,
        billingDate: toISODate(r[cols['מועדחיוב']]), billingEst: false,
        abroad: !!fx, standing: /הוראת קבע/.test(type),
      });
    }
    // installments come as N identical-date rows without index or billing date: number them in file order,
    // and estimate billing from the card's other transactions bought within ±3 days (first one), then +1 month each.
    const byCard = {};
    for (const t of out.txns) if (t.billingDate) (byCard[t.card] = byCard[t.card] || []).push(t);
    const estimate = (t) => {
      // nearest regular purchase on the same card: same day first, then the days right after, then right before
      const T = Date.parse(t.date);
      const near = (byCard[t.card] || []).filter((o) => !o.inst && !o.billingEst && Math.abs(Date.parse(o.date) - T) <= 4 * 864e5 && o.billingDate > t.date)
        .sort((x, y) => { const dx = Date.parse(x.date) - T, dy = Date.parse(y.date) - T; return (dx < 0) - (dy < 0) || Math.abs(dx) - Math.abs(dy); });
      return near.length ? near[0].billingDate : null;
    };
    const groups = {};
    for (const t of out.txns) if (t.inst) { const g = [t.card, t.date, t.merchant, t.inst.of].join('|'); (groups[g] = groups[g] || []).push(t); }
    for (const g of Object.values(groups)) {
      const first = estimate(g[0]);
      g.forEach((t, i) => { t.inst.n = (i % t.inst.of) + 1; if (!t.billingDate && first) { t.billingDate = addMonthsISO(first, t.inst.n - 1); t.billingEst = true; } });
    }
    for (const t of out.txns) if (!t.billingDate) { const e = estimate(t); if (e) { t.billingDate = e; t.billingEst = true; } }

    // statements: per card (no printed per-card total) + one overall check against the file's total (excludes pending)
    const cards = {};
    for (const t of out.txns) {
      const st = (cards[t.card] = cards[t.card] || { card: t.card, cardName: t.cardName, headerTotal: null, billingDate: null, rowsTotal: 0, count: 0, statedTotal: null });
      if (!t.pending) { st.rowsTotal += t.amount; st.count++; }
      if (t.billingDate && (!st.billingDate || t.billingDate > st.billingDate)) st.billingDate = t.billingDate;
    }
    const all = { card: '*', label: 'כל הכרטיסים', cardName: '', headerTotal: null, billingDate: null, rowsTotal: 0, count: 0, statedTotal: stated };
    for (const st of Object.values(cards)) { st.rowsTotal = Math.round(st.rowsTotal * 100) / 100; all.rowsTotal += st.rowsTotal; all.count += st.count; out.statements.push(st); }
    all.rowsTotal = Math.round(all.rowsTotal * 100) / 100;
    out.statements.push(all);

    // same key scheme as the other Cal format, so the two never double count
    const seen = {};
    for (const t of out.txns) {
      const base = ['cal', t.card, t.date, t.merchant, t.amountOrig, t.inst ? t.inst.n : 0].join('|');
      seen[base] = (seen[base] || 0) + 1;
      t.key = base + '|' + seen[base];
      delete t.cardName;
    }
    const pend = out.txns.filter((t) => t.pending).length;
    if (pend) out.warnings.push(`${pend} עסקאות "בקליטה" — ייובאו כזמניות ויתעדכנו בייבוא הבא`);
    if (skipped) out.warnings.push(`${skipped} עסקאות בקליטה בלי סכום בש"ח (מט"ח) — לא יובאו; יגיעו בייבוא הבא`);
    const inst = Object.keys(groups).length;
    if (inst) out.warnings.push(`${inst} עסקאות תשלומים — בקובץ אין מספר תשלום ותאריך חיוב, אז הם מוערכים לפי עסקאות אחרות באותו כרטיס`);
    return out;
  }

  function parseRows(rows) {
    if (isIsracard(rows)) return parseIsracard(rows);
    if (isIsracardExport(rows)) return parseIsracardExport(rows);
    if (isCalTxList(rows)) return parseCalTxList(rows);
    if (isCal(rows)) return parseCal(rows);
    return null;
  }

  /* checksum: sum of parsed charges must equal the total the issuer printed */
  function verify(res) {
    return res.statements.map((s) => {
      const expected = s.statedTotal != null ? s.statedTotal : s.headerTotal;
      const ok = expected == null ? null : Math.abs(expected - s.rowsTotal) < 0.05;
      return { card: s.card, label: s.label, expected, got: s.rowsTotal, ok, count: s.count, billingDate: s.billingDate };
    });
  }

  const api = { parseRows, verify, toISODate, parseInstallment, clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KupaParsers = api;
})(typeof window !== 'undefined' ? window : globalThis);
