const features = [
  {
    title: "Multilingual remittance agent",
    body: "Parse user payment intent across EN/ES/PT/FR with typo tolerance and structured outputs."
  },
  {
    title: "EUR → NGN live execution path",
    body: "Route through Celo + Mento with live scoring for fees, slippage, and expected settlement ETA."
  },
  {
    title: "Secure developer keys",
    body: "Issue scoped API keys per developer or workload and revoke instantly when risk signals change."
  },
  {
    title: "Signed webhooks",
    body: "Receive transfer lifecycle events with HMAC signatures, replay protection, and retry backoff."
  },
  {
    title: "Idempotency by design",
    body: "Prevent duplicate transfer execution with first-class idempotency keys on state-changing requests."
  },
  {
    title: "Auditable payment trail",
    body: "Track decisions, route selection, and settlement events across every transfer with structured logs."
  }
];

const steps = [
  "Create a quote using /quote and inspect route score, FX output, fees, and ETA.",
  "Submit /transfer with x-api-key and Idempotency-Key to execute safely.",
  "Listen for transfer.submitted / settled / failed signed webhooks in your agent runtime."
];

const trust = [
  "HMAC-signed webhooks with timestamp validation",
  "Configurable policy guardrails for amounts and corridors",
  "Developer-scoped API keys with revocation support",
  "Structured audit logs for quote and transfer lifecycle"
];

const pricing = ["Starter", "Pro", "Enterprise"];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface text-slate-100">
      <header className="border-b border-line/80 bg-surface/95 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="text-lg font-semibold tracking-tight">
            RailAgent
          </a>
          <ul className="flex items-center gap-5 text-sm text-slate-300">
            <li><a className="hover:text-white" href="https://github.com/tobi-techy/railagent/tree/master/docs">Docs</a></li>
            <li><a className="hover:text-white" href="https://github.com/tobi-techy/railagent">GitHub</a></li>
            <li><a className="hover:text-white" href="mailto:team@railagent.dev">Contact</a></li>
          </ul>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-20 pt-16 md:grid-cols-2 md:pt-24">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            Developer-first remittance rails for AI agents
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Move cross-border value with confidence, not custom glue code.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
            RailAgent gives your agent one clean API for quote optimization, policy-safe execution, and signed settlement events on Celo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="mailto:team@railagent.dev" className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-300">
              Get Started
            </a>
            <a href="https://github.com/tobi-techy/railagent/tree/master/docs" className="rounded-md border border-line px-5 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500">
              View Docs
            </a>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-6 shadow-2xl shadow-black/30">
          <p className="text-sm text-slate-300">Live corridor preview</p>
          <p className="mt-2 text-xl font-semibold">EUR → NGN</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-line p-3"><dt className="text-slate-400">FX Output</dt><dd className="mt-1 text-base font-semibold">₦ 1,243,900</dd></div>
            <div className="rounded-lg border border-line p-3"><dt className="text-slate-400">Settlement ETA</dt><dd className="mt-1 text-base font-semibold">~42s</dd></div>
            <div className="rounded-lg border border-line p-3"><dt className="text-slate-400">Route Score</dt><dd className="mt-1 text-base font-semibold">95.6 / 100</dd></div>
            <div className="rounded-lg border border-line p-3"><dt className="text-slate-400">Webhook Status</dt><dd className="mt-1 text-base font-semibold">Signed</dd></div>
          </dl>
        </div>
      </section>

      <section className="border-y border-line bg-panel/70">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-10 md:grid-cols-2 md:items-center">
          <h2 className="text-2xl font-semibold tracking-tight">Problem: every agent team rebuilds payments infra.</h2>
          <p className="text-slate-300">Solution: RailAgent unifies intent parsing, route optimization, policy enforcement, and settlement webhooks into one production-grade API surface.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">Feature grid</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl border border-line bg-panel p-5">
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-8 space-y-4">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-4 rounded-xl border border-line bg-panel p-5">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent">{i + 1}</span>
              <p className="text-sm leading-6 text-slate-200">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">API quickstart</h2>
        <pre className="mt-6 overflow-x-auto rounded-xl border border-line bg-black/40 p-5 text-sm leading-6 text-emerald-100">
{`curl -X POST http://localhost:3000/transfer \\
  -H 'content-type: application/json' \\
  -H 'x-api-key: <RAW_KEY>' \\
  -H 'Idempotency-Key: tx_001' \\
  -d '{
    "quoteId":"qt_demo_001",
    "recipient":"maria",
    "amount":"120",
    "fromToken":"EUR",
    "toToken":"NGN"
  }'`}
        </pre>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">Trust & security</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {trust.map((item) => (
            <li key={item} className="rounded-xl border border-line bg-panel p-5 text-sm text-slate-200">{item}</li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {pricing.map((plan) => (
            <article key={plan} className="rounded-xl border border-line bg-panel p-6">
              <h3 className="text-xl font-semibold">{plan}</h3>
              <p className="mt-2 text-sm text-slate-300">Custom corridor limits, webhook throughput, and support SLAs.</p>
              <a href="mailto:team@railagent.dev" className="mt-6 inline-flex rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-slate-500">Contact</a>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-400">
          <p>© {new Date().getFullYear()} RailAgent</p>
          <div className="flex gap-5">
            <a className="hover:text-slate-200" href="https://github.com/tobi-techy/railagent/tree/master/docs">Docs</a>
            <a className="hover:text-slate-200" href="https://github.com/tobi-techy/railagent">GitHub</a>
            <a className="hover:text-slate-200" href="https://status.example.com">API Status</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
