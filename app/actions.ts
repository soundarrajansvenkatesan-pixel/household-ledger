"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function addExpense(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const vendorNameRaw = String(formData.get("vendor") || "").trim();
  const categoryId = String(formData.get("category_id") || "");
  const amount = parseFloat(String(formData.get("amount") || "0"));
  const expenseDate = String(formData.get("expense_date") || "");
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!vendorNameRaw || !categoryId || !amount || !expenseDate) {
    redirect("/expenses/new?error=Please+fill+in+vendor%2C+category%2C+amount+and+date");
  }

  // Normalize vendor name so "BigBasket" and "bigbasket " resolve to the same vendor
  const vendorName = vendorNameRaw.replace(/\s+/g, " ");

  // 1. Find an existing vendor (case-insensitive)
  const { data: existingVendor } = await supabase
    .from("vendors")
    .select("id, category_id")
    .ilike("name", vendorName)
    .maybeSingle();

  let vendorId: string;

  if (existingVendor) {
    vendorId = existingVendor.id;

    // Work out what category this vendor currently resolves to for this user
    const { data: override } = await supabase
      .from("vendor_overrides")
      .select("category_id")
      .eq("vendor_id", vendorId)
      .eq("user_id", user!.id)
      .maybeSingle();

    const resolvedDefault = override?.category_id ?? existingVendor.category_id;

    // If this user picked something different, remember it as their personal override
    if (resolvedDefault !== categoryId) {
      await supabase
        .from("vendor_overrides")
        .upsert(
          { vendor_id: vendorId, user_id: user!.id, category_id: categoryId },
          { onConflict: "vendor_id,user_id" }
        );
    }
  } else {
    // Brand new vendor — this category becomes the shared default for everyone
    const { data: newVendor, error: vendorError } = await supabase
      .from("vendors")
      .insert({ name: vendorName, category_id: categoryId, created_by: user!.id })
      .select("id")
      .single();

    if (vendorError || !newVendor) {
      redirect("/expenses/new?error=Could+not+save+vendor");
    }
    vendorId = newVendor!.id;
  }

  const { error: expenseError } = await supabase.from("expenses").insert({
    user_id: user!.id,
    vendor_id: vendorId,
    vendor_text: vendorName,
    category_id: categoryId,
    amount,
    expense_date: expenseDate,
    notes,
    source: "manual",
  });

  if (expenseError) {
    redirect(`/expenses/new?error=${encodeURIComponent(expenseError.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?added=1");
}

export async function lookupVendorCategory(vendorName: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const name = vendorName.trim();
  if (!name) return null;

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, category_id")
    .ilike("name", name)
    .maybeSingle();

  if (!vendor) return null;

  const { data: override } = await supabase
    .from("vendor_overrides")
    .select("category_id")
    .eq("vendor_id", vendor.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return override?.category_id ?? vendor.category_id;
}
