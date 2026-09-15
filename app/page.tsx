import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

export default async function Home() {
  const user = await currentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-24 sm:px-6 lg:px-8 text-center">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            Chat with your GitHub repositories
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Paste any GitHub repo URL and chat with the codebase using natural language.
            Get answers with clickable citations pointing to exact file locations.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-zinc-900 px-8 py-3 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/sign-up"
                className="rounded-full bg-zinc-900 px-8 py-3 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Get started for free
              </Link>
            )}
            <Link
              href="#how-it-works"
              className="rounded-full px-8 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-900/10 hover:bg-zinc-50 dark:text-zinc-50 dark:ring-zinc-50/20 dark:hover:bg-zinc-800"
            >
              Learn more
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              How it works
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Three simple steps to chat with any codebase
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-zinc-50/10">
              <div className="mb-4 h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                1. Paste a repo URL
              </h3>
              <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                Enter any public GitHub repository URL. We'll fetch the codebase and prepare it for chatting.
              </p>
            </div>

            <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-zinc-50/10">
              <div className="mb-4 h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                2. Chat with the code
              </h3>
              <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                Ask natural language questions about the repository. Get answers grounded in actual code.
              </p>
            </div>

            <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-zinc-50/10">
              <div className="mb-4 h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                3. Follow citations
              </h3>
              <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                Every answer includes clickable citations to the exact file locations where the information was found.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            GitHub Repo Explainer
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
              Privacy
            </a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
