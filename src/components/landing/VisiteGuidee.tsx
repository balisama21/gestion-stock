import React from "react";
import { BarChart3, Boxes, CreditCard, ShoppingCart, Truck, Wallet } from "lucide-react";
import { Revele } from "./Revele";
import { CaptureAnnotee, type Repere } from "./CaptureAnnotee";
import caisse from "./visite/caisse.jpg";
import caissePetit from "./visite/caisse-420.jpg";
import stock from "./visite/stock.jpg";
import stockPetit from "./visite/stock-800.jpg";
import creances from "./visite/creances.jpg";
import creancesPetit from "./visite/creances-800.jpg";
import tresorerie from "./visite/tresorerie.jpg";
import tresoreriePetit from "./visite/tresorerie-800.jpg";
import commandes from "./visite/commandes.jpg";
import commandesPetit from "./visite/commandes-800.jpg";
import tableau from "./visite/tableau.jpg";
import tableauPetit from "./visite/tableau-800.jpg";
import facture from "./visite/facture.jpg";
import facturePetit from "./visite/facture-500.jpg";
import ticket from "./visite/ticket.jpg";

/**
 * La visite guidée : une vraie boutique, puis le vrai écran.
 *
 * Chaque étape s'ouvre sur une photo du métier — le comptoir, la réserve,
 * le marché, le camion — pour que le visiteur s'y reconnaisse, puis montre
 * l'écran de l'application qui lui correspond, ses éléments désignés par
 * des numéros. Les dessins qui tenaient ce rôle disaient l'idée ; les
 * captures montrent le produit tel qu'on l'utilisera.
 *
 * Les captures viennent d'une boutique de démonstration aux données
 * inventées. Les photos sont publiées sous licence Unsplash (usage libre,
 * y compris commercial), servies par leur CDN à la largeur demandée,
 * comme celles du tableau de bord.
 */

