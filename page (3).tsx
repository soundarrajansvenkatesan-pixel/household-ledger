"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Changing one expense's category also fixes every other expense this user
// has from the same vendor that was sitting in the same (now-stale) category
// — so correcting one row from a CSV import corrects the whole backlog.
export async function updateExpenseCategory(expenseId: string, newCategoryId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Not signed in" };

  const { data: expense } = await supabase
    .from("expenses")
    .select("id, vendor_id, category_id, user_id")
    .eq("id", expenseId)
    .maybeSingle();

  if (!expense || expense.user_id !== user.id) {
    return { error: "You can only edit your own expenses" };
  }

  const oldCategoryId = expense.category_id;
  const vendorId = expense.vendor_id;

  const { error: updateError } = await supabase
    .from("expenses")
    .update({ category_id: newCategoryId })
    .eq("id", expenseId);

  if (updateError) return { error: updateError.message };

  if (vendorId) {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("category_id")
      .eq("id", vendorId)
      .maybeSingle();

    if (vendor && vendor.category_id === oldCategoryId) {
      // The shared default was the same stale category — fix it for everyone.
      await supabase.from("vendors").update({ category_id: newCategoryId }).eq("id", vendorId);
    } else {
      // Someone already set a different shared default — leave it alone,
      // just remember this user's personal preference for this vendor.
      await supabase.from("vendor_overrides").upsert(
        { vendor_id: vendorId, user_id: user.id, category_id: newCategoryId },
        { onConflict: "vendor_id,user_id" }
      );
    }

    // Fix this user's other transactions from the same vendor that were
    // still sitting in the old category.
    await supabase
      .from("expenses")
      .update({ category_id: newCategoryId })
      .eq("vendor_id", vendorId)
      .eq("user_id", user.id)
      .eq("category_id", oldCategoryId)
      .neq("id", expenseId);
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteExpense(expenseId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { success: true };
}
