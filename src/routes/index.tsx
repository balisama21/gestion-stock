import { createFileRoute } from "@tanstack/react-router";
import BalsamaApp from "../BalsamaApp";
import { APP_NAME, APP_TAGLINE } from "../lib/appConfig";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Stock, Ventes & Trésorerie` },
      {
        name: "description",
        content: APP_TAGLINE,
      },
      { property: "og:title", content: `${APP_NAME} — Stock & Trésorerie` },
      {
        property: "og:description",
        content: APP_TAGLINE,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BalsamaApp,
});
