import { useMemo, useState } from "react";

const githubUrl = "https://github.com/tobi-techy/railagent";
const docsApiUrl = `${githubUrl}/blob/master/docs/api.md`;
const readmeUrl = `${githubUrl}/blob/master/README.md`;

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Docs", href: "#docs" },
  { label: "API", href: "#api" },
  { label: "Security", href: "#security" },
  { label: "GitHub", href: githubUrl },
];

const quickstartSnippet = `curl -X POST http://localhost:3000/transfer \\
  -H 'content-type: application/json' \\
  -H 'x-api-key: <YOUR_DEV_KEY>' \\
  -H 'Idempotency-Key: demo_transfer_001' \\
  -d '{
    "quoteId": "qt_demo_001",
    "recipient": "maria",
    "amount": "120",
    "fromToken": "EUR",
    "toToken": "NGN"
  }'`;

function App() {
  const [copied, setCopied] = useState(false);

  const year = useMemo(() => new Date().getFullYear(), []);

  const copySnippet = async () => {
    await navigator.clipboard.writeText(quickstartSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="text-lg font-semibold tracking-tight text-white">
            RailAgent
          </a>
          <div className="hidden gap-6 text-sm text-slate-300 md:flex">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="transition hover:text-white">
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-20 px-6 py-12 md:py-20">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-8 shadow-2xl shadow-cyan-950/30 md:p-14">
          <p className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyan-300">
            Developer-first payment rails on Celo
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Build cross-border agent payments without rebuilding infra.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-300 md:text-lg">
            RailAgent gives you one API for quote discovery, guarded transfer execution, and signed settlement webhooks.
            Designed for teams shipping AI agents and payment automations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#docs" className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200">
              Read docs
            </a>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-white transition hover:border-slate-500"
            >
              View GitHub
            </a>
          </div>
        </section>

        <section id="features" className="space-y-6">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">Features built for production workflows</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              ["Multilingual NL", "Handle multilingual payment intent parsing for agent-facing chat UX."],
              ["EUR → NGN live path", "Optimized corridor support includes EUR to NGN in policy-allowed flows."],
              ["Idempotent transfer execution", "Replay-safe transfer endpoint with required Idempotency-Key headers."],
              ["Webhook signing", "HMAC-signed transfer lifecycle events for secure callback handling."],
              ["Developer-scoped keys", "Issue and revoke write keys per developer account through admin endpoints."],
              ["Policy guardrails", "Enforce corridor, amount, and recipient checks before execution."],
            ].map(([title, description]) => (
              <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["1. Parse or quote", "Start with /intent/parse or request a quote for from/to token and amount."],
            ["2. Execute safely", "Call /transfer with developer key + idempotency key to enforce policy checks."],
            ["3. React to settlement", "Receive signed webhook events to update your agent state automatically."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-slate-300">{body}</p>
            </article>
          ))}
        </section>

        <section id="api" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white md:text-3xl">API quickstart</h2>
            <button
              type="button"
              onClick={copySnippet}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500"
            >
              {copied ? "Copied" : "Copy snippet"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-slate-800 bg-black/40 p-5 text-xs text-cyan-200 md:text-sm">
            <code>{quickstartSnippet}</code>
          </pre>
        </section>

        <section id="docs" className="grid gap-4 md:grid-cols-2">
          <a href={docsApiUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-cyan-500/40">
            <p className="text-sm font-medium text-cyan-300">/docs/api.md</p>
            <h3 className="mt-2 text-xl font-semibold text-white">API reference in repo</h3>
            <p className="mt-2 text-sm text-slate-300">Endpoint contracts, payload shapes, and auth headers.</p>
          </a>
          <a href={readmeUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-cyan-500/40">
            <p className="text-sm font-medium text-cyan-300">/README.md</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Project overview</h3>
            <p className="mt-2 text-sm text-slate-300">Architecture, setup, policy behavior, and monorepo package map.</p>
          </a>
        </section>

        <section id="security" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">Security by default</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>• HMAC-SHA256 webhook signatures with timestamp checks.</li>
            <li>• Idempotency required on transfer execution endpoints.</li>
            <li>• Developer key issuance and revocation via admin-scoped token.</li>
            <li>• Transfer guardrails for amount, corridor, and recipient requirements.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">Ship agent payments with confidence</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-cyan-100/90 md:text-base">
            Start locally with mock providers, then move to managed keys and signed webhooks for production.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={docsApiUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900">
              Get API key
            </a>
            <a href={docsApiUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-200/40 px-4 py-2 text-sm font-medium text-white">
              Read docs
            </a>
            <a href={githubUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-200/40 px-4 py-2 text-sm font-medium text-white">
              View GitHub
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>© {year} RailAgent. Built for developer teams integrating AI-driven cross-border payments.</p>
          <a href={githubUrl} target="_blank" rel="noreferrer" className="transition hover:text-white">
            github.com/tobi-techy/railagent
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
