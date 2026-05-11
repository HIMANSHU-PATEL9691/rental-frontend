import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { StoreProvider } from "@/data/store";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gold">ARIHANT COLLECTION</p>
        <h1 className="mt-3 font-display text-7xl text-foreground">404</h1>
        <h2 className="mt-2 font-display text-2xl text-foreground">Page not found</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          This piece is not in our atelier. Try the dashboard.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gold px-5 py-2 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold/90"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ARIHANT COLLECTION" },
      {
        name: "description",
        content: "Rental point",
      },
      { name: "author", content: "ARIHANT COLLECTION" },
      { property: "og:title", content: "ARIHANT COLLECTION" },
      {
        property: "og:description",
        content: "Rental point",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
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

function RootComponent() {
  return (
    <StoreProvider>
      <Outlet />
      <Toaster />
    </StoreProvider>
  );
}