const photo = (id: string, largeur: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${largeur}&q=70`;

interface Etape {
  numero: string;
  icone: React.ElementType;
  etiquette: string;
  titre: string;
  texte: string;
  points: string[];
  photo: { id: string; legende: string; cadrage?: string };
  capture: {
    src: string;
    petit: string;
    largeur: number;
    hauteur: number;
    ecran: string;
    alt: string;
    largeurMax?: string;
    reperes: Repere[];
  };
}

const ETAPES: Etape[] = [
  {
    numero: "01",
    icone: ShoppingCart,
    etiquette: "Au comptoir",
    titre: "Une vente encaissée en quelques secondes",
    texte:
      "Le client attend : on scanne ou on choisit le produit, on ajuste la quantité, on encaisse. Le ticket sort aussitôt.",
    points: [
      "Plusieurs articles sur un même ticket",
      "Prix prérempli, modifiable pour une vente",
      "Payé comptant, en partie, ou à crédit",
    ],
    photo: {
      id: "1687422808311-a776f467a468",
      legende: "Au comptoir, le panier se remplit pendant que le client attend.",
      cadrage: "50% 40%",
    },
    capture: {
      src: caisse,
      petit: caissePetit,
      largeur: 767,
      hauteur: 1603,
      ecran: "Ventes · Nouvelle vente",
      alt: "Formulaire de nouvelle vente avec un panier de deux articles",
      largeurMax: "23rem",
      reperes: [
        {
          x: 49.9,
          y: 22.5,
          cote: "gauche",
          titre: "Scanner ou choisir",
          texte: "Le code-barres retrouve le produit ; la liste montre ce qui reste en stock.",
        },
        {
          x: 40,
          y: 57.3,
          cote: "gauche",
          titre: "Le panier",
          texte: "Chaque article, sa quantité et son prix. On en ajoute autant qu'il faut.",
        },
        {
          x: 73.9,
          y: 14.8,
          cote: "droite",
          titre: "Le vendeur",
          texte: "Chaque vente lui est attribuée : son chiffre et sa caisse sont suivis à part.",
        },
        {
          x: 90,
          y: 85.2,
          cote: "droite",
          titre: "Payé ou à crédit",
          texte: "Si le client paie une partie, le reste devient une créance, toute seule.",
        },
        {
          x: 66,
          y: 96.1,
          cote: "droite",
          titre: "Valider",
          texte: "Le stock baisse, la caisse monte, le reçu s'imprime.",
        },
      ],
    },
  },
  {
    numero: "02",
    icone: Boxes,
    etiquette: "Dans la réserve",
    titre: "Le stock se tient tout seul",
    texte:
      "Chaque achat ajoute, chaque vente retire, chaque commande réserve. Vous voyez ce qui manque avant que le client ne le demande.",
    points: [
      "Seuil d'alerte par produit",
      "Valeur du stock au prix d'achat",
      "Correction d'inventaire tracée, avec son motif",
    ],
    photo: {
      id: "1707059259782-21afb503b751",
      legende: "Ce qui est sur l'étagère est ce que l'écran affiche.",
    },
    capture: {
      src: stock,
      petit: stockPetit,
      largeur: 1600,
      hauteur: 1364,
      ecran: "Produits",
      alt: "Liste des produits avec leurs prix, leur stock et les alertes",
      reperes: [
        {
          x: 4.3,
          y: 17.3,
          cote: "gauche",
          titre: "Le stock en chiffres",
          texte: "Nombre de références, valeur du stock, produits à racheter.",
        },
        {
          x: 5.7,
          y: 39.8,
          cote: "gauche",
          titre: "Chaque produit",
          texte: "Son prix de vente, son prix d'achat, son fournisseur.",
        },
        {
          x: 95.5,
          y: 7.1,
          cote: "droite",
          titre: "Un produit en une minute",
          texte: "Désignation, prix, stock de départ et seuil d'alerte.",
        },
        {
          x: 94.5,
          y: 51.1,
          cote: "droite",
          titre: "Sous le seuil",
          texte: "L'orange signale qu'il est temps de racheter.",
        },
        {
          x: 94.5,
          y: 79.4,
          cote: "droite",
          titre: "Rupture",
          texte: "Impossible de vendre plus que ce qui reste.",
        },
      ],
    },
  },
  {
    numero: "03",
    icone: CreditCard,
    etiquette: "Les crédits clients",
    titre: "Qui vous doit quoi, sans chercher",
    texte:
      "Les ventes à crédit et les commandes non soldées se rangent d'elles-mêmes. Un paiement reçu ? Un clic, et le reste diminue.",
    points: [
      "Total à recevoir toujours à jour",
      "Historique des paiements de chaque client",
      "Espèces, Mobile Money ou virement",
    ],
    photo: {
      id: "1687422809654-579d81c29d32",
      legende: "Le client revient payer : le solde se met à jour aussitôt.",
      cadrage: "50% 35%",
    },
    capture: {
      src: creances,
      petit: creancesPetit,
      largeur: 1600,
      hauteur: 1082,
      ecran: "Paiements à recevoir",
      alt: "Liste des ventes et commandes restant à encaisser",
      reperes: [
        {
          x: 16,
          y: 25.2,
          cote: "gauche",
          titre: "Le total à recevoir",
          texte: "Tout ce que vos clients vous doivent, en un chiffre.",
        },
        {
          x: 9.2,
          y: 59.8,
          cote: "gauche",
          titre: "Chaque pièce",
          texte: "Vente ou commande, avec le nom du client.",
        },
        {
          x: 91,
          y: 41.9,
          cote: "droite",
          titre: "Recevoir",
          texte: "Montant, mode de paiement : c'est enregistré.",
        },
        {
          x: 80.5,
          y: 51.5,
          cote: "droite",
          titre: "Le reste dû",
          texte: "Ce qui manque encore, sur le total de la vente.",
        },
      ],
    },
  },
  {
    numero: "04",
    icone: Wallet,
    etiquette: "La caisse",
    titre: "Votre trésorerie, au franc près",
    texte:
      "Ce qui est entré, ce qui est sorti, ce qu'il reste. Chaque montant se rattache à une vente, un achat ou une dépense.",
    points: [
      "Alerte si la trésorerie passe sous votre seuil",
      "Apports, dépenses et remboursements",
      "Le détail jour par jour dans l'historique",
    ],
    photo: {
      id: "1579621970795-87facc2f976d",
      legende: "Chaque ariary entré ou sorti a sa ligne.",
    },
    capture: {
      src: tresorerie,
      petit: tresoreriePetit,
      largeur: 1600,
      hauteur: 1136,
      ecran: "Capital & trésorerie",
      alt: "Écran de trésorerie avec la composition des entrées et sorties",
      reperes: [
        {
          x: 18.5,
          y: 24.8,
          cote: "gauche",
          titre: "L'argent disponible",
          texte: "Ce qu'il y a dans la caisse, maintenant.",
        },
        {
          x: 96,
          y: 8.5,
          cote: "droite",
          titre: "Ajouter un apport",
          texte: "Une injection d'argent, notée avec sa source.",
        },
        {
          x: 93.4,
          y: 20.1,
          cote: "droite",
          titre: "Saine ou basse",
          texte: "Le signal passe à l'orange sous votre seuil.",
        },
        {
          x: 96.2,
          y: 59,
          cote: "droite",
          titre: "Ce qui est entré",
          texte: "Les ventes et commandes encaissées.",
        },
        {
          x: 96.2,
          y: 66.5,
          cote: "droite",
          titre: "Ce qui est sorti",
          texte: "Les achats de stock et les dépenses.",
        },
      ],
    },
  },
  {
    numero: "05",
    icone: Truck,
    etiquette: "Commandes et livraisons",
    titre: "De la commande à la livraison",
    texte:
      "Une commande réserve la marchandise pour le client. Livrée, elle sort du stock ; annulée, elle est remboursée.",
    points: [
      "Stock réservé, jamais vendu deux fois",
      "Paiements par acomptes",
      "Bon de commande imprimable",
    ],
    photo: {
      id: "1601584115197-04ecc0da31d7",
      legende: "La marchandise part : le stock et la commande suivent.",
    },
    capture: {
      src: commandes,
      petit: commandesPetit,
      largeur: 1600,
      hauteur: 977,
      ecran: "Commandes",
      alt: "Liste des commandes avec leur statut et leur paiement",
      reperes: [
        {
          x: 12.7,
          y: 52.6,
          cote: "gauche",
          titre: "Statut et paiement",
          texte: "En attente, en cours, livré · impayé, partiel, payé.",
        },
        {
          x: 26.6,
          y: 91.6,
          cote: "gauche",
          titre: "Marquer livré",
          texte: "La marchandise réservée sort du stock.",
        },
        {
          x: 92.3,
          y: 29.2,
          cote: "droite",
          titre: "Les impayés",
          texte: "Ce qui reste à encaisser sur les commandes.",
        },
        {
          x: 54.1,
          y: 82.6,
          cote: "droite",
          titre: "Total, payé, reste",
          texte: "Chaque commande, au clair.",
        },
      ],
    },
  },
];

const ICONES_CYCLE = [
  { icone: ShoppingCart, nom: "Acheter", ecran: "Achats" },
  { icone: Boxes, nom: "Stocker", ecran: "Produits" },
  { icone: CreditCard, nom: "Vendre", ecran: "Ventes, commandes" },
  { icone: Wallet, nom: "Encaisser", ecran: "Paiements, facturation" },
  { icone: BarChart3, nom: "Piloter", ecran: "Tableau de bord, bilan" },
];

/** Le cycle d'une boutique : cinq étapes reliées par des flèches. */
const Cycle: React.FC = () => {
  const cx = 260;
  const cy = 230;
  const r = 165;
  const pos = ICONES_CYCLE.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / ICONES_CYCLE.length;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), a };
  });
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <svg viewBox="0 0 520 460" className="block h-auto w-full" aria-hidden>
        <defs>
          <marker
            id="cy-pointe"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--primary)" />
          </marker>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="color-mix(in srgb, var(--primary) 16%, transparent)"
          strokeWidth="22"
        />
        {pos.map((p, i) => {
          const a1 = p.a + 0.42;
          const a2 = p.a + (2 * Math.PI) / ICONES_CYCLE.length - 0.42;
          return (
            <path
              key={i}
              d={`M${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} A${r},${r} 0 0 1 ${cx + r * Math.cos(a2)},${cy + r * Math.sin(a2)}`}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              markerEnd="url(#cy-pointe)"
            />
          );
        })}
        <circle cx={cx} cy={cy} r="78" fill="var(--primary)" />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">
          Une saisie,
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">
          tout suit
        </text>
      </svg>
      {ICONES_CYCLE.map(({ icone: Icone, nom, ecran }, i) => (
        <div
          key={nom}
          className="absolute flex w-[8.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border bg-white px-3 py-2.5 text-center"
          style={{
            left: `${(pos[i].x / 520) * 100}%`,
            top: `${(pos[i].y / 460) * 100}%`,
            borderColor: "var(--reglure)",
            boxShadow: "0 10px 24px -14px rgba(28,27,24,.45)",
          }}
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              background: "color-mix(in srgb, var(--primary) 14%, transparent)",
              color: "var(--primary)",
            }}
          >
            <Icone className="h-4 w-4" />
          </span>
          <span className="mt-1 text-[0.9rem] font-bold" style={{ color: "var(--carbone)" }}>
            {nom}
          </span>
          <span className="text-[0.7rem] leading-tight" style={{ color: "var(--carbone-doux)" }}>
            {ecran}
          </span>
        </div>
      ))}
    </div>
  );
};

const Pastille: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold"
    style={{
      background: "color-mix(in srgb, var(--terre) 12%, transparent)",
      color: "var(--terre)",
    }}
  >
    {children}
  </span>
);

const BlocPhoto: React.FC<{ etape: Etape; aDroite: boolean }> = ({ etape, aDroite }) => {
  const Icone = etape.icone;
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={aDroite ? "lg:order-2" : undefined}>
        <div className="relative">
          <img
            src={photo(etape.photo.id, 1100)}
            srcSet={`${photo(etape.photo.id, 640)} 640w, ${photo(etape.photo.id, 1100)} 1100w`}
            sizes="(min-width: 1024px) 34rem, 100vw"
            width={1100}
            height={733}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[3/2] w-full rounded-3xl object-cover"
            style={{
              objectPosition: etape.photo.cadrage ?? "50% 50%",
              boxShadow: "0 30px 60px -30px rgba(28,27,24,.5)",
            }}
          />
          <span
            className="absolute -top-5 left-6 grid h-14 w-14 place-items-center rounded-full font-mono text-lg font-bold text-white"
            style={{ background: "var(--primary)", boxShadow: "0 8px 20px -8px rgba(0,0,0,.45)" }}
          >
            {etape.numero}
          </span>
          <p
            className="absolute bottom-4 left-4 right-4 rounded-xl px-4 py-2.5 text-[0.85rem] font-medium backdrop-blur-md sm:right-auto sm:max-w-[80%]"
            style={{ background: "rgba(253,252,250,.88)", color: "var(--carbone)" }}
          >
            {etape.photo.legende}
          </p>
        </div>
      </div>
      <div className={aDroite ? "lg:order-1" : undefined}>
        <Pastille>
          <Icone className="h-4 w-4" />
          {etape.etiquette}
        </Pastille>
        <h3 className="titre-section mt-4 text-[clamp(1.5rem,3.6vw,2.2rem)] font-bold leading-tight tracking-tight">
          {etape.titre}
        </h3>
        <p
          className="mt-4 text-[1.0625rem] leading-relaxed"
          style={{ color: "var(--carbone-doux)" }}
        >
          {etape.texte}
        </p>
        <ul className="mt-5 space-y-2.5">
          {etape.points.map((p) => (
            <li
              key={p}
              className="flex items-start gap-2.5 text-[0.95rem]"
              style={{ color: "var(--carbone)" }}
            >
              <span
                className="mt-1 grid h-5 w-5 flex-none place-items-center rounded-full text-[0.7rem] font-bold text-white"
                style={{ background: "var(--primary)" }}
              >
                ✓
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const VisiteGuidee: React.FC = () => (
  <section
    id="visite"
    className="reglure relative scroll-mt-16 overflow-hidden px-5 py-20 sm:py-28"
  >
    <div className="relative mx-auto max-w-7xl">
      {/* Le principe, en un schéma. */}
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <Revele>
          <Pastille>Visite guidée</Pastille>
          <h2 className="titre-section mt-6 max-w-[18ch] text-[clamp(1.8rem,5vw,2.9rem)] font-bold leading-[1.1] tracking-tight">
            Ce que vous notiez à la main, l'application le tient pour vous
          </h2>
          <p
            className="mt-5 max-w-[50ch] text-[1.0625rem] leading-relaxed"
            style={{ color: "var(--carbone-doux)" }}
          >
            Une vente saisie une fois se retrouve dans le stock, dans la caisse et dans le bilan.
            Suivez une journée de boutique, du comptoir à la caisse : voici les vrais écrans de
            l'application.
          </p>
        </Revele>
        <Revele delai={120}>
          <Cycle />
        </Revele>
      </div>

      {/* Les étapes : la photo du métier, puis l'écran expliqué. */}
      <div className="mt-24 space-y-28 sm:space-y-36">
        {ETAPES.map((etape, i) => (
          <div key={etape.numero}>
            <Revele>
              <BlocPhoto etape={etape} aDroite={i % 2 === 1} />
            </Revele>
            <Revele delai={80} className="mt-12">
              <CaptureAnnotee
                src={etape.capture.src}
                srcPetit={etape.capture.petit}
                largeur={etape.capture.largeur}
                hauteur={etape.capture.hauteur}
                alt={etape.capture.alt}
                ecran={etape.capture.ecran}
                largeurMax={etape.capture.largeurMax}
                reperes={etape.capture.reperes}
              />
            </Revele>
          </div>
        ))}
      </div>

      {/* Le tableau de bord : tout se retrouve ici. */}
      <div className="mt-28 sm:mt-36">
        <Revele className="text-center">
          <Pastille>
            <BarChart3 className="h-4 w-4" />
            Chaque matin
          </Pastille>
          <h3 className="titre-section mx-auto mt-4 max-w-[22ch] text-[clamp(1.5rem,3.6vw,2.2rem)] font-bold leading-tight tracking-tight">
            Toute la boutique d'un coup d'œil
          </h3>
          <p
            className="mx-auto mt-4 max-w-[56ch] text-[1.0625rem] leading-relaxed"
            style={{ color: "var(--carbone-doux)" }}
          >
            Le tableau de bord rassemble ce que les écrans précédents ont enregistré : les ventes du
            jour, l'argent entré et sorti, le stock qui baisse, et ce qui attend.
          </p>
        </Revele>
        <Revele delai={80} className="mt-12">
          <CaptureAnnotee
            src={tableau}
            srcPetit={tableauPetit}
            largeur={1413}
            hauteur={1170}
            alt="Tableau de bord avec les ventes du jour, les entrées et sorties d'argent et le stock"
            ecran="Tableau de bord"
            reperes={[
              {
                x: 21.6,
                y: 28.1,
                cote: "gauche",
                titre: "Les alertes du jour",
                texte: "Tâches en retard, produits à racheter.",
              },
              {
                x: 18.5,
                y: 48.1,
                cote: "gauche",
                titre: "Ventes du jour",
                texte: "Comparées à la veille.",
              },
              {
                x: 46.1,
                y: 48.1,
                cote: "gauche",
                titre: "Entrées d'argent",
                texte: "Ce qui a été encaissé aujourd'hui.",
              },
              {
                x: 38.2,
                y: 95,
                cote: "gauche",
                titre: "La courbe du mois",
                texte: "Les ventes, jour après jour.",
              },
              {
                x: 59.2,
                y: 48.1,
                cote: "droite",
                titre: "Sorties d'argent",
                texte: "Achats et dépenses du jour et du mois.",
              },
              {
                x: 86.3,
                y: 58.4,
                cote: "droite",
                titre: "À recommander",
                texte: "Les produits à racheter avant qu'ils manquent.",
              },
            ]}
          />
        </Revele>
      </div>

      {/* Les documents. */}
      <div className="mt-28 sm:mt-36">
        <Revele className="text-center">
          <Pastille>Ce que vous remettez au client</Pastille>
          <h3 className="titre-section mx-auto mt-4 max-w-[24ch] text-[clamp(1.5rem,3.6vw,2.2rem)] font-bold leading-tight tracking-tight">
            Un ticket ou une facture, prêts en un clic
          </h3>
          <p
            className="mx-auto mt-4 max-w-[56ch] text-[1.0625rem] leading-relaxed"
            style={{ color: "var(--carbone-doux)" }}
          >
            Ticket de caisse 58 ou 80 mm, facture A4 à vos couleurs, devis et proformas : imprimés,
            enregistrés en PDF ou envoyés par WhatsApp.
          </p>
        </Revele>
        <Revele delai={80} className="mt-12">
          <div className="grid items-center gap-10 lg:grid-cols-[15rem_1fr]">
            <figure className="m-0 mx-auto w-full max-w-[15rem]">
              <img
                src={ticket}
                width={470}
                height={745}
                alt="Ticket de caisse de 80 mm avec son code-barres"
                loading="lazy"
                decoding="async"
                className="block h-auto w-full rotate-[-2deg] rounded-lg"
                style={{ boxShadow: "0 24px 50px -24px rgba(28,27,24,.5)" }}
              />
              <figcaption
                className="mt-4 text-center text-[0.85rem]"
                style={{ color: "var(--carbone-doux)" }}
              >
                Le ticket 80 mm, avec le code-barres du numéro de vente.
              </figcaption>
            </figure>
            <CaptureAnnotee
              src={facture}
              srcPetit={facturePetit}
              largeur={900}
              hauteur={1275}
              alt="Facture A4 avec le tampon Reste à payer et le montant en lettres"
              ecran="Facture A4"
              largeurMax="26rem"
              reperes={[
                {
                  x: 10.5,
                  y: 7.2,
                  cote: "gauche",
                  titre: "Votre identité",
                  texte: "Logo, coordonnées, NIF et STAT.",
                },
                {
                  x: 29.2,
                  y: 42,
                  cote: "gauche",
                  titre: "Le détail",
                  texte: "Articles, quantités, prix.",
                },
                {
                  x: 7.5,
                  y: 55.2,
                  cote: "gauche",
                  titre: "Le montant en lettres",
                  texte: "La mention qui tranche en cas de désaccord.",
                },
                {
                  x: 93.8,
                  y: 20.4,
                  cote: "droite",
                  titre: "Le tampon",
                  texte: "Payé, ou reste à payer.",
                },
                {
                  x: 94,
                  y: 61.4,
                  cote: "droite",
                  titre: "Total et reste dû",
                  texte: "Ce qui a été réglé et ce qui manque.",
                },
              ]}
            />
          </div>
        </Revele>
      </div>

      <p className="mt-16 text-center text-[0.75rem]" style={{ color: "var(--carbone-doux)" }}>
        Écrans de l'application, chiffres d'exemple · Photos : Unsplash
      </p>
    </div>
  </section>
);
