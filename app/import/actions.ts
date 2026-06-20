"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveVendorId, ensureVendorAlias } from "@/lib/vendor-resolution";

export type ColumnMapping = {
  headerSignature: string;
  bankLabel: string | null;
  dateColumn: string;
  descriptionColumn: string;
  debitColumn: string;
  creditColumn: string | null;
};

export async function getColumnMapping(signature: string): Promise<ColumnMapping | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("csv_column_mappings")
    .select("*")
    .eq("header_signature", signature)
    .maybeSingle();

  if (!data) return null;

  return {
    headerSignature: data.header_signature,
    bankLabel: data.bank_label,
    dateColumn: data.date_column,
    descriptionColumn: data.description_column,
    debitColumn: data.amount_column,
    creditColumn: data.credit_column,
  };
}

export async function saveColumnMapping(mapping: ColumnMapping) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  await supabase.from("csv_column_mappings").upsert(
    {
      header_signature: mapping.headerSignature,
      bank_label: mapping.bankLabel,
      date_column: mapping.dateColumn,
      description_column: mapping.descriptionColumn,
      amount_column: mapping.debitColumn,
      credit_column: mapping.creditColumn,
      created_by: user!.id,
    },
    { onConflict: "header_signature" }
  );
}

export type VendorMatch = {
  key: string;
  vendorId: string | null;
  vendorName: string | null;
  categoryId: string | null;
};

// Looks up a batch of normalized description keys in one round trip
export async function bulkLookupVendors(keys: string[]): Promise<VendorMatch[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return keys.map((key) => ({ key, vendorId: null, vendorName: null, categoryId: null }));

  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (uniqueKeys.length === 0) return [];

  const { data: aliases } = await supabase
    .from("vendor_aliases")
    .select("alias_key, vendor_id, vendors(name, category_id)")
    .in("alias_key", uniqueKeys);

  const results: VendorMatch[] = [];
  const matchedKeys = new Set<string>();

  for (const row of aliases ?? []) {
    const vendor = row.vendors as unknown as { name: string; category_id: string } | null;
    matchedKeys.add(row.alias_key);

    let categoryId = vendor?.category_id ?? null;
    if (categoryId) {
      const { data: override } = await supabase
        .from("vendor_overrides")
        .select("category_id")
        .eq("vendor_id", row.vendor_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (override) categoryId = override.category_id;
    }

    results.push({
      key: row.alias_key,
      vendorId: row.vendor_id,
      vendorName: vendor?.name ?? null,
      categoryId,
    });
  }

  for (const key of uniqueKeys) {
    if (!matchedKeys.has(key)) {
      results.push({ key, vendorId: null, vendorName: null, categoryId: null });
    }
  }

  return results;
}

export type ImportRow = {
  rawDescription: string;
  normalizedKey: string;
  vendorName: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
};

export async function importTransactions(
  rows: ImportRow[],
  meta: { fileName: string; bankLabel: string | null }
): Promise<{ imported: number; error?: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  let imported = 0;

  for (const row of rows) {
    const resolved = await resolveVendorId(supabase, user!.id, row.vendorName, row.categoryId);
    if ("error" in resolved) continue;

    await ensureVendorAlias(supabase, row.normalizedKey, resolved.vendorId, user!.id);

    const { error } = await supabase.from("expenses").insert({
      user_id: user!.id,
      vendor_id: resolved.vendorId,
      vendor_text: row.rawDescription,
      category_id: row.categoryId,
      amount: row.amount,
      expense_date: row.expenseDate,
      source: "csv_import",
    });

    if (!error) imported++;
  }

  await supabase.from("statement_imports").insert({
    user_id: user!.id,
    file_name: meta.fileName,
    file_type: "csv",
    bank_label: meta.bankLabel,
    transaction_count: imported,
  });

  revalidatePath("/dashboard");
  return { imported };
}
