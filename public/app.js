/* Kupa — personal budget vs actual. All data lives encrypted on the server; this file runs only in the browser. */
(function () {
  'use strict';
  const VERSION = '3.12'; // bump on every change: 1.0 initial · 1.2 auto-lock 3 min · 1.3 version label · 1.4 multi-select, new category from any menu, Amex Export (.xls) format · 1.5 stay unlocked across refresh, report drill-down · 1.6 billing-month basis (default), both dates on transactions · 1.7 report by card · 1.8 Cal 'transactions & credits' format · 1.9 exclude cards · 2.0 searchable A-Z category picker · 2.1 remember BIT/PAYBOX category (opt-in) · 2.2 amount range filter · 2.3 rules manager (amount rules, run one rule, rule drill-down, lock from auto) · 2.4 sort transactions · 2.5 sort rules · 2.6 rule month range + day-of-month range, matching list in editor · 2.7 month range + day range moved to transaction filters · 2.8 quick-classify assistant · 2.9 rules import, Google lookup, by-card report counts only counted spending · 3.0 import: edit category per row, confidence filter · 3.1 import: new / already-exists filter · 3.2 import filter counts respect each other · 3.3 investments module · 3.4 investments: spreadsheet-style entry + paste a table · 3.5 investments: upload xlsx/csv · 3.6 Isracard 'not yet recorded' transactions · 3.7 category groups · 3.8 quick-update tab (group → category → transactions) · 3.9 Excel export, quick: single month, add group, hide empty rows · 3.10 quick: expenses sorted by amount · 3.11 wide editor tab · 3.12 month-vs-month comparison report
  const VERSION_DATE = '12.10.26';
  const EMPTY_F = () => ({ q: '', cat: '', group: '', card: '', month: '', onlyNone: false, abroad: false, standing: false, min: '', max: '', rule: '', mFrom: '', mTo: '', dFrom: '', dTo: '' });
  const S = window.KupaStore;
  const P = window.KupaParsers;
  const $app = document.getElementById('app');

  /* ---------------- helpers ---------------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'style') el.style.cssText = v; // CSSOM — allowed under strict CSP, unlike the style attribute
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    for (const kid of kids.flat()) if (kid != null) el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const ICONS = {
    month: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
    trend: 'M3 17l6-6 4 4 8-8M14 7h7v7',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
    plus: 'M12 5v14M5 12h14', prev: 'M9 6l6 6-6 6', next: 'M15 6l-6 6 6 6', x: 'M6 6l12 12M18 6L6 18',
    lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
    layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
    download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    g_travel: 'M12 4a9 8 0 0 1 9 8H3a9 8 0 0 1 9-8zM12 12v7a2 2 0 0 0 4 0M12 4v-1',
    g_bag: 'M5 8h14l-1 12H6zM9 8V7a3 3 0 0 1 6 0v1',
    g_coins: 'M5 7c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5S5 8.4 5 7zM5 7v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V7M5 12v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5',
    g_doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
    g_family: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 5.2a3 3 0 0 1 0 5.6M18 14.5a5.5 5.5 0 0 1 3 5.5',
    g_home: 'M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5',
    g_food: 'M4 11a8 6 0 0 1 16 0zM4 14.5h16M5 17.5h14a1.2 1.2 0 0 1 0 2.5H5a1.2 1.2 0 0 1 0-2.5z',
    g_car: 'M4 16v-4l2.2-5h11.6l2.2 5v4zM3 16h18M7 16v2.5M17 16v2.5M7.5 12.5h.01M16.5 12.5h.01',
    g_health: 'M12 20s-7-4.4-8.6-9C2.3 7.6 5 4.8 8 5.6c1.9.5 4 3 4 3s2.1-2.5 4-3c3-.8 5.7 2 4.6 5.4C19 15.6 12 20 12 20z',
    g_fun: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM15 7v10',
    g_work: 'M3 8h18v11H3zM9 8V5h6v3M3 13h18',
    g_tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
    g_gift: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1-3-5-4-5-1.5S12 7 12 7zM12 7c1-3 5-4 5-1.5S12 7 12 7z',
    g_pet: 'M8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 13c-3 0-5 3-5 5s2 2 5 2 5 0 5-2-2-5-5-5z', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  };
  const icon = (n) => s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, s('path', { d: ICONS[n] }));

  const nf0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ils = (n, dec) => (n < 0 ? '-' : '') + '₪' + (dec ? nf2 : nf0).format(Math.abs(n || 0));
  const amt = (n, dec) => h('span', { class: 'amt' }, ils(n, dec));
  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const mLabel = (m) => MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
  const mShort = (m) => MONTHS[+m.slice(5, 7) - 1].slice(0, 3) + "' " + m.slice(2, 4);
  const addMonths = (m, k) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const thisMonth = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const fullDate = (iso) => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '';
  const dShort = (iso) => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) : '';
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const round2 = (n) => Math.round(n * 100) / 100;

  let toastTimer;
  function toast(msg) {
    document.querySelectorAll('.toast').forEach((e) => e.remove());
    const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 3500);
  }

  /* ---------------- data model ---------------- */
  // person-to-person transfers. Hebrew has no \b in JS regex, so "ביט" must stand alone (not "ביטוח").
  const P2P = /\bBIT\b|(^|[\s\-"'])ב?ביט($|[\s\-"'])|\bPAYBOX\b|פייבוקס|PEPPER\s*PAY/i;
  const NOT_P2P = /דמי כרטיס|עמלת|עמלה/; // card fees that merely mention the app
  const isP2P = (m) => P2P.test(m || '') && !NOT_P2P.test(m || '');
  const normMerchant = (m) => (m || '').toUpperCase().replace(/\d{4,}/g, '').replace(/[*#]/g, ' ').replace(/\s+/g, ' ').trim();

  function initialData() {
    const C = (name, type = 'expense') => ({ id: uid(), name, type, budget: 0 });
    const cats = [
      C('סופר ומכולת'), C('אוכל בחוץ ומשלוחים'), C('רכב ודלק'), C('תחבורה ומוניות'), C('פארם וטיפוח'), C('בריאות'),
      C('ביגוד והנעלה'), C('אלקטרוניקה'), C('מנויים ותקשורת'), C('פנאי ובילוי'), C('חו"ל ונסיעות'), C('מתנות'),
      C('לימודים וקורסים'), C('בית'), C('אגרות וממשלה'), C('שונות'),
      C('העברות וחיסכון', 'transfer'), C('משכורת', 'income'), C('הכנסה אחרת', 'income'),
    ];
    const id = (n) => cats.find((c) => c.name === n).id;
    const R = (text, cat) => ({ id: uid(), text, cat: id(cat), kind: 'contains', auto: true });
    const rules = [
      ...['סופר פארם', 'SUPER-PHARM', 'SUPER PHARM', 'גוד פארם', 'BE ', 'CVS', 'WALGREENS'].map((t) => R(t, 'פארם וטיפוח')),
      ...['WOLT', 'וולט', '10BIS', 'תן ביס', 'CIBUS', 'סיבוס', 'PIZZA', 'פיצה', 'DOUGHNUT', 'MCDONALD', 'מקדונלד', 'ארומה', 'קפה', 'CAFE', 'COFFEE', 'BURGER', 'בורגר', 'מסעדת', 'RESTAURANT', 'STARBUCKS', 'TST*'].map((t) => R(t, 'אוכל בחוץ ומשלוחים')),
      ...['שופרסל', 'רמי לוי', 'ויקטורי', 'יוחננוף', 'טיב טעם', 'אושר עד', 'יינות ביתן', 'מגה בעיר', 'AM:PM', 'קרפור', 'CARREFOUR', 'סופר', 'מכולת', 'מינימרקט', 'TRADER JOE', 'WHOLE FOODS', 'SAFEWAY', 'WALMART', 'TARGET', 'COSTCO', '7-ELEVEN'].map((t) => R(t, 'סופר ומכולת')),
      ...['סונול', 'SONOL', 'פז ', 'PAZ', 'דלק ', 'DELEK', 'דור אלון', 'TEN ', 'YELLOW', 'פנגו', 'PANGO', 'סלופארק', 'חניון', 'CHEVRON', 'SHELL'].map((t) => R(t, 'רכב ודלק')),
      ...['GETT', 'YANGO', 'UBER', 'LYFT', 'רב-קו', 'רב קו', 'רכבת', 'MOOVIT', 'אגד', 'דן '].map((t) => R(t, 'תחבורה ומוניות')),
      ...['NETFLIX', 'SPOTIFY', 'APPLE.COM', 'GOOGLE', 'YOUTUBE', 'DISNEY', 'OPENAI', 'CHATGPT', 'ANTHROPIC', 'CLAUDE.AI', 'פרטנר', 'סלקום', 'הוט ', 'בזק', 'גולן טלקום', 'פלאפון', 'סלולר', 'AMAZON PRIME'].map((t) => R(t, 'מנויים ותקשורת')),
      ...['אלקטרוניקה', 'KSP', 'באג ', 'IVORY', 'איבורי', 'BEST BUY'].map((t) => R(t, 'אלקטרוניקה')),
      ...['אל על', 'ELAL', 'EL AL', 'ISRAIR', 'ישראייר', 'ארקיע', 'AIRBNB', 'BOOKING', 'HOTEL', 'EXPEDIA', ' INN', 'SUITES', 'MARRIOTT', 'HILTON', 'HYATT', 'AIRLINES', 'UNITED AIR', 'DELTA AIR', 'ALASKA AIR', 'HERTZ', 'AVIS', 'ENTERPRISE RENT', 'TURO', 'DUTY FREE'].map((t) => R(t, 'חו"ל ונסיעות')),
      ...['משרד התחבורה', 'רשות המסים', 'עירית', 'עיריית', 'ביטוח לאומי', 'משרד הפנים'].map((t) => R(t, 'אגרות וממשלה')),
      ...['ZARA', 'H&M', 'קסטרו', 'פוקס', 'FOX', 'NIKE', 'ADIDAS', 'TERMINAL X', 'טרמינל X'].map((t) => R(t, 'ביגוד והנעלה')),
      ...['מכבי', 'כללית', 'מאוחדת', 'לאומית', 'רופא', 'מרפאה'].map((t) => R(t, 'בריאות')),
    ];
    const sectors = { 'אנרגיה': id('רכב ודלק'), 'פנאי בילוי': id('פנאי ובילוי'), 'מוצרי חשמל': id('אלקטרוניקה'), 'מוסדות': id('אגרות וממשלה'), 'מזון': id('סופר ומכולת'), 'מסעדות': id('אוכל בחוץ ומשלוחים'), 'תקשורת': id('מנויים ותקשורת'), 'ביגוד': id('ביגוד והנעלה'), 'רפואה': id('בריאות'), 'תיירות': id('חו"ל ונסיעות'), 'תחבורה': id('תחבורה ומוניות'), 'רכב': id('רכב ודלק') };
    return { schema: 1, created: new Date().toISOString(), settings: { instByBilling: true, autoLockMin: 3, lockV: 2 }, categories: cats, rules, sectors, budgets: {}, txns: [], imports: [], cards: {} };
  }

  const D = () => S.data;
  const catById = (id) => D().categories.find((c) => c.id === id);
  const catName = (id) => (catById(id) || {}).name || 'לסיווג';
  const heCmp = (a, b) => a.localeCompare(b, 'he', { sensitivity: 'base', numeric: true });
  const sortedCats = (type) => D().categories.filter((c) => !type || c.type === type).slice().sort((a, b) => heCmp(a.name, b.name));
  const expenseCats = () => D().categories.filter((c) => c.type === 'expense');

  // Which month a transaction belongs to. Default basis = billing month (the month the card is charged);
  // the home screen can switch to purchase date. Manual entries have no billing date -> their own date.
  function monthOfRaw(t, basis) {
    if (basis !== 'purchase' && t.billingDate) return t.billingDate.slice(0, 7);
    if (t.inst && D().settings.instByBilling && t.billingDate) return t.billingDate.slice(0, 7);
    return t.date.slice(0, 7);
  }
  const monthOf = (t) => monthOfRaw(t, ui.basis);
  const basisLabel = () => (ui.basis === 'purchase' ? 'לפי תאריך עסקה' : 'לפי חודש חיוב');
  // signed contribution: expenses positive, refunds negative; income tracked separately
  // a card switched off in settings: its transactions stay stored but count nowhere and are hidden
  const ignoredCard = (t) => t.source === 'card' && !!(D().cards[t.card] && D().cards[t.card].ignored);
  function parts(t) {
    if (t.excluded || t.amount == null || ignoredCard(t)) return [];
    if (t.splits && t.splits.length) return t.splits.map((sp) => ({ cat: sp.cat, amount: sp.amount }));
    return [{ cat: t.cat || null, amount: t.amount }];
  }
  function cardLabel(t) {
    if (t.source === 'bank') return 'בנק'; if (t.source === 'cash') return 'מזומן';
    const c = D().cards[t.card]; return c ? c.label : t.card;
  }

  /* ---- rules: merchant text (exact name or "contains") + optional amount range -> category ---- */
  const set_ = (v) => v != null && v !== '';
  const hasAmt = (r) => set_(r.min) || set_(r.max);
  const hasDate = (r) => set_(r.mFrom) || set_(r.mTo) || set_(r.dFrom) || set_(r.dTo);
  const hasCond = (r) => hasAmt(r) || hasDate(r);
  function dayIn(day, from, to) { // inclusive; supports wrap-around like 28 → 3
    const f = set_(from) ? +from : 1, t = set_(to) ? +to : 31;
    return f <= t ? day >= f && day <= t : day >= f || day <= t;
  }
  function ruleMatch(r, t) {
    if (!t.merchant || (t.source && t.source !== 'card')) return false; // parsed rows (import) have no source yet
    if (r.kind === 'exact') { if (normMerchant(t.merchant) !== r.text) return false; }
    else if (!t.merchant.toUpperCase().includes(String(r.text).toUpperCase())) return false;
    if (r.min != null && r.min !== '' && !(t.amount != null && t.amount >= +r.min)) return false;
    if (r.max != null && r.max !== '' && !(t.amount != null && t.amount <= +r.max)) return false;
    if (hasDate(r)) { // by purchase date
      const ym = (t.date || '').slice(0, 7);
      if (set_(r.mFrom) && ym < r.mFrom) return false;
      if (set_(r.mTo) && ym > r.mTo) return false;
      if ((set_(r.dFrom) || set_(r.dTo)) && !dayIn(+(t.date || '').slice(8, 10), r.dFrom, r.dTo)) return false;
    }
    return true;
  }
  // most specific first: your rules before built-in, amount rules before plain, exact name before "contains"
  const ruleRank = (r) => (r.auto ? 100 : 0) + (hasCond(r) ? 0 : 10) + (r.kind === 'exact' ? 0 : 1);
  const rankedRules = () => D().rules.map((r, i) => [r, i]).sort((a, b) => ruleRank(a[0]) - ruleRank(b[0]) || a[1] - b[1]).map((x) => x[0]);
  const ruleById = (id) => D().rules.find((r) => r.id === id);
  const ruleText = (r) => (r.kind === 'exact' ? `"${r.text}"` : `מכיל "${r.text}"`) + amtText(r) + dateText(r);
  const mm = (ym) => ym.slice(5, 7) + '/' + ym.slice(2, 4);
  const dateText = (r) => (set_(r.mFrom) || set_(r.mTo) ? ` · חודשים ${set_(r.mFrom) ? mm(r.mFrom) : '…'}–${set_(r.mTo) ? mm(r.mTo) : '…'}` : '') + (set_(r.dFrom) || set_(r.dTo) ? ` · ימים ${set_(r.dFrom) ? r.dFrom : 1}–${set_(r.dTo) ? r.dTo : 31}` : '');
  const amtText = (r) => !hasAmt(r) ? '' : (r.min !== '' && r.min != null && r.max !== '' && r.max != null)
    ? (+r.min === +r.max ? ` · סכום ${ils(+r.min, true)}` : ` · ${ils(+r.min)}–${ils(+r.max)}`)
    : (r.min !== '' && r.min != null ? ` · מ-${ils(+r.min)}` : ` · עד ${ils(+r.max)}`);
  const canAuto = (r, t) => !(r.auto && isP2P(t.merchant)); // transfers: only rules you created yourself

  function classify(t) {
    for (const r of rankedRules()) if (canAuto(r, t) && ruleMatch(r, t)) return { cat: r.cat, src: 'rule', ruleId: r.id };
    if (!isP2P(t.merchant) && t.sector && D().sectors[t.sector]) return { cat: D().sectors[t.sector], src: 'sector', ruleId: null };
    return { cat: null, src: null, ruleId: null };
  }

  // apply one rule to existing transactions (never touches locked ones; manual ones only if asked)
  function runRule(r, includeManual) {
    let n = 0;
    for (const t of D().txns) {
      if (t.noAuto || (!includeManual && t.catSrc === 'manual') || !canAuto(r, t) || !ruleMatch(r, t)) continue;
      if (classify(t).ruleId !== r.id) continue; // a more specific rule wins this one — leave it to that rule
      if (t.cat === r.cat && t.ruleId === r.id && !t.splits) continue;
      t.cat = r.cat; t.catSrc = 'rule'; t.ruleId = r.id; t.splits = null; n++;
    }
    return n;
  }

  function setCategory(t, cat, learn) {
    t.cat = cat; t.catSrc = 'manual'; t.ruleId = null; t.splits = null;
    if (!learn || t.source !== 'card' || !cat) return 0;
    const norm = normMerchant(t.merchant);
    D().rules = D().rules.filter((r) => !(r.kind === 'exact' && r.text === norm && !hasCond(r)));
    const r = { id: uid(), kind: 'exact', text: norm, cat, auto: false, min: '', max: '' };
    D().rules.unshift(r);
    return runRule(r, false);
  }

  /* category groups: a level above categories (expense categories only) */
  const GROUP_ICONS = ['g_travel', 'g_bag', 'g_coins', 'g_doc', 'g_family', 'g_home', 'g_food', 'g_car', 'g_health', 'g_fun', 'g_work', 'g_gift', 'g_pet', 'g_tag'];
  const GROUP_COLORS = ['#2bc4b0', '#f0619c', '#7c74b8', '#36bfe3', '#4cbf59', '#c45fd8', '#f59e0b', '#e3b512', '#ef5b6b', '#a67ef0', '#3b82f6', '#64748b'];
  const DEFAULT_GROUPS = [
    ['travel', 'חופשות וטיולים', 'g_travel', 0, /חו"ל|נסיע|טיול|חופש|מלון|טיס/],
    ['eat', 'אוכלים בחוץ', 'g_food', 6, /אוכל בחוץ|מסעד|משלוח|קפה|בר(ים)?$/],
    ['car', 'רכב ותחבורה', 'g_car', 7, /רכב|דלק|תחבור|מונית|חני|ליסינג|טסט/],
    ['health', 'בריאות וטיפוח אישי', 'g_health', 8, /בריאות|פארם|טיפוח|רופא|תרופ|שיניים|קוסמטי|ספר(ות)?$/],
    ['fin', 'שירותים פיננסיים', 'g_doc', 3, /ביטוח|עמל|בנק|ריבית|הלוואה|משכנתא|אגרות|ממשלה|מיסים|מס /],
    ['family', 'ילדים, משפחה והשכלה', 'g_family', 4, /לימוד|קורס|ילד|גן |חינוך|השכלה|משפחה|חוג|בית ספר/],
    ['home', 'משק בית', 'g_home', 5, /בית|חשמל|מים|ארנונה|גז|ועד|שכירות|תקשורת|מנוי|ניקיון|תחזוק/],
    ['fun', 'פנאי, תרבות והעשרה', 'g_fun', 9, /פנאי|בילוי|תרבות|הופע|סרט|ספרים|ספורט|כושר|תחביב/],
    ['shop', 'עושים קניות', 'g_bag', 1, /סופר|מכולת|ביגוד|הנעלה|אלקטרוניקה|מתנ|קניות|ריהוט|צעצוע/],
    ['biz', 'שירותים עסקיים', 'g_work', 10, /עסק/],
    ['misc', 'שונות', 'g_coins', 2, null],
  ];
  const groups = () => D().groups || [];
  const groupById = (id) => groups().find((g) => g.id === id);
  const miscGroup = () => groups().find((g) => g.key === 'misc') || groups()[groups().length - 1];
  // every expense category belongs to exactly one group; unknown or missing -> "שונות"
  const groupOf = (c) => (c && c.type === 'expense' ? groupById(c.group) || miscGroup() : null);
  const guessGroup = (name) => { const d = DEFAULT_GROUPS.find((g) => g[4] && g[4].test(name || '')); const k = d ? d[0] : 'misc'; const g = groups().find((x) => x.key === k); return g ? g.id : (miscGroup() || {}).id; };
  const catsOfGroup = (gid) => expenseCats().filter((c) => (groupOf(c) || {}).id === gid);
  const gIcon = (g, size) => h('span', { class: 'gicon', style: `color:${g.color};${size ? `width:${size}px;height:${size}px` : ''}` }, icon(ICONS[g.icon] ? g.icon : 'g_tag'));

  function budgetFor(catId, month) {
    const o = D().budgets[month];
    if (o && o[catId] != null) return o[catId];
    const c = catById(catId); return c ? c.budget || 0 : 0;
  }

  function monthStats(month) {
    const byCat = {}; let spent = 0, income = 0, unclassified = 0, unclassifiedSum = 0, transfers = 0;
    for (const t of D().txns) {
      if (monthOf(t) !== month) continue;
      for (const p of parts(t)) {
        const c = catById(p.cat);
        if (t.dir === 'in' || (c && c.type === 'income')) { income += p.amount; continue; }
        if (c && c.type === 'transfer') { transfers += p.amount; continue; }
        byCat[p.cat || '_none'] = (byCat[p.cat || '_none'] || 0) + p.amount;
        spent += p.amount;
        if (!p.cat) { unclassified++; unclassifiedSum += p.amount; }
      }
    }
    let budget = 0; for (const c of expenseCats()) budget += budgetFor(c.id, month);
    return { byCat, spent: round2(spent), income, budget, unclassified, unclassifiedSum, transfers };
  }

  function allMonths() {
    const set = new Set(D().txns.map(monthOf)); set.add(thisMonth());
    return [...set].sort();
  }

  /* ---------------- import ---------------- */
  async function parseFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const results = [];
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
      const r = P.parseRows(rows);
      if (r && r.txns.length) results.push(r);
    }
    if (!results.length) throw new Error('הפורמט לא מזוהה. נתמכים כרגע: ישראכרט / אמריקן אקספרס, כאל / דיינרס.');
    const merged = { issuer: results[0].issuer, format: results[0].format, statements: results.flatMap((r) => r.statements), txns: results.flatMap((r) => r.txns), warnings: results.flatMap((r) => r.warnings) };
    merged.checks = P.verify(merged);
    return merged;
  }

  function planImport(parsed) {
    const byKey = new Map(D().txns.filter((t) => t.key).map((t) => [t.key, t]));
    // Same bill can come in two Isracard/Amex formats with different voucher numbers.
    // Secondary match across formats only: card + purchase date + charged amount + installment no.
    const fmt = (k) => (k || '').split('|')[0];
    const sec = (t) => [t.card, t.date, Math.round((t.amount || 0) * 100), t.inst ? t.inst.n : 0].join('|');
    const pool = {};
    for (const t of D().txns) if (t.key && t.source === 'card') { const k = sec(t); (pool[k] = pool[k] || []).push(fmt(t.key)); }
    const plan = { add: [], update: [], dup: [], crossDup: 0 };
    for (const t of parsed.txns) {
      const ex = byKey.get(t.key);
      if (ex) { if (ex.pending && !t.pending) plan.update.push([ex, t]); else plan.dup.push(t); continue; }
      // Isracard: a 'not yet recorded' transaction has no voucher; when the billed version arrives, match it by card+date+amount+first word
      if (fmt(t.key) === 'isr') {
        const w = (m) => normMerchant(m || '').split(' ')[0];
        const same = (x) => fmt(x.key) === 'isr' && x.card === t.card && x.date === t.date && Math.abs((x.amountOrig || 0) - (t.amountOrig || 0)) < 0.01 && w(x.merchant) === w(t.merchant);
        if (!t.pending) {
          const pend = D().txns.find((x) => x.pending && same(x) && !plan.update.some(([e]) => e === x));
          if (pend) { plan.update.push([pend, t]); continue; }
        } else if (D().txns.some((x) => !x.pending && same(x))) { plan.dup.push(t); continue; } // old 'not yet recorded' file re-imported after the final one
      }
      const cands = pool[sec(t)];
      const i = cands ? cands.findIndex((f) => f !== fmt(t.key) && f !== 'cal' && fmt(t.key) !== 'cal') : -1;
      if (i >= 0) { cands.splice(i, 1); plan.dup.push(t); plan.crossDup++; continue; }
      plan.add.push(t);
    }
    return plan;
  }

  function applyImport(parsed, plan, fileName) {
    const imp = { id: uid(), at: new Date().toISOString(), file: fileName, issuer: parsed.issuer, cards: [...new Set(parsed.statements.filter((s) => s.card !== '*').map((s) => s.card))], added: plan.add.length, updated: plan.update.length, dup: plan.dup.length, checks: parsed.checks };
    for (const st of parsed.statements) {
      if (st.card === '*') continue;
      if (!D().cards[st.card]) {
        const base = /AMEX|אמריקן/i.test(st.cardName) ? 'אמקס' : parsed.issuer === 'cal' ? (/דיינרס/.test(st.cardName) ? 'דיינרס' : /ויזה/.test(st.cardName) ? 'ויזה כאל' : /מסטרקארד/.test(st.cardName) ? 'מסטרקארד כאל' : 'כאל') : 'ישראכרט';
        D().cards[st.card] = { label: base + ' ' + st.card, issuer: parsed.issuer };
      }
    }
    for (const t of plan.add) {
      const { cat, src, ruleId } = classify(t);
      D().txns.push({ ...t, id: uid(), source: 'card', dir: 'out', cat, catSrc: src, ruleId, splits: null, memo: '', importId: imp.id, excluded: false });
    }
    for (const [ex, t] of plan.update) {
      Object.assign(ex, { key: t.key, voucher: t.voucher || ex.voucher, merchant: t.merchant || ex.merchant, amount: t.amount, amountOrig: t.amountOrig, currency: t.currency === '?' ? ex.currency : t.currency, billingDate: t.billingDate, billingEst: false, pending: false, notes: t.notes, inst: t.inst || ex.inst });
    }
    D().imports.unshift(imp);
    S.save();
    return imp;
  }

  function undoImport(impId) {
    const before = D().txns.length;
    D().txns = D().txns.filter((t) => t.importId !== impId);
    D().imports = D().imports.filter((i) => i.id !== impId);
    S.save();
    return before - D().txns.length;
  }

  /* ---------------- app state + shell ---------------- */
  const ui = { repTab: 'overview', cmp: { dim: 'group', mode: 'counted', open: new Set(), limit: 40 }, e: { q: '', group: '', cat: '', card: '', mFrom: '', mTo: '', min: '', max: '', counted: '', sort: 'amt-desc', limit: 200, learn: false, sel: new Set() }, q: { group: '', cat: '', month: '', range: 6, learn: false }, openGroups: new Set(), byGroup: true, repGroups: true, view: 'month', month: thisMonth(), f: EMPTY_F(), back: null, basis: 'billing', sort: 'date-desc', reportRange: 12, cmpA: null, cmpB: null, selMode: false, sel: new Set() };

  function setView(v, patch, keepBack) {
    if (!keepBack) ui.back = null;
    if (ui.view !== v) { try { history.pushState({ v }, ''); } catch (e) { /* ignore */ } }
    ui.view = v; if (patch) Object.assign(ui, patch);
    try { sessionStorage.setItem('kupa-view', v); } catch (e) { /* ignore */ }
    render(); window.scrollTo(0, 0);
  }
  // drill-down: jump to transactions with exactly this filter, remembering where we came from
  function drill(f) { if (f.month) { f = { ...f, mFrom: f.month, mTo: f.month, month: '' }; } const from = ui.view; ui.selMode = false; ui.sel.clear(); setView('txns', { f: { ...EMPTY_F(), ...f }, back: from }, true); }
  window.addEventListener('popstate', (e) => { if (!S.data) return; ui.view = (e.state && e.state.v) || 'month'; ui.back = null; render(); });

  const syncLabel = h('span', { class: 'sync' }, '');
  function onSync(st, e) {
    syncLabel.className = 'sync';
    if (st === 'dirty' || st === 'saving') syncLabel.textContent = 'שומר…';
    else if (st === 'saved') syncLabel.textContent = 'נשמר ✓';
    else if (st === 'conflict') { syncLabel.textContent = 'נטען מחדש'; toast('הנתונים עודכנו ממכשיר אחר ונטענו מחדש. השינוי האחרון שלך לא נשמר — בצע אותו שוב.'); render(); }
    else if (st === 'error') { syncLabel.className = 'sync err'; syncLabel.textContent = 'שגיאת שמירה — ינסה שוב'; setTimeout(() => S.flush(), 5000); console.warn(e); }
  }

  function shell(content) {
    const tabs = [['month', 'חודש', 'month'], ['txns', 'עסקאות', 'list'], ['quick', 'עדכון', 'layers'], ['edit', 'עריכה', 'edit'], ['import', 'ייבוא', 'upload'], ['reports', 'דוחות', 'chart'], ['invest', 'השקעות', 'trend'], ['settings', 'הגדרות', 'gear']];
    return h('div', null,
      h('div', { class: 'shell' + (ui.view === 'edit' ? ' wide' : '') },
        h('header', { class: 'topbar' },
          h('div', { class: 'brand' }, h('img', { src: 'icon.svg', alt: '' }), 'קופה', h('span', { class: 'ver', title: 'עודכן ' + VERSION_DATE }, 'v' + VERSION)),
          h('nav', { class: 'tabs', 'aria-label': 'ניווט' }, tabs.map(([v, label, ic]) => h('button', { 'aria-current': ui.view === v || (v === 'settings' && ui.view === 'rules') ? 'page' : null, onclick: () => setView(v) }, icon(ic), label))),
          h('div', { class: 'spacer' }), syncLabel,
          h('button', { class: 'icon-btn', title: 'נעילה', 'aria-label': 'נעילה', onclick: lockNow }, icon('lock'))),
        content),
      h('button', { class: 'fab', title: 'הוספת תנועה ידנית', 'aria-label': 'הוספת תנועה ידנית', onclick: () => openManual() }, icon('plus')));
  }

  function render() {
    if (!S.data) return;
    const views = { month: viewMonth, txns: viewTxns, import: viewImport, reports: viewReports, settings: viewSettings, rules: viewRules, classify: viewClassify, invest: viewInvest, quick: viewQuick, edit: viewEdit };
    $app.replaceChildren(shell(views[ui.view]()));
  }

  /* ---------------- view: month ---------------- */
  function viewMonth() {
    const m = ui.month; const st = monthStats(m);
    const left = st.budget - st.spent;
    const cats = expenseCats().map((c) => ({ c, spent: st.byCat[c.id] || 0, budget: budgetFor(c.id, m) }))
      .filter((r) => r.spent || r.budget)
      .sort((a, b) => (b.budget ? 1 : 0) - (a.budget ? 1 : 0) || b.spent - a.spent);
    const max = Math.max(1, ...cats.map((r) => Math.max(r.spent, r.budget)));

    const rows = cats.map(({ c, spent, budget }) => {
      const row = budgetRow(c, spent, budget, max, m); row._cat = c; return row;
    });
    function budgetRow(c, spent, budget, max, m) {
      const over = budget > 0 && spent > budget;
      const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : (spent / max) * 100;
      return h('div', { class: 'brow' + (budget ? '' : ' nobudget'), role: 'button', tabindex: 0, onclick: () => drill({ cat: c.id, month: m }) },
        h('div', { class: 'name' }, c.name),
        h('div', { class: 'figs' }, h('b', null, amt(spent)), budget ? [' / ', amt(budget)] : h('span', { class: 'faint' }, ' · ללא תקציב'),
          over ? h('div', { class: 'tag-over' }, 'חריגה ', amt(spent - budget)) : budget ? h('div', { class: 'faint' }, Math.round((spent / budget) * 100) + '% · נותרו ', amt(budget - spent)) : null),
        h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { class: over ? 'over' : '', style: `width:${pct}%` })));
    }
    // groups: one line per group (icon, name, total, colored bar), tap to open its categories
    function groupRows(cats, rows, m) {
      const gl = groups().map((g) => {
        const mine = cats.filter((r) => (groupOf(r.c) || {}).id === g.id);
        return { g, mine, spent: mine.reduce((n, r) => n + r.spent, 0), budget: mine.reduce((n, r) => n + r.budget, 0) };
      }).filter((x) => x.mine.length).sort((a, b) => b.spent - a.spent);
      const gmax = Math.max(1, ...gl.map((x) => x.spent));
      return h('div', { class: 'glist' }, gl.map(({ g, mine, spent, budget }) => {
        const open = ui.openGroups.has(g.id); const over = budget > 0 && spent > budget;
        const toggle = () => { if (open) ui.openGroups.delete(g.id); else ui.openGroups.add(g.id); render(); };
        return h('div', { class: 'gblock' + (open ? ' open' : '') },
          h('div', { class: 'grow-row', role: 'button', tabindex: 0, 'aria-expanded': open ? 'true' : 'false', onclick: toggle, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } } },
            gIcon(g),
            h('div', { class: 'gtext' }, h('div', { class: 'gname' }, g.name),
              h('div', { class: 'gsum' }, amt(spent), budget ? h('span', { class: 'faint' }, ' / ', amt(budget)) : null, over ? h('span', { class: 'tag-over' }, ' חריגה ', amt(spent - budget)) : null)),
            h('div', { class: 'gbar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.max(3, (spent / gmax) * 100)}%;background:${g.color}` })),
            h('span', { class: 'chev', 'aria-hidden': 'true' }, open ? '▴' : '▾')),
          open ? h('div', { class: 'gcats' },
            rows.filter((r) => mine.some((x) => x.c === r._cat)),
            h('button', { class: 'btn small', onclick: () => drill({ group: g.id, month: m }) }, 'כל העסקאות בקבוצה ›')) : null);
      }));
    }

    const noneSum = st.byCat._none || 0;
    const future = upcomingInstallments(m);

    return h('main', { class: 'stack' },
      h('div', { class: 'row' },
        h('div', { class: 'monthnav' },
          h('button', { class: 'icon-btn', 'aria-label': 'חודש קודם', onclick: () => { ui.month = addMonths(m, -1); render(); } }, icon('prev')),
          h('h1', null, mLabel(m)),
          h('button', { class: 'icon-btn', 'aria-label': 'חודש הבא', onclick: () => { ui.month = addMonths(m, 1); render(); } }, icon('next'))),
        h('div', { class: 'grow' }),
        m !== thisMonth() ? h('button', { class: 'btn small', onclick: () => { ui.month = thisMonth(); render(); } }, 'החודש') : null),
      h('div', { class: 'row' },
        h('div', { class: 'seg', role: 'group', 'aria-label': 'שיוך לחודש' },
          h('button', { 'aria-pressed': ui.basis !== 'purchase' ? 'true' : 'false', onclick: () => { ui.basis = 'billing'; render(); } }, 'חודש חיוב'),
          h('button', { 'aria-pressed': ui.basis === 'purchase' ? 'true' : 'false', onclick: () => { ui.basis = 'purchase'; render(); } }, 'תאריך עסקה')),
        h('span', { class: 'faint' }, ui.basis === 'purchase' ? 'מוצג לפי מתי קנית. חל גם על עסקאות ודוחות עד שתחזיר.' : 'מוצג לפי מתי חויב הכרטיס (חיוב 02.10 = אוקטובר)')),
      h('div', { class: 'kpis' },
        kpi('הוצאות', amt(st.spent)),
        kpi('תקציב', st.budget ? amt(st.budget) : h('button', { class: 'value', onclick: () => setView('settings') }, 'להגדרה ›')),
        kpi(left >= 0 ? 'נותר' : 'חריגה', amt(Math.abs(left)), st.budget && left < 0 ? 'over' : ''),
        kpi('הכנסות', amt(st.income))),
      st.unclassified ? h('div', { class: 'notice row' },
        h('span', { class: 'grow' }, `${st.unclassified} עסקאות לסיווג (`, amt(st.unclassifiedSum), ')'),
        h('button', { class: 'btn small primary', onclick: () => setView('classify', { back: 'month' }, true) }, 'סיווג מהיר ›'),
        h('button', { class: 'btn small', onclick: () => drill({ month: m, onlyNone: true }) }, 'רשימה')) : null,
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, ui.byGroup ? 'לפי קבוצות' : 'תקציב מול ביצוע'),
          h('div', { class: 'seg', role: 'group', 'aria-label': 'תצוגה' },
            h('button', { 'aria-pressed': ui.byGroup ? 'true' : 'false', onclick: () => { ui.byGroup = true; render(); } }, 'קבוצות'),
            h('button', { 'aria-pressed': ui.byGroup ? 'false' : 'true', onclick: () => { ui.byGroup = false; render(); } }, 'קטגוריות'))),
        !rows.length ? h('div', { class: 'empty' }, 'אין עדיין נתונים לחודש הזה. ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); setView('import'); } }, 'ייבוא קובץ ›'))
          : ui.byGroup ? groupRows(cats, rows, m) : h('div', { class: 'budgets' }, rows),
        noneSum ? h('div', { class: 'faint', style: 'margin-top:8px' }, 'לא מסווג: ', amt(noneSum)) : null,
        st.transfers ? h('div', { class: 'faint' }, 'העברות וחיסכון (לא נספרות כהוצאה): ', amt(st.transfers)) : null),
      future.length ? h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'תשלומים עתידיים'), h('span', { class: 'faint' }, 'התחייבויות שכבר קיימות')),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, 'חודש'), h('th', null, 'סכום'), h('th', null, 'עסקאות'))),
          h('tbody', null, future.map((f) => h('tr', null, h('td', null, mLabel(f.month)), h('td', { class: 'n' }, amt(f.sum)), h('td', { class: 'faint' }, f.items.join(', ')))))))) : null);
  }
  const kpiLink = (label, value, f) => h('button', { class: 'kpi kpi-link', onclick: () => drill(f) }, h('div', { class: 'label' }, label + ' ›'), h('div', { class: 'value' }, value));
  const kpi = (label, value, cls) => h('div', { class: 'kpi ' + (cls || '') }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value));

  function upcomingInstallments(fromMonth) {
    // latest known installment per purchase; project remaining ones forward
    const latest = new Map();
    for (const t of D().txns) {
      if (!t.inst || t.inst.n >= t.inst.of || t.amount == null || ignoredCard(t)) continue;
      const k = t.card + '|' + (t.voucher || t.merchant + t.date);
      const cur = latest.get(k); if (!cur || t.inst.n > cur.inst.n) latest.set(k, t);
    }
    const out = {};
    for (const t of latest.values()) {
      const base = monthOf(t);
      for (let n = t.inst.n + 1; n <= t.inst.of; n++) {
        const mm = addMonths(base, n - t.inst.n);
        if (mm <= fromMonth) continue;
        (out[mm] = out[mm] || { month: mm, sum: 0, items: [] }).sum += t.amount;
        out[mm].items.push(t.merchant);
      }
    }
    return Object.values(out).sort((a, b) => a.month.localeCompare(b.month));
  }

  /* ---------------- view: transactions ---------------- */
  function filteredTxns() {
    const f = ui.f; const q = f.q.trim().toUpperCase();
    return D().txns.filter((t) => {
      if (f.month && monthOf(t) !== f.month) return false;
      if (f.mFrom || f.mTo) { const m = monthOf(t); if ((f.mFrom && m < f.mFrom) || (f.mTo && m > f.mTo)) return false; }
      if (set_(f.dFrom) || set_(f.dTo)) { if (!dayIn(+t.date.slice(8, 10), f.dFrom, f.dTo)) return false; }
      if (f.card && cardLabel(t) !== f.card) return false;
      if (!f.card && ignoredCard(t)) return false;
      if (f.abroad && !t.abroad) return false;
      if (f.standing && !t.standing) return false;
      if (f.rule) { const r = ruleById(f.rule); if (!r || !ruleMatch(r, t)) return false; }
      if (f.min !== '' && f.min != null && !(t.amount != null && t.amount >= +f.min)) return false;
      if (f.max !== '' && f.max != null && !(t.amount != null && t.amount <= +f.max)) return false;
      if (f.onlyNone && (t.cat || (t.splits && t.splits.length) || t.excluded)) return false;
      if (f.group) { const inG = (cid) => { const c = catById(cid); return !!c && (groupOf(c) || {}).id === f.group; }; if (!(inG(t.cat) || (t.splits || []).some((sp) => inG(sp.cat)))) return false; }
      if (f.cat) {
        if (f.cat === '_none') { if (t.cat || (t.splits && t.splits.length)) return false; }
        else if (!(t.cat === f.cat || (t.splits || []).some((sp) => sp.cat === f.cat))) return false;
      }
      if (q && !((t.merchant || '').toUpperCase().includes(q) || (t.memo || '').toUpperCase().includes(q))) return false;
      return true;
    }).sort(SORTS[ui.sort] ? SORTS[ui.sort].fn : SORTS['date-desc'].fn);
  }
  const amtOf = (t) => (t.amount == null ? -Infinity : t.amount);
  const byDate = (a, b) => b.date.localeCompare(a.date);
  const SORTS = {
    'date-desc': { label: 'תאריך: חדש → ישן', fn: byDate },
    'date-asc': { label: 'תאריך: ישן → חדש', fn: (a, b) => a.date.localeCompare(b.date) },
    'amt-desc': { label: 'סכום: גבוה → נמוך', fn: (a, b) => amtOf(b) - amtOf(a) || byDate(a, b) },
    'amt-asc': { label: 'סכום: נמוך → גבוה', fn: (a, b) => (a.amount == null) - (b.amount == null) || amtOf(a) - amtOf(b) || byDate(a, b) },
    'name-asc': { label: 'שם: א → ת', fn: (a, b) => heCmp(a.merchant || '', b.merchant || '') || byDate(a, b) },
    'name-desc': { label: 'שם: ת → א', fn: (a, b) => heCmp(b.merchant || '', a.merchant || '') || byDate(a, b) },
  };

  function viewTxns() {
    const list = filteredTxns();
    const total = list.reduce((n, t) => n + (ignoredCard(t) ? [{ cat: t.cat, amount: t.amount || 0 }] : parts(t)).reduce((m, p) => m + (ui.f.cat && ui.f.cat !== '_none' && t.splits ? (p.cat === ui.f.cat ? p.amount : 0) : ui.f.group && t.splits ? ((groupOf(catById(p.cat)) || {}).id === ui.f.group ? p.amount : 0) : p.amount), 0), 0);
    const cards = [...new Set(D().txns.map(cardLabel))].sort();
    const ignoredLabels = new Set(Object.values(D().cards).filter((c) => c.ignored).map((c) => c.label));
    const hiddenCount = ui.f.card ? 0 : D().txns.filter(ignoredCard).length;
    const months = allMonths().reverse();
    const upd = (k, v) => { ui.f[k] = v; render(); };
    let qTimer, aTimer;
    const amountInput = (key, label, isDay) => h('label', { class: 'amtf' }, h('span', null, label),
      h('input', { type: 'number', inputmode: isDay ? 'numeric' : 'decimal', min: isDay ? '1' : '0', max: isDay ? '31' : null, step: isDay ? '1' : 'any', placeholder: isDay ? (key === 'dFrom' ? '1' : '31') : '—', value: ui.f[key] == null ? '' : ui.f[key], 'aria-label': label + ' (₪)', 'data-amt': key,
        oninput: (e) => { clearTimeout(aTimer); const v = e.target.value; aTimer = setTimeout(() => { ui.f[key] = v; render(); const el = document.querySelector(`input[data-amt="${key}"]`); if (el) el.focus(); }, 450); } }));
    const search = h('input', { type: 'search', placeholder: 'חיפוש בית עסק או הערה', value: ui.f.q, 'aria-label': 'חיפוש',
      oninput: (e) => { clearTimeout(qTimer); const v = e.target.value; qTimer = setTimeout(() => { ui.f.q = v; render(); const el = document.querySelector('input[type=search]'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }, 250); } });

    return h('main', { class: 'stack' },
      ui.back ? h('div', null, h('button', { class: 'btn small', onclick: () => { try { history.back(); } catch (e) { setView(ui.back); } } }, '› חזרה ל' + ({ reports: 'דוחות', month: 'חודש', rules: 'חוקי סיווג', classify: 'סיווג מהיר' }[ui.back] || 'קודם'))) : null,
      h('div', { class: 'filters' },
        search,
        h('div', { class: 'mrange' },
          h('select', { 'aria-label': 'מחודש', title: basisLabel(), onchange: (e) => { ui.f.mFrom = e.target.value; ui.f.month = ''; if (ui.f.mTo && ui.f.mFrom && ui.f.mTo < ui.f.mFrom) ui.f.mTo = ui.f.mFrom; render(); } },
            h('option', { value: '' }, 'מחודש: הכל'), months.slice().reverse().map((m) => h('option', { value: m, selected: ui.f.mFrom === m }, mLabel(m)))),
          h('select', { 'aria-label': 'עד חודש', title: basisLabel(), onchange: (e) => { ui.f.mTo = e.target.value; ui.f.month = ''; if (ui.f.mFrom && ui.f.mTo && ui.f.mFrom > ui.f.mTo) ui.f.mFrom = ui.f.mTo; render(); } },
            h('option', { value: '' }, 'עד חודש: הכל'), months.map((m) => h('option', { value: m, selected: ui.f.mTo === m }, mLabel(m))))),
        catPicker({ value: ui.f.cat, ariaLabel: 'סינון קטגוריה', extras: [{ value: '', label: 'כל הקטגוריות' }, { value: '_none', label: 'לסיווג' }], onChange: (v) => upd('cat', v) }),
        h('select', { 'aria-label': 'כרטיס', onchange: (e) => upd('card', e.target.value) }, h('option', { value: '' }, 'כל הכרטיסים'), cards.map((c) => h('option', { value: c, selected: ui.f.card === c }, c + (ignoredLabels.has(c) ? ' (מוחרג)' : '')))),
        h('div', { class: 'row' },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ui.f.onlyNone, onchange: (e) => upd('onlyNone', e.target.checked) }), 'רק לסיווג'),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ui.f.abroad, onchange: (e) => upd('abroad', e.target.checked) }), 'חו"ל')),
        h('div', { class: 'row amtrow' }, amountInput('min', 'מ-₪'), amountInput('max', 'עד ₪')),
        h('div', { class: 'row amtrow' }, amountInput('dFrom', 'מיום', true), amountInput('dTo', 'עד יום', true)),
        h('div', { class: 'faint basisnote' }, `חודשים ${basisLabel()} · ימים לפי תאריך העסקה, בכל חודש שבטווח (אפשר גם 28 עד 3)`)),
      h('div', { class: 'row faint' }, `${list.length} עסקאות · סה"כ `, amt(total),
        (ui.f.q || ui.f.cat || ui.f.group || ui.f.card || ui.f.month || ui.f.mFrom || ui.f.mTo || ui.f.dFrom !== '' || ui.f.dTo !== '' || ui.f.onlyNone || ui.f.abroad || ui.f.standing || ui.f.min !== '' || ui.f.max !== '' || ui.f.rule) ? h('button', { class: 'btn small', onclick: () => { ui.f = EMPTY_F(); render(); } }, 'ניקוי סינון') : null,
        hiddenCount ? h('span', { class: 'faint' }, `· ${hiddenCount} מכרטיסים מוחרגים מוסתרות`) : null,
        ui.f.card && ignoredLabels.has(ui.f.card) ? h('span', { class: 'pill warn' }, 'כרטיס מוחרג — לא נספר') : null,
        ui.f.rule && ruleById(ui.f.rule) ? h('button', { class: 'pill accent', onclick: () => { ui.f.rule = ''; render(); } }, 'חוק: ' + ruleText(ruleById(ui.f.rule)) + ' ✕') : null,
        ui.f.standing ? h('button', { class: 'pill accent', onclick: () => { ui.f.standing = false; render(); } }, 'הוראות קבע ✕') : null,
        ui.f.group && groupById(ui.f.group) ? h('button', { class: 'pill accent', onclick: () => { ui.f.group = ''; render(); } }, 'קבוצה: ' + groupById(ui.f.group).name + ' ✕') : null,
        xlBtn(() => exportXlsx('kupa-transactions', [{ name: 'עסקאות', rows: txExportRows(list) }])),
        h('select', { class: 'sortsel', 'aria-label': 'מיון', style: 'margin-inline-start:auto', onchange: (e) => { ui.sort = e.target.value; try { sessionStorage.setItem('kupa-sort', ui.sort); } catch (x) { /* ignore */ } render(); } },
          Object.entries(SORTS).map(([k, v]) => h('option', { value: k, selected: ui.sort === k }, '↕ ' + v.label))),
        h('button', { class: 'btn small', onclick: () => setView('classify', { back: 'txns' }, true) }, 'סיווג מהיר'),
        h('button', { class: 'btn small' + (ui.selMode ? ' primary' : ''), onclick: () => { ui.selMode = !ui.selMode; ui.sel.clear(); render(); } }, ui.selMode ? 'סיום בחירה' : 'בחירה מרובה')),
      h('section', { class: 'card', style: 'padding:4px 12px' },
        list.length ? h('div', { class: 'txlist' }, list.slice(0, 500).map(txRow)) : h('div', { class: 'empty' }, 'אין עסקאות שמתאימות לסינון'),
        list.length > 500 ? h('div', { class: 'faint', style: 'padding:8px' }, 'מוצגות 500 הראשונות — צמצם את הסינון') : null),
      ui.selMode ? selBar(list) : null);
  }

  function selBar(list) {
    // drop selections that are no longer in the filtered list
    const ids = new Set(list.map((t) => t.id));
    for (const id of [...ui.sel]) if (!ids.has(id)) ui.sel.delete(id);
    const chosen = list.filter((t) => ui.sel.has(t.id));
    const sum = chosen.reduce((n, t) => n + (t.amount || 0), 0);
    const all = chosen.length === list.length && list.length > 0;
    const sel = catPicker({ ariaLabel: 'קטגוריה לנבחרות', placeholder: 'בחר קטגוריה…' });
    return h('div', { class: 'selbar', role: 'region', 'aria-label': 'פעולות על הנבחרות' },
      h('div', { class: 'row' },
        h('b', null, `נבחרו ${chosen.length}`), chosen.length ? amt(sum) : null,
        h('div', { class: 'grow' }),
        h('button', { class: 'btn small', onclick: () => { if (all) ui.sel.clear(); else list.forEach((t) => ui.sel.add(t.id)); render(); } }, all ? 'ניקוי הבחירה' : `בחר הכל (${list.length})`)),
      h('div', { class: 'row' },
        h('span', { class: 'grow', style: 'min-width:160px' }, sel),
        h('button', { class: 'btn primary', disabled: !chosen.length, onclick: () => {
          if (!sel.value) return toast('בחר קטגוריה');
          for (const t of chosen) { t.cat = sel.value; t.catSrc = 'manual'; t.splits = null; }
          S.save(); toast(`סווגו ${chosen.length} עסקאות ל"${catName(sel.value)}"`);
          ui.sel.clear(); render();
        } }, 'סיווג')),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', disabled: !chosen.length, onclick: () => {
          const lock = !chosen.every((t) => t.noAuto);
          chosen.forEach((t) => { t.noAuto = lock; }); S.save();
          toast(lock ? `${chosen.length} עסקאות הוחרגו מסיווג אוטומטי` : `${chosen.length} עסקאות חזרו לסיווג אוטומטי`); render();
        } }, chosen.length && chosen.every((t) => t.noAuto) ? 'ביטול החרגה מסיווג אוטומטי' : 'החרגה מסיווג אוטומטי')));
  }

  function txRow(t) {
    const hasSplit = t.splits && t.splits.length;
    const catText = t.excluded ? 'לא נספר' : hasSplit ? 'מפוצל: ' + t.splits.map((sp) => catName(sp.cat)).join(', ') : catName(t.cat);
    const picked = ui.selMode && ui.sel.has(t.id);
    const act = () => { if (ui.selMode) { if (ui.sel.has(t.id)) ui.sel.delete(t.id); else ui.sel.add(t.id); render(); } else openTx(t); };
    return h('div', { class: 'tx' + (t.amount < 0 || t.dir === 'in' ? ' refund' : '') + (ui.selMode ? ' selectable' : '') + (picked ? ' picked' : ''),
      role: ui.selMode ? 'checkbox' : 'button', 'aria-checked': ui.selMode ? String(picked) : null, tabindex: 0, onclick: act, onkeydown: (e) => { if (e.key === 'Enter' || (ui.selMode && e.key === ' ')) { e.preventDefault(); act(); } } },
      h('div', { class: 'm' }, ui.selMode ? h('span', { class: 'box', 'aria-hidden': 'true' }, picked ? '✓' : '') : null, t.merchant || '(ללא שם)'),
      h('div', { class: 'a' }, t.amount == null ? h('span', { class: 'faint' }, 'טרם נקבע') : amt(t.dir === 'in' ? t.amount : t.amount, true)),
      h('div', { class: 'meta' }, h('span', { class: 'num', title: 'תאריך עסקה' }, dShort(t.date)), t.billingDate ? h('span', { class: 'bill', title: 'תאריך חיוב' }, '· חיוב ', h('span', { class: 'num' }, dShort(t.billingDate))) : null, h('span', { class: 'pill' }, cardLabel(t)),
        t.inst ? h('span', { class: 'pill accent' }, `תשלום ${t.inst.n}/${t.inst.of}`) : null,
        t.pending ? h('span', { class: 'pill warn' }, 'בקליטה') : null,
        t.noAuto ? h('span', { class: 'pill', title: 'חוקים לא משנים את הסיווג' }, 'ללא סיווג אוטו') : null,
        t.currency && t.currency !== 'ILS' && t.currency !== '?' ? h('span', { class: 'pill' }, t.currency + ' ' + t.amountOrig) : null,
        t.memo ? h('span', null, '· ' + t.memo) : null),
      h('div', { class: 'cat' + (!t.cat && !hasSplit && !t.excluded ? ' none' : '') }, catText));
  }

  /* ---------------- sheets (drawers) ---------------- */
  function sheet(title, body, onClose) {
    const close = () => { scrim.remove(); document.removeEventListener('keydown', esc); if (onClose) onClose(); };
    const esc = (e) => { if (e.key === 'Escape' && document.querySelector('.scrim:last-of-type') === scrim) close(); };
    const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) close(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'head' }, h('h2', null, title), h('button', { class: 'icon-btn', 'aria-label': 'סגירה', onclick: close }, icon('x'))),
        body(close)));
    document.addEventListener('keydown', esc);
    document.body.appendChild(scrim);
    const first = scrim.querySelector('select, input'); if (first && window.matchMedia('(min-width: 760px)').matches) first.focus();
    return close;
  }

  const catOptions = (sel, types) => [h('option', { value: '' }, '— לסיווג —'),
    ...['expense', 'transfer', 'income'].filter((ty) => !types || types.includes(ty)).map((ty) => h('optgroup', { label: { expense: 'הוצאות', transfer: 'העברות', income: 'הכנסות' }[ty] },
      sortedCats(ty).map((c) => h('option', { value: c.id, selected: sel === c.id }, c.name)))),
    h('option', { value: '__new' }, '+ קטגוריה חדשה…')];

  function openNewCategory(onDone, prefill) {
    let created = null;
    sheet('קטגוריה חדשה', (close) => {
      const name = h('input', { type: 'text', placeholder: 'למשל: חוגים, רכב — טיפולים, חיסכון לדירה', maxlength: '40', value: prefill || '' });
      const budget = h('input', { type: 'number', min: '0', step: '50', inputmode: 'numeric', placeholder: '0' });
      let type = 'expense'; let gTouched = false;
      const gsel = h('select', { 'aria-label': 'קבוצה', onchange: () => { gTouched = true; } }, groups().map((g) => h('option', { value: g.id }, g.name)));
      gsel.value = guessGroup(prefill || '');
      name.addEventListener('input', () => { if (!gTouched) gsel.value = guessGroup(name.value); });
      const gField = h('label', { class: 'field' }, h('span', null, 'קבוצה'), gsel);
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'סוג' });
      const drawSeg = () => seg.replaceChildren(...[['expense', 'הוצאה'], ['transfer', 'העברה'], ['income', 'הכנסה']].map(([k, v]) =>
        h('button', { type: 'button', 'aria-pressed': type === k ? 'true' : 'false', onclick: () => { type = k; budget.disabled = k !== 'expense'; gField.hidden = k !== 'expense'; drawSeg(); } }, v)));
      drawSeg();
      const save = () => {
        const n = name.value.trim();
        if (!n) return toast('צריך שם');
        if (D().categories.some((c) => c.name === n)) return toast('כבר יש קטגוריה בשם הזה');
        created = { id: uid(), name: n, type, budget: type === 'expense' ? Math.max(0, +budget.value || 0) : 0, group: type === 'expense' ? gsel.value : undefined };
        D().categories.push(created); S.save(); close();
      };
      setTimeout(() => name.focus(), 50);
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      return h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', null, 'שם'), name),
        seg, gField,
        h('label', { class: 'field' }, h('span', null, 'תקציב חודשי (אפשר להשאיר ריק)'), budget),
        h('div', { class: 'faint' }, 'העברה = לא נספרת כהוצאה (למשל העברה לחיסכון). אפשר לשנות ולמחוק בהגדרות.'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'יצירה')));
    }, () => onDone(created));
  }

  /* Searchable category picker (A–Z). Behaves like a form control: .value, 'change' event. */
  const TYPE_LABEL = { expense: 'הוצאות', transfer: 'העברות', income: 'הכנסות' };
  function catPicker(opts) {
    const { value, extras, placeholder, onChange, ariaLabel } = opts || {};
    let val = value || '';
    const btn = h('button', { type: 'button', class: 'picker', 'aria-label': ariaLabel || 'קטגוריה', 'aria-haspopup': 'dialog' });
    const label = () => { const ex = (extras || []).find((e) => e.value === val); return ex ? ex.label : val ? catName(val) : (placeholder || '— לסיווג —'); };
    const paint = () => { btn.replaceChildren(h('span', { class: 'grow' + (!val && !(extras || []).some((e) => e.value === '') ? ' ph' : '') }, label()), h('span', { class: 'chev', 'aria-hidden': 'true' }, '▾')); };
    Object.defineProperty(btn, 'value', { get: () => val, set: (v) => { val = v || ''; paint(); } });
    btn.addEventListener('click', () => openCatSearch(val, extras, (v) => {
      val = v; paint(); btn.dispatchEvent(new Event('change', { bubbles: true })); if (onChange) onChange(v);
    }));
    paint();
    return btn;
  }

  function openCatSearch(current, extras, pick) {
    sheet('בחירת קטגוריה', (close) => {
      const q = h('input', { type: 'search', placeholder: 'חיפוש קטגוריה…', 'aria-label': 'חיפוש קטגוריה', autocomplete: 'off' });
      const list = h('div', { class: 'catlist', role: 'listbox' });
      const choose = (v) => { close(); pick(v); };
      const item = (v, text, cls) => h('button', { type: 'button', role: 'option', class: 'catitem' + (cls ? ' ' + cls : '') + (v === current ? ' on' : ''), 'aria-selected': v === current ? 'true' : 'false', onclick: () => choose(v) },
        h('span', { class: 'grow' }, text), v === current ? h('span', { 'aria-hidden': 'true' }, '✓') : null);
      const draw = () => {
        const term = q.value.trim().toLowerCase();
        const hit = (name) => !term || name.toLowerCase().includes(term);
        const kids = [];
        for (const e of extras || []) if (hit(e.label)) kids.push(item(e.value, e.label, 'extra'));
        let count = 0;
        for (const ty of ['expense', 'transfer', 'income']) {
          const cs = sortedCats(ty).filter((c) => hit(c.name));
          if (!cs.length) continue;
          kids.push(h('div', { class: 'catgroup' }, TYPE_LABEL[ty]));
          cs.forEach((c) => { kids.push(item(c.id, c.name)); count++; });
        }
        const exact = term && D().categories.some((c) => c.name.toLowerCase() === term);
        if (term && !count) kids.push(h('div', { class: 'faint', style: 'padding:8px 4px' }, 'לא נמצאה קטגוריה'));
        kids.push(h('button', { type: 'button', class: 'catitem new', onclick: () => { close(); openNewCategory((c) => { if (c) pick(c.id); }, exact ? '' : q.value.trim()); } },
          term && !exact ? `+ יצירת קטגוריה "${q.value.trim()}"` : '+ קטגוריה חדשה…'));
        list.replaceChildren(...kids);
      };
      q.addEventListener('input', draw);
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const first = list.querySelector('.catitem'); if (first) first.click(); } });
      draw();
      setTimeout(() => q.focus(), 60);
      return h('div', { class: 'stack' }, q, list);
    });
  }

  // any category <select> offering "+ new\": remember the previous value, intercept "__new"
  document.addEventListener('change', (e) => { if (!S.data && !e.target.closest('.lock')) e.stopImmediatePropagation(); }, true);
  document.addEventListener('focusin', (e) => { if (e.target.tagName === 'SELECT') e.target.dataset.prev = e.target.value; }, true);
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.tagName !== 'SELECT' || el.value !== '__new') return;
    e.stopImmediatePropagation();
    const prev = el.dataset.prev && el.dataset.prev !== '__new' ? el.dataset.prev : '';
    openNewCategory((c) => {
      if (!c) { el.value = prev; return; }
      const isFilter = el.getAttribute('aria-label') === 'קטגוריה';
      el.replaceChildren(...catOptions(c.id));
      el.value = c.id; el.dataset.prev = c.id;
      if (!isFilter) el.dispatchEvent(new Event('change', { bubbles: true }));
      toast(`נוצרה "${c.name}"`);
    });
  }, true);

  function openTx(t) {
    sheet(t.merchant || 'עסקה', (close) => {
      const p2p = isP2P(t.merchant);
      const catSel = catPicker({ value: t.cat, ariaLabel: 'קטגוריה', extras: [{ value: '', label: '— לסיווג —' }] });
      const learn = h('input', { type: 'checkbox', checked: !p2p && t.source === 'card' }); // off by default for BIT/PAYBOX
      const memo = h('input', { type: 'text', value: t.memo || '', placeholder: 'למשל: מתנה ליום הולדת של…' });
      const excluded = h('input', { type: 'checkbox', checked: !!t.excluded });
      const noAuto = h('input', { type: 'checkbox', checked: !!t.noAuto });
      const byRule = t.catSrc === 'rule' && t.ruleId && ruleById(t.ruleId);
      let splits = (t.splits || []).map((sp) => ({ ...sp }));
      const splitBox = h('div', { class: 'stack' });
      const drawSplits = () => {
        const sum = round2(splits.reduce((n, sp) => n + (+sp.amount || 0), 0));
        splitBox.replaceChildren(
          ...splits.map((sp, i) => h('div', { class: 'splitrow' },
            catPicker({ value: sp.cat, ariaLabel: 'קטגוריה לחלק', onChange: (v) => { sp.cat = v || null; } }),
            h('input', { type: 'number', step: '0.01', inputmode: 'decimal', value: sp.amount, oninput: (e) => { sp.amount = +e.target.value; drawSplits.sumOnly(); } }),
            h('button', { class: 'icon-btn', 'aria-label': 'הסרה', onclick: () => { splits.splice(i, 1); drawSplits(); } }, icon('trash')))),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: () => { const rest = round2((t.amount || 0) - splits.reduce((n, sp) => n + (+sp.amount || 0), 0)); splits.push({ cat: null, amount: splits.length ? rest : round2((t.amount || 0) / 2) }); if (splits.length === 1) splits.push({ cat: null, amount: round2((t.amount || 0) - splits[0].amount) }); drawSplits(); } }, '+ פיצול לקטגוריות'),
            splits.length ? h('span', { class: 'faint split-sum' + (Math.abs(sum - (t.amount || 0)) > 0.01 ? ' check-bad' : '') }, 'סה"כ ', ils(sum, true), ' מתוך ', ils(t.amount || 0, true)) : null));
      };
      drawSplits.sumOnly = () => { const el = splitBox.querySelector('.split-sum'); if (!el) return; const sum = round2(splits.reduce((n, sp) => n + (+sp.amount || 0), 0)); el.textContent = 'סה"כ ' + ils(sum, true) + ' מתוך ' + ils(t.amount || 0, true); el.classList.toggle('check-bad', Math.abs(sum - (t.amount || 0)) > 0.01); };
      drawSplits();

      const save = () => {
        if (splits.length) {
          const sum = round2(splits.reduce((n, sp) => n + (+sp.amount || 0), 0));
          if (Math.abs(sum - (t.amount || 0)) > 0.01) { toast('סכום הפיצול חייב להיות שווה לסכום העסקה'); return; }
          t.splits = splits.map((sp) => ({ cat: sp.cat, amount: +sp.amount })); t.cat = null; t.catSrc = 'manual';
        } else if ((catSel.value || null) !== t.cat || t.splits) {
          const n = setCategory(t, catSel.value || null, learn.checked && catSel.value);
          if (n) toast(`עודכנו גם ${n} עסקאות נוספות מאותו בית עסק`);
        }
        t.memo = memo.value.trim(); t.excluded = excluded.checked; t.noAuto = noAuto.checked;
        S.save(); close(); render();
      };

      return h('div', { class: 'stack' },
        h('div', { class: 'row' }, h('div', { style: 'font-size:24px;font-weight:700' }, t.amount == null ? 'סכום טרם נקבע' : amt(t.amount, true)),
          t.currency && t.currency !== 'ILS' && t.currency !== '?' ? h('span', { class: 'pill' }, `${t.amountOrig} ${t.currency}`) : null),
        h('div', { class: 'dates' },
          h('div', null, h('span', { class: 'faint' }, 'תאריך עסקה'), h('b', { class: 'num' }, fullDate(t.date))),
          h('div', null, h('span', { class: 'faint' }, 'תאריך חיוב'), t.billingDate ? h('b', { class: 'num' }, fullDate(t.billingDate) + (t.billingEst ? ' (משוער)' : '')) : h('b', null, t.source === 'card' ? 'לא ידוע' : '—')),
          h('div', null, h('span', { class: 'faint' }, 'נספר ב'), h('b', null, mLabel(monthOf(t)))),
          h('div', null, h('span', { class: 'faint' }, 'כרטיס'), h('b', null, cardLabel(t)))),
        h('div', { class: 'faint' }, [t.inst ? `תשלום ${t.inst.n} מתוך ${t.inst.of} (עסקה מלאה ${ils(t.amountOrig)})` : null, (t.notes || '').replace(/תשלום\s*\d+\s*מתוך\s*\d+/g, '').replace(/^[\s·]+|[\s·]+$/g, '')].filter(Boolean).join(' · ')),
        p2p ? h('div', { class: 'notice info' }, 'העברה בין אנשים (BIT / PAYBOX). כדאי לרשום בהערה על מה היא.') : (t.source === 'card' && t.merchant ? h('div', null, lookup(t.merchant)) : null),
        h('label', { class: 'field' }, h('span', null, 'קטגוריה'), catSel),
        t.source === 'card' ? h('label', { class: 'check faint' }, learn, p2p
          ? `לזכור: כל העברות "${normMerchant(t.merchant)}" — גם קודמות שלא סווגו ידנית וגם עתידיות — ייכנסו לקטגוריה הזאת`
          : 'לזכור: כל העסקאות מבית העסק הזה ייכנסו לקטגוריה הזאת') : null,
        p2p ? h('div', { class: 'faint' }, 'שים לב: בהעברות בין אנשים כל העברה היא בדרך כלל משהו אחר. סמן רק אם ההעברות האלה תמיד לאותה מטרה. אפשר למחוק את החוק בהגדרות ← חוקי סיווג.') : null,
        splitBox,
        h('label', { class: 'field' }, h('span', null, 'הערה'), memo),
        h('label', { class: 'check' }, excluded, 'לא לספור בתקציב (למשל החזר שקיבלתי בנפרד)'),
        t.source === 'card' ? h('label', { class: 'check' }, noAuto, 'לא לסווג אוטומטית — חוקים לא ישנו את הסיווג של העסקה הזאת') : null,
        byRule ? h('div', { class: 'faint' }, 'סווגה אוטומטית לפי חוק: ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); close(); openRule(byRule); } }, ruleText(byRule) + ' → ' + catName(byRule.cat))) : null,
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: save }, 'שמירה'),
          t.source !== 'card' ? h('button', { class: 'btn', onclick: () => { close(); openManual(t); } }, 'עריכה') : null,
          h('div', { class: 'grow' }),
          h('button', { class: 'btn danger', onclick: () => confirmInline(close, () => { D().txns = D().txns.filter((x) => x !== t); S.save(); render(); }) }, 'מחיקה')));
    });
  }

  function confirmInline(closeParent, action) {
    closeParent();
    sheet('למחוק את העסקה?', (close) => h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'עסקה מקובץ תחזור אם תייבא את אותו קובץ שוב.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { action(); close(); } }, 'מחיקה'), h('button', { class: 'btn', onclick: close }, 'ביטול'))));
    return true;
  }

  function openManual(existing) {
    sheet(existing ? 'עריכת תנועה' : 'תנועה ידנית', (close) => {
      let dir = existing ? existing.dir : 'out';
      const date = h('input', { type: 'date', value: existing ? existing.date : new Date().toISOString().slice(0, 10), required: true });
      const desc = h('input', { type: 'text', value: existing ? existing.merchant : '', placeholder: 'למשל: שכר דירה, משכורת, מזומן לשוק' });
      const amount = h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', value: existing ? Math.abs(existing.amount) : '' });
      const src = h('select', null, h('option', { value: 'bank', selected: !existing || existing.source === 'bank' }, 'בנק'), h('option', { value: 'cash', selected: existing && existing.source === 'cash' }, 'מזומן'));
      const cat = catPicker({ value: existing ? existing.cat : null, ariaLabel: 'קטגוריה', extras: [{ value: '', label: '— לסיווג —' }] });
      const memo = h('input', { type: 'text', value: existing ? existing.memo || '' : '' });
      const repeat = h('input', { type: 'number', min: '1', max: '36', value: '1', inputmode: 'numeric' });
      const seg = h('div', { class: 'seg', role: 'group' });
      const drawSeg = () => seg.replaceChildren(
        h('button', { 'aria-pressed': dir === 'out' ? 'true' : 'false', onclick: () => { dir = 'out'; drawSeg(); } }, 'הוצאה'),
        h('button', { 'aria-pressed': dir === 'in' ? 'true' : 'false', onclick: () => { dir = 'in'; drawSeg(); } }, 'הכנסה'));
      drawSeg();
      const save = () => {
        const a = +amount.value;
        if (!date.value || !desc.value.trim() || !(a > 0)) { toast('צריך תאריך, תיאור וסכום'); return; }
        const base = { source: src.value, dir, merchant: desc.value.trim(), amount: a, amountOrig: a, currency: 'ILS', cat: cat.value || null, catSrc: 'manual', memo: memo.value.trim(), splits: null, excluded: false, inst: null, pending: false };
        if (existing) Object.assign(existing, base, { date: date.value });
        else {
          const n = Math.max(1, Math.min(36, +repeat.value || 1));
          for (let i = 0; i < n; i++) {
            const d = new Date(date.value + 'T12:00:00'); d.setMonth(d.getMonth() + i);
            D().txns.push({ ...base, id: uid(), key: null, date: d.toISOString().slice(0, 10), card: null });
          }
        }
        S.save(); close(); render(); toast('נשמר');
      };
      return h('div', { class: 'stack' },
        seg,
        h('div', { class: 'fields' }, h('label', { class: 'field' }, h('span', null, 'תאריך'), date), h('label', { class: 'field' }, h('span', null, 'סכום ₪'), amount)),
        h('label', { class: 'field' }, h('span', null, 'תיאור'), desc),
        h('div', { class: 'fields' }, h('label', { class: 'field' }, h('span', null, 'קטגוריה'), cat), h('label', { class: 'field' }, h('span', null, 'מקור'), src)),
        h('label', { class: 'field' }, h('span', null, 'הערה'), memo),
        existing ? null : h('label', { class: 'field' }, h('span', null, 'לחזור כל חודש — כמה חודשים (1 = פעם אחת)'), repeat),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'שמירה')));
    });
  }

  /* ---------------- view: import ---------------- */
  let pendingImports = [];
  function viewImport() {
    const input = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', multiple: true, class: 'hidden', onchange: (e) => handleFiles(e.target.files) });
    const drop = h('div', { class: 'drop', role: 'button', tabindex: 0, onclick: () => input.click(), onkeydown: (e) => { if (e.key === 'Enter') input.click(); },
      ondragover: (e) => { e.preventDefault(); drop.classList.add('on'); }, ondragleave: () => drop.classList.remove('on'),
      ondrop: (e) => { e.preventDefault(); drop.classList.remove('on'); handleFiles(e.dataTransfer.files); } },
      h('div', { style: 'font-weight:600;font-size:16px' }, 'בחר או גרור קבצי אקסל'),
      h('div', { class: 'faint' }, 'ישראכרט · אמריקן אקספרס (שני הפורמטים) · כאל / דיינרס (שני הפורמטים). אפשר כמה קבצים בבת אחת. הקובץ נקרא רק בתוך הדפדפן.'));

    return h('main', { class: 'stack' },
      h('h1', null, 'ייבוא'),
      drop, input,
      pendingImports.map(previewCard),
      D().imports.length ? h('section', { class: 'card' }, h('h2', { style: 'margin-bottom:8px' }, 'היסטוריית ייבוא'),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, 'מתי'), h('th', null, 'קובץ'), h('th', null, 'כרטיס'), h('th', null, 'חדשות'), h('th', null, 'בדיקה'), h('th', null, ''))),
          h('tbody', null, D().imports.slice(0, 50).map((imp) => h('tr', null,
            h('td', { class: 'num' }, new Date(imp.at).toLocaleDateString('he-IL')), h('td', null, imp.file), h('td', null, imp.cards.join(', ')),
            h('td', { class: 'n' }, imp.added + (imp.updated ? ` (+${imp.updated} עודכנו)` : '')),
            h('td', null, imp.checks.every((c) => c.ok !== false) ? h('span', { class: 'check-ok' }, '✓ תואם') : h('span', { class: 'check-bad' }, '✗ פער')),
            h('td', null, h('button', { class: 'btn small danger', onclick: () => { const n = undoImport(imp.id); toast(`בוטל — נמחקו ${n} עסקאות`); render(); } }, 'ביטול ייבוא')))))))) : null);
  }

  async function handleFiles(files) {
    for (const f of files) {
      try {
        const parsed = await parseFile(f);
        pendingImports.push({ id: uid(), file: f.name, parsed, plan: planImport(parsed), force: false });
      } catch (e) {
        pendingImports.push({ id: uid(), file: f.name, error: e.message || String(e) });
      }
    }
    render();
  }

  function previewCard(pi) {
    const remove = () => { pendingImports = pendingImports.filter((x) => x !== pi); render(); };
    if (pi.error) return h('section', { class: 'card stack' }, h('h3', null, pi.file), h('div', { class: 'notice bad' }, pi.error), h('button', { class: 'btn small', onclick: remove }, 'הסרה'));
    const { parsed, plan } = pi;
    const allOk = parsed.checks.every((c) => c.ok !== false);
    const sum = (arr) => arr.reduce((n, t) => n + (t.amount || 0), 0);
    const byMonth = {};
    for (const t of plan.add) { const m = monthOf(t); byMonth[m] = (byMonth[m] || 0) + 1; }
    const autoCat = plan.add.filter((t) => classify(t).cat).length;
    return h('section', { class: 'card stack' },
      h('div', { class: 'row' }, h('h3', { class: 'grow' }, pi.file), h('span', { class: 'pill' }, parsed.issuer === 'cal' ? (parsed.format === 'txlist' ? 'כאל — פירוט עסקאות וזיכויים' : 'כאל / דיינרס') : 'ישראכרט / אמקס')),
      parsed.checks.map((c) => h('div', null, c.label ? `${c.label} · ${c.count} עסקאות · ` : `כרטיס ${c.card} · ${parsed.format === 'txlist' ? 'חיוב אחרון' : 'חיוב'} ${c.billingDate ? dShort(c.billingDate) : '?'} · ${c.count} עסקאות · `,
        c.ok === true ? h('span', { class: 'check-ok' }, '✓ הסכום תואם לסה"כ בקובץ (', amt(c.got, true), ')') :
          c.ok === false ? h('span', { class: 'check-bad' }, '✗ קראתי ', amt(c.got, true), ' אבל בקובץ כתוב ', amt(c.expected, true)) : h('span', { class: 'faint' }, parsed.format === 'txlist' ? amt(c.got, true) : 'אין סה"כ בקובץ לבדיקה'))),
      h('div', { class: 'row' },
        h('span', { class: 'pill accent' }, `${plan.add.length} חדשות (${ils(sum(plan.add))})`),
        plan.update.length ? h('span', { class: 'pill' }, `${plan.update.length} יתעדכנו מ"בקליטה"`) : null,
        plan.dup.length ? h('span', { class: 'pill' }, `${plan.dup.length} כבר קיימות — ידולגו`) : null,
        plan.crossDup ? h('span', { class: 'pill warn' }, `${plan.crossDup} מהן זוהו לפי תאריך+סכום מייצוא בפורמט אחר`) : null,
        plan.add.length ? h('span', { class: 'pill' }, `${autoCat} יסווגו אוטומטית`) : null),
      Object.keys(byMonth).length ? h('div', { class: 'faint' }, `ייספרו בחודשים (${basisLabel()}): ` + Object.entries(byMonth).sort().map(([m, n]) => `${mLabel(m)} (${n})`).join(', ')) : null,
      parsed.statements.filter((st) => D().cards[st.card] && D().cards[st.card].ignored).map((st) => h('div', { class: 'notice info' }, `כרטיס ${D().cards[st.card].label} מוחרג בהגדרות — העסקאות שלו ייובאו אבל לא ייספרו`)),
      parsed.warnings.map((w) => h('div', { class: 'notice' }, w)),
      !allOk ? h('label', { class: 'check check-bad' }, h('input', { type: 'checkbox', checked: pi.force, onchange: (e) => { pi.force = e.target.checked; render(); } }), 'הבנתי שיש פער — לייבא בכל זאת') : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', disabled: (!allOk && !pi.force) || (!plan.add.length && !plan.update.length), onclick: () => {
          const imp = applyImport(parsed, plan, pi.file); remove();
          toast(`יובאו ${imp.added} עסקאות` + (imp.updated ? `, עודכנו ${imp.updated}` : ''));
        } }, plan.add.length || plan.update.length ? 'ייבוא' : 'אין מה לייבא'),
        h('button', { class: 'btn', onclick: remove }, 'ביטול')));
  }

  /* ---------------- view: reports ---------------- */
  const repTabs = () => h('div', { class: 'seg', role: 'group', 'aria-label': 'סוג דוח' },
    [['overview', 'סקירה'], ['cmp', 'השוואה']].map(([k, l]) => h('button', { 'aria-pressed': ui.repTab === k ? 'true' : 'false', onclick: () => { ui.repTab = k; render(); } }, l)));
  function viewReports() {
    if (ui.repTab === 'cmp') return viewCompare();
    const end = thisMonth() > (allMonths().slice(-1)[0] || '') ? thisMonth() : allMonths().slice(-1)[0];
    const months = []; for (let i = ui.reportRange - 1; i >= 0; i--) months.push(addMonths(end, -i));
    const stats = months.map((m) => ({ m, ...monthStats(m) }));
    const cats = expenseCats();
    // average only over months that actually have data (from the first month with any spending)
    const firstIdx = stats.findIndex((s) => s.spent);
    const active = firstIdx < 0 ? 1 : stats.length - firstIdx;
    const avg = (id) => stats.reduce((n, s) => n + (s.byCat[id] || 0), 0) / active;
    const gsum = (byCat, g) => catsOfGroup(g.id).reduce((n, c) => n + (byCat[c.id] || 0), 0);
    const catRows = ui.repGroups
      ? groups().map((g) => ({ g, c: { id: g.id, name: g.name }, f: { group: g.id }, vals: stats.map((s) => gsum(s.byCat, g)) })).map((r) => ({ ...r, avg: r.vals.reduce((n, v) => n + v, 0) / active })).filter((r) => r.vals.some(Boolean)).sort((a, b) => b.avg - a.avg)
      : cats.map((c) => ({ c, f: { cat: c.id }, vals: stats.map((s) => s.byCat[c.id] || 0), avg: avg(c.id) })).filter((r) => r.vals.some(Boolean)).sort((a, b) => b.avg - a.avg);
    const noneVals = stats.map((s) => s.byCat._none || 0);
    const maxCell = Math.max(1, ...catRows.flatMap((r) => r.vals));

    // top merchants in range
    const merch = {};
    const inRange = D().txns.filter((t) => months.includes(monthOf(t)) && !t.excluded && !ignoredCard(t) && t.dir !== 'in' && t.amount != null && !(catById(t.cat) && catById(t.cat).type !== 'expense'));
    for (const t of inRange) { const k = normMerchant(t.merchant); (merch[k] = merch[k] || { name: t.merchant, sum: 0, n: 0 }); merch[k].sum += t.amount; merch[k].n++; }
    const top = Object.values(merch).sort((a, b) => b.sum - a.sum).slice(0, 15);

    // by card: everything charged to each card (all categories, like the bill itself), per month in range
    const byCard = {};
    for (const t of D().txns) {
      if (t.amount == null || t.dir === 'in' || ignoredCard(t)) continue;
      const mi = months.indexOf(monthOf(t)); if (mi < 0) continue;
      // only spending that counts: parts() drops excluded; transfer/income categories don't count either
      const counted = parts(t).filter((p) => { const c = catById(p.cat); return !c || c.type === 'expense'; }).reduce((n, p) => n + p.amount, 0);
      if (!counted) continue;
      const k = cardLabel(t);
      const r = (byCard[k] = byCard[k] || { label: k, vals: months.map(() => 0), n: 0, abroad: 0, sum: 0 });
      r.vals[mi] += counted; r.n++; r.sum += counted; if (t.abroad) r.abroad += counted;
    }
    const cardRows = Object.values(byCard).sort((a, b) => b.sum - a.sum);
    const cardMonthTotals = months.map((_, i) => cardRows.reduce((n, r) => n + r.vals[i], 0));
    const cardGrand = cardRows.reduce((n, r) => n + r.sum, 0);
    const shownIdx = months.map((_, i) => i).filter((i) => cardMonthTotals[i]);
    const abroad = inRange.filter((t) => t.abroad).reduce((n, t) => n + t.amount, 0);
    const standing = inRange.filter((t) => t.standing).reduce((n, t) => n + t.amount, 0);
    const totalRange = inRange.reduce((n, t) => n + t.amount, 0);

    // compare
    const all = allMonths();
    ui.cmpB = ui.cmpB || end; ui.cmpA = ui.cmpA || addMonths(ui.cmpB, -1);
    const A = monthStats(ui.cmpA), B = monthStats(ui.cmpB);
    const cmpRows = (ui.repGroups ? groups().map((g) => ({ c: { id: g.id, name: g.name }, grp: true, a: gsum(A.byCat, g), b: gsum(B.byCat, g) })) : cats.map((c) => ({ c, a: A.byCat[c.id] || 0, b: B.byCat[c.id] || 0 }))).filter((r) => r.a || r.b).sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
    const grpSeg = () => h('div', { class: 'seg', role: 'group', 'aria-label': 'רמה' },
      h('button', { 'aria-pressed': ui.repGroups ? 'true' : 'false', onclick: () => { ui.repGroups = true; render(); } }, 'קבוצות'),
      h('button', { 'aria-pressed': ui.repGroups ? 'false' : 'true', onclick: () => { ui.repGroups = false; render(); } }, 'קטגוריות'));
    const dc = (f, cls, style, ...kids) => h('td', { class: (cls || '') + ' drill', style, role: 'link', tabindex: 0, title: 'הצג עסקאות', onclick: () => drill(f), onkeydown: (e) => { if (e.key === 'Enter') drill(f); } }, ...kids);
    const monthOpts = (sel) => all.slice().reverse().map((m) => h('option', { value: m, selected: m === sel }, mLabel(m)));

    const repExport = () => {
      const mh = months.map((m) => mLabel(m));
      const tot = (vals) => r2x(vals.reduce((n, v) => n + v, 0));
      const gR = groups().map((g) => [g.name, ...stats.map((x) => r2x(gsum(x.byCat, g)))]).filter((r) => r.slice(1).some(Boolean));
      const cR = cats.map((c) => { const g = groupOf(c); return [c.name, g ? g.name : '', ...stats.map((x) => r2x(x.byCat[c.id] || 0))]; }).filter((r) => r.slice(2).some(Boolean));
      exportXlsx('kupa-reports', [
        { name: 'לפי חודש', rows: [['חודש', 'הוצאות', 'תקציב', 'הכנסות', 'לסיווג'], ...stats.map((x) => [mLabel(x.m), r2x(x.spent), r2x(x.budget), r2x(x.income), r2x(x.byCat._none || 0)])] },
        { name: 'קבוצות', rows: [['קבוצה', ...mh, 'סה"כ'], ...gR.map((r) => [...r, tot(r.slice(1))])] },
        { name: 'קטגוריות', rows: [['קטגוריה', 'קבוצה', ...mh, 'סה"כ'], ...cR.map((r) => [...r, tot(r.slice(2))])] },
        { name: 'לפי כרטיס', rows: [['כרטיס', ...mh, 'סה"כ', 'עסקאות', 'חו"ל ₪'], ...cardRows.map((r) => [r.label, ...r.vals.map(r2x), r2x(r.sum), r.n, r2x(r.abroad)])] },
        { name: 'השוואת חודשים', rows: [[ui.repGroups ? 'קבוצה' : 'קטגוריה', mLabel(ui.cmpA), mLabel(ui.cmpB), 'שינוי'], ...cmpRows.map((r) => [r.c.name, r2x(r.a), r2x(r.b), r2x(r.b - r.a)]), ['סה"כ', r2x(A.spent), r2x(B.spent), r2x(B.spent - A.spent)]] },
        { name: 'בתי עסק', rows: [['בית עסק', 'עסקאות', 'סה"כ'], ...top.map((m) => [m.name, m.n, r2x(m.sum)])] },
      ]);
    };
    return h('main', { class: 'stack' },
      h('div', { class: 'row', style: 'flex-wrap:wrap' }, h('h1', { class: 'grow' }, 'דוחות', h('span', { class: 'faint', style: 'font-size:13px;font-weight:400;margin-inline-start:8px' }, basisLabel())), repTabs(),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'טווח' }, [3, 6, 12, 24].map((n) => h('button', { 'aria-pressed': ui.reportRange === n ? 'true' : 'false', onclick: () => { ui.reportRange = n; render(); } }, n + ' ח׳'))), xlBtn(repExport)),
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'הוצאות לפי חודש'), h('span', { class: 'faint' }, `ממוצע (${active} ח׳ עם נתונים) `, amt(stats.reduce((n, s) => n + s.spent, 0) / active))),
        barChart(stats.map((s) => ({ m: s.m, label: mShort(s.m), full: mLabel(s.m), value: s.spent, budget: s.budget, cur: s.m === ui.month }))),
        h('div', { class: 'legend' }, h('span', null, h('i'), 'הוצאות'), h('span', { class: 'faint' }, 'לחיצה על עמודה או מספר מציגה את העסקאות'), stats.some((s) => s.budget) ? h('span', null, h('i', { class: 'line' }), 'תקציב') : null)),
      cardRows.length ? h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'לפי כרטיס'), h('span', { class: 'faint' }, 'הוצאות שנספרות בלבד — בלי "לא לספור" ובלי העברות, לכן יכול להיות נמוך מדף החיוב')),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, 'כרטיס'), shownIdx.map((i) => h('th', { class: 'n' }, mShort(months[i]))), h('th', { class: 'n' }, 'סה"כ'), h('th', { class: 'n' }, 'מהסך'), h('th', { class: 'n' }, 'עסקאות'), h('th', { class: 'n' }, 'חו"ל'))),
          h('tbody', null,
            cardRows.map((r) => h('tr', null, dc({ card: r.label }, '', null, r.label),
              shownIdx.map((i) => r.vals[i] ? dc({ card: r.label, month: months[i] }, 'n', null, nf0.format(r.vals[i])) : h('td', { class: 'n faint' }, '·')),
              dc({ card: r.label }, 'n', null, h('b', null, nf0.format(r.sum))),
              h('td', { class: 'n faint' }, cardGrand ? Math.round((r.sum / cardGrand) * 100) + '%' : ''),
              h('td', { class: 'n' }, r.n),
              h('td', { class: 'n faint' }, r.sum ? Math.round((r.abroad / r.sum) * 100) + '%' : ''))),
            h('tr', { class: 'total' }, h('td', null, 'סה"כ'), shownIdx.map((i) => dc({ month: months[i] }, 'n', null, nf0.format(cardMonthTotals[i]))), h('td', { class: 'n' }, nf0.format(cardGrand)), h('td'), h('td', { class: 'n' }, cardRows.reduce((n, r) => n + r.n, 0)), h('td')))))) : null,
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, (ui.repGroups ? 'קבוצות' : 'קטגוריות') + ' לאורך זמן'), h('span', { class: 'faint' }, 'כהה יותר = יותר כסף'), grpSeg()),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, ui.repGroups ? 'קבוצה' : 'קטגוריה'), months.map((m) => h('th', { class: 'n' }, mShort(m))), h('th', { class: 'n' }, 'ממוצע'))),
          h('tbody', null,
            catRows.map((r) => h('tr', null, dc(r.f, '', null, r.g ? h('span', { class: 'gcell' }, gIcon(r.g, 18), r.c.name) : r.c.name), r.vals.map((v, i) => v ? dc({ ...r.f, month: months[i] }, 'n', `background: color-mix(in srgb, var(--bar) ${Math.round((v / maxCell) * 55)}%, transparent)`, nf0.format(v)) : h('td', { class: 'n' }, '·')), h('td', { class: 'n' }, h('b', null, nf0.format(r.avg))))),
            noneVals.some(Boolean) ? h('tr', null, dc({ cat: '_none' }, 'faint', null, 'לסיווג'), noneVals.map((v, i) => v ? dc({ cat: '_none', month: months[i] }, 'n faint', null, nf0.format(v)) : h('td', { class: 'n faint' }, '·')), h('td', null)) : null,
            h('tr', { class: 'total' }, h('td', null, 'סה"כ'), stats.map((s) => s.spent ? dc({ month: s.m }, 'n', null, nf0.format(s.spent)) : h('td', { class: 'n' }, '0')), h('td', { class: 'n' }, nf0.format(stats.reduce((n, s) => n + s.spent, 0) / active))))))),
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'השוואת חודשים'), h('button', { class: 'btn small', onclick: () => { ui.repTab = 'cmp'; render(); window.scrollTo(0, 0); } }, 'להשוואה המלאה ›'), grpSeg()),
        h('div', { class: 'fields', style: 'margin-bottom:10px' },
          h('select', { 'aria-label': 'חודש א', onchange: (e) => { ui.cmpA = e.target.value; render(); } }, monthOpts(ui.cmpA)),
          h('select', { 'aria-label': 'חודש ב', onchange: (e) => { ui.cmpB = e.target.value; render(); } }, monthOpts(ui.cmpB))),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, ui.repGroups ? 'קבוצה' : 'קטגוריה'), h('th', { class: 'n' }, mShort(ui.cmpA)), h('th', { class: 'n' }, mShort(ui.cmpB)), h('th', { class: 'n' }, 'שינוי'))),
          h('tbody', null, cmpRows.map((r) => diffRow(r.c.name, r.a, r.b, false, dc, r.c.id, r.grp)), diffRow('סה"כ', A.spent, B.spent, true, dc, null))))),
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'בתי העסק הגדולים'), h('span', { class: 'faint' }, `${ui.reportRange} חודשים`)),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, 'בית עסק'), h('th', { class: 'n' }, 'עסקאות'), h('th', { class: 'n' }, 'סה"כ'), h('th', { class: 'n' }, 'מהסך'))),
          h('tbody', null, top.map((m) => h('tr', null, dc({ q: m.name }, '', null, m.name), h('td', { class: 'n' }, m.n), dc({ q: m.name }, 'n', null, amt(m.sum)), h('td', { class: 'n faint' }, totalRange ? Math.round((m.sum / totalRange) * 100) + '%' : ''))))))),
      h('div', { class: 'kpis' },
        kpiLink('חו"ל', amt(abroad), { abroad: true }), kpi('חו"ל מהסך', totalRange ? Math.round((abroad / totalRange) * 100) + '%' : '—'),
        kpiLink('הוראות קבע', amt(standing), { standing: true }), kpi('ממוצע חודשי', amt(totalRange / active))));
  }

  /* ---------------- month vs month ----------------
     dimension: group / category / card / merchant; scope: counted only / everything / not counted only.
     every row opens to the actual expenses of both months. */
  function viewCompare() {
    const C = ui.cmp; const all = allMonths();
    const last = all.slice(-1)[0] || thisMonth();
    ui.cmpB = ui.cmpB || last; ui.cmpA = ui.cmpA || addMonths(ui.cmpB, -1);
    const MA = ui.cmpA, MB = ui.cmpB;
    // expense parts with a "counted" flag; income (refunds, income categories) is left out entirely
    const items = [];
    for (const t of D().txns) {
      const m = monthOf(t); if (m !== MA && m !== MB) continue;
      if (t.amount == null || t.dir === 'in') continue;
      const ps = t.splits && t.splits.length ? t.splits.map((sp) => ({ cat: sp.cat, amount: sp.amount })) : [{ cat: t.cat || null, amount: t.amount }];
      for (const p of ps) {
        const c = catById(p.cat);
        if (c && c.type === 'income') continue;
        const why = ignoredCard(t) ? 'כרטיס מוחרג' : t.excluded ? 'לא נספר' : c && c.type === 'transfer' ? 'העברה' : '';
        const counted = !why;
        if (C.mode === 'counted' && !counted) continue;
        if (C.mode === 'not' && counted) continue;
        items.push({ t, m, cat: p.cat, c, amount: p.amount, counted, why });
      }
    }
    const DIMS = {
      group: { label: 'קבוצה', key: (x) => (x.c && x.c.type === 'transfer' ? '_tr' : x.c ? (groupOf(x.c) || {}).id : '_none'),
        name: (k) => (k === '_none' ? 'לסיווג' : k === '_tr' ? 'העברות' : (groupById(k) || {}).name || '?'), icon: (k) => groupById(k), f: (k) => (k === '_none' ? { cat: '_none' } : k === '_tr' ? null : { group: k }) },
      cat: { label: 'קטגוריה', key: (x) => x.cat || '_none', name: (k) => (k === '_none' ? 'לסיווג' : catName(k)), f: (k) => ({ cat: k }) },
      card: { label: 'כרטיס', key: (x) => cardLabel(x.t), name: (k) => k, f: (k) => ({ card: k }) },
      merch: { label: 'בית עסק', key: (x) => normMerchant(x.t.merchant) || '?', name: (k, r) => (r && r.disp) || k, f: (k, r) => ({ q: (r && r.disp) || k }) },
    };
    const dim = DIMS[C.dim];
    const rowsMap = new Map();
    for (const x of items) {
      const k = dim.key(x);
      const r = rowsMap.get(k) || { k, a: 0, b: 0, na: 0, nb: 0, xa: [], xb: [], disp: x.t.merchant };
      if (x.m === MA) { r.a += x.amount; r.na++; r.xa.push(x); } else { r.b += x.amount; r.nb++; r.xb.push(x); }
      rowsMap.set(k, r);
    }
    const rows = [...rowsMap.values()].sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a) || (y.a + y.b) - (x.a + x.b));
    const TA = rows.reduce((n, r) => n + r.a, 0), TB = rows.reduce((n, r) => n + r.b, 0);
    const shown = C.dim === 'merch' ? rows.slice(0, C.limit) : rows;
    const pctTxt = (a, b) => (a ? `${b - a > 0 ? '+' : ''}${Math.round(((b - a) / a) * 100)}%` : b ? 'חדש' : '');
    const diffCell = (a, b) => { const d = b - a; return h('td', { class: 'n ' + (d > 0 ? 'up' : d < 0 ? 'down' : '') }, h('span', { class: 'amt' }, (d > 0 ? '+' : d < 0 ? '−' : '') + nf0.format(Math.abs(d)))); };
    const goTx = (f, m) => { if (f) drill({ ...f, month: m }); };
    const txList = (xs, m) => h('div', { class: 'cmptx' },
      h('div', { class: 'cmptxh' }, h('b', null, mLabel(m)), h('span', { class: 'faint' }, ` · ${xs.length} · `), amt(xs.reduce((n, x) => n + x.amount, 0))),
      xs.length ? xs.slice().sort((p, q) => q.amount - p.amount).map((x) => h('div', { class: 'cmptxr' + (x.counted ? '' : ' off'), role: 'button', tabindex: 0, onclick: () => openTx(x.t), onkeydown: (e) => { if (e.key === 'Enter') openTx(x.t); } },
        h('span', { class: 'm' }, x.t.merchant || '(ללא שם)'),
        h('span', { class: 'faint' }, dShort(x.t.date) + (C.dim === 'cat' ? '' : ' · ' + catName(x.cat)) + (C.dim === 'card' ? '' : ' · ' + cardLabel(x.t)) + (x.why ? ' · ' + x.why : '')),
        h('span', { class: 'a' }, amt(x.amount, true)))) : h('div', { class: 'faint' }, 'אין'));
    const body = [];
    for (const r of shown) {
      const open = C.open.has(C.dim + '|' + r.k);
      const toggle = () => { const id = C.dim + '|' + r.k; if (open) C.open.delete(id); else C.open.add(id); render(); };
      const g = dim.icon ? dim.icon(r.k) : null;
      const f = dim.f(r.k, r);
      body.push(h('tr', { class: 'cmprow' + (open ? ' qon' : '') },
        h('td', { class: 'drill', role: 'button', tabindex: 0, 'aria-expanded': open ? 'true' : 'false', onclick: toggle, onkeydown: (e) => { if (e.key === 'Enter') toggle(); } },
          h('span', { class: 'gcell' }, h('span', { class: 'chev' }, open ? '▾' : '◂'), g ? gIcon(g, 18) : null, dim.name(r.k, r))),
        h('td', { class: 'n' + (r.a ? ' drill' : ''), onclick: r.a && f ? () => goTx(f, MA) : null }, r.a ? nf0.format(r.a) : '·', h('span', { class: 'faint cnt' }, r.na ? ` (${r.na})` : '')),
        h('td', { class: 'n' + (r.b ? ' drill' : ''), onclick: r.b && f ? () => goTx(f, MB) : null }, r.b ? nf0.format(r.b) : '·', h('span', { class: 'faint cnt' }, r.nb ? ` (${r.nb})` : '')),
        diffCell(r.a, r.b), h('td', { class: 'n faint' }, pctTxt(r.a, r.b))));
      if (open) body.push(h('tr', { class: 'cmpopen' }, h('td', { colspan: 5 }, h('div', { class: 'cmppair' }, txList(r.xa, MA), txList(r.xb, MB)))));
    }
    const monthOpts = (sel) => all.slice().reverse().map((m) => h('option', { value: m, selected: m === sel }, mLabel(m)));
    const doExport = () => {
      const head = [dim.label, mLabel(MA), 'עסקאות', mLabel(MB), 'עסקאות', 'שינוי ₪', 'שינוי %'];
      const sumRows = rows.map((r) => [dim.name(r.k, r), r2x(r.a), r.na, r2x(r.b), r.nb, r2x(r.b - r.a), r.a ? Math.round(((r.b - r.a) / r.a) * 1000) / 10 : '']);
      const det = [['חודש', dim.label, 'תאריך', 'בית עסק', 'סכום ₪', 'קטגוריה', 'קבוצה', 'כרטיס', 'נספר']];
      for (const r of rows) for (const x of [...r.xa, ...r.xb]) det.push([mLabel(x.m), dim.name(r.k, r), fullDate(x.t.date), x.t.merchant || '', r2x(x.amount), catName(x.cat), (groupOf(x.c) || {}).name || '', cardLabel(x.t), x.counted ? 'כן' : x.why]);
      exportXlsx(`kupa-compare-${MA}-vs-${MB}`, [{ name: 'השוואה', rows: [head, ...sumRows, ['סה"כ', r2x(TA), rows.reduce((n, r) => n + r.na, 0), r2x(TB), rows.reduce((n, r) => n + r.nb, 0), r2x(TB - TA), TA ? Math.round(((TB - TA) / TA) * 1000) / 10 : '']] }, { name: 'הוצאות', rows: det }]);
    };
    const seg = (label, key, opts) => h('div', { class: 'seg', role: 'group', 'aria-label': label }, opts.map(([k, l]) => h('button', { 'aria-pressed': C[key] === k ? 'true' : 'false', onclick: () => { C[key] = k; C.limit = 40; render(); } }, l)));
    return h('main', { class: 'stack' },
      h('div', { class: 'row', style: 'flex-wrap:wrap' }, h('h1', { class: 'grow' }, 'דוחות', h('span', { class: 'faint', style: 'font-size:13px;font-weight:400;margin-inline-start:8px' }, basisLabel())), repTabs(), xlBtn(doExport)),
      h('section', { class: 'card stack' },
        h('div', { class: 'row cmpctl' },
          h('select', { 'aria-label': 'חודש א', onchange: (e) => { ui.cmpA = e.target.value; render(); } }, monthOpts(MA)),
          h('button', { class: 'icon-btn', title: 'החלפה', 'aria-label': 'החלפת החודשים', onclick: () => { ui.cmpA = MB; ui.cmpB = MA; render(); } }, '⇄'),
          h('select', { 'aria-label': 'חודש ב', onchange: (e) => { ui.cmpB = e.target.value; render(); } }, monthOpts(MB)),
          h('button', { class: 'btn small', onclick: () => { ui.cmpB = last; ui.cmpA = addMonths(last, -1); render(); } }, 'אחרון מול קודם')),
        h('div', { class: 'row cmpctl' },
          seg('רמה', 'dim', [['group', 'קבוצות'], ['cat', 'קטגוריות'], ['card', 'כרטיסים'], ['merch', 'בתי עסק']]),
          seg('מה נכלל', 'mode', [['counted', 'רק נספר'], ['all', 'הכול'], ['not', 'רק לא נספר']])),
        h('div', { class: 'kpis' }, kpi(mLabel(MA), amt(TA)), kpi(mLabel(MB), amt(TB)), kpi('שינוי', h('span', { class: TB - TA > 0 ? 'up' : TB - TA < 0 ? 'down' : '' }, (TB - TA > 0 ? '+' : TB - TA < 0 ? '−' : '') + ils(Math.abs(TB - TA)))), kpi('שינוי %', TA ? pctTxt(TA, TB) : '—')),
        h('div', { class: 'faint' }, C.mode === 'counted' ? 'רק הוצאות שנספרות בתקציב.' : C.mode === 'all' ? 'כולל הוצאות שסומנו "לא לספור", כרטיסים מוחרגים והעברות (מסומנות באפור).' : 'רק מה שלא נספר: "לא לספור", כרטיסים מוחרגים והעברות.',
          ' לחיצה על שורה פותחת את ההוצאות של שני החודשים; לחיצה על סכום עוברת לעסקאות.'),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid cmptable' },
          h('thead', null, h('tr', null, h('th', null, dim.label), h('th', { class: 'n' }, mShort(MA)), h('th', { class: 'n' }, mShort(MB)), h('th', { class: 'n' }, 'שינוי'), h('th', { class: 'n' }, '%'))),
          h('tbody', null, body.length ? body : h('tr', null, h('td', { colspan: 5, class: 'faint' }, 'אין הוצאות בשני החודשים')),
            h('tr', { class: 'total' }, h('td', null, 'סה"כ'), h('td', { class: 'n' }, nf0.format(TA)), h('td', { class: 'n' }, nf0.format(TB)), diffCell(TA, TB), h('td', { class: 'n faint' }, pctTxt(TA, TB)))))),
        rows.length > shown.length ? h('button', { class: 'btn', onclick: () => { C.limit += 60; render(); } }, `עוד בתי עסק (${shown.length} מתוך ${rows.length})`) : null));
  }

  function diffRow(name, a, b, total, dc, catId, isGroup) {
    const d = b - a; const pct = a ? Math.round((d / a) * 100) : null;
    const k = isGroup ? 'group' : 'cat';
    const f = (m) => (catId ? { [k]: catId, month: m } : { month: m });
    return h('tr', { class: total ? 'total' : '' }, catId ? dc({ [k]: catId }, '', null, name) : h('td', null, name),
      a ? dc(f(ui.cmpA), 'n', null, nf0.format(a)) : h('td', { class: 'n' }, '0'), b ? dc(f(ui.cmpB), 'n', null, nf0.format(b)) : h('td', { class: 'n' }, '0'),
      h('td', { class: 'n ' + (d > 0 ? 'up' : d < 0 ? 'down' : '') }, h('span', { class: 'amt' }, (d > 0 ? '+' : d < 0 ? '−' : '') + nf0.format(Math.abs(d))), pct != null && d ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''));
  }

  function barChart(data) {
    const W = 640, H = 220, pad = { t: 10, r: 8, b: 26, l: 48 };
    const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.budget || 0))) * 1.08;
    const step = Math.pow(10, Math.floor(Math.log10(max))); const tickStep = max / step > 5 ? step * 2 : max / step > 2.5 ? step : step / 2;
    const ticks = []; for (let v = 0; v <= max; v += tickStep) ticks.push(v);
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b; const bw = iw / data.length;
    // RTL: newest month on the left would be confusing in a time axis; keep time running right-to-left like Hebrew reading
    const x = (i) => pad.l + iw - (i + 1) * bw;
    const y = (v) => pad.t + ih - (v / max) * ih;
    const tip = h('div', { class: 'tip hidden' });
    const wrap = h('div', { class: 'chart' });
    const fmtK = (v) => v >= 1000 ? nf0.format(v / 1000) + 'K' : nf0.format(v);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'הוצאות לפי חודש' },
      s('g', { class: 'grid' }, ticks.map((v) => s('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }))),
      s('g', { class: 'axis' }, ticks.map((v) => s('text', { x: pad.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmtK(v))),
        data.map((d, i) => (data.length <= 12 || i % 2 === 0) ? s('text', { x: x(i) + bw / 2, y: H - 8, 'text-anchor': 'middle' }, d.label) : null)),
      data.map((d, i) => { const bh = Math.max(0, ih - (y(d.value) - pad.t)); const w = Math.min(36, bw - 6); const xx = x(i) + (bw - w) / 2;
        return d.value ? s('path', { class: 'b', fill: 'var(--bar)', d: `M${xx},${y(0)} V${y(d.value) + Math.min(4, bh)} q0,-4 4,-4 h${w - 8} q4,0 4,4 V${y(0)} Z`, opacity: d.cur ? 1 : 0.85 }) : null; }),
      data.some((d) => d.budget) ? s('path', { class: 'bline', d: data.map((d, i) => `${i ? 'L' : 'M'}${x(i) + bw / 2},${y(d.budget || 0)}`).join(' ') }) : null,
      data.map((d, i) => s('rect', { class: 'hit', x: x(i), y: pad.t, width: bw, height: ih })));
    svg.querySelectorAll('rect.hit').forEach((r, i) => {
      const show = () => { const d = data[i]; tip.textContent = `${d.full}: ${ils(d.value)}${d.budget ? ' · תקציב ' + ils(d.budget) : ''}`; tip.classList.remove('hidden');
        const box = svg.getBoundingClientRect(); const sx = box.width / W; tip.style.left = ((x(i) + bw / 2) * sx - tip.offsetWidth / 2) + 'px'; tip.style.top = (y(Math.max(d.value, d.budget || 0)) * sx) + 'px'; tip.style.transform = 'translate(0,-110%)'; };
      r.addEventListener('mouseenter', show); r.addEventListener('click', () => { if (data[i].value) drill({ month: data[i].m }); }); r.addEventListener('mouseleave', () => tip.classList.add('hidden'));
    });
    wrap.append(svg, tip);
    return wrap;
  }

  const lookup = (name) => h('a', { class: 'btn small', href: 'https://www.google.com/search?q=' + encodeURIComponent(String(name).replace(/[*#]/g, ' ').replace(/\s\d{3,}.*$/, '')), target: '_blank', rel: 'noopener noreferrer', title: 'חיפוש בגוגל — שם בית העסק נשלח לגוגל' }, '🔍 חפש');
  /* ---------------- quick classify: group unclassified by merchant, suggest, accept in one tap ---------------- */
  // keyword -> preferred category names (first one that exists wins; otherwise offer to create the first)
  const LEX = [
    [/דוג |\bDOG\b|חיות|\bPETS?\b|וטרינר|VET\b|אניפט|זו פט/i, ['חיות מחמד', 'פנאי ובילוי']],
    [/ALIEXPRESS|AMAZON(?! PRIME)|EBAY|SHEIN|TEMU|ASOS|IHERB/i, ['קניות אונליין']],
    [/מסעד|קפה|CAFE|COFFEE|פיצ|PIZZA|בורגר|BURGER|סושי|SUSHI|שווארמ|פלאפל|חומוס|גלידה|ICE CREAM|מאפה|קונדיטור|BAKERY|בר |BAR |PUB|גריל|GRILL|KITCHEN|ביסטרו|BISTRO|טאקו|TACO|נודלס|NOODLE|RAMEN|DONUT|DOUGHNUT|MCDONALD|KFC|DOMINO|ארומה|קפולסקי|לנדוור|WOLT|וולט|10BIS|תן ביס|CIBUS|סיבוס|STARBUCKS|RESTAURANT|DINER|EATERY|BRASSERIE|TRATTORIA|קייטרינג/i, ['אוכל בחוץ ומשלוחים']],
    [/סופר|מרקט|MARKET|מכולת|שופרסל|רמי לוי|ויקטורי|יוחננוף|טיב טעם|אושר עד|קרפור|CARREFOUR|AM:PM|יינות ביתן|חצי חינם|מעדני|ירקות|פירות|קצב|אטליז|דגים|WALMART|TARGET|COSTCO|SAFEWAY|TRADER JOE|WHOLE FOODS|7-ELEVEN|LIDL|ALDI|SPAR|BILLA|KAUFLAND|TESCO/i, ['סופר ומכולת']],
    [/סונול|SONOL|\bפז\b|PAZ|דלק|DELEK|דור אלון|\bTEN\b|YELLOW|תחנת|חני|PANGO|פנגו|סלופארק|CELLOPARK|מוסך|צמיגים|טסט|רישוי|ליסינג|שטיפת|וואש|WASH|CHEVRON|SHELL|ARCO|EXXON|PARKING|CITYOF.*P|OFFSTREET/i, ['רכב ודלק']],
    [/GETT|YANGO|UBER|LYFT|BOLT|מונית|רב.?קו|רכבת|אגד|\bדן\b|MOOVIT|אוטובוס|TAXI|METRO|TRANSIT/i, ['תחבורה ומוניות']],
    [/ביטוח|INSURANCE|הראל|מגדל|כלל ביטוח|הפניקס|מנורה|AIG|ליברה|ביטוח ישיר|9 ביטוח/i, ['ביטוחים', 'ביטוח']],
    [/פארם|PHARM|בית מרקחת|CVS|WALGREENS|טיפוח|קוסמטיקה|SEPHORA|BEAUTY|מספרה|BARBER|ציפורניים|NAIL/i, ['פארם וטיפוח']],
    [/רופא|מרפא|קופ.?ח|מכבי|כללית|מאוחדת|לאומית|שיניים|DENTAL|אופטיק|OPTIC|פיזיותרפ|CLINIC|HOSPITAL|בית חולים|ד"ר /i, ['בריאות']],
    [/NETFLIX|SPOTIFY|APPLE\.COM|ITUNES|GOOGLE|YOUTUBE|DISNEY|HBO|AMAZON PRIME|OPENAI|CHATGPT|ANTHROPIC|CLAUDE|MICROSOFT|ADOBE|DROPBOX|ICLOUD|פרטנר|סלקום|הוט |\bHOT\b|בזק|גולן טלקום|פלאפון|YES\b|STING|סלולר|אינטרנט/i, ['מנויים ותקשורת']],
    [/ZARA|H&M|קסטרו|CASTRO|פוקס|\bFOX\b|NIKE|ADIDAS|TERMINAL X|טרמינל X|PRIMARK|UNIQLO|GAP\b|LEVI|MANGO|PULL&BEAR|BERSHKA|STRADIVARIUS|AMERICAN EAGLE|MICHAEL KORS|ביגוד|הנעלה|נעליים|SHOES|SKECHERS|FOOT LOCKER/i, ['ביגוד והנעלה']],
    [/KSP|באג|IVORY|איבורי|BEST BUY|אלקטרוניקה|מחשב|COMPUTER|APPLE STORE|סמסונג|SAMSUNG|DJI/i, ['אלקטרוניקה']],
    [/אל על|ELAL|EL AL|ISRAIR|ישראייר|ארקיע|AIRLINE|AIRWAYS|AIR |WIZZ|RYANAIR|EASYJET|AIRBNB|BOOKING|HOTEL|מלון|INN\b|SUITES|HOSTEL|EXPEDIA|HERTZ|AVIS|SIXT|ENTERPRISE|DUTY FREE|מט"ח|FLYING ?MONEY|פליי מאני|היינמן|JR\.?-?HEINEMANN|ג'יי\.אר/i, ['חו"ל ונסיעות']],
    [/ארנונה|מועצה|עירי|חשמל|חברת החשמל|מים|מי |תאגיד|גז|סופרגז|אמישראגז|ועד בית|שכר דירה|IKEA|איקאה|\bACE\b|הום סנטר|HOME CENTER|כלי בית|מטבח/i, ['בית']],
    [/משרד|רשות|אגרה|ביטוח לאומי|מס הכנסה|דואר|האוכלוסין|DMV|GOV/i, ['אגרות וממשלה']],
    [/קורס|לימוד|אוניברסיט|מכללה|UDEMY|COURSERA|ספרים|BOOK|סטימצקי|צומת ספרים|חוג|גן ילדים|צהרון|חטיבת|בית ספר|תיכון|ישיבת|אולפנ/i, ['לימודים וקורסים', 'חוגים']],
    [/סינמה|CINEMA|יס פלאנט|קולנוע|תיאטרון|הופעה|כרטיסים|EVENTIM|TICKET|טיקט|טיקצ|לאן|LEAAN|כושר|FITNESS|GYM|הולמס|דאנס|DANCE|קאנטרי|STEAM|PLAYSTATION|XBOX|NINTENDO|RIOT|CASINO|מוזיאון|MUSEUM|פארק/i, ['פנאי ובילוי']],
    [/מתנ|GIFT|פרחים|FLOWERS|צעצוע|TOYS/i, ['מתנות']],
  ];
  const STOP = new Set(['בע"מ', 'בעמ', 'ISRAEL', 'ישראל', 'IL', 'LTD', 'INC', 'COM', 'WWW', 'סניף', 'THE', 'AND', 'של', 'ושות']);
  const tokens = (m) => normMerchant(m).replace(/[^A-Z֐-׿0-9 ]/gi, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  const catByName = (n) => D().categories.find((c) => c.name === n);

  function suggestFor(group) {
    const m = group.merchant;
    if (isP2P(m)) return { cat: null, why: 'העברה בין אנשים — אין דרך לנחש', sure: false };
    // 1) your own decisions on a similar merchant (shares its first meaningful word)
    const tk = tokens(m); const first = tk[0];
    if (first) {
      const votes = {};
      for (const t of D().txns) {
        if (!t.cat || t.splits || !(t.catSrc === 'manual' || (t.catSrc === 'rule' && t.ruleId && ruleById(t.ruleId) && !ruleById(t.ruleId).auto))) continue;
        if (normMerchant(t.merchant) === group.norm) continue;
        if (tokens(t.merchant)[0] === first) votes[t.cat] = (votes[t.cat] || 0) + 1;
      }
      const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
      if (best) { const total = Object.values(votes).reduce((a, b) => a + b, 0);
        return { cat: best[0], why: `סיווגת ככה בית עסק דומה ("${first}")`, sure: best[1] / total >= 0.8 }; }
    }
    // 2) keywords
    for (const [re, names] of LEX) {
      if (!re.test(m)) continue;
      const hit = m.match(re)[0].trim();
      const c = names.map(catByName).find(Boolean);
      return c ? { cat: c.id, why: `השם מכיל "${hit}"`, sure: true } : { cat: null, create: names[0], why: `השם מכיל "${hit}" — אין לך קטגוריה "${names[0]}"`, sure: false };
    }
    // 3) weak hints
    if (group.txns.every((t) => t.abroad)) { const c = catByName('חו"ל ונסיעות'); if (c) return { cat: c.id, why: 'כל העסקאות בחו"ל', sure: false }; }
    const months = new Set(group.txns.map((t) => t.date.slice(0, 7)));
    if (group.txns.length >= 3 && months.size >= 3 && !group.txns.some((t) => t.inst) && new Set(group.txns.map((t) => Math.round(t.amount || 0))).size === 1) {
      const c = catByName('מנויים ותקשורת'); if (c) return { cat: c.id, why: `אותו סכום כל חודש (${months.size} חודשים) — אולי מנוי או הוראת קבע`, sure: false };
    }
    return { cat: null, why: 'אין לי ניחוש', sure: false };
  }

  function unclassifiedGroups() {
    const g = new Map();
    for (const t of D().txns) {
      if (t.cat || (t.splits && t.splits.length) || t.excluded || t.source !== 'card' || ignoredCard(t) || t.dir === 'in') continue;
      const k = normMerchant(t.merchant);
      if (!g.has(k)) g.set(k, { norm: k, merchant: t.merchant, txns: [], sum: 0 });
      const x = g.get(k); x.txns.push(t); x.sum += t.amount || 0;
    }
    const list = [...g.values()];
    for (const x of list) { x.sug = suggestFor(x); x.p2p = isP2P(x.merchant); }
    return list.sort((a, b) => (a.p2p - b.p2p) || b.sum - a.sum);
  }

  function acceptGroup(x, catId, remember) {
    let n = 0;
    for (const t of x.txns) { t.cat = catId; t.catSrc = 'manual'; t.ruleId = null; t.splits = null; n++; }
    if (remember && catId) {
      D().rules = D().rules.filter((r) => !(r.kind === 'exact' && r.text === x.norm && !hasCond(r)));
      const r = { id: uid(), kind: 'exact', text: x.norm, cat: catId, auto: false, min: '', max: '' };
      D().rules.unshift(r); n += runRule(r, false);
    }
    return n;
  }

  function viewClassify() {
    const groups = unclassifiedGroups();
    const sure = groups.filter((x) => x.sug.sure && x.sug.cat);
    const nTx = groups.reduce((n, x) => n + x.txns.length, 0);
    ui.skip = ui.skip || new Set();
    const shown = groups.filter((x) => !ui.skip.has(x.norm));
    return h('main', { class: 'stack' },
      ui.back ? h('div', null, h('button', { class: 'btn small', onclick: () => { try { history.back(); } catch (e) { setView(ui.back); } } }, '› חזרה')) : null,
      h('h1', null, 'סיווג מהיר'),
      groups.length ? h('div', { class: 'faint' }, `${nTx} עסקאות לא מסווגות ב-${groups.length} בתי עסק. ההצעות מחושבות במכשיר שלך בלבד. אישור יוצר חוק לבית העסק, כך שבפעם הבאה זה יקרה לבד.`) : null,
      sure.length ? h('div', { class: 'notice info row' },
        h('span', { class: 'grow' }, `${sure.length} בתי עסק עם הצעה ברורה (${sure.reduce((n, x) => n + x.txns.length, 0)} עסקאות)`),
        h('button', { class: 'btn primary small', onclick: () => {
          let n = 0; for (const x of sure) n += acceptGroup(x, x.sug.cat, true);
          S.save(); toast(`סווגו ${n} עסקאות ונוצרו ${sure.length} חוקים`); render();
        } }, 'אשר את כל הברורים')) : null,
      !groups.length ? h('div', { class: 'card empty' }, 'אין עסקאות לסיווג 🎉') : null,
      h('div', { class: 'qlist' }, shown.slice(0, 80).map((x) => {
        const pick = catPicker({ value: x.sug.cat, ariaLabel: 'קטגוריה ל' + x.merchant, placeholder: 'בחר קטגוריה…' });
        const remember = h('input', { type: 'checkbox', checked: !x.p2p });
        const dates = x.txns.map((t) => t.date).sort();
        return h('section', { class: 'card qcard' + (x.sug.sure ? ' sure' : '') },
          h('div', { class: 'row' },
            h('div', { class: 'grow' }, h('b', null, x.merchant), h('div', { class: 'faint' }, `${x.txns.length} עסקאות · ${dShort(dates[0])}${dates.length > 1 ? '–' + dShort(dates[dates.length - 1]) : ''}`)),
            h('b', null, amt(x.sum))),
          h('div', { class: 'faint qwhy' }, x.sug.cat ? (x.sug.sure ? '✓ ' : '? ') : '', x.sug.why),
          x.sug.create ? h('button', { class: 'btn small', onclick: () => openNewCategory((c) => { if (c) { acceptGroup(x, c.id, remember.checked); S.save(); render(); } }, x.sug.create) }, `+ ליצור "${x.sug.create}" ולסווג`) : null,
          h('div', { class: 'qrow' }, pick,
            h('button', { class: 'btn primary', onclick: () => { if (!pick.value) return toast('בחר קטגוריה'); const n = acceptGroup(x, pick.value, remember.checked); S.save(); toast(`סווגו ${n} עסקאות`); render(); } }, 'אישור'),
            h('button', { class: 'btn', onclick: () => { ui.skip.add(x.norm); render(); } }, 'דלג')),
          h('div', { class: 'row' },
            h('label', { class: 'check faint' }, remember, x.p2p ? 'לזכור גם להעברות הבאות (בדרך כלל לא כדאי)' : 'לזכור לבית העסק (ליצור חוק)'),
            h('span', { style: 'margin-inline-start:auto; display:flex; gap:6px' }, x.p2p ? null : lookup(x.merchant), h('button', { class: 'btn small', onclick: () => drill({ q: x.merchant, onlyNone: true }) }, 'פירוט'))));
      })),
      shown.length > 80 ? h('div', { class: 'faint' }, `מוצגים 80 הראשונים מתוך ${shown.length}`) : null,
      ui.skip.size ? h('button', { class: 'btn small', onclick: () => { ui.skip.clear(); render(); } }, `הצג שוב ${ui.skip.size} שדילגת עליהם`) : null);
  }

  /* ---------------- view: rules ---------------- */
  function viewRules() {
    ui.rulesTab = ui.rulesTab || 'mine'; ui.rulesQ = ui.rulesQ || '';
    const q = ui.rulesQ.trim().toUpperCase();
    const rows = rankedRules().filter((r) => (ui.rulesTab === 'all' || (ui.rulesTab === 'mine' ? !r.auto : r.auto)))
      .filter((r) => !q || String(r.text).toUpperCase().includes(q) || catName(r.cat).toUpperCase().includes(q));
    const counts = new Map(); const by = new Map();
    for (const r of rows) { let n = 0, sum = 0; for (const t of D().txns) if (ruleMatch(r, t)) { n++; sum += t.amount || 0; } counts.set(r.id, n); by.set(r.id, sum); }
    ui.rulesSort = ui.rulesSort || 'priority';
    const RS = {
      priority: ['סדר הבדיקה', null],
      'count-desc': ['כמות עסקאות: הכי הרבה', (a, b) => counts.get(b.id) - counts.get(a.id)],
      'count-asc': ['כמות עסקאות: הכי מעט', (a, b) => counts.get(a.id) - counts.get(b.id)],
      'sum-desc': ['סכום: הכי גבוה', (a, b) => by.get(b.id) - by.get(a.id)],
      'name-asc': ['שם: א → ת', (a, b) => heCmp(String(a.text), String(b.text))],
      'cat-asc': ['קטגוריה: א → ת', (a, b) => heCmp(catName(a.cat), catName(b.cat))],
    };
    if (RS[ui.rulesSort] && RS[ui.rulesSort][1]) rows.sort((a, b) => RS[ui.rulesSort][1](a, b) || heCmp(String(a.text), String(b.text)));
    const sortSel = h('select', { class: 'sortsel', 'aria-label': 'מיון חוקים', onchange: (e) => { ui.rulesSort = e.target.value; render(); } },
      Object.entries(RS).map(([k, v]) => h('option', { value: k, selected: ui.rulesSort === k }, '↕ ' + v[0])));
    let qT;
    const search = h('input', { type: 'search', placeholder: 'חיפוש לפי בית עסק או קטגוריה', value: ui.rulesQ, 'aria-label': 'חיפוש חוק',
      oninput: (e) => { clearTimeout(qT); const v = e.target.value; qT = setTimeout(() => { ui.rulesQ = v; render(); const el = document.querySelector('input[aria-label="חיפוש חוק"]'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }, 250); } });
    const mine = D().rules.filter((r) => !r.auto).length;
    return h('main', { class: 'stack' },
      h('div', null, h('button', { class: 'btn small', onclick: () => setView('settings') }, '› חזרה להגדרות')),
      h('div', { class: 'row' }, h('h1', { class: 'grow' }, 'חוקי סיווג'),
        h('label', { class: 'btn' }, 'ייבוא חוקים', h('input', { type: 'file', accept: '.json,application/json', class: 'hidden', onchange: async (e) => { const f = e.target.files[0]; if (f) { try { openRulesImport(JSON.parse(await f.text())); } catch (x) { toast('קובץ לא תקין'); } } e.target.value = ''; } })),
        h('button', { class: 'btn primary', onclick: () => openRule(null) }, '+ חוק חדש')),
      h('div', { class: 'faint' }, 'סדר הבדיקה: החוקים שלך לפני המובנים; בתוכם — חוק עם סכום לפני חוק בלי סכום, ושם מדויק לפני "מכיל". הראשון שמתאים קובע.'),
      h('div', { class: 'row' },
        h('div', { class: 'seg', role: 'group', 'aria-label': 'אילו חוקים' },
          [['mine', `שלי (${mine})`], ['builtin', `מובנים (${D().rules.length - mine})`], ['all', 'הכל']].map(([k, v]) => h('button', { 'aria-pressed': ui.rulesTab === k ? 'true' : 'false', onclick: () => { ui.rulesTab = k; render(); } }, v))),
        h('div', { class: 'grow', style: 'min-width:180px' }, search),
        sortSel),
      h('section', { class: 'card', style: 'padding:4px 12px' },
        rows.length ? h('div', { class: 'rulelist' }, rows.map((r) => h('div', { class: 'rule' },
          h('div', { class: 'rmain', role: 'button', tabindex: 0, onclick: () => openRule(r) },
            h('div', null, h('b', null, ruleText(r)), r.auto ? h('span', { class: 'pill', style: 'margin-inline-start:6px' }, 'מובנה') : null),
            h('div', { class: 'faint' }, '→ ', h('span', { style: 'color:var(--ink)' }, catName(r.cat)), ` · ${counts.get(r.id)} עסקאות`, counts.get(r.id) ? [' · ', amt(by.get(r.id))] : null)),
          h('div', { class: 'ractions' },
            h('button', { class: 'btn small', disabled: !counts.get(r.id), onclick: () => drill({ rule: r.id }) }, 'עסקאות'),
            h('button', { class: 'btn small', onclick: () => { const n = runRule(r, false); S.save(); toast(n ? `החוק עדכן ${n} עסקאות` : 'אין מה לעדכן — הכל כבר מסווג לפי החוק (או סווג ידנית / הוחרג)'); render(); } }, 'הפעל'),
            h('button', { class: 'btn small', onclick: () => openRule(r) }, 'עריכה'))))) : h('div', { class: 'empty' }, ui.rulesTab === 'mine' && !q ? 'עוד אין חוקים שלך. הם נוצרים כשמסמנים "לזכור" בעסקה, או ב"+ חוק חדש".' : 'לא נמצאו חוקים')));
  }

  // file: { app: 'kupa-rules', rules: [{ text, kind?: 'exact'|'contains', cat: '<category name>', confidence?: 'high'|'medium'|'low', note? }] }
  function openRulesImport(file) {
    if (!file || file.app !== 'kupa-rules' || !Array.isArray(file.rules)) return toast('זה לא קובץ חוקים של קופה');
    const items = file.rules.filter((r) => r && r.text && r.cat).map((r) => {
      const kind = r.kind === 'contains' ? 'contains' : 'exact';
      const text = kind === 'exact' ? normMerchant(r.text) : String(r.text).trim();
      const probe = { kind, text, min: '', max: '' };
      const n = D().txns.filter((t) => ruleMatch(probe, t)).length;
      const exists = D().rules.some((x) => !x.auto && x.kind === kind && x.text === text && !hasCond(x));
      const on = !exists && r.cat !== 'שונות' && (r.confidence || 'high') !== 'low';
      return { ...r, kind, text, n, exists, on };
    });
    for (const x of items) { const c = catByName(x.cat); x.catId = c ? c.id : '__new'; }
    let conf = 'all', status = 'all';
    const CONF = { high: 'בטוח', medium: 'סביר', low: 'ניחוש' };
    sheet('ייבוא חוקים', (close) => {
      const list = h('div', { class: 'matchlist', style: 'max-height:52vh' });
      const count = h('b');
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'סינון לפי ביטחון' });
      const seg2 = h('div', { class: 'seg', role: 'group', 'aria-label': 'סינון לפי קיים/חדש' });
      const visible = () => items.filter((x) => (conf === 'all' || (x.confidence || 'high') === conf) && (status === 'all' || (status === 'exists') === x.exists));
      const draw = () => {
        const v = visible();
        count.textContent = `מוצגים ${v.length} · נבחרו ${items.filter((x) => x.on).length} מתוך ${items.length}`;
        const okConf = (x, k) => k === 'all' || (x.confidence || 'high') === k;
        const okStat = (x, k) => k === 'all' || (k === 'exists') === x.exists;
        seg.replaceChildren(...[['all', 'הכל'], ['high', 'בטוח'], ['medium', 'סביר'], ['low', 'ניחוש']].map(([k, lbl]) => {
          const n = items.filter((x) => okConf(x, k) && okStat(x, status)).length; // counts within the other filter
          return h('button', { type: 'button', 'aria-pressed': conf === k ? 'true' : 'false', onclick: () => { conf = k; draw(); } }, `${lbl} (${n})`);
        }));
        seg2.replaceChildren(...[['all', 'הכל'], ['new', 'חדש'], ['exists', 'כבר קיים']].map(([k, lbl]) => {
          const n = items.filter((x) => okStat(x, k) && okConf(x, conf)).length;
          return h('button', { type: 'button', 'aria-pressed': status === k ? 'true' : 'false', onclick: () => { status = k; draw(); } }, `${lbl} (${n})`);
        }));
        if (!v.length) { list.replaceChildren(h('div', { class: 'empty' }, 'אין שורות בסינון הזה')); return; }
        list.replaceChildren(...v.map((x) => {
          const pick = catPicker({ value: x.catId, ariaLabel: 'קטגוריה ל' + x.text, extras: x.catId === '__new' || !catByName(x.cat) ? [{ value: '__new', label: x.cat + ' (חדשה)' }] : [],
            onChange: (val) => { x.catId = val; if (val && !x.exists) { x.on = true; draw(); } } });
          return h('div', { class: 'mrow imp' + (x.on ? '' : ' off') },
            h('input', { type: 'checkbox', checked: x.on, disabled: x.exists, 'aria-label': 'לייבא ' + x.text, onchange: (e) => { x.on = e.target.checked; draw(); } }),
            h('span', { class: 'mname' }, x.text, h('div', { class: 'faint' }, [x.note, x.exists ? 'כבר קיים' : `${x.n} עסקאות`].filter(Boolean).join(' · '))),
            h('span', { class: 'imppick' }, pick),
            h('span', { class: 'pill' + ((x.confidence || 'high') === 'low' ? ' warn' : '') }, CONF[x.confidence || 'high']));
        }));
      };
      draw();
      const includeManual = h('input', { type: 'checkbox', checked: false });
      return h('div', { class: 'stack' },
        h('div', { class: 'faint' }, 'מסומנים מראש: בטוח וסביר (חוץ מ"שונות"). אפשר לשנות קטגוריה בכל שורה לפני הייבוא — שינוי מסמן את השורה. קטגוריות חסרות ייווצרו.'),
        seg, seg2,
        h('div', { class: 'row' }, count, h('div', { class: 'grow' }),
          h('button', { class: 'btn small', onclick: () => { visible().forEach((x) => { if (!x.exists) x.on = true; }); draw(); } }, 'סמן את המוצגים'),
          h('button', { class: 'btn small', onclick: () => { visible().forEach((x) => { x.on = false; }); draw(); } }, 'נקה את המוצגים')),
        list,
        h('label', { class: 'check faint' }, includeManual, 'להחיל גם על עסקאות שסיווגתי ידנית'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => {
          let made = 0, cats = 0, tx = 0;
          for (const x of items.filter((i) => i.on)) {
            let c = x.catId && x.catId !== '__new' ? catById(x.catId) : catByName(x.cat);
            if (!c) { c = { id: uid(), name: x.cat, type: 'expense', budget: 0, group: guessGroup(x.cat) }; D().categories.push(c); cats++; }
            const r = { id: uid(), kind: x.kind, text: x.text, cat: c.id, auto: false, min: '', max: '' };
            D().rules.unshift(r); made++; tx += runRule(r, includeManual.checked);
          }
          S.save(); close(); toast(`נוצרו ${made} חוקים` + (cats ? `, ${cats} קטגוריות חדשות` : '') + ` · סווגו ${tx} עסקאות`); render();
        } }, 'ייבוא')));
    });
  }

  function openRule(existing, prefill) {
    const r0 = existing || { kind: 'contains', text: '', min: '', max: '', cat: null, ...(prefill || {}) };
    sheet(existing ? 'עריכת חוק' : 'חוק חדש', (close) => {
      let kind = r0.kind;
      const text = h('input', { type: 'text', value: r0.text, placeholder: 'למשל: WOLT, ביטוח, PAYBOX', 'aria-label': 'בית עסק' });
      const min = h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: r0.min == null ? '' : r0.min, placeholder: '—', 'aria-label': 'סכום מ' });
      const max = h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: r0.max == null ? '' : r0.max, placeholder: '—', 'aria-label': 'סכום עד' });
      const mFrom = h('input', { type: 'month', value: r0.mFrom || '', 'aria-label': 'מחודש' });
      const mTo = h('input', { type: 'month', value: r0.mTo || '', 'aria-label': 'עד חודש' });
      const dFrom = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '31', value: r0.dFrom == null ? '' : r0.dFrom, placeholder: '1', 'aria-label': 'מיום בחודש' });
      const dTo = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '31', value: r0.dTo == null ? '' : r0.dTo, placeholder: '31', 'aria-label': 'עד יום בחודש' });
      const cat = catPicker({ value: r0.cat, ariaLabel: 'קטגוריה לחוק', placeholder: 'בחר קטגוריה…' });
      const matchList = h('div', { class: 'matchlist' });
      const applyNow = h('input', { type: 'checkbox', checked: true });
      const includeManual = h('input', { type: 'checkbox', checked: false });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'סוג התאמה' });
      const preview = h('div', { class: 'notice info' });
      const day = (el) => (el.value === '' ? '' : Math.max(1, Math.min(31, Math.round(+el.value))));
      const draft = () => ({ kind, text: kind === 'exact' ? normMerchant(text.value) : text.value.trim(), min: min.value === '' ? '' : +min.value, max: max.value === '' ? '' : +max.value, mFrom: mFrom.value || '', mTo: mTo.value || '', dFrom: day(dFrom), dTo: day(dTo), cat: cat.value || null, auto: false });
      const upd = () => {
        const d = draft();
        if (!d.text) { preview.textContent = 'כתוב שם בית עסק (או חלק ממנו).'; matchList.replaceChildren(); return; }
        const m = D().txns.filter((t) => ruleMatch(d, t)).sort((a, b) => b.date.localeCompare(a.date));
        matchList.replaceChildren(...m.slice(0, 60).map((t) => h('div', { class: 'mrow' + (d.cat && t.cat !== d.cat ? ' diff' : '') },
          h('span', { class: 'num' }, dShort(t.date) + '.' + t.date.slice(2, 4)),
          h('span', { class: 'mname' }, t.merchant),
          h('span', { class: 'mcat' }, t.noAuto ? '🔒 ' : t.catSrc === 'manual' ? '✎ ' : '', catName(t.cat)),
          h('b', { class: 'amt' }, ils(t.amount || 0)))),
          m.length > 60 ? h('div', { class: 'faint', style: 'padding:6px' }, `ועוד ${m.length - 60} — "הצג עסקאות" לרשימה המלאה`) : null);
        const other = m.filter((t) => d.cat && t.cat !== d.cat);
        const manual = other.filter((t) => t.catSrc === 'manual').length, locked = other.filter((t) => t.noAuto).length;
        const names = [...new Set(m.map((t) => t.merchant))];
        preview.replaceChildren(`מתאים ל-${m.length} עסקאות (${ils(m.reduce((n, t) => n + (t.amount || 0), 0))})`,
          d.cat ? `. ${other.length} מהן בקטגוריה אחרת` + (manual || locked ? ` (${manual} סווגו ידנית, ${locked} מוחרגות)` : '') : '',
          names.length ? h('div', { class: 'faint', style: 'margin-top:4px' }, 'בתי עסק: ' + names.slice(0, 6).join(' · ') + (names.length > 6 ? ` ועוד ${names.length - 6}` : '')) : null);
      };
      const drawSeg = () => seg.replaceChildren(...[['contains', 'מכיל'], ['exact', 'שם מדויק']].map(([k, v]) => h('button', { type: 'button', 'aria-pressed': kind === k ? 'true' : 'false', onclick: () => { kind = k; drawSeg(); upd(); } }, v)));
      drawSeg();
      [text, min, max, mFrom, mTo, dFrom, dTo].forEach((el) => el.addEventListener('input', upd)); cat.addEventListener('change', upd);
      upd();
      const save = () => {
        const d = draft();
        if (!d.text) return toast('צריך בית עסק');
        if (!d.cat) return toast('צריך קטגוריה');
        if (d.min !== '' && d.max !== '' && d.min > d.max) return toast('"מ-" גדול מ"עד"');
        if (d.mFrom && d.mTo && d.mFrom > d.mTo) return toast('חודש ההתחלה אחרי חודש הסיום');
        let r = existing;
        if (r) Object.assign(r, d); else { r = { id: uid(), ...d }; D().rules.unshift(r); }
        const n = applyNow.checked ? runRule(r, includeManual.checked) : 0;
        S.save(); close(); toast((existing ? 'החוק עודכן' : 'החוק נוצר') + (applyNow.checked ? ` · עודכנו ${n} עסקאות` : '')); render();
      };
      return h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', null, 'בית עסק'), text),
        seg,
        h('div', { class: 'fields' }, h('label', { class: 'field' }, h('span', null, 'סכום מ-₪ (לא חובה)'), min), h('label', { class: 'field' }, h('span', null, 'עד ₪ (לא חובה)'), max)),
        h('div', { class: 'faint' }, 'לסכום מדויק כתוב אותו מספר בשני השדות. לדוגמה: PAYBOX מ-4600 עד 4600 → חיסכון.'),
        !(r0.mFrom || r0.mTo || r0.dFrom || r0.dTo) ? null : h('details', { class: 'ruledates', open: true },
          h('summary', null, 'תאריכים (לא חובה) — לפי תאריך העסקה'),
          h('div', { class: 'stack', style: 'margin-top:8px' },
            h('div', { class: 'fields' }, h('label', { class: 'field' }, h('span', null, 'מחודש'), mFrom), h('label', { class: 'field' }, h('span', null, 'עד חודש'), mTo)),
            h('div', { class: 'fields' }, h('label', { class: 'field' }, h('span', null, 'מיום בחודש'), dFrom), h('label', { class: 'field' }, h('span', null, 'עד יום בחודש'), dTo)),
            h('div', { class: 'faint' }, 'טווח הימים חל על כל חודש בטווח. לדוגמה ימים 5–11: רק עסקאות שבוצעו בין ה-5 ל-11 בכל חודש. אפשר גם 28–3 (סוף חודש ותחילת הבא). בלי "עד חודש" — החוק ימשיך לחול גם על חודשים עתידיים.'))),
        h('label', { class: 'field' }, h('span', null, 'קטגוריה'), cat),
        preview,
        h('div', { class: 'faint' }, 'העסקאות שהחוק תופס (✎ = סווג ידנית, 🔒 = מוחרג מסיווג אוטומטי, מסומן = בקטגוריה אחרת):'),
        matchList,
        h('label', { class: 'check' }, applyNow, 'להחיל עכשיו על עסקאות קיימות'),
        h('label', { class: 'check faint' }, includeManual, 'כולל עסקאות שסיווגתי ידנית (עסקאות שהוחרגו מסיווג אוטומטי לא ישתנו אף פעם)'),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: save }, 'שמירה'),
          existing ? h('button', { class: 'btn', onclick: () => { close(); drill({ rule: existing.id }); } }, 'הצג עסקאות') : null,
          h('div', { class: 'grow' }),
          existing ? h('button', { class: 'btn danger', onclick: () => {
            const n = D().txns.filter((t) => t.ruleId === existing.id && t.catSrc === 'rule').length;
            D().rules = D().rules.filter((x) => x !== existing);
            // transactions this rule classified fall back to whatever the remaining rules say
            for (const t of D().txns) if (t.ruleId === existing.id && t.catSrc === 'rule' && !t.noAuto) { const c = classify(t); t.cat = c.cat; t.catSrc = c.src; t.ruleId = c.ruleId; }
            S.save(); close(); toast(`החוק נמחק · ${n} עסקאות סווגו מחדש לפי שאר החוקים`); render();
          } }, 'מחיקה') : null));
    });
  }

  /* ---------------- investments (USD broker account, manual transactions) ---------------- */
  const IV = () => D().invest;
  const nfu = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const usd = (n, sign) => n == null ? '—' : (n < 0 ? '−' : sign && n > 0 ? '+' : '') + '$' + nfu.format(Math.abs(n));
  const pctf = (x, sign) => x == null ? '—' : (x < 0 ? '−' : sign && x > 0 ? '+' : '') + nfu.format(Math.abs(x * 100)) + '%';
  const money = (n, sign) => h('span', { class: 'amt' + (sign && n != null ? (n > 0 ? ' gain' : n < 0 ? ' loss' : '') : '') }, usd(n, sign));
  const pctEl = (x, sign) => h('span', { class: 'amt' + (sign && x != null ? (x > 0 ? ' gain' : x < 0 ? ' loss' : '') : '') }, pctf(x, sign));
  const TYPES = { buy: 'קנייה', sell: 'מכירה', div: 'דיבידנד', dep: 'הפקדה', wd: 'משיכה' };
  const QUOTE_TTL = 15 * 60000;
  const agoText = (at) => { if (!at) return ''; const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'עכשיו' : m < 60 ? `לפני ${m} ד׳` : m < 1440 ? `לפני ${Math.round(m / 60)} ש׳` : new Date(at).toLocaleDateString('he-IL'); };

  function effPrices() { // manual override wins; otherwise last API price
    const out = {};
    for (const [sym, p] of Object.entries(IV().prices)) {
      if (p.manual && p.manual.price != null) out[sym] = { price: p.manual.price, at: p.manual.at, manual: true };
      else if (p.price != null) out[sym] = { price: p.price, at: p.at, stale: p.stale || (Date.now() - p.at > 24 * 3600000) };
    }
    return out;
  }
  const validInv = (t) => !!t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && (
    (t.type === 'buy' || t.type === 'sell') ? !!t.sym && t.qty > 0 && t.price > 0 && t.fee >= 0 :
    t.type === 'div' ? !!t.sym && t.gross > 0 && (t.tax || 0) >= 0 :
    (t.type === 'dep' || t.type === 'wd') ? t.amount > 0 : false);
  const invTxns = () => IV().txns.filter(validInv);
  const heldSymbols = () => KupaInvest.compute(invTxns(), {}, IV().settings).positions.map((p) => p.sym);

  let quoteBusy = false, quoteMsg = '';
  const tried = {}; // sym -> last automatic attempt (so a missing key / bad symbol can't cause a fetch loop)
  async function refreshQuotes(force) {
    if (quoteBusy) return;
    const held = heldSymbols();
    const stale = (s2) => { const p = IV().prices[s2]; return !(p && ((p.manual && p.manual.price != null) || (p.at && Date.now() - p.at < QUOTE_TTL))); };
    const syms = force ? held : held.filter((s2) => stale(s2) && !(tried[s2] && Date.now() - tried[s2] < QUOTE_TTL));
    if (!syms.length) return;
    syms.forEach((s2) => { tried[s2] = Date.now(); });
    quoteBusy = true; quoteMsg = 'מושך מחירים…'; if (ui.view === 'invest') render();
    try {
      const q = await S.quotes(syms, force);
      let ok = 0; const fail = []; let noKey = false;
      for (const [sym, r] of Object.entries(q)) {
        const cur = IV().prices[sym] || {};
        if (r.error === 'no_key') noKey = true;
        if (r.price != null) { IV().prices[sym] = { ...cur, price: r.price, at: r.at, stale: !!r.stale }; if (r.stale) fail.push(sym); else ok++; }
        else fail.push(sym);
      }
      quoteMsg = noKey ? 'אין מפתח API בשרת — מחירים ידניים בלבד (לחיצה על מחיר בטבלה)' : fail.length ? `לא עודכנו: ${fail.join(', ')} — מוצג המחיר האחרון` : `עודכנו ${ok} מחירים`;
      if (ok) S.save();
    } catch (e) { quoteMsg = 'משיכת מחירים נכשלה — מוצגים המחירים האחרונים'; }
    quoteBusy = false; if (ui.view === 'invest') render();
  }

  function viewInvest() {
    const iv = IV(); const prices = effPrices();
    const r = KupaInvest.compute(invTxns(), prices, { sellFee: iv.settings.fee, cgt: iv.settings.cgt });
    const badRows = iv.txns.length - invTxns().length;
    setTimeout(() => refreshQuotes(false), 0);
    const kpiI = (label, value, sub) => h('div', { class: 'kpi' }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value), sub ? h('div', { class: 'faint' }, sub) : null);
    const priceCell = (p) => {
      const pr = prices[p.sym];
      return h('td', { class: 'n drill', role: 'button', tabindex: 0, title: 'עדכון מחיר ידני', onclick: () => openPrice(p.sym) },
        p.price == null ? h('span', { class: 'loss' }, 'אין מחיר') : money(p.price),
        pr ? h('div', { class: 'pmeta' + (pr.stale ? ' stale' : '') }, pr.manual ? '✎ ידני · ' + agoText(pr.at) : (pr.stale ? '⚠ ישן · ' : '') + agoText(pr.at)) : null);
    };
    const T = r.positions;
    return h('main', { class: 'stack' },
      h('div', { class: 'row' }, h('h1', { class: 'grow' }, 'תיק השקעות'),
        h('button', { class: 'btn', disabled: quoteBusy || !T.length, onclick: () => refreshQuotes(true) }, quoteBusy ? 'מרענן…' : 'רענון מחירים'),
        h('button', { class: 'btn', onclick: () => openInvPaste() }, 'ייבוא קובץ / הדבקה'),
        h('button', { class: 'btn primary', onclick: () => addInvRow() }, '+ שורה')),
      badRows ? h('div', { class: 'notice bad' }, `${badRows} שורות לא שלמות (מסומנות באדום בטבלת התנועות) — לא נכללות בחישוב`) : null,
      quoteMsg ? h('div', { class: 'faint' }, quoteMsg) : null,
      r.missing.length ? h('div', { class: 'notice' }, `אין מחיר ל: ${r.missing.join(', ')} — לחץ על המחיר בטבלה כדי להזין ידנית. השווי לא כולל אותם.`) : null,
      r.warnings.map((w) => h('div', { class: 'notice bad' }, w)),
      !iv.txns.length ? h('div', { class: 'card empty' }, 'עוד אין תנועות. התחל ב"+ תנועה" — למשל הפקדה, ואז קניות.') : null,
      iv.txns.length ? h('div', { class: 'kpis' },
        kpiI('שווי תיק', money(r.portfolio), 'מזומן + ניירות'),
        kpiI('יתרה דולרית', money(r.cash)),
        kpiI('שווי ניירות', money(r.value)),
        kpiI('רווח מול הפקדות', money(r.vsDeposits, true), [pctf(r.vsDepositsPct, true), ' · הפקדות נטו ', usd(r.netDeposits)])) : null,
      T.length ? h('section', { class: 'card', style: 'padding:8px 10px' },
        h('div', { class: 'section-title' }, h('h2', null, 'פוזיציות'), h('span', { class: 'faint' }, 'לחיצה על מחיר — עדכון ידני')),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid inv' },
          h('thead', null, h('tr', null, ...['נייר', 'כמות', 'עלות כולל עמלות', 'עלות ממוצעת', 'שער נוכחי', 'שווי', 'רווח מחיר', '%', 'דיבידנד נטו', '%', 'רווח כולל', '%', 'משקל', 'BREAKEVEN'].map((x, i) => h('th', { class: i ? 'n' : '' }, x)))),
          h('tbody', null,
            T.map((p) => h('tr', null,
              h('td', null, h('b', null, p.sym)), h('td', { class: 'n' }, nfu.format(p.qty).replace(/\.00$/, '')), h('td', { class: 'n' }, money(p.cost)), h('td', { class: 'n' }, money(p.avg)),
              priceCell(p), h('td', { class: 'n' }, money(p.value)),
              h('td', { class: 'n' }, money(p.priceGain, true)), h('td', { class: 'n' }, pctEl(p.priceGainPct, true)),
              h('td', { class: 'n' }, money(p.div)), h('td', { class: 'n' }, pctEl(p.divPct)),
              h('td', { class: 'n' }, h('b', null, money(p.total, true))), h('td', { class: 'n' }, pctEl(p.totalPct, true)),
              h('td', { class: 'n' }, pctf(p.weight)), h('td', { class: 'n' }, money(p.breakeven)))),
            h('tr', { class: 'total' }, h('td', null, 'סה"כ'), h('td'), h('td', { class: 'n' }, money(r.cost)), h('td'), h('td'), h('td', { class: 'n' }, money(r.value)),
              h('td', { class: 'n' }, money(r.priceGain, true)), h('td', { class: 'n' }, pctEl(r.priceGainPct, true)),
              h('td', { class: 'n' }, money(r.divHeld)), h('td', { class: 'n' }, pctEl(r.divPct)),
              h('td', { class: 'n' }, money(r.total, true)), h('td', { class: 'n' }, pctEl(r.totalPct, true)), h('td', { class: 'n' }, r.value ? '100%' : ''), h('td')))))) : null,
      iv.txns.length ? h('section', { class: 'card stack' },
        h('h2', null, 'סיכום חשבון'),
        h('div', { class: 'sumgrid' },
          ...[['סך הפקדות נטו', money(r.netDeposits)], ['רווח כולל מול הפקדות', [money(r.vsDeposits, true), ' (', pctEl(r.vsDepositsPct, true), ')']],
            ['סך עמלות ששולמו', money(r.fees)], ['מס שנוכה מדיבידנדים', money(r.divTax)], ['דיבידנד נטו (כולל ניירות שנמכרו)', money(r.divNet)],
            r.realized ? ['רווח ממומש ממכירות', money(r.realized, true)] : null].filter(Boolean).map(([k, v]) => h('div', null, h('span', { class: 'faint' }, k), h('b', null, v)))),
        T.length ? h('div', { class: 'sellall' },
          h('h3', null, 'אם מוכרים הכל עכשיו'),
          h('div', { class: 'sumgrid' },
            h('div', null, h('span', { class: 'faint' }, `עמלות מכירה (${T.length} × ${usd(+iv.settings.fee)})`), h('b', null, money(r.sellFees))),
            h('div', null, h('span', { class: 'faint' }, `מס רווחי הון משוער (${nfu.format(iv.settings.cgt * 100).replace(/\.00$/, '')}% על הרווח נטו אחרי עמלות)`), h('b', null, money(r.estTax))),
            h('div', null, h('span', { class: 'faint' }, 'רווח נטו'), h('b', null, money(r.netIfSold, true)))),
          h('div', { class: 'faint' }, 'הערכה בלבד: המס מחושב על סכום הרווחים פחות ההפסדים בניירות המוחזקים, בלי התאמות אינפלציה/שער ובלי קיזוז מכירות קודמות בשנה.')) : null) : null,
      invGrid(iv),
      h('details', { class: 'card' }, h('summary', null, 'הגדרות התיק ומחירים'),
        h('div', { class: 'stack', style: 'margin-top:10px' },
          h('div', { class: 'fields' },
            h('label', { class: 'field' }, h('span', null, 'עמלה לעסקה ($) — ברירת מחדל בטופס וגם עמלת מכירה משוערת'),
              h('input', { type: 'number', step: 'any', min: '0', inputmode: 'decimal', value: iv.settings.fee, onchange: (e) => { iv.settings.fee = Math.max(0, +e.target.value || 0); S.save(); render(); } })),
            h('label', { class: 'field' }, h('span', null, 'מס רווחי הון (%)'),
              h('input', { type: 'number', step: 'any', min: '0', max: '100', inputmode: 'decimal', value: iv.settings.cgt * 100, onchange: (e) => { iv.settings.cgt = Math.max(0, Math.min(100, +e.target.value || 0)) / 100; S.save(); render(); } }))),
          h('div', { class: 'faint' }, 'מחירים: נמשכים בצד השרת (Finnhub) עם מפתח שנשמר כ-secret, במטמון 15 דקות. לשרת נשלחים רק סימולי הניירות — לא כמויות ולא סכומים. בלי מפתח — עובדים עם מחירים ידניים (לחיצה על מחיר בטבלה).'))));
  }

  /* spreadsheet-style transactions: same columns as the user's sheet; edits save on leaving a cell */
  const INV_TYPES_HE = { 'הפקדה': 'dep', 'משיכה': 'wd', 'קנייה': 'buy', 'קניה': 'buy', 'מכירה': 'sell', 'דיבידנד': 'div', 'deposit': 'dep', 'withdrawal': 'wd', 'buy': 'buy', 'sell': 'sell', 'dividend': 'div' };
  const FIELDS = { buy: ['sym', 'qty', 'price', 'fee'], sell: ['sym', 'qty', 'price', 'fee'], div: ['sym', 'gross', 'tax'], dep: ['amount'], wd: ['amount'] };
  function invGrid(iv) {
    const rows = iv.txns.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.seq || 0) - (b.seq || 0));
    const cell = (t, field, attrs) => {
      const on = (FIELDS[t.type] || []).includes(field) || field === 'date';
      const v = field === 'amount' ? t.amount : t[field];
      return h('td', null, h('input', { ...attrs, value: v == null || (typeof v === 'number' && isNaN(v)) ? '' : v, disabled: !on, 'data-k': t.id + ':' + field,
        onchange: (e) => {
          let x = e.target.value.trim();
          if (field === 'sym') x = x.toUpperCase();
          else if (field !== 'date') x = x === '' ? null : Math.abs(+x.replace(/[,$\s]/g, ''));
          t[field] = x; S.save(); renderKeepFocus();
        } }));
    };
    const numA = { type: 'text', inputmode: 'decimal', class: 'gnum' };
    return h('section', { class: 'card', style: 'padding:8px 10px' },
      h('div', { class: 'section-title' }, h('h2', null, `תנועות (${iv.txns.length})`), h('span', { class: 'faint' }, 'עריכה ישירה בתאים · נשמר ביציאה מתא')),
      h('div', { class: 'tablewrap' }, h('table', { class: 'grid igrid' },
        h('thead', null, h('tr', null, ...['תאריך', 'סוג פעולה', 'נייר', 'כמות', 'שער ביצוע', 'עמלה', 'ברוטו', 'מס', 'סכום נטו', ''].map((x) => h('th', null, x)))),
        h('tbody', null, rows.map((t) => {
          const ok = validInv(t); const n = ok ? KupaInvest.net(t) : null;
          return h('tr', { class: ok ? '' : 'bad' },
            cell(t, 'date', { type: 'date' }),
            h('td', null, h('select', { 'data-k': t.id + ':type', onchange: (e) => { t.type = e.target.value; if ((t.type === 'buy' || t.type === 'sell') && t.fee == null) t.fee = iv.settings.fee; S.save(); renderKeepFocus(); } },
              Object.entries(TYPES).map(([k, v]) => h('option', { value: k, selected: t.type === k }, v)))),
            cell(t, 'sym', { type: 'text', class: 'gsym', autocapitalize: 'characters', placeholder: t.type === 'dep' || t.type === 'wd' ? 'USD' : '' }),
            cell(t, 'qty', numA), cell(t, 'price', numA), cell(t, 'fee', numA),
            t.type === 'dep' || t.type === 'wd' ? cell(t, 'amount', numA) : cell(t, 'gross', numA),
            cell(t, 'tax', numA),
            h('td', { class: 'n' }, n == null ? h('span', { class: 'loss' }, 'חסר') : money(n, true)),
            h('td', null, h('button', { class: 'icon-btn', 'aria-label': 'מחיקת שורה', onclick: () => { iv.txns = iv.txns.filter((x) => x !== t); S.save(); render(); } }, icon('trash'))));
        })))),
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'btn', onclick: () => addInvRow() }, '+ שורה'),
        h('span', { class: 'faint' }, 'הפקדה/משיכה: הסכום בעמודת "ברוטו". מס: אפשר עם מינוס או בלי.')));
  }
  function addInvRow() {
    const iv = IV(); const lastT = iv.txns.slice().sort((a, b) => (b.seq || 0) - (a.seq || 0))[0];
    const t = { id: uid(), seq: Date.now(), date: new Date().toISOString().slice(0, 10), type: lastT && lastT.type !== 'dep' ? lastT.type : 'buy', sym: '', qty: null, price: null, fee: iv.settings.fee };
    iv.txns.push(t); S.save(); render();
    setTimeout(() => { const el = document.querySelector(`[data-k="${t.id}:sym"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 30);
  }
  function renderKeepFocus() { // re-render after a cell change without losing the cell the user tabbed into
    setTimeout(() => { const a = document.activeElement; const k = a && a.dataset ? a.dataset.k : null; render(); if (k) { const el = document.querySelector(`[data-k="${k}"]`); if (el) el.focus(); } }, 0);
  }

  /* paste rows copied from a spreadsheet (tab-separated), headers optional:
     תאריך | סוג פעולה | נייר | כמות | שער ביצוע | עמלה | ברוטו | מס | סכום נטו */
  function parseInvTable(text) {
    const lines = text.split(/\r?\n/).map((l) => l.replace(/‏|‎/g, '')).filter((l) => l.trim());
    if (!lines.length) return [];
    const split = (l) => (l.includes('\t') ? l.split('\t') : l.split(/\s{2,}|,(?=\S)/)).map((c) => c.trim());
    let cols = ['date', 'type', 'sym', 'qty', 'price', 'fee', 'gross', 'tax', 'net'];
    const H = { 'תאריך': 'date', 'סוג פעולה': 'type', 'סוג': 'type', 'נייר': 'sym', 'סימול': 'sym', 'כמות': 'qty', 'שער ביצוע': 'price', 'שער': 'price', 'עמלה': 'fee', 'ברוטו': 'gross', 'מס': 'tax', 'סכום נטו': 'net', 'סכום': 'amount' };
    let start = 0;
    const first = split(lines[0]);
    if (first.some((c) => H[c])) { cols = first.map((c) => H[c] || null); start = 1; }
    const num = (v) => { if (v == null || v === '') return null; const x = +String(v).replace(/[,$₪\s]/g, ''); return isNaN(x) ? NaN : x; };
    const toDate = (v) => { v = (v || '').trim(); if (/^\d{5}(\.\d+)?$/.test(v)) return P.toISODate(+v); let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      m = v.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/); if (m) { let y = m[3] ? +m[3] : new Date().getFullYear(); if (y < 100) y += 2000; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; } return null; };
    const out = [];
    for (let i = start; i < lines.length; i++) {
      const c = split(lines[i]); const o = {}; cols.forEach((k, j) => { if (k) o[k] = c[j]; });
      const type = INV_TYPES_HE[(o.type || '').trim()] || INV_TYPES_HE[(o.type || '').trim().toLowerCase()];
      const t = { date: toDate(o.date), type };
      const problems = [];
      if (!t.date) problems.push('תאריך');
      if (!type) problems.push('סוג פעולה');
      if (type === 'buy' || type === 'sell') Object.assign(t, { sym: (o.sym || '').toUpperCase(), qty: Math.abs(num(o.qty)), price: Math.abs(num(o.price)), fee: o.fee === '' || o.fee == null ? IV().settings.fee : Math.abs(num(o.fee)) });
      else if (type === 'div') Object.assign(t, { sym: (o.sym || '').toUpperCase(), gross: Math.abs(num(o.gross)), tax: Math.abs(num(o.tax) || 0) });
      else if (type === 'dep' || type === 'wd') t.amount = Math.abs(num(o.gross) ?? num(o.amount) ?? num(o.net) ?? num(o.qty));
      if (type && !validInv(t)) problems.push('ערכים חסרים');
      const given = num(o.net); let check = null;
      if (type && validInv(t) && given != null && !isNaN(given)) { const calc = KupaInvest.net(t); check = Math.abs(calc - given) < 0.01 ? 'ok' : `חישוב ${usd(calc, true)} ≠ בטבלה ${usd(given, true)}`; }
      const key = (x) => [x.date, x.type, x.sym || '', x.qty || '', x.price || '', x.gross || '', x.amount || ''].join('|');
      const exists = IV().txns.some((x) => key(x) === key(t));
      out.push({ t, raw: lines[i], problems, check, exists, on: !problems.length && !exists });
    }
    return out;
  }

  function openInvPaste() {
    sheet('ייבוא תנועות — קובץ או הדבקה', (close) => {
      const ta = h('textarea', { rows: 8, dir: 'ltr', placeholder: 'העתק שורות מאקסל / Google Sheets והדבק כאן (אפשר כולל שורת הכותרות)', style: 'font-family:ui-monospace,monospace;font-size:12px' });
      const prev = h('div');
      let items = [];
      const draw = () => {
        items = parseInvTable(ta.value);
        if (!items.length) { prev.replaceChildren(); return; }
        const n = items.filter((x) => x.on).length;
        prev.replaceChildren(h('div', { class: 'stack' },
          h('div', { class: 'row' }, h('b', null, `${n} שורות ייובאו`), h('span', { class: 'faint' }, `מתוך ${items.length}`),
            items.some((x) => x.check && x.check !== 'ok') ? h('span', { class: 'pill warn' }, 'יש אי-התאמה בסכום נטו') : items.some((x) => x.check === 'ok') ? h('span', { class: 'pill accent' }, '✓ הסכום נטו תואם בכל השורות') : null),
          h('div', { class: 'matchlist', style: 'max-height:40vh' }, items.map((x) => h('label', { class: 'mrow pst' + (x.on ? '' : ' off') },
            h('input', { type: 'checkbox', checked: x.on, disabled: !!x.problems.length, onchange: (e) => { x.on = e.target.checked; } }),
            h('span', { class: 'num' }, x.t.date ? fullDate(x.t.date) : '?'),
            h('span', { class: 'mname' }, (TYPES[x.t.type] || '?') + ' ' + (x.t.sym || ''), h('div', { class: 'faint' },
              x.problems.length ? 'לא תקין: ' + x.problems.join(', ') : x.exists ? 'כבר קיים — ידולג' : x.check && x.check !== 'ok' ? x.check : '')),
            h('b', { class: 'amt' }, x.problems.length ? '' : usd(KupaInvest.net(x.t), true)))))));
      };
      ta.addEventListener('input', draw);
      const fileIn = h('input', { type: 'file', accept: '.xlsx,.xls,.csv,.tsv,.txt', class: 'hidden', onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          let text;
          if (/\.(csv|tsv|txt)$/i.test(f.name)) text = await f.text();
          else {
            const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false });
            // first sheet that looks like the transactions table (has a header with תאריך), else the first sheet
            const sheets = wb.SheetNames.map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }));
            const rows = sheets.find((r) => r.some((row) => row.some((c) => String(c).trim() === 'תאריך'))) || sheets[0] || [];
            const hi = rows.findIndex((row) => row.some((c) => String(c).trim() === 'תאריך'));
            text = rows.slice(Math.max(0, hi)).filter((row) => row.some((c) => String(c).trim() !== '')).map((row) => row.map((c) => String(c)).join('\t')).join('\n');
          }
          ta.value = text; draw(); fname.textContent = f.name;
        } catch (x) { toast('לא הצלחתי לקרוא את הקובץ'); }
        e.target.value = '';
      } });
      const fname = h('span', { class: 'faint' });
      return h('div', { class: 'stack' },
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => fileIn.click() }, 'בחירת קובץ (Excel / CSV)'), fname, fileIn),
        h('div', { class: 'faint' }, 'או להעתיק שורות מגיליון ולהדביק:'),
        h('div', { class: 'faint' }, 'עמודות לפי הסדר (או לפי שורת כותרות): תאריך · סוג פעולה · נייר · כמות · שער ביצוע · עמלה · ברוטו · מס · סכום נטו. הפקדה/משיכה — הסכום בברוטו. אם יש עמודת "סכום נטו", כל שורה נבדקת מולה.'),
        ta, prev,
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => {
          const add = items.filter((x) => x.on && !x.problems.length);
          if (!add.length) return toast('אין שורות לייבוא');
          let seq = Date.now(); for (const x of add) IV().txns.push({ id: uid(), seq: seq++, ...x.t });
          S.save(); close(); toast(`יובאו ${add.length} תנועות`); render(); refreshQuotes(false);
        } }, 'ייבוא')));
    });
  }

  function openPrice(sym) {
    const p = IV().prices[sym] || {};
    sheet('מחיר ' + sym, (close) => {
      const inp = h('input', { type: 'number', step: 'any', min: '0', inputmode: 'decimal', value: p.manual ? p.manual.price : '', placeholder: p.price != null ? String(p.price) : '' });
      return h('div', { class: 'stack' },
        h('div', null, 'מחיר אחרון מה-API: ', p.price != null ? h('b', null, usd(p.price)) : h('span', { class: 'faint' }, 'אין'), p.at ? h('span', { class: 'faint' }, ' · ' + agoText(p.at) + (p.stale ? ' (ישן)' : '')) : null),
        h('label', { class: 'field' }, h('span', null, 'מחיר ידני ($) — דורס את ה-API עד שתנקה'), inp),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => { const v = +inp.value; if (!(v > 0)) return toast('מחיר לא תקין'); IV().prices[sym] = { ...p, manual: { price: v, at: Date.now() } }; S.save(); close(); render(); } }, 'שמירה'),
          p.manual ? h('button', { class: 'btn', onclick: () => { const q = { ...p }; delete q.manual; IV().prices[sym] = q; S.save(); close(); render(); refreshQuotes(true); } }, 'ניקוי — חזרה למחיר API') : null));
    });
  }

  function openInvTx(existing) {
    const iv = IV();
    const t0 = existing || { type: 'buy', date: new Date().toISOString().slice(0, 10), fee: iv.settings.fee };
    sheet(existing ? 'עריכת תנועה' : 'תנועה חדשה', (close) => {
      let type = t0.type;
      const known = [...new Set(iv.txns.filter((t) => t.sym).map((t) => t.sym))].sort();
      const date = h('input', { type: 'date', value: t0.date });
      const sym = h('input', { type: 'text', value: t0.sym || '', placeholder: 'VOO', autocapitalize: 'characters', autocomplete: 'off', list: 'kupa-syms', style: 'direction:ltr;text-align:right' });
      const dl = h('datalist', { id: 'kupa-syms' }, known.map((s2) => h('option', { value: s2 })));
      const num = (v, ph) => h('input', { type: 'number', step: 'any', min: '0', inputmode: 'decimal', value: v == null ? '' : v, placeholder: ph || '' });
      const qty = num(t0.qty), price = num(t0.price), fee = num(t0.fee != null ? t0.fee : iv.settings.fee), gross = num(t0.gross), tax = num(t0.tax), amount = num(t0.amount);
      const preview = h('div', { class: 'notice info' });
      const box = h('div', { class: 'stack' });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'סוג' });
      const f = (label, el) => h('label', { class: 'field' }, h('span', null, label), el);
      const draft = () => {
        const d = { type, date: date.value };
        if (type === 'buy' || type === 'sell') Object.assign(d, { sym: sym.value.trim().toUpperCase(), qty: +qty.value, price: +price.value, fee: +fee.value || 0 });
        else if (type === 'div') Object.assign(d, { sym: sym.value.trim().toUpperCase(), gross: +gross.value, tax: +tax.value || 0 });
        else Object.assign(d, { amount: +amount.value });
        return d;
      };
      const upd = () => { const d = draft(); const n = KupaInvest.net(d); preview.replaceChildren('סכום נטו למזומן: ', money(isFinite(n) ? n : 0, true)); };
      const draw = () => {
        seg.replaceChildren(...Object.entries(TYPES).map(([k, v]) => h('button', { type: 'button', 'aria-pressed': type === k ? 'true' : 'false', onclick: () => { type = k; draw(); } }, v)));
        box.replaceChildren(
          type !== 'dep' && type !== 'wd' ? f('נייר (סימול)', sym) : null,
          type === 'buy' || type === 'sell' ? h('div', { class: 'fields' }, f('כמות', qty), f('שער ביצוע ($)', price), f('עמלה ($)', fee)) : null,
          type === 'div' ? h('div', { class: 'fields' }, f('ברוטו ($)', gross), f('מס שנוכה ($)', tax)) : null,
          type === 'dep' || type === 'wd' ? f('סכום ($)', amount) : null);
        upd();
      };
      [date, sym, qty, price, fee, gross, tax, amount].forEach((el) => el.addEventListener('input', upd));
      draw();
      const save = () => {
        const d = draft();
        if (!d.date) return toast('צריך תאריך');
        if ((type === 'buy' || type === 'sell' || type === 'div') && !/^[A-Z0-9.\-]{1,12}$/.test(d.sym)) return toast('סימול לא תקין');
        if ((type === 'buy' || type === 'sell') && !(d.qty > 0 && d.price > 0)) return toast('צריך כמות ושער');
        if (type === 'div' && !(d.gross > 0)) return toast('צריך סכום ברוטו');
        if ((type === 'dep' || type === 'wd') && !(d.amount > 0)) return toast('צריך סכום');
        if (existing) { for (const k of ['sym', 'qty', 'price', 'fee', 'gross', 'tax', 'amount']) delete existing[k]; Object.assign(existing, d); }
        else iv.txns.push({ id: uid(), seq: Date.now(), ...d });
        S.save(); close(); render(); refreshQuotes(false);
      };
      return h('div', { class: 'stack' }, seg, f('תאריך', date), box, dl, preview,
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'שמירה'), h('div', { class: 'grow' }),
          existing ? h('button', { class: 'btn danger', onclick: () => { iv.txns = iv.txns.filter((x) => x !== existing); S.save(); close(); render(); } }, 'מחיקה') : null));
    });
  }

  /* Excel export: sheets = [{ name, rows: [[...], ...], cols?: [widths] }] — numbers stay numbers */
  function exportXlsx(fileBase, sheets) {
    try {
      const wb = XLSX.utils.book_new();
      for (const sh of sheets) {
        const ws = XLSX.utils.aoa_to_sheet(sh.rows);
        ws['!cols'] = (sh.rows[0] || []).map((_, i) => ({ wch: Math.min(40, Math.max(8, ...sh.rows.map((r) => String(r[i] == null ? '' : r[i]).length + 2))) }));
        XLSX.utils.book_append_sheet(wb, ws, sh.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
      }
      wb.Workbook = { Views: [{ RTL: true }] };
      const d = new Date(); const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      // own download link so the file keeps its name (Hebrew included) on every browser
      const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `${fileBase}-${stamp}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast('הקובץ ירד');
    } catch (e) { console.warn(e); toast('הייצוא נכשל'); }
  }
  const xlBtn = (fn) => h('button', { class: 'btn small', title: 'ייצוא לאקסל', onclick: fn }, icon('download'), 'אקסל');
  const r2x = (n) => Math.round((n || 0) * 100) / 100;
  // one transaction -> rows for export (a split transaction gives one row per part)
  function txExportRows(list) {
    const head = ['תאריך עסקה', 'תאריך חיוב', 'חודש (' + basisLabel() + ')', 'בית עסק', 'סכום ₪', 'סכום מקור', 'מטבע', 'קבוצה', 'קטגוריה', 'כרטיס', 'תשלום', 'נספר', 'הערות'];
    const rows = [head];
    for (const t of list) {
      const ps = t.splits && t.splits.length ? t.splits.map((sp) => ({ cat: sp.cat, amount: sp.amount })) : [{ cat: t.cat, amount: t.amount }];
      for (const p of ps) {
        const c = catById(p.cat); const g = groupOf(c);
        rows.push([fullDate(t.date), fullDate(t.billingDate), monthOf(t), t.merchant || '', p.amount == null ? '' : r2x(t.dir === 'in' ? -p.amount : p.amount), t.amountOrig == null ? '' : r2x(t.amountOrig), t.currency || '',
          g ? g.name : '', c ? c.name : 'לסיווג', cardLabel(t), t.inst ? `${t.inst.n}/${t.inst.of}` : '', t.excluded || ignoredCard(t) ? 'לא' : 'כן', [t.memo, t.notes].filter(Boolean).join(' · ')]);
      }
    }
    return rows;
  }
  function openNewGroup(onDone) {
    sheet('קבוצה חדשה', (close) => {
      const name = h('input', { type: 'text', maxlength: '40', placeholder: 'למשל: בעלי חיים, חיסכון לדירה' });
      const save = () => {
        const n = name.value.trim(); if (!n) return toast('צריך שם');
        if (groups().some((g) => g.name === n)) return toast('כבר יש קבוצה בשם הזה');
        const used = new Set(groups().map((g) => g.color));
        const g = { id: uid(), key: '', name: n, icon: 'g_tag', color: GROUP_COLORS.find((c) => !used.has(c)) || '#64748b' };
        D().groups.push(g); S.save(); close(); toast(`נוספה "${n}" — אפשר להעביר אליה קטגוריות`); if (onDone) onDone(g);
      };
      setTimeout(() => name.focus(), 50); name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      return h('div', { class: 'stack' }, h('label', { class: 'field' }, h('span', null, 'שם'), name),
        h('div', { class: 'faint' }, 'אייקון וצבע אפשר לשנות בהגדרות ← קבוצות.'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'יצירה')));
    }, () => render());
  }

  /* ---------------- view: quick update ----------------
     groups over time → pick a group → its categories over time (each can move to another group)
     → pick a category (or one of its months) → its transactions (each can move to another category) */
  function viewQuick() {
    const q = ui.q;
    const all = allMonths();
    const end = thisMonth() > (all.slice(-1)[0] || '') ? thisMonth() : all.slice(-1)[0];
    const months = []; if (q.only) months.push(q.only); else for (let i = 0; i < q.range; i++) months.push(addMonths(end, -i)); // newest first
    if (q.only) q.month = '';
    const stats = months.map((m) => monthStats(m));
    const sumCats = (byCat, ids) => ids.reduce((n, id) => n + (byCat[id] || 0), 0);
    if (q.group && q.group !== '_none' && !groupById(q.group)) Object.assign(q, { group: '', cat: '', month: '' });
    if (q.cat && !catById(q.cat)) Object.assign(q, { cat: '', month: '' });
    const pick = (patch) => { Object.assign(ui.q, patch); render(); };
    const qExport = {};
    const cell = (v, on, sel) => v ? h('td', { class: 'n drill' + (sel ? ' qsel' : ''), role: 'button', tabindex: 0, onclick: on, onkeydown: (e) => { if (e.key === 'Enter') on(); } }, nf0.format(v)) : h('td', { class: 'n faint' }, '·');
    const head = (first) => h('thead', null, h('tr', null, h('th', null, first), months.map((m) => h('th', { class: 'n' + (q.month === m ? ' qsel' : '') }, q.only ? mLabel(m) : mShort(m)))));

    // level 1: groups (+ unclassified)
    const gRows = groups().map((g) => { const ids = catsOfGroup(g.id).map((c) => c.id); return { g, vals: stats.map((x) => sumCats(x.byCat, ids)) }; })
      .map((r) => ({ ...r, tot: r.vals.reduce((n, v) => n + v, 0) })).filter((r) => r.vals.some(Boolean)).sort((a, b) => b.tot - a.tot);
    const noneVals = stats.map((x) => x.byCat._none || 0);
    const gTable = h('table', { class: 'grid qtable' }, head('קבוצה'), h('tbody', null,
      gRows.map((r) => h('tr', { class: q.group === r.g.id ? 'qon' : '' },
        h('td', { class: 'drill', role: 'button', tabindex: 0, onclick: () => pick({ group: q.group === r.g.id ? '' : r.g.id, cat: '', month: '' }), onkeydown: (e) => { if (e.key === 'Enter') pick({ group: r.g.id, cat: '', month: '' }); } }, h('span', { class: 'gcell' }, gIcon(r.g, 18), r.g.name)),
        r.vals.map((v, i) => cell(v, () => pick({ group: r.g.id, cat: '', month: months[i] }), q.group === r.g.id && q.month === months[i])))),
      noneVals.some(Boolean) ? h('tr', { class: q.group === '_none' ? 'qon' : '' },
        h('td', { class: 'drill', role: 'button', tabindex: 0, onclick: () => pick({ group: '_none', cat: '', month: '' }) }, h('span', { class: 'gcell faint' }, 'לסיווג')),
        noneVals.map((v, i) => cell(v, () => pick({ group: '_none', cat: '', month: months[i] }), q.group === '_none' && q.month === months[i]))) : null));

    // level 2: categories of the chosen group
    let catSec = null;
    if (q.group && q.group !== '_none') {
      const g = groupById(q.group);
      const cRows = catsOfGroup(g.id).map((c) => ({ c, vals: stats.map((x) => x.byCat[c.id] || 0) })).filter((r) => r.vals.some(Boolean)).map((r) => ({ ...r, tot: r.vals.reduce((n, v) => n + v, 0) }))
        .sort((a, b) => b.tot - a.tot || heCmp(a.c.name, b.c.name));
      qExport.cats = { g, rows: cRows };
      catSec = h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', { class: 'gcell' }, gIcon(g, 22), g.name), h('span', { class: 'faint' }, 'בחירת קטגוריה מציגה את ההוצאות · אפשר להעביר קטגוריה לקבוצה אחרת')),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid qtable' }, head('קטגוריה'), h('tbody', null,
          cRows.map((r) => h('tr', { class: q.cat === r.c.id ? 'qon' : '' },
            h('td', { class: 'qcat' },
              h('button', { class: 'linkbtn', onclick: () => pick({ cat: q.cat === r.c.id ? '' : r.c.id, month: q.cat === r.c.id ? '' : q.month }) }, r.c.name),
              h('select', { class: 'qgroup', 'aria-label': 'קבוצה של ' + r.c.name, onchange: (e) => {
                r.c.group = e.target.value; S.save(); toast(`"${r.c.name}" הועברה ל"${groupById(r.c.group).name}"`);
                if (q.cat === r.c.id) Object.assign(q, { cat: '' }); render();
              } }, groups().map((x) => h('option', { value: x.id, selected: x.id === g.id }, x.name)))),
            r.vals.map((v, i) => cell(v, () => pick({ cat: r.c.id, month: months[i] }), q.cat === r.c.id && q.month === months[i])))),
          cRows.length ? null : h('tr', null, h('td', { colspan: months.length + 1, class: 'faint' }, 'אין הוצאות בקבוצה בטווח הזה'))))));
    }

    // level 3: transactions of the chosen category (or unclassified)
    let txSec = null;
    const txCat = q.group === '_none' ? '_none' : q.cat;
    if (txCat) {
      const inCat = (t) => parts(t).some((p) => (txCat === '_none' ? !p.cat : p.cat === txCat));
      const partAmt = (t) => parts(t).filter((p) => (txCat === '_none' ? !p.cat : p.cat === txCat)).reduce((n, p) => n + p.amount, 0);
      const list = D().txns.filter((t) => (q.month ? monthOf(t) === q.month : months.includes(monthOf(t))) && inCat(t))
        .sort((a, b) => partAmt(b) - partAmt(a) || (b.date || '').localeCompare(a.date || '')); // largest first
      qExport.tx = list;
      const title = txCat === '_none' ? 'לסיווג' : catById(txCat).name;
      txSec = h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, title, ' · ', list.length, ' הוצאות'), h('span', null, amt(list.reduce((n, t) => n + partAmt(t), 0)))),
        h('div', { class: 'row', style: 'margin-bottom:8px' },
          q.month ? h('button', { class: 'pill accent', onclick: () => pick({ month: '' }) }, mLabel(q.month) + ' ✕') : h('span', { class: 'faint' }, q.only ? mLabel(q.only) : `כל ${q.range} החודשים · לחיצה על מספר בטבלה מסננת לחודש`),
          h('label', { class: 'check', style: 'margin-inline-start:auto' }, h('input', { type: 'checkbox', checked: q.learn, onchange: (e) => { q.learn = e.target.checked; } }), 'לזכור לכל העסקאות מאותו בית עסק')),
        list.length ? h('div', { class: 'qtx' }, list.map((t) => h('div', { class: 'qtxrow' },
          h('div', { class: 'qtxm' }, h('div', { class: 'm' }, t.merchant || '(ללא שם)'),
            h('div', { class: 'faint' }, dShort(t.date), ' · ', cardLabel(t), t.splits && t.splits.length ? ' · מפוצלת' : '')),
          h('div', { class: 'qtxa' }, amt(partAmt(t), true)),
          catPicker({ value: t.splits && t.splits.length ? '' : t.cat || '', placeholder: 'לסיווג', ariaLabel: 'קטגוריה ל' + (t.merchant || ''), onChange: (v) => {
            if (!v) return;
            const n = setCategory(t, v, q.learn); S.save();
            toast(`הועבר ל"${catName(v)}"` + (n ? ` · ועוד ${n} עסקאות מאותו בית עסק` : ''));
            render();
          } })))) : h('div', { class: 'empty' }, 'אין הוצאות בטווח הזה'));
    }

    const doExport = () => {
      const mh = months.map((m) => mLabel(m));
      const sheets = [{ name: 'קבוצות', rows: [['קבוצה', ...mh, 'סה"כ'], ...gRows.map((r) => [r.g.name, ...r.vals.map(r2x), r2x(r.tot)]), ...(noneVals.some(Boolean) ? [['לסיווג', ...noneVals.map(r2x), r2x(noneVals.reduce((n, v) => n + v, 0))]] : [])] }];
      if (qExport.cats) sheets.push({ name: 'קטגוריות - ' + qExport.cats.g.name, rows: [['קטגוריה', ...mh, 'סה"כ'], ...qExport.cats.rows.map((r) => [r.c.name, ...r.vals.map(r2x), r2x(r.tot)])] });
      if (qExport.tx) sheets.push({ name: 'הוצאות', rows: txExportRows(qExport.tx) });
      exportXlsx('kupa-quick-update', sheets);
    };
    const withData = all.filter((m) => monthStats(m).spent).reverse();
    return h('main', { class: 'stack' },
      h('div', { class: 'row qtop' }, h('h1', { class: 'grow' }, 'עדכון מהיר', h('span', { class: 'faint', style: 'font-size:13px;font-weight:400;margin-inline-start:8px' }, basisLabel())),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'טווח' }, [3, 6, 12].map((n) => h('button', { 'aria-pressed': !q.only && q.range === n ? 'true' : 'false', onclick: () => pick({ range: n, only: '', month: '' }) }, n + ' ח׳'))),
        h('select', { 'aria-label': 'חודש מסוים', class: q.only ? 'on' : '', onchange: (e) => pick({ only: e.target.value, month: '' }) },
          h('option', { value: '' }, 'חודש מסוים…'), withData.map((m) => h('option', { value: m, selected: q.only === m }, mLabel(m)))),
        xlBtn(doExport)),
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'קבוצות'), h('span', { class: 'faint' }, 'בחירת קבוצה מציגה את הקטגוריות שלה'),
          h('button', { class: 'btn small', style: 'margin-inline-start:auto', onclick: () => openNewGroup() }, '+ קבוצה')),
        gRows.length || noneVals.some(Boolean) ? h('div', { class: 'tablewrap' }, gTable) : h('div', { class: 'empty' }, 'אין הוצאות בטווח הזה')),
      catSec, txSec);
  }

  /* ---------------- view: wide editor ----------------
     one table of transactions with filters; change category, the category's group, counted and note in the row;
     select rows to change many at once */
  function viewEdit() {
    const e = ui.e;
    const months = allMonths().slice().reverse();
    const cards = [...new Set(D().txns.map(cardLabel))].sort();
    const gOfT = (t) => { const c = catById(t.cat); return c ? groupOf(c) : null; };
    const inGroup = (t, gid) => (t.splits && t.splits.length ? t.splits.map((sp) => sp.cat) : [t.cat]).some((cid) => { const c = catById(cid); return gid === '_none' ? !c : c && (groupOf(c) || {}).id === gid; });
    const q = e.q.trim().toLowerCase();
    let list = D().txns.filter((t) => {
      const m = monthOf(t);
      if (e.mFrom && m < e.mFrom) return false;
      if (e.mTo && m > e.mTo) return false;
      if (e.card && cardLabel(t) !== e.card) return false;
      if (e.group && !inGroup(t, e.group)) return false;
      if (e.cat) { if (e.cat === '_none') { if (t.cat || (t.splits && t.splits.length)) return false; } else if (!(t.cat === e.cat || (t.splits || []).some((sp) => sp.cat === e.cat))) return false; }
      if (e.min !== '' && !(t.amount != null && t.amount >= +e.min)) return false;
      if (e.max !== '' && !(t.amount != null && t.amount <= +e.max)) return false;
      if (e.counted === 'yes' && (t.excluded || ignoredCard(t))) return false;
      if (e.counted === 'no' && !(t.excluded || ignoredCard(t))) return false;
      if (q && !((t.merchant || '').toLowerCase().includes(q) || (t.memo || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))) return false;
      return true;
    });
    const A = (t) => (t.amount == null ? -Infinity : t.amount);
    const SORTS = {
      'amt-desc': (a, b) => A(b) - A(a), 'amt-asc': (a, b) => A(a) - A(b),
      'date-desc': (a, b) => (b.date || '').localeCompare(a.date || ''), 'date-asc': (a, b) => (a.date || '').localeCompare(b.date || ''),
      'name-asc': (a, b) => heCmp(a.merchant || '', b.merchant || ''), 'name-desc': (a, b) => heCmp(b.merchant || '', a.merchant || ''),
      'cat-asc': (a, b) => heCmp(catName(a.cat), catName(b.cat)) || A(b) - A(a), 'cat-desc': (a, b) => heCmp(catName(b.cat), catName(a.cat)) || A(b) - A(a),
      'grp-asc': (a, b) => heCmp((gOfT(a) || { name: 'ת' }).name, (gOfT(b) || { name: 'ת' }).name) || A(b) - A(a), 'grp-desc': (a, b) => heCmp((gOfT(b) || { name: '' }).name, (gOfT(a) || { name: '' }).name) || A(b) - A(a),
    };
    list.sort((a, b) => (SORTS[e.sort] || SORTS['amt-desc'])(a, b) || (b.date || '').localeCompare(a.date || ''));
    for (const id of [...e.sel]) if (!list.some((t) => t.id === id)) e.sel.delete(id); // selection only within the filter
    const total = list.reduce((n, t) => n + (t.excluded || ignoredCard(t) || t.amount == null ? 0 : t.dir === 'in' ? -t.amount : t.amount), 0);
    const shown = list.slice(0, e.limit);
    const upd = (k, v) => { e[k] = v; e.limit = 200; render(); };
    const keepScroll = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
    let qT, aT;
    const sortTh = (label, key, cls) => {
      const cur = e.sort.startsWith(key + '-') ? e.sort.endsWith('desc') ? ' ▼' : ' ▲' : '';
      const first = key === 'amt' || key === 'date' ? '-desc' : '-asc'; const other = first === '-desc' ? '-asc' : '-desc';
      const next = e.sort === key + first ? key + other : key + first;
      return h('th', { class: (cls || '') + ' sortable', role: 'button', tabindex: 0, onclick: () => upd('sort', next), onkeydown: (ev) => { if (ev.key === 'Enter') upd('sort', next); } }, label + cur);
    };
    const groupSel = (t) => {
      const c = catById(t.cat);
      if (!c || c.type !== 'expense' || (t.splits && t.splits.length)) return h('span', { class: 'faint' }, c && c.type !== 'expense' ? (c.type === 'income' ? 'הכנסה' : 'העברה') : '—');
      return h('select', { class: 'esel', 'aria-label': 'קבוצה של ' + c.name, title: 'הקבוצה של הקטגוריה "' + c.name + '" — חל על כל ההוצאות שלה', onchange: (ev) => {
        c.group = ev.target.value; S.save(); toast(`הקטגוריה "${c.name}" הועברה ל"${groupById(c.group).name}" — חל על כל ההוצאות שלה`); keepScroll();
      } }, groups().map((g) => h('option', { value: g.id, selected: (groupOf(c) || {}).id === g.id }, g.name)));
    };
    const rows = shown.map((t) => {
      const sel = e.sel.has(t.id); const off = t.excluded || ignoredCard(t);
      return h('tr', { class: (sel ? 'esel-on ' : '') + (off ? 'eoff' : '') },
        h('td', null, h('input', { type: 'checkbox', checked: sel, 'aria-label': 'בחירה', onchange: (ev) => { if (ev.target.checked) e.sel.add(t.id); else e.sel.delete(t.id); keepScroll(); } })),
        h('td', { class: 'n' }, dShort(t.date)),
        h('td', { class: 'faint' }, mShort(monthOf(t))),
        h('td', { class: 'emerch' }, h('button', { class: 'linkbtn', title: 'פרטי עסקה', onclick: () => openTx(t) }, t.merchant || '(ללא שם)'), t.inst ? h('span', { class: 'faint' }, ` ${t.inst.n}/${t.inst.of}`) : null),
        h('td', { class: 'faint' }, cardLabel(t)),
        h('td', { class: 'n' }, t.amount == null ? h('span', { class: 'faint' }, 'טרם נקבע') : amt(t.dir === 'in' ? -t.amount : t.amount, true)),
        h('td', null, groupSel(t)),
        h('td', { class: 'ecat' }, catPicker({ value: t.splits && t.splits.length ? '' : t.cat || '', placeholder: t.splits && t.splits.length ? 'מפוצל' : 'לסיווג', ariaLabel: 'קטגוריה', onChange: (v) => {
          if (!v) return; const n = setCategory(t, v, e.learn); S.save();
          toast(`"${t.merchant}" ← ${catName(v)}` + (n ? ` · ועוד ${n} מאותו בית עסק` : '')); keepScroll();
        } })),
        h('td', null, ignoredCard(t) ? h('span', { class: 'faint', title: 'כרטיס מוחרג בהגדרות' }, 'כרטיס מוחרג') : h('input', { type: 'checkbox', checked: !t.excluded, 'aria-label': 'נספר', onchange: (ev) => { t.excluded = !ev.target.checked; S.save(); keepScroll(); } })),
        h('td', null, h('input', { type: 'text', class: 'ememo', value: t.memo || '', placeholder: '—', 'aria-label': 'הערה', onchange: (ev) => { t.memo = ev.target.value.trim(); S.save(); } })));
    });
    const selList = list.filter((t) => e.sel.has(t.id));
    const bulk = selList.length ? h('div', { class: 'ebulk' },
      h('b', null, `${selList.length} נבחרו`),
      catPicker({ value: '', placeholder: 'קטגוריה לכולן…', ariaLabel: 'קטגוריה לנבחרות', onChange: (v) => {
        if (!v) return; let n = 0; for (const t of selList) n += setCategory(t, v, e.learn); S.save();
        toast(`${selList.length} עסקאות ← ${catName(v)}` + (n ? ` · ועוד ${n} מאותם בתי עסק` : '')); e.sel.clear(); keepScroll();
      } }),
      h('button', { class: 'btn small', onclick: () => { selList.forEach((t) => { t.excluded = true; }); S.save(); keepScroll(); } }, 'לא לספור'),
      h('button', { class: 'btn small', onclick: () => { selList.forEach((t) => { t.excluded = false; }); S.save(); keepScroll(); } }, 'לספור'),
      h('button', { class: 'btn small', onclick: () => { e.sel.clear(); keepScroll(); } }, 'ביטול בחירה')) : null;
    const allSel = shown.length && shown.every((t) => e.sel.has(t.id));
    const anyF = e.q || e.group || e.cat || e.card || e.mFrom || e.mTo || e.min !== '' || e.max !== '' || e.counted;
    const numIn = (k, ph) => h('input', { type: 'number', inputmode: 'decimal', min: '0', step: 'any', placeholder: ph, value: e[k], 'aria-label': ph, 'data-e': k, class: 'enum',
      oninput: (ev) => { clearTimeout(aT); const v = ev.target.value; aT = setTimeout(() => { upd(k, v); const el = document.querySelector(`input[data-e="${k}"]`); if (el) { el.focus(); } }, 450); } });

    return h('main', { class: 'stack' },
      h('div', { class: 'row', style: 'flex-wrap:wrap' }, h('h1', { class: 'grow' }, 'עריכה', h('span', { class: 'faint', style: 'font-size:13px;font-weight:400;margin-inline-start:8px' }, basisLabel())),
        xlBtn(() => exportXlsx('kupa-edit', [{ name: 'עסקאות', rows: txExportRows(list) }]))),
      h('div', { class: 'efilters' },
        h('input', { type: 'search', placeholder: 'חיפוש בית עסק או הערה', value: e.q, 'aria-label': 'חיפוש', 'data-e': 'q',
          oninput: (ev) => { clearTimeout(qT); const v = ev.target.value; qT = setTimeout(() => { upd('q', v); const el = document.querySelector('input[data-e="q"]'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }, 300); } }),
        h('select', { 'aria-label': 'מחודש', onchange: (ev) => { e.mFrom = ev.target.value; if (e.mTo && e.mFrom && e.mTo < e.mFrom) e.mTo = e.mFrom; upd('limit', 200); } }, h('option', { value: '' }, 'מחודש: הכל'), months.map((m) => h('option', { value: m, selected: e.mFrom === m }, mLabel(m)))),
        h('select', { 'aria-label': 'עד חודש', onchange: (ev) => { e.mTo = ev.target.value; if (e.mFrom && e.mTo && e.mFrom > e.mTo) e.mFrom = e.mTo; upd('limit', 200); } }, h('option', { value: '' }, 'עד חודש: הכל'), months.map((m) => h('option', { value: m, selected: e.mTo === m }, mLabel(m)))),
        h('select', { 'aria-label': 'קבוצה', onchange: (ev) => { e.cat = ''; upd('group', ev.target.value); } }, h('option', { value: '' }, 'כל הקבוצות'), groups().map((g) => h('option', { value: g.id, selected: e.group === g.id }, g.name)), h('option', { value: '_none', selected: e.group === '_none' }, 'לסיווג')),
        catPicker({ value: e.cat, ariaLabel: 'סינון קטגוריה', extras: [{ value: '', label: 'כל הקטגוריות' }, { value: '_none', label: 'לסיווג' }], onChange: (v) => upd('cat', v) }),
        h('select', { 'aria-label': 'כרטיס', onchange: (ev) => upd('card', ev.target.value) }, h('option', { value: '' }, 'כל הכרטיסים'), cards.map((c) => h('option', { value: c, selected: e.card === c }, c))),
        h('select', { 'aria-label': 'נספר', onchange: (ev) => upd('counted', ev.target.value) }, [['', 'נספרות ולא נספרות'], ['yes', 'רק נספרות'], ['no', 'רק לא נספרות']].map(([v, l]) => h('option', { value: v, selected: e.counted === v }, l))),
        h('div', { class: 'row amtrow' }, numIn('min', 'מ-₪'), numIn('max', 'עד ₪'))),
      h('div', { class: 'row faint', style: 'flex-wrap:wrap' }, `${list.length} עסקאות · סה"כ נספר `, amt(total),
        anyF ? h('button', { class: 'btn small', onclick: () => { Object.assign(e, { q: '', group: '', cat: '', card: '', mFrom: '', mTo: '', min: '', max: '', counted: '', limit: 200 }); e.sel.clear(); render(); } }, 'ניקוי סינון') : null,
        h('label', { class: 'check', style: 'margin-inline-start:auto' }, h('input', { type: 'checkbox', checked: e.learn, onchange: (ev) => { e.learn = ev.target.checked; } }), 'שינוי קטגוריה = לזכור לכל העסקאות מאותו בית עסק')),
      bulk,
      h('div', { class: 'card etablecard' }, h('div', { class: 'tablewrap' }, h('table', { class: 'grid etable' },
        h('thead', null, h('tr', null,
          h('th', null, h('input', { type: 'checkbox', checked: allSel, 'aria-label': 'בחירת כל המוצגות', onchange: (ev) => { shown.forEach((t) => (ev.target.checked ? e.sel.add(t.id) : e.sel.delete(t.id))); keepScroll(); } })),
          sortTh('תאריך', 'date', 'n'), h('th', null, 'חודש'), sortTh('בית עסק', 'name'), h('th', null, 'כרטיס'), sortTh('סכום', 'amt', 'n'), sortTh('קבוצה', 'grp'), sortTh('קטגוריה', 'cat'), h('th', null, 'נספר'), h('th', null, 'הערה'))),
        h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 10, class: 'faint' }, 'אין עסקאות שמתאימות לסינון')))))),
      list.length > shown.length ? h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { e.limit += 300; keepScroll(); } }, `עוד ${Math.min(300, list.length - shown.length)} (מוצגות ${shown.length} מתוך ${list.length})`)) : null);
  }

  /* ---------------- view: settings ---------------- */
  function viewSettings() {
    const m = ui.month;
    const catBox = h('div');
    const types = { expense: 'הוצאה', transfer: 'העברה (לא נספר)', income: 'הכנסה' };
    let catQ = '';
    const catSearch = h('input', { type: 'search', placeholder: 'חיפוש קטגוריה…', 'aria-label': 'חיפוש קטגוריה', oninput: (e) => { catQ = e.target.value.trim().toLowerCase(); drawCats(); } });
    const drawCats = () => catBox.replaceChildren(
      h('div', { class: 'catedit faint', style: 'border:0' }, h('span', null, 'שם (א–ב)'), h('span', null, 'תקציב חודשי'), h('span', { class: 'groupsel' }, 'קבוצה'), h('span', { class: 'typesel' }, 'סוג'), h('span')),
      ...D().categories.slice().sort((a, b) => heCmp(a.name, b.name)).filter((c) => !catQ || c.name.toLowerCase().includes(catQ)).map((c) => h('div', { class: 'catedit' },
        h('input', { type: 'text', value: c.name, 'aria-label': 'שם קטגוריה', onchange: (e) => { c.name = e.target.value.trim() || c.name; S.save(); drawCats(); } }),
        h('input', { type: 'number', min: '0', step: '50', inputmode: 'numeric', value: c.budget || '', placeholder: '0', disabled: c.type !== 'expense', 'aria-label': 'תקציב', onchange: (e) => { c.budget = Math.max(0, +e.target.value || 0); S.save(); } }),
        h('select', { class: 'groupsel', 'aria-label': 'קבוצה', disabled: c.type !== 'expense', onchange: (e) => { c.group = e.target.value; S.save(); drawGroups(); } },
          c.type !== 'expense' ? h('option', null, '—') : groups().map((g) => h('option', { value: g.id, selected: (groupOf(c) || {}).id === g.id }, g.name))),
        h('select', { class: 'typesel', 'aria-label': 'סוג', onchange: (e) => { c.type = e.target.value; if (c.type === 'expense' && !groupById(c.group)) c.group = guessGroup(c.name); S.save(); drawCats(); drawGroups(); } }, Object.entries(types).map(([k, v]) => h('option', { value: k, selected: c.type === k }, v))),
        h('button', { class: 'icon-btn', 'aria-label': 'מחיקת קטגוריה', onclick: () => {
          const used = D().txns.filter((t) => t.cat === c.id || (t.splits || []).some((sp) => sp.cat === c.id)).length;
          sheet(`למחוק את "${c.name}"?`, (close) => h('div', { class: 'stack' }, h('p', { class: 'muted' }, used ? `${used} עסקאות בקטגוריה יחזרו ל"לסיווג". חוקי הסיווג שלה יימחקו.` : 'אין בה עסקאות.'),
            h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => {
              D().categories = D().categories.filter((x) => x !== c); D().rules = D().rules.filter((r) => r.cat !== c.id);
              for (const t of D().txns) { if (t.cat === c.id) { t.cat = null; t.catSrc = null; } if (t.splits) t.splits.forEach((sp) => { if (sp.cat === c.id) sp.cat = null; }); }
              for (const k of Object.keys(D().sectors)) if (D().sectors[k] === c.id) delete D().sectors[k];
              S.save(); close(); render(); } }, 'מחיקה'), h('button', { class: 'btn', onclick: close }, 'ביטול'))));
        } }, icon('trash')))),
      h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: 'btn', onclick: () => openNewCategory((c) => { if (c) { catQ = ''; catSearch.value = ''; drawCats(); } }) }, '+ קטגוריה'),
        h('span', { class: 'faint' }, 'סה"כ תקציב חודשי: ', amt(expenseCats().reduce((n, c) => n + (c.budget || 0), 0)))));
    drawCats();

    // groups: name, icon, color; deleting one moves its categories to "שונות"
    const groupBox = h('div');
    function openIconPick(g) {
      sheet('אייקון לקבוצה', (close) => h('div', { class: 'iconpick' }, GROUP_ICONS.map((ic) => h('button', { class: 'gpick' + (g.icon === ic ? ' on' : ''), 'aria-label': ic, style: `color:${g.color}`, onclick: () => { g.icon = ic; S.save(); close(); drawGroups(); } }, icon(ic)))));
    }
    function drawGroups() {
      groupBox.replaceChildren(
        ...groups().map((g) => {
          const n = catsOfGroup(g.id).length; const isMisc = g === miscGroup();
          return h('div', { class: 'gedit' },
            h('button', { class: 'gpick', 'aria-label': 'החלפת אייקון', title: 'החלפת אייקון', style: `color:${g.color}`, onclick: () => openIconPick(g) }, icon(ICONS[g.icon] ? g.icon : 'g_tag')),
            h('input', { type: 'text', value: g.name, 'aria-label': 'שם קבוצה', onchange: (e) => { g.name = e.target.value.trim() || g.name; S.save(); drawCats(); } }),
            h('input', { type: 'color', value: g.color, 'aria-label': 'צבע', onchange: (e) => { g.color = e.target.value; S.save(); drawGroups(); } }),
            h('span', { class: 'faint gcount' }, n + ' קט׳'),
            isMisc ? h('span', { class: 'faint', title: 'קבוצת ברירת המחדל' }, '·') : h('button', { class: 'icon-btn', 'aria-label': 'מחיקת קבוצה', onclick: () => {
              sheet(`למחוק את הקבוצה "${g.name}"?`, (close) => h('div', { class: 'stack' }, h('p', { class: 'muted' }, n ? `${n} הקטגוריות שבה יעברו ל"${miscGroup().name}". הקטגוריות והעסקאות לא נמחקות.` : 'אין בה קטגוריות.'),
                h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => {
                  const to = miscGroup().id; for (const c of D().categories) if (c.group === g.id) c.group = to;
                  D().groups = groups().filter((x) => x !== g); S.save(); close(); render(); } }, 'מחיקה'), h('button', { class: 'btn', onclick: close }, 'ביטול'))));
            } }, icon('trash')));
        }),
        h('div', { class: 'row', style: 'margin-top:10px' },
          h('button', { class: 'btn', onclick: () => {
            const used = new Set(groups().map((g) => g.color));
            D().groups.push({ id: uid(), key: '', name: 'קבוצה חדשה', icon: 'g_tag', color: GROUP_COLORS.find((c) => !used.has(c)) || '#64748b' });
            S.save(); drawGroups(); drawCats(); const ins = groupBox.querySelectorAll('.gedit input[type=text]'); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); }
          } }, '+ קבוצה'),
          h('span', { class: 'faint' }, 'שיוך קטגוריה לקבוצה — בטבלת הקטגוריות למטה')));
    }
    drawGroups();

    // month override
    const ov = D().budgets[m] || {};
    const ovBox = h('div', { class: 'stack' },
      h('div', { class: 'row' },
        h('button', { class: 'icon-btn', 'aria-label': 'חודש קודם', onclick: () => { ui.month = addMonths(m, -1); render(); } }, icon('prev')),
        h('b', null, mLabel(m)),
        h('button', { class: 'icon-btn', 'aria-label': 'חודש הבא', onclick: () => { ui.month = addMonths(m, 1); render(); } }, icon('next'))),
      h('div', { class: 'faint' }, 'השאר ריק כדי להשתמש בתקציב הקבוע. רלוונטי לחודשים חריגים (חגים, חופשה).'),
      h('div', { class: 'fields' }, sortedCats('expense').map((c) => h('label', { class: 'field' }, h('span', null, c.name + ` (קבוע ${ils(c.budget || 0)})`),
        h('input', { type: 'number', min: '0', step: '50', inputmode: 'numeric', value: ov[c.id] != null ? ov[c.id] : '', onchange: (e) => {
          D().budgets[m] = D().budgets[m] || {};
          if (e.target.value === '') delete D().budgets[m][c.id]; else D().budgets[m][c.id] = Math.max(0, +e.target.value);
          if (!Object.keys(D().budgets[m]).length) delete D().budgets[m];
          S.save(); } })))));

    const learned = D().rules.filter((r) => !r.auto);
    const cardEntries = Object.entries(D().cards);

    return h('main', { class: 'stack' },
      h('h1', null, 'הגדרות'),
      h('section', { class: 'card' }, h('div', { class: 'section-title' }, h('h2', null, 'קבוצות'), h('span', { class: 'faint' }, 'רמה מעל הקטגוריות · תקציב קבוצה = סכום הקטגוריות שבה')), groupBox),
      h('section', { class: 'card' }, h('div', { class: 'section-title' }, h('h2', null, 'קטגוריות ותקציב קבוע')), h('div', { style: 'margin-bottom:8px' }, catSearch), catBox),
      h('section', { class: 'card' }, h('div', { class: 'section-title' }, h('h2', null, 'תקציב לחודש מסוים')), ovBox),
      h('section', { class: 'card stack' },
        h('h2', null, 'כללי'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: D().settings.instByBilling, onchange: (e) => { D().settings.instByBilling = e.target.checked; S.save(); } }),
          'במצב "תאריך עסקה": עסקת תשלומים נספרת לפי חודש החיוב שלה (כבוי = לפי תאריך הרכישה)'),
        h('label', { class: 'field', style: 'max-width:240px' }, h('span', null, 'נעילה אוטומטית אחרי (דקות)'),
          h('input', { type: 'number', min: '1', max: '120', value: D().settings.autoLockMin, onchange: (e) => { if (!S.data) return; D().settings.autoLockMin = Math.max(1, Math.min(120, +e.target.value || 3)); S.save(); lastTouch = 0; resetIdle(); } }))),
      cardEntries.length ? h('section', { class: 'card stack' }, h('h2', null, 'כרטיסים'),
        h('div', { class: 'faint' }, 'כרטיס מוחרג ממשיך להיות מיובא ונשמר, אבל לא נספר בתקציב, בדוחות ובתשלומים העתידיים, ומוסתר ברשימת העסקאות. אפשר להחזיר בכל רגע.'),
        h('div', { class: 'cardlist' }, cardEntries.map(([num, c]) => {
          const n = D().txns.filter((t) => t.source === 'card' && t.card === num).length;
          return h('div', { class: 'cardrow' + (c.ignored ? ' off' : '') },
            h('label', { class: 'field grow' }, h('span', null, `מסתיים ב-${num} · ${n} עסקאות`),
              h('input', { type: 'text', value: c.label, onchange: (e) => { c.label = e.target.value.trim() || c.label; S.save(); } })),
            h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!c.ignored, onchange: (e) => { c.ignored = e.target.checked; S.save(); toast(c.ignored ? `${c.label} מוחרג` : `${c.label} נספר שוב`); render(); } }), 'להחריג'));
        }))) : null,
      h('section', { class: 'card stack' },
        h('div', { class: 'section-title' }, h('h2', null, 'חוקי סיווג'), h('span', { class: 'faint' }, `${learned.length} שלך · ${D().rules.length - learned.length} מובנים`)),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => setView('rules') }, 'ניהול חוקים ›'),
          h('button', { class: 'btn', onclick: () => openRule(null) }, '+ חוק חדש'),
          h('button', { class: 'btn', onclick: () => { let n = 0; for (const t of D().txns) if (t.catSrc !== 'manual' && !t.noAuto && t.source === 'card') { const r = classify(t); if (r.cat !== t.cat || r.ruleId !== t.ruleId) { t.cat = r.cat; t.catSrc = r.src; t.ruleId = r.ruleId; t.splits = null; n++; } } S.save(); toast(`עודכנו ${n} עסקאות`); render(); } }, 'הפעלת כל החוקים מחדש'))),
      securitySection());
  }

  function securitySection() {
    const oldPw = h('input', { type: 'password', autocomplete: 'current-password' });
    const newPw = h('input', { type: 'password', autocomplete: 'new-password' });
    const newPw2 = h('input', { type: 'password', autocomplete: 'new-password' });
    const verBox = h('div');
    const download = (name, text, type) => { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
    const today = new Date().toISOString().slice(0, 10);
    return h('section', { class: 'card stack' },
      h('h2', null, 'אבטחה וגיבוי'),
      h('div', { class: 'notice info' }, 'הנתונים מוצפנים בדפדפן לפני שהם נשלחים. אין שחזור סיסמה — מי שאין לו את הסיסמה (כולל אני) לא יכול לפתוח אותם. שמור גיבוי מוצפן ואת הסיסמה במקום בטוח.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: async () => download(`kupa-backup-${today}.kupa`, await S.exportBackup(), 'application/octet-stream') }, 'הורדת גיבוי מוצפן'),
        h('button', { class: 'btn', onclick: () => {
          const rows = [['תאריך', 'בית עסק', 'סכום', 'קטגוריה', 'חודש תקציב', 'כרטיס', 'תשלום', 'הערה']];
          for (const t of D().txns.slice().sort((a, b) => a.date.localeCompare(b.date))) rows.push([t.date, t.merchant, t.dir === 'in' ? -t.amount : t.amount, t.splits ? t.splits.map((sp) => catName(sp.cat) + ':' + sp.amount).join(' | ') : catName(t.cat), monthOf(t), cardLabel(t), t.inst ? `${t.inst.n}/${t.inst.of}` : '', t.memo || '']);
          const csv = '﻿' + rows.map((r) => r.map((v) => { const s2 = String(v == null ? '' : v); return /[",\n]/.test(s2) ? '"' + s2.replace(/"/g, '""') + '"' : s2; }).join(',')).join('\n');
          download(`kupa-${today}.csv`, csv, 'text/csv'); } }, 'ייצוא CSV (לא מוצפן!)')),
      h('details', null, h('summary', null, 'שחזור מגיבוי או מגרסה קודמת'),
        h('div', { class: 'stack', style: 'margin-top:10px' },
          h('div', { class: 'faint' }, 'השרת שומר 30 גרסאות אחרונות. שחזור מחליף את כל הנתונים הנוכחיים (והנוכחיים נשמרים כגרסה).'),
          h('button', { class: 'btn small', onclick: async () => {
            const vs = await S.versions();
            verBox.replaceChildren(h('div', { class: 'tablewrap' }, h('table', { class: 'grid' }, h('tbody', null, vs.map((v) => h('tr', null, h('td', { class: 'num' }, '#' + v.ver), h('td', null, new Date(v.at).toLocaleString('he-IL')), h('td', { class: 'n faint' }, Math.round(v.size / 1024) + 'KB'),
              h('td', null, v.ver === S.version ? h('span', { class: 'faint' }, 'נוכחית') : h('button', { class: 'btn small', onclick: async () => { const data = await S.loadVersion(v.ver); S.data = data; S.save(); toast('שוחזר מגרסה #' + v.ver); render(); } }, 'שחזור'))))))));
          } }, 'הצגת גרסאות'), verBox,
          h('label', { class: 'field' }, h('span', null, 'קובץ גיבוי (.kupa) — ייפתח עם הסיסמה שהייתה בזמן הגיבוי'),
            h('input', { type: 'file', accept: '.kupa,.json', onchange: async (e) => {
              const f = e.target.files[0]; if (!f) return;
              sheet('סיסמת הגיבוי', (close) => { const inp = h('input', { type: 'password' }); return h('div', { class: 'stack' }, inp, h('button', { class: 'btn primary', onclick: async () => {
                try { const data = await S.readBackup(await f.text(), inp.value); S.data = data; S.save(); close(); toast('שוחזר מגיבוי'); render(); } catch (err) { toast('סיסמה שגויה או קובץ פגום'); } } }, 'שחזור')); });
            } })))),
      h('details', null, h('summary', null, 'החלפת סיסמה'),
        h('div', { class: 'stack', style: 'margin-top:10px;max-width:360px' },
          h('label', { class: 'field' }, h('span', null, 'סיסמה נוכחית'), oldPw),
          h('label', { class: 'field' }, h('span', null, 'סיסמה חדשה (12 תווים לפחות)'), newPw),
          h('label', { class: 'field' }, h('span', null, 'שוב'), newPw2),
          h('div', { class: 'faint' }, 'אחרי ההחלפה, גרסאות קודמות נמחקות מהשרת (הן מוצפנות בסיסמה הישנה). גיבויים שהורדת ממשיכים להיפתח בסיסמה הישנה.'),
          h('button', { class: 'btn primary', onclick: async (e) => {
            if (newPw.value.length < 12) return toast('לפחות 12 תווים'); if (newPw.value !== newPw2.value) return toast('הסיסמאות לא זהות');
            e.target.disabled = true; e.target.textContent = 'מצפין מחדש…';
            try { await S.changePassword(oldPw.value, newPw.value); toast('הסיסמה הוחלפה'); render(); } catch (err) { toast(err.message === 'bad_password' ? 'הסיסמה הנוכחית שגויה' : 'שגיאה: ' + err.message); e.target.disabled = false; e.target.textContent = 'החלפה'; }
          } }, 'החלפה'))));
  }

  /* ---------------- lock / setup ---------------- */
  function strength(pw) {
    let sc = 0; if (pw.length >= 12) sc++; if (pw.length >= 16) sc++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) sc++; if (/\d/.test(pw)) sc++; if (/[^\w\s]/.test(pw) || /[֐-׿]/.test(pw)) sc++; if (/\s/.test(pw.trim()) && pw.length >= 20) sc += 2;
    return Math.min(4, sc);
  }

  async function lockScreen(msg) {
    let meta;
    try { meta = await S.meta(); } catch (e) { $app.replaceChildren(h('div', { class: 'lock' }, h('div', { class: 'card' }, h('h1', null, 'אין חיבור לשרת'), h('p', { class: 'muted' }, 'בדוק חיבור לאינטרנט ונסה שוב.'), h('button', { class: 'btn', onclick: () => lockScreen() }, 'ניסיון חוזר')))); return; }
    const pw = h('input', { type: 'password', autocomplete: meta.initialized ? 'current-password' : 'new-password', 'aria-label': 'סיסמה', autofocus: true });
    const err = h('div', { class: 'check-bad', role: 'alert' }, msg || '');
    const btn = h('button', { class: 'btn primary', type: 'submit', style: 'width:100%' }, meta.initialized ? 'כניסה' : 'יצירת כספת');

    if (meta.initialized) {
      const form = h('form', { class: 'stack', onsubmit: async (e) => {
        e.preventDefault(); if (!pw.value) return;
        btn.disabled = true; btn.textContent = 'פותח…'; err.textContent = '';
        try { await S.unlock(pw.value); pw.value = ''; startApp(); }
        catch (x) {
          btn.disabled = false; btn.textContent = 'כניסה';
          err.textContent = x.status === 401 ? `סיסמה שגויה (נותרו ${x.body && x.body.left} ניסיונות בשעה הקרובה)` : x.status === 429 ? 'יותר מדי ניסיונות. הכניסה נעולה לשעה.' : 'שגיאה: ' + x.message;
          pw.select();
        } } }, h('label', { class: 'field' }, h('span', null, 'סיסמה'), pw), err, btn);
      $app.replaceChildren(h('div', { class: 'lock' }, h('div', { class: 'card stack' }, h('h1', null, h('img', { src: 'icon.svg', alt: '' }), 'קופה', h('span', { class: 'ver' }, 'v' + VERSION)), form)));
      pw.focus();
      return;
    }

    const pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
    const code = h('input', { type: 'text', autocomplete: 'off' });
    const bar = h('i'); const meter = h('div', { class: 'strength' }, bar);
    const ack = h('input', { type: 'checkbox' });
    pw.addEventListener('input', () => { const sc = strength(pw.value); bar.style.width = (sc / 4) * 100 + '%'; bar.style.background = sc < 2 ? 'var(--over)' : sc < 3 ? 'var(--warn)' : 'var(--ok)'; });
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      if (pw.value.length < 12) { err.textContent = 'לפחות 12 תווים. משפט קצר עדיף על סיסמה מסובכת.'; return; }
      if (pw.value !== pw2.value) { err.textContent = 'הסיסמאות לא זהות'; return; }
      if (!ack.checked) { err.textContent = 'צריך לאשר שהבנת שאין שחזור סיסמה'; return; }
      btn.disabled = true; btn.textContent = 'יוצר…';
      try { await S.init(pw.value, code.value.trim(), initialData()); pw.value = pw2.value = ''; startApp(); ui.view = 'import'; render(); }
      catch (x) { btn.disabled = false; btn.textContent = 'יצירת כספת'; err.textContent = x.message === 'bad_setup_code' ? 'קוד ההתקנה שגוי' : 'שגיאה: ' + x.message; }
    } },
    h('p', { class: 'muted' }, 'פעם ראשונה. בחר סיסמה — ממנה נגזר מפתח ההצפנה. היא לא נשלחת לשרת ולא נשמרת בשום מקום.'),
    h('label', { class: 'field' }, h('span', null, 'סיסמה (12 תווים לפחות)'), pw, meter),
    h('label', { class: 'field' }, h('span', null, 'שוב'), pw2),
    meta.needsSetupCode ? h('label', { class: 'field' }, h('span', null, 'קוד התקנה'), code) : null,
    h('label', { class: 'check' }, ack, 'הבנתי: אם אשכח את הסיסמה, הנתונים אבודים.'),
    err, btn);
    $app.replaceChildren(h('div', { class: 'lock' }, h('div', { class: 'card stack' }, h('h1', null, h('img', { src: 'icon.svg', alt: '' }), 'קופה — הגדרה ראשונה', h('span', { class: 'ver' }, 'v' + VERSION)), form)));
  }

  /* ---------------- session ---------------- */
  let idleTimer = null; let hiddenAt = null;
  function resetIdle() {
    clearTimeout(idleTimer);
    if (!S.data) return;
    const min = D().settings.autoLockMin || 3;
    idleTimer = setTimeout(() => lockNow('ננעל אחרי חוסר פעילות'), min * 60000);
    const n = Date.now(); if (n - lastTouch > 10000) { lastTouch = n; S.touch(min); } // persist "last activity" so a refresh keeps the session
  }
  let lastTouch = 0;
  async function lockNow(msg) {
    try { await S.settle(); } catch (e) { /* ignore */ }
    await S.lock(); pendingImports = []; clearTimeout(idleTimer); lastTouch = 0;
    try { sessionStorage.removeItem('kupa-view'); } catch (e) { /* ignore */ }
    document.querySelectorAll('.scrim, .toast').forEach((e) => e.remove());
    lockScreen(typeof msg === 'string' ? msg : '');
  }
  function startApp(view) {
    migrate();
    ui.month = thisMonth(); ui.view = view || 'month';
    try { const so = sessionStorage.getItem('kupa-sort'); if (so) ui.sort = so; } catch (e) { /* ignore */ }
    try { history.replaceState({ v: ui.view }, ''); } catch (e) { /* ignore */ }
    render(); lastTouch = 0; resetIdle();
  }
  function migrate() {
    const d = D();
    d.settings = Object.assign({ instByBilling: true, autoLockMin: 3 }, d.settings || {});
    if (!d.settings.lockV) { d.settings.autoLockMin = 3; d.settings.lockV = 2; S.save(); } // one-time: new default 3 min
    (d.rules || []).forEach((r) => { if (r.min === undefined) r.min = ''; if (r.max === undefined) r.max = ''; });
    d.cards = d.cards || {}; d.budgets = d.budgets || {}; d.sectors = d.sectors || {}; d.imports = d.imports || [];
    d.invest = d.invest || { txns: [], prices: {}, settings: { fee: 8, cgt: 0.25 } };
    d.invest.prices = d.invest.prices || {}; d.invest.settings = Object.assign({ fee: 8, cgt: 0.25 }, d.invest.settings || {});
    if (!d.groups || !d.groups.length) { // 3.7: category groups
      d.groups = DEFAULT_GROUPS.slice().sort((x, y) => x[3] - y[3]).map(([key, name, ic, ci]) => ({ id: uid(), key, name, icon: ic, color: GROUP_COLORS[ci] })); // shown in this order
      for (const c of d.categories) if (c.type === 'expense' && !groupById(c.group)) c.group = guessGroup(c.name);
      S.save();
    }
    if (!d.settings.mig25) { // built-in 'טרמינל' caught 'היינמן טרמינל' (airport) as clothing
      const bad = (d.rules || []).filter((r) => r.auto && r.text === 'טרמינל');
      if (bad.length) {
        const ids = new Set(bad.map((r) => r.id));
        d.rules = d.rules.filter((r) => !ids.has(r.id));
        for (const t of d.txns) if (t.catSrc === 'rule' && !t.noAuto && (ids.has(t.ruleId) || (!t.ruleId && /טרמינל/.test(t.merchant || '') && !/TERMINAL X|טרמינל X/i.test(t.merchant)))) { const c = classify(t); t.cat = c.cat; t.catSrc = c.src; t.ruleId = c.ruleId; }
      }
      d.settings.mig25 = true; S.save();
    }
  }

  S.onStatus(onSync);
  let lastMove = 0;
  ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach((ev) => document.addEventListener(ev, resetIdle, { passive: true }));
  document.addEventListener('pointermove', () => { const n = Date.now(); if (n - lastMove > 5000) { lastMove = n; resetIdle(); } }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); if (S.dirty) S.flush(); if (S.data) S.touch(D().settings.autoLockMin || 3); }
    else if (S.data && hiddenAt && Date.now() - hiddenAt > (D().settings.autoLockMin || 3) * 60000) lockNow('ננעל אחרי חוסר פעילות');
  });
  window.addEventListener('beforeunload', (e) => { if (S.dirty) { S.flush(); e.preventDefault(); e.returnValue = ''; } });

  (async () => {
    // refresh within the idle window: continue without the password
    if (await S.resume()) {
      let v = 'month'; try { v = sessionStorage.getItem('kupa-view') || 'month'; } catch (e) { /* ignore */ }
      startApp(['month', 'txns', 'import', 'reports', 'settings', 'rules', 'classify', 'invest', 'quick', 'edit'].includes(v) ? v : 'month');
    } else lockScreen();
  })();
})();
