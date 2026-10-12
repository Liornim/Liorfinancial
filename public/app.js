/* Kupa — personal budget vs actual. All data lives encrypted on the server; this file runs only in the browser. */
(function () {
  'use strict';
  const VERSION = '1.5'; // bump on every change: 1.0 initial · 1.2 auto-lock 3 min · 1.3 version label · 1.4 multi-select, new category from any menu, Amex Export (.xls) format · 1.5 stay unlocked across refresh, report drill-down
  const VERSION_DATE = '12.10.26';
  const EMPTY_F = () => ({ q: '', cat: '', card: '', month: '', onlyNone: false, abroad: false, standing: false });
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
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
    plus: 'M12 5v14M5 12h14', prev: 'M9 6l6 6-6 6', next: 'M15 6l-6 6 6 6', x: 'M6 6l12 12M18 6L6 18',
    lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
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
  const P2P = /\bBIT\b|ביט|PAYBOX|פייבוקס|PEPPER\s*PAY|העברה ב/i;
  const isP2P = (m) => P2P.test(m || '');
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
      ...['ZARA', 'H&M', 'קסטרו', 'פוקס', 'FOX', 'NIKE', 'ADIDAS', 'TERMINAL X', 'טרמינל'].map((t) => R(t, 'ביגוד והנעלה')),
      ...['מכבי', 'כללית', 'מאוחדת', 'לאומית', 'רופא', 'מרפאה'].map((t) => R(t, 'בריאות')),
    ];
    const sectors = { 'אנרגיה': id('רכב ודלק'), 'פנאי בילוי': id('פנאי ובילוי'), 'מוצרי חשמל': id('אלקטרוניקה'), 'מוסדות': id('אגרות וממשלה'), 'מזון': id('סופר ומכולת'), 'מסעדות': id('אוכל בחוץ ומשלוחים'), 'תקשורת': id('מנויים ותקשורת'), 'ביגוד': id('ביגוד והנעלה'), 'רפואה': id('בריאות'), 'תיירות': id('חו"ל ונסיעות'), 'תחבורה': id('תחבורה ומוניות'), 'רכב': id('רכב ודלק') };
    return { schema: 1, created: new Date().toISOString(), settings: { instByBilling: true, autoLockMin: 3, lockV: 2 }, categories: cats, rules, sectors, budgets: {}, txns: [], imports: [], cards: {} };
  }

  const D = () => S.data;
  const catById = (id) => D().categories.find((c) => c.id === id);
  const catName = (id) => (catById(id) || {}).name || 'לסיווג';
  const expenseCats = () => D().categories.filter((c) => c.type === 'expense');

  function monthOf(t) {
    if (t.inst && D().settings.instByBilling && t.billingDate) return t.billingDate.slice(0, 7);
    return t.date.slice(0, 7);
  }
  // signed contribution: expenses positive, refunds negative; income tracked separately
  function parts(t) {
    if (t.excluded || t.amount == null) return [];
    if (t.splits && t.splits.length) return t.splits.map((sp) => ({ cat: sp.cat, amount: sp.amount }));
    return [{ cat: t.cat || null, amount: t.amount }];
  }
  function cardLabel(t) {
    if (t.source === 'bank') return 'בנק'; if (t.source === 'cash') return 'מזומן';
    const c = D().cards[t.card]; return c ? c.label : t.card;
  }

  function classify(t) {
    if (isP2P(t.merchant)) return { cat: null, src: null };
    const up = (t.merchant || '').toUpperCase(); const norm = normMerchant(t.merchant);
    const learned = D().rules.find((r) => r.kind === 'exact' && r.text === norm);
    if (learned) return { cat: learned.cat, src: 'rule' };
    for (const r of D().rules) if (r.kind === 'contains' && up.includes(r.text.toUpperCase())) return { cat: r.cat, src: 'rule' };
    if (t.sector && D().sectors[t.sector]) return { cat: D().sectors[t.sector], src: 'sector' };
    return { cat: null, src: null };
  }

  function setCategory(t, cat, learn) {
    t.cat = cat; t.catSrc = 'manual'; t.splits = null;
    if (!learn || isP2P(t.merchant) || t.source !== 'card') return 0;
    const norm = normMerchant(t.merchant);
    D().rules = D().rules.filter((r) => !(r.kind === 'exact' && r.text === norm));
    D().rules.unshift({ id: uid(), kind: 'exact', text: norm, cat, auto: false });
    let n = 0;
    for (const o of D().txns) if (o !== t && o.catSrc !== 'manual' && normMerchant(o.merchant) === norm) { o.cat = cat; o.catSrc = 'rule'; n++; }
    return n;
  }

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
    const merged = { issuer: results[0].issuer, statements: results.flatMap((r) => r.statements), txns: results.flatMap((r) => r.txns), warnings: results.flatMap((r) => r.warnings) };
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
      const cands = pool[sec(t)];
      const i = cands ? cands.findIndex((f) => f !== fmt(t.key) && f !== 'cal' && fmt(t.key) !== 'cal') : -1;
      if (i >= 0) { cands.splice(i, 1); plan.dup.push(t); plan.crossDup++; continue; }
      plan.add.push(t);
    }
    return plan;
  }

  function applyImport(parsed, plan, fileName) {
    const imp = { id: uid(), at: new Date().toISOString(), file: fileName, issuer: parsed.issuer, cards: [...new Set(parsed.statements.map((s) => s.card))], added: plan.add.length, updated: plan.update.length, dup: plan.dup.length, checks: parsed.checks };
    for (const st of parsed.statements) {
      if (!D().cards[st.card]) {
        const base = /AMEX|אמריקן/i.test(st.cardName) ? 'אמקס' : parsed.issuer === 'cal' ? (/דיינרס/.test(st.cardName) ? 'דיינרס' : 'כאל') : 'ישראכרט';
        D().cards[st.card] = { label: base + ' ' + st.card, issuer: parsed.issuer };
      }
    }
    for (const t of plan.add) {
      const { cat, src } = classify(t);
      D().txns.push({ ...t, id: uid(), source: 'card', dir: 'out', cat, catSrc: src, splits: null, memo: '', importId: imp.id, excluded: false });
    }
    for (const [ex, t] of plan.update) {
      Object.assign(ex, { amount: t.amount, amountOrig: t.amountOrig, currency: t.currency === '?' ? ex.currency : t.currency, billingDate: t.billingDate, pending: false, notes: t.notes, inst: t.inst || ex.inst });
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
  const ui = { view: 'month', month: thisMonth(), f: EMPTY_F(), back: null, reportRange: 12, cmpA: null, cmpB: null, selMode: false, sel: new Set() };

  function setView(v, patch, keepBack) {
    if (!keepBack) ui.back = null;
    if (ui.view !== v) { try { history.pushState({ v }, ''); } catch (e) { /* ignore */ } }
    ui.view = v; if (patch) Object.assign(ui, patch);
    try { sessionStorage.setItem('kupa-view', v); } catch (e) { /* ignore */ }
    render(); window.scrollTo(0, 0);
  }
  // drill-down: jump to transactions with exactly this filter, remembering where we came from
  function drill(f) { const from = ui.view; ui.selMode = false; ui.sel.clear(); setView('txns', { f: { ...EMPTY_F(), ...f }, back: from }, true); }
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
    const tabs = [['month', 'חודש', 'month'], ['txns', 'עסקאות', 'list'], ['import', 'ייבוא', 'upload'], ['reports', 'דוחות', 'chart'], ['settings', 'הגדרות', 'gear']];
    return h('div', null,
      h('div', { class: 'shell' },
        h('header', { class: 'topbar' },
          h('div', { class: 'brand' }, h('img', { src: 'icon.svg', alt: '' }), 'קופה', h('span', { class: 'ver', title: 'עודכן ' + VERSION_DATE }, 'v' + VERSION)),
          h('nav', { class: 'tabs', 'aria-label': 'ניווט' }, tabs.map(([v, label, ic]) => h('button', { 'aria-current': ui.view === v ? 'page' : null, onclick: () => setView(v) }, icon(ic), label))),
          h('div', { class: 'spacer' }), syncLabel,
          h('button', { class: 'icon-btn', title: 'נעילה', 'aria-label': 'נעילה', onclick: lockNow }, icon('lock'))),
        content),
      h('button', { class: 'fab', title: 'הוספת תנועה ידנית', 'aria-label': 'הוספת תנועה ידנית', onclick: () => openManual() }, icon('plus')));
  }

  function render() {
    if (!S.data) return;
    const views = { month: viewMonth, txns: viewTxns, import: viewImport, reports: viewReports, settings: viewSettings };
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
      const over = budget > 0 && spent > budget;
      const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : (spent / max) * 100;
      return h('div', { class: 'brow' + (budget ? '' : ' nobudget'), role: 'button', tabindex: 0, onclick: () => drill({ cat: c.id, month: m }) },
        h('div', { class: 'name' }, c.name),
        h('div', { class: 'figs' }, h('b', null, amt(spent)), budget ? [' / ', amt(budget)] : h('span', { class: 'faint' }, ' · ללא תקציב'),
          over ? h('div', { class: 'tag-over' }, 'חריגה ', amt(spent - budget)) : budget ? h('div', { class: 'faint' }, Math.round((spent / budget) * 100) + '% · נותרו ', amt(budget - spent)) : null),
        h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { class: over ? 'over' : '', style: `width:${pct}%` })));
    });

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
      h('div', { class: 'kpis' },
        kpi('הוצאות', amt(st.spent)),
        kpi('תקציב', st.budget ? amt(st.budget) : h('button', { class: 'value', onclick: () => setView('settings') }, 'להגדרה ›')),
        kpi(left >= 0 ? 'נותר' : 'חריגה', amt(Math.abs(left)), st.budget && left < 0 ? 'over' : ''),
        kpi('הכנסות', amt(st.income))),
      st.unclassified ? h('div', { class: 'notice', role: 'button', tabindex: 0, onclick: () => drill({ month: m, onlyNone: true }) },
        `${st.unclassified} עסקאות לסיווג (`, amt(st.unclassifiedSum), ') — לחץ לסיווג ›') : null,
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'תקציב מול ביצוע'), h('span', { class: 'faint' }, 'לחיצה על קטגוריה מציגה את העסקאות')),
        rows.length ? h('div', { class: 'budgets' }, rows) : h('div', { class: 'empty' }, 'אין עדיין נתונים לחודש הזה. ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); setView('import'); } }, 'ייבוא קובץ ›')),
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
      if (!t.inst || t.inst.n >= t.inst.of || t.amount == null) continue;
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
      if (f.card && cardLabel(t) !== f.card) return false;
      if (f.abroad && !t.abroad) return false;
      if (f.standing && !t.standing) return false;
      if (f.onlyNone && (t.cat || (t.splits && t.splits.length) || t.excluded)) return false;
      if (f.cat) {
        if (f.cat === '_none') { if (t.cat || (t.splits && t.splits.length)) return false; }
        else if (!(t.cat === f.cat || (t.splits || []).some((sp) => sp.cat === f.cat))) return false;
      }
      if (q && !((t.merchant || '').toUpperCase().includes(q) || (t.memo || '').toUpperCase().includes(q))) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }

  function viewTxns() {
    const list = filteredTxns();
    const total = list.reduce((n, t) => n + parts(t).reduce((m, p) => m + (ui.f.cat && ui.f.cat !== '_none' && t.splits ? (p.cat === ui.f.cat ? p.amount : 0) : p.amount), 0), 0);
    const cards = [...new Set(D().txns.map(cardLabel))].sort();
    const months = allMonths().reverse();
    const upd = (k, v) => { ui.f[k] = v; render(); };
    let qTimer;
    const search = h('input', { type: 'search', placeholder: 'חיפוש בית עסק או הערה', value: ui.f.q, 'aria-label': 'חיפוש',
      oninput: (e) => { clearTimeout(qTimer); const v = e.target.value; qTimer = setTimeout(() => { ui.f.q = v; render(); const el = document.querySelector('input[type=search]'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }, 250); } });

    return h('main', { class: 'stack' },
      ui.back ? h('div', null, h('button', { class: 'btn small', onclick: () => { try { history.back(); } catch (e) { setView(ui.back); } } }, '› חזרה ל' + ({ reports: 'דוחות', month: 'חודש' }[ui.back] || 'קודם'))) : null,
      h('div', { class: 'filters' },
        search,
        h('select', { 'aria-label': 'חודש', onchange: (e) => upd('month', e.target.value) }, h('option', { value: '' }, 'כל החודשים'), months.map((m) => h('option', { value: m, selected: ui.f.month === m }, mLabel(m)))),
        h('select', { 'aria-label': 'קטגוריה', onchange: (e) => upd('cat', e.target.value) }, h('option', { value: '' }, 'כל הקטגוריות'), h('option', { value: '_none', selected: ui.f.cat === '_none' }, 'לסיווג'), D().categories.map((c) => h('option', { value: c.id, selected: ui.f.cat === c.id }, c.name))),
        h('select', { 'aria-label': 'כרטיס', onchange: (e) => upd('card', e.target.value) }, h('option', { value: '' }, 'כל הכרטיסים'), cards.map((c) => h('option', { value: c, selected: ui.f.card === c }, c))),
        h('div', { class: 'row' },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ui.f.onlyNone, onchange: (e) => upd('onlyNone', e.target.checked) }), 'רק לסיווג'),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ui.f.abroad, onchange: (e) => upd('abroad', e.target.checked) }), 'חו"ל'))),
      h('div', { class: 'row faint' }, `${list.length} עסקאות · סה"כ `, amt(total),
        (ui.f.q || ui.f.cat || ui.f.card || ui.f.month || ui.f.onlyNone || ui.f.abroad || ui.f.standing) ? h('button', { class: 'btn small', onclick: () => { ui.f = EMPTY_F(); render(); } }, 'ניקוי סינון') : null,
        ui.f.standing ? h('button', { class: 'pill accent', onclick: () => { ui.f.standing = false; render(); } }, 'הוראות קבע ✕') : null,
        h('button', { class: 'btn small' + (ui.selMode ? ' primary' : ''), style: 'margin-inline-start:auto', onclick: () => { ui.selMode = !ui.selMode; ui.sel.clear(); render(); } }, ui.selMode ? 'סיום בחירה' : 'בחירה מרובה')),
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
    const sel = h('select', { 'aria-label': 'קטגוריה לנבחרות' }, catOptions(null));
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
        } }, 'סיווג')));
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
      h('div', { class: 'meta' }, h('span', { class: 'num' }, dShort(t.date)), h('span', { class: 'pill' }, cardLabel(t)),
        t.inst ? h('span', { class: 'pill accent' }, `תשלום ${t.inst.n}/${t.inst.of}`) : null,
        t.pending ? h('span', { class: 'pill warn' }, 'בקליטה') : null,
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
      D().categories.filter((c) => c.type === ty).map((c) => h('option', { value: c.id, selected: sel === c.id }, c.name)))),
    h('option', { value: '__new' }, '+ קטגוריה חדשה…')];

  function openNewCategory(onDone) {
    let created = null;
    sheet('קטגוריה חדשה', (close) => {
      const name = h('input', { type: 'text', placeholder: 'למשל: חוגים, רכב — טיפולים, חיסכון לדירה', maxlength: '40' });
      const budget = h('input', { type: 'number', min: '0', step: '50', inputmode: 'numeric', placeholder: '0' });
      let type = 'expense';
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'סוג' });
      const drawSeg = () => seg.replaceChildren(...[['expense', 'הוצאה'], ['transfer', 'העברה'], ['income', 'הכנסה']].map(([k, v]) =>
        h('button', { type: 'button', 'aria-pressed': type === k ? 'true' : 'false', onclick: () => { type = k; budget.disabled = k !== 'expense'; drawSeg(); } }, v)));
      drawSeg();
      const save = () => {
        const n = name.value.trim();
        if (!n) return toast('צריך שם');
        if (D().categories.some((c) => c.name === n)) return toast('כבר יש קטגוריה בשם הזה');
        created = { id: uid(), name: n, type, budget: type === 'expense' ? Math.max(0, +budget.value || 0) : 0 };
        D().categories.push(created); S.save(); close();
      };
      setTimeout(() => name.focus(), 50);
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      return h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', null, 'שם'), name),
        seg,
        h('label', { class: 'field' }, h('span', null, 'תקציב חודשי (אפשר להשאיר ריק)'), budget),
        h('div', { class: 'faint' }, 'העברה = לא נספרת כהוצאה (למשל העברה לחיסכון). אפשר לשנות ולמחוק בהגדרות.'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'יצירה')));
    }, () => onDone(created));
  }

  // any category <select> offering "+ new": remember the previous value, intercept "__new"
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
      const catSel = h('select', { 'aria-label': 'קטגוריה' }, catOptions(t.cat));
      const learn = h('input', { type: 'checkbox', checked: !p2p && t.source === 'card' });
      const memo = h('input', { type: 'text', value: t.memo || '', placeholder: 'למשל: מתנה ליום הולדת של…' });
      const excluded = h('input', { type: 'checkbox', checked: !!t.excluded });
      let splits = (t.splits || []).map((sp) => ({ ...sp }));
      const splitBox = h('div', { class: 'stack' });
      const drawSplits = () => {
        const sum = round2(splits.reduce((n, sp) => n + (+sp.amount || 0), 0));
        splitBox.replaceChildren(
          ...splits.map((sp, i) => h('div', { class: 'splitrow' },
            h('select', { onchange: (e) => { sp.cat = e.target.value || null; } }, catOptions(sp.cat)),
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
        t.memo = memo.value.trim(); t.excluded = excluded.checked;
        S.save(); close(); render();
      };

      return h('div', { class: 'stack' },
        h('div', { class: 'row' }, h('div', { style: 'font-size:24px;font-weight:700' }, t.amount == null ? 'סכום טרם נקבע' : amt(t.amount, true)),
          t.currency && t.currency !== 'ILS' && t.currency !== '?' ? h('span', { class: 'pill' }, `${t.amountOrig} ${t.currency}`) : null),
        h('div', { class: 'faint' }, [dShort(t.date) + '.' + t.date.slice(0, 4), cardLabel(t), t.inst ? `תשלום ${t.inst.n} מתוך ${t.inst.of} (עסקה מלאה ${ils(t.amountOrig)})` : null, t.billingDate ? 'חיוב ' + dShort(t.billingDate) : null, 'נספר ב' + mLabel(monthOf(t)), t.notes].filter(Boolean).join(' · ')),
        p2p ? h('div', { class: 'notice info' }, 'העברה בין אנשים — סווג ידנית. כדאי לרשום בהערה על מה היא.') : null,
        h('label', { class: 'field' }, h('span', null, 'קטגוריה'), catSel),
        t.source === 'card' && !p2p ? h('label', { class: 'check faint' }, learn, 'לזכור: כל העסקאות מבית העסק הזה ייכנסו לקטגוריה הזאת') : null,
        splitBox,
        h('label', { class: 'field' }, h('span', null, 'הערה'), memo),
        h('label', { class: 'check' }, excluded, 'לא לספור בתקציב (למשל החזר שקיבלתי בנפרד)'),
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
      const cat = h('select', null, catOptions(existing ? existing.cat : null));
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
      h('div', { class: 'faint' }, 'ישראכרט · אמריקן אקספרס (שני הפורמטים) · כאל · דיינרס. אפשר כמה קבצים בבת אחת. הקובץ נקרא רק בתוך הדפדפן.'));

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
    for (const t of plan.add) { const m = (t.inst && D().settings.instByBilling && t.billingDate ? t.billingDate : t.date).slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; }
    const autoCat = plan.add.filter((t) => classify(t).cat).length;
    return h('section', { class: 'card stack' },
      h('div', { class: 'row' }, h('h3', { class: 'grow' }, pi.file), h('span', { class: 'pill' }, parsed.issuer === 'cal' ? 'כאל / דיינרס' : 'ישראכרט / אמקס')),
      parsed.checks.map((c) => h('div', null, `כרטיס ${c.card} · חיוב ${c.billingDate ? dShort(c.billingDate) : '?'} · ${c.count} עסקאות · `,
        c.ok === true ? h('span', { class: 'check-ok' }, '✓ הסכום תואם לסה"כ בקובץ (', amt(c.got, true), ')') :
          c.ok === false ? h('span', { class: 'check-bad' }, '✗ קראתי ', amt(c.got, true), ' אבל בקובץ כתוב ', amt(c.expected, true)) : h('span', { class: 'faint' }, 'אין סה"כ בקובץ לבדיקה'))),
      h('div', { class: 'row' },
        h('span', { class: 'pill accent' }, `${plan.add.length} חדשות (${ils(sum(plan.add))})`),
        plan.update.length ? h('span', { class: 'pill' }, `${plan.update.length} יתעדכנו מ"בקליטה"`) : null,
        plan.dup.length ? h('span', { class: 'pill' }, `${plan.dup.length} כבר קיימות — ידולגו`) : null,
        plan.crossDup ? h('span', { class: 'pill warn' }, `${plan.crossDup} מהן זוהו לפי תאריך+סכום מייצוא בפורמט אחר`) : null,
        plan.add.length ? h('span', { class: 'pill' }, `${autoCat} יסווגו אוטומטית`) : null),
      Object.keys(byMonth).length ? h('div', { class: 'faint' }, 'ייספרו בחודשים: ' + Object.entries(byMonth).sort().map(([m, n]) => `${mLabel(m)} (${n})`).join(', ')) : null,
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
  function viewReports() {
    const end = thisMonth() > (allMonths().slice(-1)[0] || '') ? thisMonth() : allMonths().slice(-1)[0];
    const months = []; for (let i = ui.reportRange - 1; i >= 0; i--) months.push(addMonths(end, -i));
    const stats = months.map((m) => ({ m, ...monthStats(m) }));
    const cats = expenseCats();
    // average only over months that actually have data (from the first month with any spending)
    const firstIdx = stats.findIndex((s) => s.spent);
    const active = firstIdx < 0 ? 1 : stats.length - firstIdx;
    const avg = (id) => stats.reduce((n, s) => n + (s.byCat[id] || 0), 0) / active;
    const catRows = cats.map((c) => ({ c, vals: stats.map((s) => s.byCat[c.id] || 0), avg: avg(c.id) })).filter((r) => r.vals.some(Boolean)).sort((a, b) => b.avg - a.avg);
    const noneVals = stats.map((s) => s.byCat._none || 0);
    const maxCell = Math.max(1, ...catRows.flatMap((r) => r.vals));

    // top merchants in range
    const merch = {};
    const inRange = D().txns.filter((t) => months.includes(monthOf(t)) && !t.excluded && t.dir !== 'in' && t.amount != null && !(catById(t.cat) && catById(t.cat).type !== 'expense'));
    for (const t of inRange) { const k = normMerchant(t.merchant); (merch[k] = merch[k] || { name: t.merchant, sum: 0, n: 0 }); merch[k].sum += t.amount; merch[k].n++; }
    const top = Object.values(merch).sort((a, b) => b.sum - a.sum).slice(0, 15);
    const abroad = inRange.filter((t) => t.abroad).reduce((n, t) => n + t.amount, 0);
    const standing = inRange.filter((t) => t.standing).reduce((n, t) => n + t.amount, 0);
    const totalRange = inRange.reduce((n, t) => n + t.amount, 0);

    // compare
    const all = allMonths();
    ui.cmpB = ui.cmpB || end; ui.cmpA = ui.cmpA || addMonths(ui.cmpB, -1);
    const A = monthStats(ui.cmpA), B = monthStats(ui.cmpB);
    const cmpRows = cats.map((c) => ({ c, a: A.byCat[c.id] || 0, b: B.byCat[c.id] || 0 })).filter((r) => r.a || r.b).sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
    const dc = (f, cls, style, ...kids) => h('td', { class: (cls || '') + ' drill', style, role: 'link', tabindex: 0, title: 'הצג עסקאות', onclick: () => drill(f), onkeydown: (e) => { if (e.key === 'Enter') drill(f); } }, ...kids);
    const monthOpts = (sel) => all.slice().reverse().map((m) => h('option', { value: m, selected: m === sel }, mLabel(m)));

    return h('main', { class: 'stack' },
      h('div', { class: 'row' }, h('h1', { class: 'grow' }, 'דוחות'),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'טווח' }, [3, 6, 12, 24].map((n) => h('button', { 'aria-pressed': ui.reportRange === n ? 'true' : 'false', onclick: () => { ui.reportRange = n; render(); } }, n + ' ח׳')))),
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'הוצאות לפי חודש'), h('span', { class: 'faint' }, `ממוצע (${active} ח׳ עם נתונים) `, amt(stats.reduce((n, s) => n + s.spent, 0) / active))),
        barChart(stats.map((s) => ({ m: s.m, label: mShort(s.m), full: mLabel(s.m), value: s.spent, budget: s.budget, cur: s.m === ui.month }))),
        h('div', { class: 'legend' }, h('span', null, h('i'), 'הוצאות'), h('span', { class: 'faint' }, 'לחיצה על עמודה או מספר מציגה את העסקאות'), stats.some((s) => s.budget) ? h('span', null, h('i', { class: 'line' }), 'תקציב') : null)),
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'קטגוריות לאורך זמן'), h('span', { class: 'faint' }, 'כהה יותר = יותר כסף')),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, 'קטגוריה'), months.map((m) => h('th', { class: 'n' }, mShort(m))), h('th', { class: 'n' }, 'ממוצע'))),
          h('tbody', null,
            catRows.map((r) => h('tr', null, dc({ cat: r.c.id }, '', null, r.c.name), r.vals.map((v, i) => v ? dc({ cat: r.c.id, month: months[i] }, 'n', `background: color-mix(in srgb, var(--bar) ${Math.round((v / maxCell) * 55)}%, transparent)`, nf0.format(v)) : h('td', { class: 'n' }, '·')), h('td', { class: 'n' }, h('b', null, nf0.format(r.avg))))),
            noneVals.some(Boolean) ? h('tr', null, dc({ cat: '_none' }, 'faint', null, 'לסיווג'), noneVals.map((v, i) => v ? dc({ cat: '_none', month: months[i] }, 'n faint', null, nf0.format(v)) : h('td', { class: 'n faint' }, '·')), h('td', null)) : null,
            h('tr', { class: 'total' }, h('td', null, 'סה"כ'), stats.map((s) => s.spent ? dc({ month: s.m }, 'n', null, nf0.format(s.spent)) : h('td', { class: 'n' }, '0')), h('td', { class: 'n' }, nf0.format(stats.reduce((n, s) => n + s.spent, 0) / active))))))),
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'השוואת חודשים')),
        h('div', { class: 'fields', style: 'margin-bottom:10px' },
          h('select', { 'aria-label': 'חודש א', onchange: (e) => { ui.cmpA = e.target.value; render(); } }, monthOpts(ui.cmpA)),
          h('select', { 'aria-label': 'חודש ב', onchange: (e) => { ui.cmpB = e.target.value; render(); } }, monthOpts(ui.cmpB))),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, 'קטגוריה'), h('th', { class: 'n' }, mShort(ui.cmpA)), h('th', { class: 'n' }, mShort(ui.cmpB)), h('th', { class: 'n' }, 'שינוי'))),
          h('tbody', null, cmpRows.map((r) => diffRow(r.c.name, r.a, r.b, false, dc, r.c.id)), diffRow('סה"כ', A.spent, B.spent, true, dc, null))))),
      h('section', { class: 'card' },
        h('div', { class: 'section-title' }, h('h2', null, 'בתי העסק הגדולים'), h('span', { class: 'faint' }, `${ui.reportRange} חודשים`)),
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, 'בית עסק'), h('th', { class: 'n' }, 'עסקאות'), h('th', { class: 'n' }, 'סה"כ'), h('th', { class: 'n' }, 'מהסך'))),
          h('tbody', null, top.map((m) => h('tr', null, dc({ q: m.name }, '', null, m.name), h('td', { class: 'n' }, m.n), dc({ q: m.name }, 'n', null, amt(m.sum)), h('td', { class: 'n faint' }, totalRange ? Math.round((m.sum / totalRange) * 100) + '%' : ''))))))),
      h('div', { class: 'kpis' },
        kpiLink('חו"ל', amt(abroad), { abroad: true }), kpi('חו"ל מהסך', totalRange ? Math.round((abroad / totalRange) * 100) + '%' : '—'),
        kpiLink('הוראות קבע', amt(standing), { standing: true }), kpi('ממוצע חודשי', amt(totalRange / active))));
  }

  function diffRow(name, a, b, total, dc, catId) {
    const d = b - a; const pct = a ? Math.round((d / a) * 100) : null;
    const f = (m) => (catId ? { cat: catId, month: m } : { month: m });
    return h('tr', { class: total ? 'total' : '' }, catId ? dc({ cat: catId }, '', null, name) : h('td', null, name),
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

  /* ---------------- view: settings ---------------- */
  function viewSettings() {
    const m = ui.month;
    const catBox = h('div');
    const types = { expense: 'הוצאה', transfer: 'העברה (לא נספר)', income: 'הכנסה' };
    const drawCats = () => catBox.replaceChildren(
      h('div', { class: 'catedit faint', style: 'border:0' }, h('span', null, 'שם'), h('span', null, 'תקציב חודשי'), h('span', { class: 'typesel' }, 'סוג'), h('span')),
      ...D().categories.map((c) => h('div', { class: 'catedit' },
        h('input', { type: 'text', value: c.name, 'aria-label': 'שם קטגוריה', onchange: (e) => { c.name = e.target.value.trim() || c.name; S.save(); } }),
        h('input', { type: 'number', min: '0', step: '50', inputmode: 'numeric', value: c.budget || '', placeholder: '0', disabled: c.type !== 'expense', 'aria-label': 'תקציב', onchange: (e) => { c.budget = Math.max(0, +e.target.value || 0); S.save(); } }),
        h('select', { class: 'typesel', 'aria-label': 'סוג', onchange: (e) => { c.type = e.target.value; S.save(); drawCats(); } }, Object.entries(types).map(([k, v]) => h('option', { value: k, selected: c.type === k }, v))),
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
        h('button', { class: 'btn', onclick: () => { D().categories.push({ id: uid(), name: 'קטגוריה חדשה', type: 'expense', budget: 0 }); S.save(); drawCats(); const ins = catBox.querySelectorAll('.catedit input[type=text]'); const last = ins[ins.length - 1]; last.focus(); last.select(); } }, '+ קטגוריה'),
        h('span', { class: 'faint' }, 'סה"כ תקציב חודשי: ', amt(expenseCats().reduce((n, c) => n + (c.budget || 0), 0)))));
    drawCats();

    // month override
    const ov = D().budgets[m] || {};
    const ovBox = h('div', { class: 'stack' },
      h('div', { class: 'row' },
        h('button', { class: 'icon-btn', 'aria-label': 'חודש קודם', onclick: () => { ui.month = addMonths(m, -1); render(); } }, icon('prev')),
        h('b', null, mLabel(m)),
        h('button', { class: 'icon-btn', 'aria-label': 'חודש הבא', onclick: () => { ui.month = addMonths(m, 1); render(); } }, icon('next'))),
      h('div', { class: 'faint' }, 'השאר ריק כדי להשתמש בתקציב הקבוע. רלוונטי לחודשים חריגים (חגים, חופשה).'),
      h('div', { class: 'fields' }, expenseCats().map((c) => h('label', { class: 'field' }, h('span', null, c.name + ` (קבוע ${ils(c.budget || 0)})`),
        h('input', { type: 'number', min: '0', step: '50', inputmode: 'numeric', value: ov[c.id] != null ? ov[c.id] : '', onchange: (e) => {
          D().budgets[m] = D().budgets[m] || {};
          if (e.target.value === '') delete D().budgets[m][c.id]; else D().budgets[m][c.id] = Math.max(0, +e.target.value);
          if (!Object.keys(D().budgets[m]).length) delete D().budgets[m];
          S.save(); } })))));

    const learned = D().rules.filter((r) => !r.auto);
    const cardEntries = Object.entries(D().cards);

    return h('main', { class: 'stack' },
      h('h1', null, 'הגדרות'),
      h('section', { class: 'card' }, h('div', { class: 'section-title' }, h('h2', null, 'קטגוריות ותקציב קבוע')), catBox),
      h('section', { class: 'card' }, h('div', { class: 'section-title' }, h('h2', null, 'תקציב לחודש מסוים')), ovBox),
      h('section', { class: 'card stack' },
        h('h2', null, 'כללי'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: D().settings.instByBilling, onchange: (e) => { D().settings.instByBilling = e.target.checked; S.save(); } }),
          'עסקת תשלומים נספרת לפי חודש החיוב (כבוי = לפי חודש הרכישה)'),
        h('label', { class: 'field', style: 'max-width:240px' }, h('span', null, 'נעילה אוטומטית אחרי (דקות)'),
          h('input', { type: 'number', min: '1', max: '120', value: D().settings.autoLockMin, onchange: (e) => { if (!S.data) return; D().settings.autoLockMin = Math.max(1, Math.min(120, +e.target.value || 3)); S.save(); lastTouch = 0; resetIdle(); } }))),
      cardEntries.length ? h('section', { class: 'card stack' }, h('h2', null, 'כרטיסים'),
        h('div', { class: 'fields' }, cardEntries.map(([num, c]) => h('label', { class: 'field' }, h('span', null, 'מסתיים ב-' + num),
          h('input', { type: 'text', value: c.label, onchange: (e) => { c.label = e.target.value.trim() || c.label; S.save(); } }))))) : null,
      h('section', { class: 'card stack' },
        h('div', { class: 'section-title' }, h('h2', null, 'חוקי סיווג שנלמדו'), h('span', { class: 'faint' }, `${learned.length} חוקים · ועוד ${D().rules.length - learned.length} מובנים`)),
        learned.length ? h('div', { class: 'tablewrap' }, h('table', { class: 'grid' }, h('tbody', null, learned.map((r) => h('tr', null, h('td', null, r.text), h('td', null, '← ' + catName(r.cat)),
          h('td', null, h('button', { class: 'btn small', onclick: () => { D().rules = D().rules.filter((x) => x !== r); S.save(); render(); } }, 'מחיקה'))))))) : h('div', { class: 'faint' }, 'כשתסווג עסקה ידנית, בית העסק יתווסף כאן.'),
        h('button', { class: 'btn', onclick: () => { let n = 0; for (const t of D().txns) if (t.catSrc !== 'manual' && t.source === 'card') { const r = classify(t); if (r.cat !== t.cat) { t.cat = r.cat; t.catSrc = r.src; n++; } } S.save(); toast(`עודכנו ${n} עסקאות`); render(); } }, 'הפעלת החוקים מחדש על עסקאות שלא סווגו ידנית')),
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
    if (S.dirty) { try { await S.flush(); } catch (e) { /* ignore */ } }
    await S.lock(); pendingImports = []; clearTimeout(idleTimer); lastTouch = 0;
    try { sessionStorage.removeItem('kupa-view'); } catch (e) { /* ignore */ }
    document.querySelectorAll('.scrim, .toast').forEach((e) => e.remove());
    lockScreen(typeof msg === 'string' ? msg : '');
  }
  function startApp(view) {
    migrate();
    ui.month = thisMonth(); ui.view = view || 'month';
    try { history.replaceState({ v: ui.view }, ''); } catch (e) { /* ignore */ }
    render(); lastTouch = 0; resetIdle();
  }
  function migrate() {
    const d = D();
    d.settings = Object.assign({ instByBilling: true, autoLockMin: 3 }, d.settings || {});
    if (!d.settings.lockV) { d.settings.autoLockMin = 3; d.settings.lockV = 2; S.save(); } // one-time: new default 3 min
    d.cards = d.cards || {}; d.budgets = d.budgets || {}; d.sectors = d.sectors || {}; d.imports = d.imports || [];
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
      startApp(['month', 'txns', 'import', 'reports', 'settings'].includes(v) ? v : 'month');
    } else lockScreen();
  })();
})();
