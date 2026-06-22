import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { ExpenseForm } from "@/components/ExpenseForm";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  return (
    <>
      <Nav active="new" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="mb-6 font-serif text-2xl text-ink">Add an expense</h1>
        <ExpenseForm categories={categories ?? []} error={error} />
      </main>
    </>
  );
}
