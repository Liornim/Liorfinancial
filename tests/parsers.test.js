// Usage: node tests/parsers.test.js file1.xlsx file2.xlsx ...  — prints checksum results per card
const XLSX = require('xlsx'); const P = require('../public/parsers.js');
let bad = 0;
for (const f of process.argv.slice(2)) {
  const wb = XLSX.readFile(f, { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  const r = P.parseRows(rows);
  if (!r) { console.log(f, 'UNKNOWN FORMAT'); bad++; continue; }
  for (const c of P.verify(r)) { console.log(f, r.issuer, c.card, c.count, c.got, '/', c.expected, c.ok ? 'OK' : 'MISMATCH'); if (c.ok === false) bad++; }
}
process.exit(bad ? 1 : 0);
