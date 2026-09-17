import React, { useCallback, useEffect, useRef, useState } from "react";
import "./dashboard.css";
import { useDashboardPeriod } from "./hooks/useDashboardPeriod";
import { dateCourte, dateLongue, heure } from "./lib/format";
import { MenuOption, MenuPill, Pill } from "./components/Pill";
import { Card, CardHeader } from "./components/Card";
import { CarteSquelette } from "./components/States";
import { Drawer, DrawerLigne } from "./components/Drawer";
import { dateDuJour } from "../../lib/dates";
import { useAuth } from "../../hooks/useAuth";

/**
 * LE TABLEAU DE BORD v2
 *
 * Portage de `docs/maquette/tableau-de-bord-complet.html`. Voir
 * `docs/dashboard-v2/audit.md` pour ce que chaque carte ira chercher.
 *
 * ÉTAT : phase 1. L'en-tête fonctionne — date, salutation, sélecteur de
 * période avec sa comparaison, mode focus, thème. Les cartes arrivent
 * aux phases suivantes ; en attendant, la grille montre des squelettes,
 * qui disent la forme sans inventer de chiffres.
 *
 * CETTE PAGE NE DESSINE PAS LA COQUILLE. La maquette redessinait aussi
 * la barre latérale et l'en-tête de l'application ; ceux-ci existent
 * déjà (`Sidebar.tsx`, `Header.tsx`) et servent vingt-cinq écrans. La
 * v2 ne remplace que le contenu.
 */

const ICONE_CALENDRIER = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

const ICONE_RAFRAICHIR = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const ICONE_OEIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
  </svg>
);

const ICONE_SOLEIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const ICONE_LUNE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

/** Mémorise le mode focus, comme la maquette, sous le même préfixe. */
const CLE_FOCUS = "tantana.dash.focus";

export interface DashboardV2PageProps {
  /** Le thème de l'application. La v2 s'y branche, elle n'en crée pas un second. */
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  /** Relance les lectures. Le bouton ⟳ de l'en-tête. */
  onRafraichir?: () => void;
}

