import { AuthProvider } from "../hooks/useAuth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { installerRepriseApresDeploiement } from "../lib/chunkRecovery";
import { enregistrerServiceWorker } from "../lib/pwa";
import { accorderLaBarreDEtat } from "../lib/couleurDeBarre";
import { InstallPrompt } from "../components/shared/InstallPrompt";
import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE } from "../lib/appConfig";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // `viewport-fit=cover` : la page occupe TOUT l'ecran, y compris
      // sous la barre d'etat et sous la barre de gestes. Sans lui, le
      // systeme reserve ces bandes et les peint de sa propre couleur —
      // un bandeau noir en haut du telephone — et, surtout, toutes les
      // valeurs `env(safe-area-inset-*)` valent zero : le code qui les
      // emploie deja pour ecarter la barre du bas ne servait a rien.
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: APP_NAME },
      {
        name: "description",
        content: APP_TAGLINE,
      },
      { name: "author", content: APP_NAME },
      { property: "og:title", content: APP_NAME },
      {
        property: "og:description",
        content: APP_TAGLINE,
      },

      { property: "og:type", content: "website" },
      // La barre d'etat prend la couleur de ce qui se trouve JUSTE en
      // dessous d'elle, c'est-a-dire l'en-tete de l'application. Le vert
      // de la marque y ferait un bandeau colore la ou l'on veut
      // justement n'en voir aucun.
      //
      // Cette valeur-ci n'est que la premiere, celle du mode clair,
      // servie avant que le code ne s'execute ; `accorderLaBarreDEtat`
      // prend le relais et la garde accordee au theme reellement
      // affiche. Une seule balise ici, et c'est necessaire : le
      // gestionnaire d'en-tete dedoublonne les metas par leur `name` et
      // n'en garderait qu'une de toute facon.
      { name: "theme-color", content: "#ffffff" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: APP_SHORT_NAME },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // iOS ignore le manifeste pour l icone de l ecran d accueil, et
      // remplit de noir toute transparence : icone carree et opaque.
      { rel: "apple-touch-icon", href: "/icon-apple-180.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
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
  const { queryClient } = Route.useRouteContext();

  // Un onglet resté ouvert pendant une mise en ligne réclame des
  // fichiers qui n’existent plus. On le détecte et on recharge, une
  // seule fois, plutôt que de laisser une erreur technique à l’écran.
  useEffect(() => {
    installerRepriseApresDeploiement();
    enregistrerServiceWorker();
  }, []);

  // La barre d'etat du telephone suit l'en-tete de l'application,
  // clair comme sombre, plutot que de rester un bandeau noir.
  useEffect(() => accorderLaBarreDEtat(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <InstallPrompt />
      </AuthProvider>
    </QueryClientProvider>
  );
}