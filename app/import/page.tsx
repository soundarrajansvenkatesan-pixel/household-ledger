import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { ImportWizard } from "@/components/ImportWizard";

export default async function ImportPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  const uncategorized = (categories ?? []).find((c) => c.name === "Uncategorized");

  return (
    <>
      <Nav active="import" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="mb-2 font-serif text-2xl text-ink">Import a statement</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Upload a CSV from your bank or credit card. PDF statement support
          (HDFC, ICICI, Axis, HSBC) is coming next.
        </p>
        <ImportWizard categories={categories ?? []} uncategorizedId={uncategorized?.id ?? null} />
      </main>
    </>
  );
}
