import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-6xl font-semibold text-zinc-200 dark:text-zinc-800">
        404
      </h1>
      <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Page not found
      </h2>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        The page you are looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
      >
        Back to overview
      </Link>
    </div>
  );
}