import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { ExpensesTable } from "@/components/ExpensesTable";
import Link from "next/link";

type ExpenseRow = {
  id: string;
  amount: number;
  expense_date: string;
  vendor_text: string | null;
  source: string;
  category_id: string | null;
  user_id: string;
  categories: { name: string } | null;
  profiles: { display_name: string | null } | null;
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData.user?.id ?? null;

  const { data: categories } = await supabase.from("categories").select("id, name").order("name");
  const uncategorized = (categories ?? []).find((c) => c.name === "Uncategorized");

  let query = supabase
    .from("expenses")
    .select(
      "id, amount, expense_date, vendor_text, source, category_id, user_id, categories(name), profiles(display_name)"
    )
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  const activeFilter = category ?? "all";
  if (activeFilter === "uncategorized" && uncategorized) {
    query = query.eq("category_id", uncategorized.id);
  } else if (activeFilter !== "all") {
    query = query.eq("category_id", activeFilter);
  }

  const { data: expenses } = await query.returns<ExpenseRow[]>();

  const filters = [
    { label: "All", value: "all" },
    { label: "Uncategorized", value: "uncategorized" },
    ...(categories ?? [])
      .filter((c) => c.name !== "Uncategorized")
      .map((c) => ({ label: c.name, value: c.id })),
  ];

  return (
    <>
      <Nav active="expenses" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <h1 className="mb-2 font-serif text-2xl text-ink">All expenses</h1>
        <p className="mb-5 text-sm text-ink-soft">
          Fixing one expense&apos;s category fixes every other expense from
          that same vendor still sitting in the old category — so one click
          per vendor clears a whole import.
        </p>

        <div className="mb-5 flex flex-wrap gap-2">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={f.value === "all" ? "/expenses" : `/expenses?category=${f.value}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                activeFilter === f.value
                  ? "border-ledger bg-ledger text-paper"
                  : "border-line text-ink-soft hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <ExpensesTable
          expenses={expenses ?? []}
          categories={categories ?? []}
          currentUserId={currentUserId}
        />
      </main>
    </>
  );
}
