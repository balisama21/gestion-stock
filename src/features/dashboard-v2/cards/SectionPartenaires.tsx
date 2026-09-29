import React, { useMemo, useState } from "react";
import { Icone, type NomIcone } from "../../../components/shared/Icone";
import { AvatarInitiale } from "../../../components/shared/AvatarInitiale";
import { Lead, Lien, TeteCarte, Vide, type TonIcone } from "../components/Tn";
import { dateLocale, montant, nombre } from "../lib/format";
import { dateDuJour, dateDansNJours } from "../../../lib/dates";
import type { ChiffresFournisseurs } from "../lib/chiffres";
import type { Purchase } from "../../../types";
import { illVideArgent } from "../assets/images";

/**
 * FOURNISSEURS & PRESTATAIRES
 *
 * Les deux annuaires de la boutique, lus tels que l'application les
 * charge (`suppliers`, `providers`), avec ce qui leur est dû. La
 * recherche, le filtre de statut et la pagination n'agissent que sur
 * l'affichage ; ajouter, modifier ou supprimer une fiche se fait dans
 * les écrans Fournisseurs et Prestataires, où mènent les boutons.
 */

export interface FicheFournisseur {
  id: string;
  nom: string;
  entreprise: string | null;
  categorie: string | null;
  produits_fournis: string[] | null;
  telephone: string | null;
  statut: string;
  created_at: string;
}

export interface FichePrestataire {
  id: string;
  nom: string;
  entreprise: string | null;
  type_service: string | null;
  telephone: string | null;
  statut: string;
  created_at: string;
}

export interface ReglementFournisseur {
  date: string;
  montant: number;
  purchase_id?: string;
  created_at?: string;
}

const PAR_PAGE = 5;
type Filtre = "tous" | "actif" | "inactif";
const FILTRES: Filtre[] = ["tous", "actif", "inactif"];
const LIBELLE_FILTRE: Record<Filtre, string> = {
  tous: "Tous",
  actif: "Actifs",
  inactif: "Inactifs",
};

const statutDe = (s: string | null | undefined) =>
  (s ?? "actif") === "inactif" ? "inactif" : "actif";

interface Ligne {
  id: string;
  nom: string;
  activite: string;
  contact: string;
  statut: "actif" | "inactif";
}

