import { Link } from "@tanstack/react-router";
import logo from "@/assets/vital-logic-logo.svg";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-surface/40 mt-20">
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Vital Logic" className="h-9 w-9" />
              <span className="font-display text-xl">
                Vital <span className="text-gradient-gold">Logic</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              From medication to education. The world's first AI-guided, human-audited health
              operating system.
            </p>
          </div>

          <div>
            <h3 className="font-display text-base text-gold">Explore</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/philosophy" className="text-muted-foreground hover:text-foreground">Philosophy</Link></li>
              <li><Link to="/pillars" className="text-muted-foreground hover:text-foreground">Four Pillars</Link></li>
              <li><Link to="/journey" className="text-muted-foreground hover:text-foreground">Journey</Link></li>
              <li><Link to="/origins" className="text-muted-foreground hover:text-foreground">Origins</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-base text-gold">Begin</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/consult" className="text-muted-foreground hover:text-foreground">Start consult</Link></li>
              <li><Link to="/integrity" className="text-muted-foreground hover:text-foreground">Our integrity</Link></li>
            </ul>
          </div>
        </div>

        <div className="divider-gold mt-12" />

        <div className="mt-6 space-y-3 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            <span className="font-medium text-foreground/80">Important:</span> Vital Logic is not a
            substitute for professional medical care. Recommendations are educational and reviewed
            by qualified practitioners, but they do not replace diagnosis or treatment from a
            licensed clinician. In an emergency, call your local emergency number.
          </p>
          <p>© {new Date().getFullYear()} Vital Logic. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
