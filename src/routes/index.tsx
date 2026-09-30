import { createFileRoute } from "@tanstack/react-router";
import BalsamaApp from "../BalsamaApp";
import { APP_NAME } from "../lib/appConfig";
import { marqueCourante, titreDePage } from "../lib/marque";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: titreDePage(
          marqueCourante(),
          `${APP_NAME} — Stock, ventes, clients, facturation & trésorerie`,
        ),
      },
      {
        name: "description",
        content: marqueCourante().slogan,
      },
      {
        property: "og:title",
        content: titreDePage(
          marqueCourante(),
          `${APP_NAME} — La gestion tout-en-un de votre entreprise`,
        ),
      },
      {
        property: "og:description",
        content: marqueCourante().slogan,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BalsamaApp,
});
