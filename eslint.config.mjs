import Link from "next/link";
import { logout } from "@/app/actions";

export function Nav({ active }: { active: "dashboard" | "new" | "import" | "expenses" }) {
  return (
    <header className="border-b border-line bg-paper-raised">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link href="/dashboard" className="font-serif text-lg text-ink">
          Household Ledger
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/dashboard"
            className={active === "dashboard" ? "text-ledger-deep font-medium" : "text-ink-soft hover:text-ink"}
          >
            Overview
          </Link>
          <Link
            href="/expenses"
            className={active === "expenses" ? "text-ledger-deep font-medium" : "text-ink-soft hover:text-ink"}
          >
            All expenses
          </Link>
          <Link
            href="/expenses/new"
            className={active === "new" ? "text-ledger-deep font-medium" : "text-ink-soft hover:text-ink"}
          >
            Add expense
          </Link>
          <Link
            href="/import"
            className={active === "import" ? "text-ledger-deep font-medium" : "text-ink-soft hover:text-ink"}
          >
            Import
          </Link>
          <form action={logout}>
            <button type="submit" className="text-ink-soft hover:text-rust">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
