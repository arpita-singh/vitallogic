import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/section";

export const Route = createFileRoute("/unauthorized")({
  head: () => ({
    meta: [{ title: "Unauthorized — Vital Logic" }],
  }),
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <Section className="py-24">
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-5xl text-gradient-gold">Access restricted</h1>
        <p className="mt-4 text-muted-foreground">
          This area is reserved for verified Vital Logic experts. If you believe this is an error,
          please contact your administrator.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground glow-gold"
        >
          Return home
        </Link>
      </div>
    </Section>
  );
}
