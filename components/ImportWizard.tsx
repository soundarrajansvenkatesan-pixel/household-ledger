"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import {
  getColumnMapping,
  saveColumnMapping,
  bulkLookupVendors,
  importTransactions,
  type ColumnMapping,
} from "@/app/import/actions";
import {
  normalizeDescription,
  headerSignature,
  guessColumn,
  parseStatementDate,
} from "@/lib/normalize";

type Category = { id: string; name: string };

type ReviewRow = {
  selected: boolean;
  rawDescription: string;
  normalizedKey: string;
  vendorName: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  matched: boolean;
};

type Step = "upload" | "mapping" | "review" | "done";

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

export function ImportWizard({
  categories,
  uncategorizedId,
}: {
  categories: Category[];
  uncategorizedId: string | null;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

  const [mapping, setMapping] = useState<ColumnMapping>({
    headerSignature: "",
    bankLabel: "",
    dateColumn: "",
    descriptionColumn: "",
    debitColumn: "",
    creditColumn: null,
  });

  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  function handleFile(file: File) {
    setError(null);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const fields = (results.meta.fields ?? []).filter(Boolean);
        const data = results.data as Record<string, string>[];

        if (fields.length === 0 || data.length === 0) {
          setError("Couldn't find any rows in that file — is it a valid CSV?");
          return;
        }

        setHeaders(fields);
        setRawRows(data);

        const sig = headerSignature(fields);

        startTransition(async () => {
          const existing = await getColumnMapping(sig);

          if (existing) {
            setMapping(existing);
            await buildReview(existing, data);
          } else {
            const guessed: ColumnMapping = {
              headerSignature: sig,
              bankLabel: "",
              dateColumn: guessColumn(fields, ["date", "txn date", "transaction date"]),
              descriptionColumn: guessColumn(fields, ["narration", "description", "particulars", "details", "remarks"]),
              debitColumn: guessColumn(fields, ["debit", "withdrawal", "amount"]),
              creditColumn: guessColumn(fields, ["credit", "deposit"]) || null,
            };
            setMapping(guessed);
            setStep("mapping");
          }
        });
      },
      error: () => setError("Couldn't read that file — please check it's a CSV."),
    });
  }

  async function buildReview(map: ColumnMapping, data: Record<string, string>[]) {
    const built: ReviewRow[] = [];

    for (const row of data) {
      const debit = parseAmount(row[map.debitColumn]);
      const credit = map.creditColumn ? parseAmount(row[map.creditColumn]) : 0;

      // Skip deposits/income rows — only debit (spending) lines become expenses
      if (debit <= 0 || credit > 0) continue;

      const rawDescription = (row[map.descriptionColumn] || "").trim();
      const normalizedKey = normalizeDescription(rawDescription);
      const parsedDate = parseStatementDate(row[map.dateColumn] || "");

      built.push({
        selected: true,
        rawDescription,
        normalizedKey,
        vendorName: rawDescription,
        categoryId: uncategorizedId ?? "",
        amount: debit,
        expenseDate: parsedDate ?? "",
        matched: false,
      });
    }

    const keys = built.map((r) => r.normalizedKey);
    const matches = await bulkLookupVendors(keys);
    const matchByKey = new Map(matches.map((m) => [m.key, m]));

    for (const row of built) {
      const match = matchByKey.get(row.normalizedKey);
      if (match?.vendorId) {
        row.vendorName = match.vendorName ?? row.vendorName;
        row.categoryId = match.categoryId ?? row.categoryId;
        row.matched = true;
      }
    }

    setReviewRows(built);
    setStep("review");
  }

  function handleMappingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mapping.dateColumn || !mapping.descriptionColumn || !mapping.debitColumn) {
      setError("Please choose at least Date, Description, and Debit/Expense amount columns.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await saveColumnMapping(mapping);
      await buildReview(mapping, rawRows);
    });
  }

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setReviewRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function toggleAll(selected: boolean) {
    setReviewRows((prev) => prev.map((r) => ({ ...r, selected })));
  }

  function handleImport() {
    const selectedRows = reviewRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setError("Select at least one row to import.");
      return;
    }
    const missingDate = selectedRows.some((r) => !r.expenseDate);
    if (missingDate) {
      setError("Some selected rows are missing a valid date — please fix or unselect them.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await importTransactions(
        selectedRows.map((r) => ({
          rawDescription: r.rawDescription,
          normalizedKey: r.normalizedKey,
          vendorName: r.vendorName.trim() || r.rawDescription,
          categoryId: r.categoryId,
          amount: r.amount,
          expenseDate: r.expenseDate,
        })),
        { fileName, bankLabel: mapping.bankLabel || null }
      );
      setImportedCount(result.imported);
      setStep("done");
    });
  }

  const selectedCount = reviewRows.filter((r) => r.selected).length;

  return (
    <div className="rounded-sm border border-line bg-paper-raised p-6 shadow-sm">
      {error && (
        <p className="mb-4 rounded-sm bg-rust/10 px-3 py-2 text-sm text-rust" role="alert">
          {error}
        </p>
      )}

      {step === "upload" && (
        <div>
          <p className="mb-4 text-sm text-ink-soft">
            Upload a bank statement CSV. The first time you use a new statement
            format, you&apos;ll be asked which columns are which — after that,
            it&apos;s remembered automatically.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full rounded-sm border border-dashed border-line bg-paper px-3 py-6 text-sm text-ink-soft file:mr-4 file:rounded-sm file:border-0 file:bg-ledger file:px-3 file:py-2 file:text-paper file:hover:bg-ledger-deep"
          />
          {isPending && <p className="mt-3 text-sm text-ink-soft">Reading file…</p>}
        </div>
      )}

      {step === "mapping" && (
        <form onSubmit={handleMappingSubmit}>
          <p className="mb-4 text-sm text-ink-soft">
            Haven&apos;t seen this layout before — match the columns from{" "}
            <strong>{fileName}</strong> once, and it&apos;ll be remembered for every
            future statement with the same format.
          </p>

          <label className="mb-3 block text-xs uppercase tracking-wide text-ink-soft">
            Statement label (optional)
            <input
              type="text"
              value={mapping.bankLabel ?? ""}
              onChange={(e) => setMapping((m) => ({ ...m, bankLabel: e.target.value }))}
              placeholder="e.g. HDFC Credit Card"
              className="mt-1 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ledger focus:ring-1 focus:ring-ledger"
            />
          </label>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <ColumnSelect label="Date column" headers={headers} value={mapping.dateColumn} onChange={(v) => setMapping((m) => ({ ...m, dateColumn: v }))} />
            <ColumnSelect label="Description column" headers={headers} value={mapping.descriptionColumn} onChange={(v) => setMapping((m) => ({ ...m, descriptionColumn: v }))} />
            <ColumnSelect label="Debit / expense amount" headers={headers} value={mapping.debitColumn} onChange={(v) => setMapping((m) => ({ ...m, debitColumn: v }))} />
            <ColumnSelect label="Credit / deposit amount (optional)" headers={headers} value={mapping.creditColumn ?? ""} onChange={(v) => setMapping((m) => ({ ...m, creditColumn: v || null }))} allowNone />
          </div>

          <p className="mb-4 text-xs text-ink-soft">
            Rows with a value in the credit/deposit column are treated as
            income and skipped — only spending gets imported as an expense.
          </p>

          <button type="submit" disabled={isPending} className="w-full rounded-sm bg-ledger py-2 font-medium text-paper transition hover:bg-ledger-deep disabled:opacity-60">
            {isPending ? "Reading transactions…" : "Continue"}
          </button>
        </form>
      )}

      {step === "review" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-ink-soft">
              Found <strong>{reviewRows.length}</strong> spending transactions in{" "}
              <strong>{fileName}</strong>. Review before importing.
            </p>
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => toggleAll(true)} className="text-ledger-deep hover:underline">Select all</button>
              <button type="button" onClick={() => toggleAll(false)} className="text-ink-soft hover:underline">Select none</button>
            </div>
          </div>

          <div className="mb-4 max-h-[28rem] overflow-y-auto rounded-sm border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-paper-raised text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-2 py-2 text-left"></th>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Vendor</th>
                  <th className="px-2 py-2 text-left">Category</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={row.selected} onChange={(e) => updateRow(i, { selected: e.target.checked })} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="date" value={row.expenseDate} onChange={(e) => updateRow(i, { expenseDate: e.target.value })} className="w-32 rounded-sm border border-line bg-paper px-1 py-1 text-xs" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="text" value={row.vendorName} onChange={(e) => updateRow(i, { vendorName: e.target.value })} className="w-full min-w-[8rem] rounded-sm border border-line bg-paper px-1 py-1 text-xs" />
                      <p className="mt-0.5 truncate text-[11px] text-ink-soft" title={row.rawDescription}>{row.rawDescription}</p>
                    </td>
                    <td className="px-2 py-2">
                      <select value={row.categoryId} onChange={(e) => updateRow(i, { categoryId: e.target.value })} className="w-full rounded-sm border border-line bg-paper px-1 py-1 text-xs">
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right">₹{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={handleImport} disabled={isPending} className="w-full rounded-sm bg-ledger py-2 font-medium text-paper transition hover:bg-ledger-deep disabled:opacity-60">
            {isPending ? "Importing…" : `Import ${selectedCount} expense${selectedCount === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="text-center">
          <p className="mb-4 text-ink">
            Imported <strong>{importedCount}</strong> expense{importedCount === 1 ? "" : "s"} from {fileName}.
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <Link href="/dashboard" className="rounded-sm bg-ledger px-4 py-2 text-paper hover:bg-ledger-deep">Go to dashboard</Link>
            <button type="button" onClick={() => { setStep("upload"); setReviewRows([]); setFileName(""); }} className="text-ink-soft hover:text-ink">
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnSelect({
  label,
  headers,
  value,
  onChange,
  allowNone,
}: {
  label: string;
  headers: string[];
  value: string;
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <label className="block text-xs uppercase tracking-wide text-ink-soft">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-sm border border-line bg-paper px-2 py-2 text-sm text-ink outline-none focus:border-ledger focus:ring-1 focus:ring-ledger"
      >
        <option value="">{allowNone ? "None" : "Choose a column"}</option>
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </label>
  );
}
