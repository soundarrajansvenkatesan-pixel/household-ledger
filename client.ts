import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import Link from "next/link";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type ExpenseRow = {
  id: string;
  amount: number;
  expense_date: string;
  vendor_text: string | null;
  notes: string | null;
  source: string;
  categories: { name: string } | null;
  profiles: { display_name: string | null } | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const { added } = await searchParams;
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [{ data: monthExpenses }, { data: recentExpenses }] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount, categories(name)")
      .gte("expense_date", monthStart)
      .returns<{ amount: number; categories: { name: string } | null }[]>(),
    supabase
      .from("expenses")
      .select(
        "id, amount, expense_date, vendor_text, notes, source, categories(name), profiles(display_name)"
      )
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<ExpenseRow[]>(),
  ]);

  const totalsByCategory = new Map<string, number>();
  let monthTotal = 0;
  for (const row of monthExpenses ?? []) {
    const name = row.categories?.name ?? "Uncategorized";
    totalsByCategory.set(name, (totalsByCategory.get(name) ?? 0) + Number(row.amount));
    monthTotal += Number(row.amount);
  }
  const sortedCategories = [...totalsByCategory.entries()].sort((a, b) => b[1] - a[1]);

  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <>
      <Nav active="dashboard" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {added && (
          <p className="mb-6 rounded-sm border border-ledger bg-paper-raised px-4 py-2 text-sm text-ledger-deep">
            Expense added and categorized.
          </p>
        )}

        <section className="mb-10">
          <p className="text-xs uppercase tracking-wide text-ink-soft">{monthLabel}</p>
          <p className="font-serif text-3xl text-ink">{money.format(monthTotal)}</p>

          {sortedCategories.length > 0 ? (
            <div className="mt-5 space-y-2">
              {sortedCategories.map(([name, total]) => {
                const pct = monthTotal > 0 ? (total / monthTotal) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm">
                      <Link
                        href={
                          name === "Uncategorized"
                            ? "/expenses?category=uncategorized"
                            : "/expenses"
                        }
                        className="text-ink hover:text-ledger-deep hover:underline"
                      >
                        {name}
                      </Link>
                      <span className="font-mono text-ink-soft">{money.format(total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-line">
                      <div
                        className="h-1.5 rounded-full bg-ledger"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">
              Nothing logged yet this month.{" "}
              <Link href="/expenses/new" className="text-ledger-deep underline">
                Add your first expense
              </Link>
              .
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-serif text-lg text-ink">Recent entries</h2>
          {recentExpenses && recentExpenses.length > 0 ? (
            <div className="overflow-hidden rounded-sm border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Paid by</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                        {new Date(row.expense_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="px-3 py-2 text-ink">{row.vendor_text ?? "—"}</td>
                      <td className="px-3 py-2 text-ink-soft">{row.categories?.name ?? "Uncategorized"}</td>
                      <td className="px-3 py-2 text-ink-soft">{row.profiles?.display_name ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-ink">
                        {money.format(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">No expenses logged yet.</p>
          )}
        </section>
      </main>
    </>
  );
}