/** Un annuaire : recherche, filtre de statut, tableau paginé. */
const Annuaire: React.FC<{
  titre: string;
  lead: NomIcone;
  colonne: string;
  placeholder: string;
  ajouter: string;
  lignes: Ligne[];
  onOuvrir?: () => void;
}> = ({ titre, lead, colonne, placeholder, ajouter, lignes, onOuvrir }) => {
  const [texte, setTexte] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [page, setPage] = useState(0);

  const visibles = useMemo(() => {
    const q = texte.trim().toLowerCase();
    return lignes.filter(
      (l) =>
        (filtre === "tous" || l.statut === filtre) &&
        (!q || [l.nom, l.activite, l.contact].some((v) => v.toLowerCase().includes(q))),
    );
  }, [lignes, texte, filtre]);

  const pages = Math.max(1, Math.ceil(visibles.length / PAR_PAGE));
  const courante = Math.min(page, pages - 1);
  const tranche = visibles.slice(courante * PAR_PAGE, courante * PAR_PAGE + PAR_PAGE);
  const suivant = FILTRES[(FILTRES.indexOf(filtre) + 1) % FILTRES.length];

  return (
    <article className="card annuaire">
      <TeteCarte
        lead={<Lead nom={lead} />}
        titre={titre}
        action={<Lien onClick={onOuvrir}>Voir tout</Lien>}
      />
      <div className="f-search">
        <label className="in">
          <Icone nom="search" />
          <input
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              setPage(0);
            }}
            placeholder={placeholder}
            aria-label={placeholder.replace("...", "")}
          />
          <button
            type="button"
            className={`filtre${filtre !== "tous" ? " actif" : ""}`}
            onClick={() => {
              setFiltre(suivant);
              setPage(0);
            }}
            aria-label={`Statut : ${LIBELLE_FILTRE[filtre]}. Afficher : ${LIBELLE_FILTRE[suivant]}`}
            title={`Statut : ${LIBELLE_FILTRE[filtre]}`}
          >
            <Icone nom="filter" />
            {filtre !== "tous" && <span>{LIBELLE_FILTRE[filtre]}</span>}
          </button>
        </label>
        {onOuvrir && (
          <button type="button" className="btn pri" onClick={onOuvrir}>
            <Icone nom="plus" />
            {ajouter}
          </button>
        )}
      </div>

      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Nom</th>
              <th>{colonne}</th>
              <th>Contact</th>
              <th>Statut</th>
              <th className="centre">Actions</th>
            </tr>
          </thead>
          {tranche.length > 0 && (
            <tbody>
              {tranche.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="nmc">
                      <AvatarInitiale nom={l.nom} taille={32} />
                      {l.nom}
                    </div>
                  </td>
                  <td>{l.activite || "—"}</td>
                  <td className="nowrap">{l.contact || "—"}</td>
                  <td>
                    <span className={`pill${l.statut === "inactif" ? " off" : ""}`}>
                      {l.statut === "inactif" ? "Inactif" : "Actif"}
                    </span>
                  </td>
                  <td className="centre">
                    <button
                      type="button"
                      className="dots-b"
                      onClick={onOuvrir}
                      disabled={!onOuvrir}
                      aria-label={`Ouvrir la fiche de ${l.nom}`}
                    >
                      <Icone nom="dots" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      {tranche.length === 0 && (
        <Vide
          image={illVideArgent}
          largeur={110}
          titre={
            lignes.length === 0
              ? `Aucun ${titre.toLowerCase().slice(0, -1)} enregistré`
              : "Aucun résultat"
          }
          detail={
            lignes.length === 0
              ? "Les fiches apparaîtront ici une fois créées."
              : "Modifiez la recherche ou le filtre de statut."
          }
        />
      )}

      <div className="pager">
        <span>
          {visibles.length === 0
            ? "0 sur 0"
            : `${courante * PAR_PAGE + 1}-${courante * PAR_PAGE + tranche.length} sur ${visibles.length}`}
        </span>
        {pages > 1 && (
          <div className="p">
            <button
              type="button"
              aria-label="Page précédente"
              disabled={courante === 0}
              onClick={() => setPage(courante - 1)}
            >
              <Icone nom="chevleft" />
            </button>
            {Array.from({ length: pages }, (_, i) => i)
              .filter((i) => pages <= 5 || Math.abs(i - courante) <= 2)
              .map((i) => (
                <button
                  key={i}
                  type="button"
                  className={i === courante ? "on" : undefined}
                  aria-current={i === courante ? "page" : undefined}
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </button>
              ))}
            <button
              type="button"
              aria-label="Page suivante"
              disabled={courante >= pages - 1}
              onClick={() => setPage(courante + 1)}
            >
              <Icone nom="chevright" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

/** « Aujourd'hui 10:24 », « Hier », « 28 sept. 2026 ». */
function quand(jour: string, instant?: string): string {
  const aujourdhui = dateDuJour();
  const hier = dateDansNJours(-1);
  const h = instant
    ? ` ${new Date(instant).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : "";
  if (jour === aujourdhui) return `Aujourd'hui${h}`;
  if (jour === hier) return `Hier${h}`;
  return dateLocale(jour).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const SectionPartenaires: React.FC<{
  fournisseurs: FicheFournisseur[] | null;
  prestataires: FichePrestataire[] | null;
  /** Ce qui reste dû aux fournisseurs ; absent sans le droit de voir les prix d'achat. */
  aPayer: ChiffresFournisseurs | null;
  achats: Purchase[];
  reglements: ReglementFournisseur[];
  onFournisseurs?: () => void;
  onPrestataires?: () => void;
  onAchats?: () => void;
  onCreerCommande?: () => void;
}> = ({
  fournisseurs,
  prestataires,
  aPayer,
  achats,
  reglements,
  onFournisseurs,
  onPrestataires,
  onAchats,
  onCreerCommande,
}) => {
  const lignesF = useMemo<Ligne[]>(
    () =>
      (fournisseurs ?? []).map((f) => ({
        id: f.id,
        nom: f.nom,
        activite: (f.produits_fournis ?? []).join(", ") || f.categorie || f.entreprise || "",
        contact: f.telephone ?? "",
        statut: statutDe(f.statut),
      })),
    [fournisseurs],
  );
  const lignesP = useMemo<Ligne[]>(
    () =>
      (prestataires ?? []).map((p) => ({
        id: p.id,
        nom: p.nom,
        activite: p.type_service || p.entreprise || "",
        contact: p.telephone ?? "",
        statut: statutDe(p.statut),
      })),
    [prestataires],
  );

  const compte = (l: Ligne[]) => {
    const actifs = l.filter((x) => x.statut === "actif").length;
    return `${nombre(actifs)} actif${actifs > 1 ? "s" : ""} · ${nombre(l.length - actifs)} inactif${l.length - actifs > 1 ? "s" : ""}`;
  };

  const dansSeptJours = dateDansNJours(7);
  const prochains = aPayer
    ? aPayer.aPayer.filter((a) => a.echeance && a.echeance <= dansSeptJours)
    : [];

  const activites = useMemo(() => {
    const achatParId = new Map(achats.map((a) => [a.id, a]));
    const tout: {
      cle: string;
      tri: string;
      icone: NomIcone;
      ton: TonIcone;
      titre: string;
      detail: string;
      quand: string;
    }[] = [];
    for (const a of achats) {
      tout.push({
        cle: `a${a.id}`,
        tri: a.date,
        icone: "cart",
        ton: "vert",
        titre: `Achat${a.fournisseur ? ` chez ${a.fournisseur}` : ""}`,
        detail: `${a.designation} × ${nombre(a.quantite)} · ${montant(a.totalAchat)}`,
        quand: quand(a.date),
      });
    }
    for (const r of reglements) {
      const achat = r.purchase_id ? achatParId.get(r.purchase_id) : undefined;
      tout.push({
        cle: `r${r.purchase_id}${r.created_at ?? r.date}${r.montant}`,
        tri: r.created_at ?? r.date,
        icone: "banknote",
        ton: "vert",
        titre: "Paiement effectué",
        detail: `${achat?.fournisseur ? `${achat.fournisseur} · ` : ""}${montant(r.montant)}`,
        quand: quand(r.date, r.created_at),
      });
    }
    for (const f of fournisseurs ?? []) {
      tout.push({
        cle: `f${f.id}`,
        tri: f.created_at,
        icone: "userplus",
        ton: "bleu",
        titre: "Nouveau fournisseur ajouté",
        detail: [f.nom, (f.produits_fournis ?? []).join(", ") || f.categorie]
          .filter(Boolean)
          .join(" · "),
        quand: quand(dateDuJour(new Date(f.created_at)), f.created_at),
      });
    }
    for (const p of prestataires ?? []) {
      tout.push({
        cle: `p${p.id}`,
        tri: p.created_at,
        icone: "userplus",
        ton: "bleu",
        titre: "Nouveau prestataire ajouté",
        detail: [p.nom, p.type_service].filter(Boolean).join(" · "),
        quand: quand(dateDuJour(new Date(p.created_at)), p.created_at),
      });
    }
    return tout.sort((a, b) => b.tri.localeCompare(a.tri)).slice(0, 4);
  }, [achats, reglements, fournisseurs, prestataires]);

  const stat = (
    lead: NomIcone,
    titre: string,
    valeur: string,
    detail: string,
    onClick?: () => void,
  ) => {
    const Racine = onClick ? "button" : "article";
    return (
      <Racine
        className="card stat"
        {...(onClick
          ? { type: "button" as const, onClick, "aria-label": `${titre} : ${valeur}` }
          : {})}
      >
        <Lead nom={lead} rond />
        <div>
          <h4>{titre}</h4>
          <div className="n num">{valeur}</div>
          <small>{detail}</small>
        </div>
        {onClick && <Icone nom="chevright" className="chev" />}
      </Racine>
    );
  };

  return (
    <>
      <div className="g4 f-top">
        {fournisseurs &&
          stat("box", "Fournisseurs", nombre(lignesF.length), compte(lignesF), onFournisseurs)}
        {prestataires &&
          stat("users", "Prestataires", nombre(lignesP.length), compte(lignesP), onPrestataires)}
        {aPayer &&
          stat(
            "file",
            "Achats à régler",
            nombre(aPayer.aPayer.length),
            `Total : ${montant(aPayer.totalDu)}`,
            onAchats,
          )}
        {aPayer &&
          stat(
            "clock",
            "Prochains paiements",
            nombre(prochains.length),
            "Dans les 7 prochains jours",
            onAchats,
          )}
      </div>

      <div className={`f-grid${fournisseurs && prestataires ? "" : " une"}`}>
        {fournisseurs && (
          <Annuaire
            titre="Fournisseurs"
            lead="box"
            colonne="Produits / Services"
            placeholder="Rechercher un fournisseur..."
            ajouter="Ajouter un fournisseur"
            lignes={lignesF}
            onOuvrir={onFournisseurs}
          />
        )}
        {prestataires && (
          <Annuaire
            titre="Prestataires"
            lead="users"
            colonne="Service"
            placeholder="Rechercher un prestataire..."
            ajouter="Ajouter un prestataire"
            lignes={lignesP}
            onOuvrir={onPrestataires}
          />
        )}
        <div className="right">
          <article className="card qa">
            <div className="card-h">
              <Icone nom="zap" className="qa-ic" />
              <h3>Actions rapides</h3>
            </div>
            {fournisseurs && onFournisseurs && (
              <button type="button" onClick={onFournisseurs}>
                <Icone nom="box" />
                Ajouter un fournisseur
                <Icone nom="chevright" className="chev" />
              </button>
            )}
            {prestataires && onPrestataires && (
              <button type="button" onClick={onPrestataires}>
                <Icone nom="users" />
                Ajouter un prestataire
                <Icone nom="chevright" className="chev" />
              </button>
            )}
            {onCreerCommande && (
              <button type="button" onClick={onCreerCommande}>
                <Icone nom="cart" />
                Créer un bon de commande
                <Icone nom="chevright" className="chev" />
              </button>
            )}
            {onAchats && (
              <button type="button" onClick={onAchats}>
                <Icone nom="file" />
                Voir tous les achats
                <Icone nom="chevright" className="chev" />
              </button>
            )}
          </article>
          <article className="card">
            <div className="card-h">
              <Icone nom="clock" className="qa-ic" />
              <h3 className="petit">Dernières activités</h3>
              <Lien onClick={onAchats}>Voir tout</Lien>
            </div>
            {activites.length === 0 ? (
              <Vide
                titre="Aucune activité"
                detail="Achats, règlements et nouvelles fiches apparaîtront ici."
              />
            ) : (
              <div className="act">
                {activites.map((a) => (
                  <div className="a" key={a.cle}>
                    <span className={`c ${a.ton}`}>
                      <Icone nom={a.icone} />
                    </span>
                    <div>
                      <b>{a.titre}</b>
                      <span>{a.detail}</span>
                    </div>
                    <time>{a.quand}</time>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
    </>
  );
};