export const DashboardV2Page: React.FC<DashboardV2PageProps> = ({
  theme,
  setTheme,
  onRafraichir,
}) => {
  /**
   * Le prénom, pour dire bonjour à quelqu'un plutôt qu'à un écran.
   *
   * Le premier mot du nom complet, et rien d'autre : « Bonjour, Mamy »
   * se dit, « Bonjour, Maminirina Rakotoarisoa » se lit comme une
   * convocation. Un compte sans nom — le champ est facultatif à
   * l'inscription — garde un accueil qui fonctionne, sans virgule
   * orpheline. Même lecture que dans l'ancien tableau de bord.
   */
  const { profile } = useAuth();
  const prenom = (profile?.full_name ?? "").trim().split(/\s+/)[0] || "";

  const aujourdhui = dateDuJour();
  const { periode, choisir, choisirIntervalle, apercus, intervalleLibre } =
    useDashboardPeriod(aujourdhui);

  /**
   * L'heure du dernier chargement.
   *
   * Posée après le premier rendu, jamais pendant : le serveur et le
   * navigateur n'ont pas la même horloge, et deux heures différentes
   * pour le même écran feraient diverger l'hydratation.
   */
  const [chargeA, setChargeA] = useState<Date | null>(null);
  useEffect(() => setChargeA(new Date()), []);

  const [focus, setFocus] = useState(false);
  useEffect(() => {
    try {
      setFocus(window.localStorage.getItem(CLE_FOCUS) === "true");
    } catch {
      /* Navigation privée : le mode focus repart simplement à zéro. */
    }
  }, []);

  const basculerFocus = useCallback(() => {
    setFocus((f) => {
      const suivant = !f;
      try {
        window.localStorage.setItem(CLE_FOCUS, String(suivant));
      } catch {
        /* sans mémoire, le réglage vaut pour cette visite */
      }
      return suivant;
    });
  }, []);

  const boutonRafraichir = useRef<HTMLButtonElement>(null);
  const rafraichir = useCallback(() => {
    const b = boutonRafraichir.current;
    if (b) {
      b.classList.remove("spin");
      void b.offsetWidth;
      b.classList.add("spin");
    }
    setChargeA(new Date());
    onRafraichir?.();
  }, [onRafraichir]);

  // Les deux champs de l'intervalle libre, tant qu'ils ne sont pas validés.
  const [du, setDu] = useState(intervalleLibre.debut);
  const [au, setAu] = useState(intervalleLibre.fin);
  const [erreurDates, setErreurDates] = useState(false);
  useEffect(() => {
    setDu(intervalleLibre.debut);
    setAu(intervalleLibre.fin);
  }, [intervalleLibre.debut, intervalleLibre.fin]);

  const [panneau, setPanneau] = useState(false);

  const heureLocale = chargeA ? chargeA.getHours() : 12;
  const salutation = heureLocale >= 18 || heureLocale < 4 ? "Bonsoir" : "Bonjour";
  const jour = new Date();
  const sombre = theme === "dark";

  return (
    <div className={`dash2${focus ? " calm" : ""}`}>
      <div className="dash2-wrap">
        <header className="top">
          <div className="hello">
            <div className="eyebrow">
              {/* La date longue sur ordinateur, courte dès la tablette :
                  « Mercredi 16 septembre 2026 » mange toute la ligne. */}
              <span className="date-longue">{dateLongue(jour)}</span>
              <span className="date-courte">{dateCourte(jour)}</span>
              <span className="fresh">
                <i aria-hidden="true" />
                <span>{chargeA ? `Mis à jour à ${heure(chargeA)}` : "Chargement…"}</span>
                <button
                  ref={boutonRafraichir}
                  className="icon-btn"
                  type="button"
                  onClick={rafraichir}
                  aria-label="Actualiser les données"
                >
                  {ICONE_RAFRAICHIR}
                </button>
              </span>
            </div>
            <h1>
              {salutation}
              {prenom ? `, ${prenom}` : ""}
            </h1>
          </div>

          <div className="tools">
            <MenuPill
              icon={ICONE_CALENDRIER}
              label={periode.nom}
              value={periode.libelle}
              ariaLabel={`Période : ${periode.nom}, ${periode.libelle}`}
            >
              {(fermer) => (
                <>
                  {apercus.map((a) => (
                    <MenuOption
                      key={a.cle}
                      checked={periode.cle === a.cle}
                      hint={a.libelle}
                      onClick={() => {
                        choisir(a.cle);
                        fermer();
                      }}
                    >
                      {a.nom}
                    </MenuOption>
                  ))}
                  <form
                    className="custom"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!du || !au || du > au) {
                        setErreurDates(true);
                        return;
                      }
                      setErreurDates(false);
                      choisirIntervalle(du, au);
                      fermer();
                    }}
                  >
                    <label>
                      Du
                      <input
                        type="date"
                        value={du}
                        max={aujourdhui}
                        onChange={(e) => setDu(e.target.value)}
                      />
                    </label>
                    <label>
                      Au
                      <input
                        type="date"
                        value={au}
                        max={aujourdhui}
                        onChange={(e) => setAu(e.target.value)}
                      />
                    </label>
                    {erreurDates && (
                      <p className="err">La date de début doit être avant la date de fin.</p>
                    )}
                    <button className="btn" type="submit">
                      Appliquer la période
                    </button>
                  </form>
                </>
              )}
            </MenuPill>

            <Pill onClick={basculerFocus} pressed={focus} title="Masquer les cartes secondaires">
              {ICONE_OEIL}
              <span className="pill-label">Mode focus</span>
            </Pill>

            <Pill
              square
              onClick={() => setTheme(sombre ? "light" : "dark")}
              ariaLabel={sombre ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {sombre ? ICONE_SOLEIL : ICONE_LUNE}
            </Pill>
          </div>

          <div className="brief">
            <p aria-live="polite">
              La période regardée va du <b>{periode.libelle}</b>, comparée à{" "}
              <b>{periode.libellePrecedent}</b>.
            </p>
          </div>
        </header>

        <section className="grid" aria-label="Tableau de bord">
          <Card span={12}>
            <CardHeader title="Socle en place — phase 1" />
            <p style={{ margin: 0, color: "var(--ink-2)" }}>
              Les jetons, les composants de base et le sélecteur de période sont posés. Les dix-neuf
              cartes et le bandeau « Aujourd&apos;hui » arrivent aux phases suivantes, branchés sur
              les vraies données de la boutique.
            </p>
            <div>
              <button type="button" className="btn ghost" onClick={() => setPanneau(true)}>
                Ouvrir le panneau de détail
              </button>
            </div>
          </Card>

          <CarteSquelette span={5} />
          <CarteSquelette span={7} lignes={5} />
          <CarteSquelette span={4} />
          <CarteSquelette span={4} />
          <CarteSquelette span={4} />
        </section>
      </div>

      <Drawer
        open={panneau}
        onClose={() => setPanneau(false)}
        title="Panneau de détail"
        subtitle="Il s'ouvrira sur les lignes réelles de chaque carte"
        footer={
          <button type="button" className="btn ghost" onClick={() => setPanneau(false)}>
            Fermer
          </button>
        }
      >
        <DrawerLigne titre="Période regardée" detail={periode.nom} valeur={periode.libelle} />
        <DrawerLigne titre="Comparée à" valeur={periode.libellePrecedent} />
      </Drawer>
    </div>
  );
};

export default DashboardV2Page;
