import type { SupabaseClient } from "@supabase/supabase-js";

// Finds or creates a vendor, applies the "shared default, personal override"
// rule, and returns the vendor's id. Used by both manual expense entry and
// bulk statement imports so behavior never drifts between the two.
export async function resolveVendorId(
  supabase: SupabaseClient,
  userId: string,
  vendorNameRaw: string,
  categoryId: string
): Promise<{ vendorId: string } | { error: string }> {
  const vendorName = vendorNameRaw.trim().replace(/\s+/g, " ");
  if (!vendorName) return { error: "Vendor name is required" };

  const { data: existingVendor } = await supabase
    .from("vendors")
    .select("id, category_id")
    .ilike("name", vendorName)
    .maybeSingle();

  if (existingVendor) {
    const vendorId = existingVendor.id as string;

    const { data: override } = await supabase
      .from("vendor_overrides")
      .select("category_id")
      .eq("vendor_id", vendorId)
      .eq("user_id", userId)
      .maybeSingle();

    const resolvedDefault = override?.category_id ?? existingVendor.category_id;

    if (resolvedDefault !== categoryId) {
      await supabase.from("vendor_overrides").upsert(
        { vendor_id: vendorId, user_id: userId, category_id: categoryId },
        { onConflict: "vendor_id,user_id" }
      );
    }

    return { vendorId };
  }

  const { data: newVendor, error: vendorError } = await supabase
    .from("vendors")
    .insert({ name: vendorName, category_id: categoryId, created_by: userId })
    .select("id")
    .single();

  if (vendorError || !newVendor) {
    return { error: vendorError?.message ?? "Could not save vendor" };
  }

  return { vendorId: newVendor.id as string };
}

// Links a normalized statement-description key to a vendor, so future
// statements recognize the same merchant even with different reference numbers.
export async function ensureVendorAlias(
  supabase: SupabaseClient,
  aliasKey: string,
  vendorId: string,
  userId: string
) {
  if (!aliasKey) return;

  const { data: existing } = await supabase
    .from("vendor_aliases")
    .select("id")
    .eq("alias_key", aliasKey)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from("vendor_aliases")
      .insert({ alias_key: aliasKey, vendor_id: vendorId, created_by: userId });
  }
}
