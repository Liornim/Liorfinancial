/* Portfolio math. Pure: (transactions, prices, settings) -> report. Nothing computed is stored; always derived.
   All amounts in USD; rounding only for display.
   Cost basis: average cost. A sale removes avg-cost × qty from the position's cost and books a realized P&L. */
(function (root) {
  'use strict';

  const ORDER = { dep: 0, wd: 1, buy: 2, sell: 3, div: 4 };

  function net(t) {
    switch (t.type) {
      case 'buy': return -(t.qty * t.price) - (t.fee || 0);
      case 'sell': return t.qty * t.price - (t.fee || 0);
      case 'div': return (t.gross || 0) - (t.tax || 0);
      case 'dep': return t.amount || 0;
      case 'wd': return -(t.amount || 0);
      default: return 0;
    }
  }

  function compute(txns, prices, settings) {
    const sellFee = settings && settings.sellFee != null ? +settings.sellFee : 8;
    const cgt = settings && settings.cgt != null ? +settings.cgt : 0.25;
    const list = txns.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.seq || 0) - (b.seq || 0) || ORDER[a.type] - ORDER[b.type]);
    const pos = {}; const warnings = [];
    let cash = 0, deposits = 0, withdrawals = 0, fees = 0, divTax = 0, divNet = 0, realized = 0;
    const P = (s) => (pos[s] = pos[s] || { sym: s, qty: 0, cost: 0, div: 0, realized: 0, fees: 0 });

    for (const t of list) {
      cash += net(t);
      if (t.type === 'dep') deposits += t.amount || 0;
      else if (t.type === 'wd') withdrawals += t.amount || 0;
      else if (t.type === 'buy') { const p = P(t.sym); p.qty += t.qty; p.cost += t.qty * t.price + (t.fee || 0); p.fees += t.fee || 0; fees += t.fee || 0; }
      else if (t.type === 'sell') {
        const p = P(t.sym);
        if (t.qty > p.qty + 1e-9) warnings.push(`${t.date}: מכירה של ${t.qty} ${t.sym} אבל מוחזקות רק ${p.qty}`);
        const q = Math.min(t.qty, p.qty);
        const avg = p.qty > 0 ? p.cost / p.qty : 0;
        const costOut = avg * q;
        const r = t.qty * t.price - (t.fee || 0) - costOut;
        p.realized += r; realized += r; p.cost -= costOut; p.qty -= t.qty; p.fees += t.fee || 0; fees += t.fee || 0;
        if (Math.abs(p.qty) < 1e-9) { p.qty = 0; p.cost = 0; }
      } else if (t.type === 'div') { const p = P(t.sym); const n = (t.gross || 0) - (t.tax || 0); p.div += n; divNet += n; divTax += t.tax || 0; }
    }

    const held = Object.values(pos).filter((p) => p.qty > 1e-9);
    let value = 0, cost = 0, divHeld = 0, missing = [];
    for (const p of held) {
      const pr = prices[p.sym];
      p.price = pr && pr.price != null ? +pr.price : null;
      if (p.price == null) missing.push(p.sym);
      p.value = p.price == null ? null : p.qty * p.price;
      p.avg = p.cost / p.qty;
      p.priceGain = p.value == null ? null : p.value - p.cost;
      p.priceGainPct = p.priceGain == null ? null : p.priceGain / p.cost;
      p.divPct = p.div / p.cost;
      p.total = p.priceGain == null ? null : p.priceGain + p.div;
      p.totalPct = p.total == null ? null : p.total / p.cost;
      p.breakeven = (p.cost + sellFee) / p.qty;
      if (p.value != null) value += p.value;
      cost += p.cost; divHeld += p.div;
    }
    for (const p of held) p.weight = value && p.value != null ? p.value / value : null;

    const priceGain = value - cost;                       // open positions only
    const total = priceGain + divHeld;                    // as in the positions table
    const netDeposits = deposits - withdrawals;
    const portfolio = cash + value;
    // "sell everything": a sale fee per held symbol; tax on the NET positive price gain after those fees (losses offset gains)
    const sellFees = sellFee * held.length;
    const taxableGain = held.reduce((n, p) => n + (p.value == null ? 0 : p.value - p.cost - sellFee), 0);
    // tax is a real money amount: rounded to the cent (the only intermediate rounding; 35.545 -> 35.55)
    const estTax = Math.round(cgt * Math.max(0, taxableGain) * 100 + 1e-7) / 100;
    const netIfSold = total + realized + (divNet - divHeld) - sellFees - estTax;

    return {
      positions: held.sort((a, b) => (b.value || 0) - (a.value || 0)),
      closed: Object.values(pos).filter((p) => p.qty <= 1e-9 && (p.realized || p.div)),
      cash, value, portfolio, cost, priceGain, priceGainPct: cost ? priceGain / cost : 0,
      divHeld, divNet, divPct: cost ? divHeld / cost : 0, total, totalPct: cost ? total / cost : 0,
      deposits, withdrawals, netDeposits, vsDeposits: portfolio - netDeposits, vsDepositsPct: netDeposits ? (portfolio - netDeposits) / netDeposits : 0,
      fees, divTax, realized, sellFees, estTax, netIfSold, missing, warnings,
    };
  }

  const api = { compute, net };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KupaInvest = api;
})(typeof window !== 'undefined' ? window : globalThis);
