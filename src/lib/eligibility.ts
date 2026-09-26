/**
 * Indicative listing-eligibility screen from the latest financials on file.
 *
 * This is a first-pass conversation aid, NOT a regulatory determination:
 * exchange / SEBI (ICDR) criteria look at multi-year history (track record,
 * operating profit in preceding years, net tangible assets, paid-up capital,
 * free cash flow, promoter holding…) and change over time. Always verify
 * against the current NSE Emerge / BSE SME / SEBI rules.
 */
export type EligibilityInput = {
  revenueCr: number | null;
  ebitdaCr: number | null;
  netWorthCr: number | null;
  incorporationYear: number | null;
};

export type EligibilityResult = {
  verdict: "MAINBOARD" | "SME" | "PRE_IPO" | "INSUFFICIENT_DATA";
  label: string;
  checks: { label: string; ok: boolean | null }[];
};

export function screenEligibility(c: EligibilityInput, now = new Date()): EligibilityResult {
  const years = c.incorporationYear ? now.getFullYear() - c.incorporationYear : null;
  if (c.ebitdaCr == null || c.netWorthCr == null) {
    return {
      verdict: "INSUFFICIENT_DATA",
      label: "Add EBITDA and net worth to screen",
      checks: [],
    };
  }
  const track = years == null ? null : years >= 3;
  const sme = [
    { label: "Operating track record ≥ 3 years", ok: track },
    { label: "EBITDA ≥ ₹1 Cr (latest year)", ok: c.ebitdaCr >= 1 },
    { label: "Positive net worth", ok: c.netWorthCr > 0 },
  ];
  const main = [
    { label: "Operating profit ≥ ₹15 Cr (proxy: latest EBITDA)", ok: c.ebitdaCr >= 15 },
    { label: "Net worth ≥ ₹1 Cr", ok: c.netWorthCr >= 1 },
    { label: "Operating track record ≥ 3 years", ok: track },
  ];
  const passes = (checks: { ok: boolean | null }[]) => checks.every((x) => x.ok !== false);
  if (passes(main)) return { verdict: "MAINBOARD", label: "Indicatively mainboard-eligible", checks: main };
  if (passes(sme)) return { verdict: "SME", label: "Indicatively SME-platform eligible (NSE Emerge / BSE SME)", checks: sme };
  return { verdict: "PRE_IPO", label: "Needs pre-IPO readiness work", checks: sme };
}
