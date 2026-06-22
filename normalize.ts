"use client";

import { useState, useTransition } from "react";
import { addExpense, lookupVendorCategory } from "@/app/actions";

type Category = { id: string; name: string };

export function ExpenseForm({
  categories,
  error,
}: {
  categories: Category[];
  error?: string;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  async function handleVendorBlur(e: React.FocusEvent<HTMLInputElement>) {
    const name = e.target.value.trim();
    if (!name) return;

    startTransition(async () => {
      const suggestedCategoryId = await lookupVendorCategory(name);
      if (suggestedCategoryId) {
        setCategoryId(suggestedCategoryId);
        const match = categories.find((c) => c.id === suggestedCategoryId);
        setSuggestion(match?.name ?? null);
      } else {
        setSuggestion(null);
      }
    });
  }

  return (
    <form
      action={addExpense}
      className="rounded-sm border border-line bg-paper-raised p-6 shadow-sm"
    >
      <label className="block text-xs uppercase tracking-wide text-ink-soft">
        Vendor
        <input
          name="vendor"
          type="text"
          required
          placeholder="e.g. BigBasket, Apollo Pharmacy"
          onBlur={handleVendorBlur}
          className="mt-1 mb-1 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ledger focus:ring-1 focus:ring-ledger"
        />
      </label>
      <p className="mb-4 h-4 text-xs text-ledger-deep">
        {isPending
          ? "Checking known vendors…"
          : suggestion
          ? `Recognized — usually categorized as "${suggestion}"`
          : ""}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block text-xs uppercase tracking-wide text-ink-soft">
          Amount (₹)
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            className="mt-1 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ledger focus:ring-1 focus:ring-ledger"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-ink-soft">
          Date
          <input
            name="expense_date"
            type="date"
            defaultValue={today}
            required
            className="mt-1 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ledger focus:ring-1 focus:ring-ledger"
          />
        </label>
      </div>

      <label className="block text-xs uppercase tracking-wide text-ink-soft">
        Category
        <select
          name="category_id"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-1 mb-4 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ledger focus:ring-1 focus:ring-ledger"
        >
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs uppercase tracking-wide text-ink-soft">
        Notes (optional)
        <input
          name="notes"
          type="text"
          className="mt-1 mb-2 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ledger focus:ring-1 focus:ring-ledger"
        />
      </label>

      {error && (
        <p className="mb-4 text-sm text-rust" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="mt-2 w-full rounded-sm bg-ledger py-2 font-medium text-paper transition hover:bg-ledger-deep"
      >
        Save expense
      </button>
      <p className="mt-3 text-xs text-ink-soft">
        Picking a different category than shown above only changes it for you
        going forward — everyone else keeps seeing the shared default.
      </p>
    </form>
  );
}
