// node tests/invest.test.js — checks the portfolio engine against the spec's test data
const I = require('../public/invest-calc.js');
const T = (date, type, o) => ({ date, type, ...o });
const tx = [
  T('2026-08-05', 'dep', { amount: 90000 }),
  T('2026-08-13', 'buy', { sym: 'VOO', qty: 50, price: 713.65, fee: 8 }),
  T('2026-08-18', 'buy', { sym: 'SPMO', qty: 30, price: 150.49, fee: 8 }),
  T('2026-08-19', 'buy', { sym: 'TQQQ', qty: 30, price: 72.20, fee: 8 }),
  T('2026-09-01', 'buy', { sym: 'NVDA', qty: 50, price: 217.09, fee: 8 }),
  T('2026-09-01', 'buy', { sym: 'VOO', qty: 23, price: 699.42, fee: 8 }),
  T('2026-09-25', 'div', { sym: 'SPMO', gross: 7.30, tax: 1.83 }),
  T('2026-09-29', 'div', { sym: 'TQQQ', gross: 4.68, tax: 1.17 }),
  T('2026-09-30', 'div', { sym: 'VOO', gross: 133.05, tax: 33.26 }),
  T('2026-10-01', 'div', { sym: 'NVDA', gross: 12.50, tax: 3.13 }),
  T('2026-10-15', 'buy', { sym: 'JPM', qty: 10, price: 334.20, fee: 8 }),
  T('2026-10-15', 'buy', { sym: 'LMT', qty: 6, price: 529.79, fee: 8 }),
  T('2026-10-20', 'buy', { sym: 'GE', qty: 17, price: 297.50, fee: 8 }),
];
const px = { VOO: 710.72, NVDA: 221.97, SPMO: 143.15, TQQQ: 72.61, LMT: 551.51, JPM: 335.19, GE: 295.88 };
const prices = Object.fromEntries(Object.entries(px).map(([k, v]) => [k, { price: v }]));
const r = I.compute(tx, prices, { sellFee: 8, cgt: 0.25 });
const pos = Object.fromEntries(r.positions.map((p) => [p.sym, p]));
const r2 = (x) => Math.round(x * 100) / 100;
const pct = (x) => Math.round(x * 10000) / 100;
const checks = [
  ['יתרה דולרית', r2(r.cash), 9171.54], ['שווי ניירות', r2(r.value), 81144.78], ['שווי תיק', r2(r.portfolio), 90316.32],
  ['עלות כוללת', r2(r.cost), 80946.60], ['רווח מחיר', r2(r.priceGain), 198.18], ['רווח מחיר %', pct(r.priceGainPct), 0.24],
  ['דיבידנד נטו', r2(r.divHeld), 118.14], ['דיבידנד %', pct(r.divPct), 0.15], ['רווח כולל', r2(r.total), 316.32], ['רווח כולל %', pct(r.totalPct), 0.39],
  ['VOO כמות', pos.VOO.qty, 73], ['VOO עלות', r2(pos.VOO.cost), 51785.16], ['VOO רווח כולל', r2(pos.VOO.total), 197.19],
  ['SPMO רווח כולל', r2(pos.SPMO.total), -222.73], ['SPMO רווח כולל %', pct(pos.SPMO.totalPct), -4.92],
  ['עמלות', r2(r.fees), 64], ['מס דיבידנד', r2(r.divTax), 39.39],
  ['עמלות מכירה', r2(r.sellFees), 56], ['מס משוער', r2(r.estTax), 35.55], ['רווח נטו אם מוכרים', r2(r.netIfSold), 224.77],
];
let bad = 0;
for (const [name, got, want] of checks) { const ok = Math.abs(got - want) < 0.005; if (!ok) bad++; console.log(ok ? 'OK ' : 'XX ', name, got, ok ? '' : '(expected ' + want + ')'); }
// sale sanity: sell half of VOO at 720 with $8 fee -> avg cost kept, realized booked
const r3 = I.compute([...tx, T('2026-10-21', 'sell', { sym: 'VOO', qty: 36.5, price: 720, fee: 8 })], prices, { sellFee: 8, cgt: 0.25 });
const v3 = r3.positions.find((p) => p.sym === 'VOO');
console.log('sale check: VOO qty', v3.qty, 'avg', r2(v3.avg), '(was', r2(pos.VOO.avg) + ') realized', r2(r3.realized), 'cash', r2(r3.cash));
process.exit(bad ? 1 : 0);
