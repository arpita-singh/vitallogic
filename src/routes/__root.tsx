import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import type { RouterContext } from "@/router";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-gradient-gold">404</h1>
        <h2 className="mt-4 font-display text-2xl text-foreground">Lost on the path</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're seeking doesn't exist or has moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 glow-gold"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Vital Logic — Your Natural Health Hub" },
      {
        name: "description",
        content:
          "AI-guided wellness consults, audited by humans. From medication to education — your personal health operating system.",
      },
      { name: "author", content: "Vital Logic" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Vital Logic — Your Natural Health Hub" },
      { name: "twitter:title", content: "Vital Logic — Your Natural Health Hub" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c53f2725-3962-4311-86ab-6784c883a33a/id-preview-cc2b0f47--c76ad899-2e2a-462d-974d-2590aeffe6ea.lovable.app-1776579310511.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c53f2725-3962-4311-86ab-6784c883a33a/id-preview-cc2b0f47--c76ad899-2e2a-462d-974d-2590aeffe6ea.lovable.app-1776579310511.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthBridge({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();

  // Inject auth into router context so beforeLoad guards see it.
  useEffect(() => {
    router.update({ context: { ...router.options.context, auth } });
    router.invalidate();
  }, [auth, router]);

  return <>{children}</>;
}

function RootComponent() {
  return (
    <AuthProvider>
      <AuthBridge>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
        <Toaster richColors position="top-center" />
      </AuthBridge>
    </AuthProvider>
  );
}
