// Turns messy bank statement text into a short, stable key so the same
// vendor can be recognized across many statements even though banks stuff
// reference numbers, UPI handles, and transaction codes into the description.
//
// Example: "UPI-BigBasket-bigbasket@icici-9876543210-Payment from Phone"
//          -> "BIGBASKET"

const NOISE_WORDS = new Set([
  "UPI", "NEFT", "IMPS", "RTGS", "POS", "ECOM", "ATW", "ATM", "BIL", "BILLPAY",
  "PAY", "PAYMENT", "PAYMENTS", "FROM", "TO", "PHONE", "BANK", "LTD", "LIMITED",
  "PVT", "PRIVATE", "TRANSFER", "TXN", "TRAN", "REF", "P2A", "P2M", "A2A", "P2P",
  "VPA", "DR", "CR", "IN", "INDIA", "ONLINE", "PURCHASE", "SPENDS", "AVL", "BAL",
  "INST", "OPENING", "CLOSING", "CHRG", "CHARGE", "GST", "MEMO", "MMT", "NETBANK",
]);

export function normalizeDescription(raw: string): string {
  if (!raw) return "";

  const beforeAt = raw.split("@")[0];

  const tokens = beforeAt
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .filter((t) => !NOISE_WORDS.has(t))
    // drop pure reference/account numbers (3+ digits) but keep short ones
    // that might be part of a brand (e.g. "7-ELEVEN" -> keep "7")
    .filter((t) => !/^[0-9]{3,}$/.test(t))
    // drop tokens that are mostly digits (mixed alphanumeric ids)
    .filter((t) => {
      const digitCount = (t.match(/[0-9]/g) || []).length;
      return digitCount / t.length < 0.5;
    });

  if (tokens.length === 0) {
    // Fall back to the first alphabetic-ish word in the original string
    const fallback = beforeAt.toUpperCase().match(/[A-Z]{3,}/);
    return fallback ? fallback[0] : beforeAt.trim().toUpperCase().slice(0, 40);
  }

  // Most bank descriptions put the merchant name first or second token-wise;
  // keep up to 3 tokens so things like "BIGBASKET ONLINE" stay distinct
  // from just noise, without dragging in branch/city names from later in the string.
  return tokens.slice(0, 3).join(" ");
}

export function headerSignature(headers: string[]): string {
  return headers
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

// Best-effort guess so the column-mapping screen pre-fills sensible defaults
export function guessColumn(headers: string[], keywords: string[]): string {
  const lower = headers.map((h) => h.toLowerCase());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

// Handles DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD and similar common bank formats
export function parseStatementDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  // DD-MM-YYYY or DD/MM/YYYY
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  // DD-MMM-YYYY (e.g. 05-Jan-2026)
  m = s.match(/^(\d{1,2})[-\s](\w{3,})[-\s](\d{4})/);
  if (m) {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const idx = months.indexOf(m[2].toLowerCase().slice(0, 3));
    if (idx !== -1) return `${m[3]}-${String(idx + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  return null;
}
