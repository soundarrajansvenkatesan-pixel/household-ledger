import { login } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-serif text-2xl text-ink">Household Ledger</p>
          <p className="mt-1 text-sm text-ink-soft">Sign in to your family&apos;s account</p>
        </div>

        <form
          action={login}
          className="rounded-sm border border-line bg-paper-raised p-6 shadow-sm"
        >
          <label className="block text-xs uppercase tracking-wide text-ink-soft">
            Email
            <input
              name="email"
              type="email"
              required
              autoFocus
              className="mt-1 mb-4 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ledger focus:ring-1 focus:ring-ledger"
            />
          </label>

          <label className="block text-xs uppercase tracking-wide text-ink-soft">
            Password
            <input
              name="password"
              type="password"
              required
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
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-soft">
          Don&apos;t have an account yet? Ask whoever set up the ledger to add you
          in Supabase under Authentication.
        </p>
      </div>
    </main>
  );
}
