import { Link } from "react-router-dom";
import { MODULES } from "../../lib/api";

const GITHUB = "https://github.com/Arya71/Aegis-Healthgraph";

const PRODUCT = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Graph Explorer", to: "/graph" },
  { label: "Patient Registry", to: "/patients" },
];

const RESOURCES = [
  { label: "The ecosystem", href: "#ecosystem" },
  { label: "How it works", href: "#how" },
  { label: "Powered by Cognee", href: "#cognee" },
  { label: "FAQ", href: "#faq" },
];

const LEGAL = ["Privacy", "Terms", "HIPAA", "Security"];

export default function Footer() {
  return (
    <footer className="border-t border-line/10">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🧠</span>
            <div>
              <div className="gradient-text text-base font-extrabold leading-none">Aegis</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-fg/40">HealthGraph</div>
            </div>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg/50">
            The healthcare AI that remembers the patient — one lifelong knowledge graph, six agents
            reasoning over it together.
          </p>
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm text-fg/55 transition hover:text-fg"
          >
            ★ GitHub
          </a>
        </div>

        <FooterCol title="Product">
          {PRODUCT.map((l) => (
            <Link key={l.to} to={l.to} className="block text-sm text-fg/55 transition hover:text-fg">
              {l.label}
            </Link>
          ))}
        </FooterCol>

        <FooterCol title="Modules">
          {MODULES.map((m) => (
            <Link key={m.key} to={`/${m.key}`} className="block text-sm text-fg/55 transition hover:text-fg">
              {m.name}
            </Link>
          ))}
        </FooterCol>

        <FooterCol title="Resources">
          {RESOURCES.map((l) => (
            <a key={l.href} href={l.href} className="block text-sm text-fg/55 transition hover:text-fg">
              {l.label}
            </a>
          ))}
        </FooterCol>

        <FooterCol title="Legal">
          {LEGAL.map((l) => (
            <a key={l} href="#" className="block text-sm text-fg/55 transition hover:text-fg">
              {l}
            </a>
          ))}
        </FooterCol>
      </div>

      <div className="border-t border-line/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5 text-xs text-fg/35">
          <span>© 2026 Aegis HealthGraph · Built for the WeMakeDevs × Cognee hackathon.</span>
          <span>Demo on mock data — not for clinical use.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg/40">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
