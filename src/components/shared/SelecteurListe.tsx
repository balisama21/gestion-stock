import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { useClicExterieur } from "../../hooks/useClicExterieur";
import { cleDeListe, correspond, valeurEquivalente } from "../../lib/listes";

export interface OptionDeSelecteur {
  id: string;
  nom: string;
  /** Une mention grise à droite du nom : « externe », « archivé », un téléphone. */
  mention?: string | null;
  /** Une valeur archivée, gardée visible parce qu'un ancien enregistrement la porte. */
  archive?: boolean;
  /** Regroupe les options sous un intertitre. Sans groupe, elles se suivent. */
  groupe?: string;
}

interface SelecteurListeProps {
  /** L'intitulé du champ. Rendu en `<label>` lié au bouton d'ouverture. */
  label: string;
  options: OptionDeSelecteur[];
  valeur: string | null;
  onChange: (id: string | null) => void;
  /** Absente, le sélecteur ne propose pas d'ajouter. */
  onCreer?: (nom: string) => Promise<{ id: string | null; error: string | null }>;
  /**
   * Demander la création au lieu de la faire : une personne externe a
   * besoin d'un téléphone, donc d'un formulaire. L'emporte sur `onCreer`.
   */
  onDemanderCreation?: (nom: string) => void;
  /** Le texte du choix vide. Absent, le champ ne peut pas être vidé. */
  libelleVide?: string;
  placeholder?: string;
  /** Une phrase sous le champ : d'où viennent les valeurs, ce qu'on peut taper. */
  aide?: React.ReactNode;
  requis?: boolean;
  desactive?: boolean;
  /** Rendu compact, pour une ligne de tableau ou un formulaire dense. */
  compact?: boolean;
  id?: string;
}

/**
 * Le sélecteur unique de toutes les listes : catégories, postes, types,
 * fournisseurs, personnes. Recherche insensible aux accents et à la
 * casse, entièrement au clavier (flèches, Entrée, Échap).
 *
 * « + Ajouter » disparaît quand la valeur existe déjà sous une autre
 * graphie : c'est l'anti-doublon vu du côté de qui tape.
 */
export const SelecteurListe: React.FC<SelecteurListeProps> = ({
  label,
  options,
  valeur,
  onChange,
  onCreer,
  onDemanderCreation,
  libelleVide,
  placeholder = "Rechercher…",
  aide,
  requis = false,
  desactive = false,
  compact = false,
  id,
}) => {
  const idAuto = useId();
  const idChamp = id ?? idAuto;
  const zone = useRef<HTMLDivElement>(null);
  const champRecherche = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);

  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [survol, setSurvol] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useClicExterieur(zone, ouvert, () => setOuvert(false));

  const choisie = options.find((o) => o.id === valeur) ?? null;

  const filtrees = useMemo(() => {
    if (!recherche.trim()) return options;
    return options.filter((o) => correspond(o.nom, recherche));
  }, [options, recherche]);

  // Pas de création si la valeur existe déjà, même archivée, même hors
  // du filtre courant.
  const dejaLa = valeurEquivalente(options, recherche);
  const peutCreer =
    Boolean(onCreer || onDemanderCreation) && Boolean(cleDeListe(recherche)) && !dejaLa;

  /** Les lignes, dans l'ordre où les flèches les parcourent. */
  const lignes = useMemo(() => {
    const l: { type: "vide" | "option" | "creer"; option?: OptionDeSelecteur }[] = [];
    if (libelleVide && !recherche.trim()) l.push({ type: "vide" });
    for (const o of filtrees) l.push({ type: "option", option: o });
    if (peutCreer) l.push({ type: "creer" });
    return l;
  }, [filtrees, libelleVide, peutCreer, recherche]);

  useEffect(() => {
    if (!ouvert) return;
    setRecherche("");
    setErreur(null);
    setSurvol(0);
    // Au tour suivant : le champ n'est pas encore dans le document.
    const t = window.setTimeout(() => champRecherche.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [ouvert]);

  useEffect(() => {
    setSurvol((s) => (s >= lignes.length ? Math.max(0, lignes.length - 1) : s));
  }, [lignes.length]);

  // Sans cela, les flèches descendent hors de la fenêtre.
  useEffect(() => {
    if (!ouvert) return;
    const el = liste.current?.children[survol] as HTMLElement | undefined;
    // Appel optionnel : jsdom ne le fournit pas, et un environnement
    // sans `scrollIntoView` ne doit pas faire tomber le champ.
    el?.scrollIntoView?.({ block: "nearest" });
  }, [survol, ouvert]);

  const creer = async () => {
    const nom = recherche.trim();
    if (!nom) return;
    if (onDemanderCreation) {
      setOuvert(false);
      onDemanderCreation(nom);
      return;
    }
    if (!onCreer) return;
    setEnCours(true);
    setErreur(null);
    const { id: cree, error } = await onCreer(nom);
    setEnCours(false);
    if (error || !cree) {
      setErreur(error ?? "La valeur n'a pas pu être ajoutée.");
      return;
    }
    onChange(cree);
    setOuvert(false);
  };

  const activer = (index: number) => {
    const ligne = lignes[index];
    if (!ligne) return;
    if (ligne.type === "creer") {
      void creer();
      return;
    }
    onChange(ligne.type === "vide" ? null : (ligne.option?.id ?? null));
    setOuvert(false);
  };

  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSurvol((s) => Math.min(s + 1, lignes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSurvol((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activer(survol);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOuvert(false);
    }
  };

  const champ = compact ? "app-field-sm" : "app-field";

  return (
    <div ref={zone} className="relative">
      <label htmlFor={idChamp} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {requis && <span className="t-danger"> *</span>}
      </label>

      <button
        type="button"
        id={idChamp}
        disabled={desactive}
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className={`${champ} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
      >
        <span className={`min-w-0 truncate ${choisie ? "" : "text-muted-foreground"}`}>
          {choisie ? choisie.nom : (libelleVide ?? placeholder)}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {choisie?.archive && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          « {choisie.nom} » est archivée. Elle reste affichée ici parce que cet enregistrement la
          porte.
        </p>
      )}

      {aide && !ouvert && <p className="mt-1 text-[11px] text-muted-foreground">{aide}</p>}

      {ouvert && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={champRecherche}
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={surTouche}
              placeholder={placeholder}
              aria-label={`Rechercher dans ${label.toLowerCase()}`}
              aria-controls={`${idChamp}-liste`}
              className="w-full bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            {recherche && (
              <button
                type="button"
                onClick={() => {
                  setRecherche("");
                  champRecherche.current?.focus();
                }}
                aria-label="Effacer la recherche"
                className="app-btn-icon h-7 w-7"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {erreur && (
            <p role="alert" className="border-b border-border px-3 py-2 text-xs t-danger">
              {erreur}
            </p>
          )}

          <ul
            ref={liste}
            id={`${idChamp}-liste`}
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {lignes.map((ligne, i) => {
              const actif = i === survol;
              const fond = actif ? "bg-accent" : "";

              if (ligne.type === "vide") {
                return (
                  <li key="vide" role="option" aria-selected={valeur === null}>
                    <button
                      type="button"
                      onMouseEnter={() => setSurvol(i)}
                      onClick={() => activer(i)}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground ${fond}`}
                    >
                      {libelleVide}
                    </button>
                  </li>
                );
              }

              if (ligne.type === "creer") {
                return (
                  <li key="creer" role="option" aria-selected={false}>
                    <button
                      type="button"
                      disabled={enCours}
                      onMouseEnter={() => setSurvol(i)}
                      onClick={() => activer(i)}
                      className={`flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-primary ${fond}`}
                    >
                      <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">
                        {enCours ? "Ajout…" : `Ajouter « ${recherche.trim()} »`}
                      </span>
                    </button>
                  </li>
                );
              }

              const o = ligne.option!;
              const precedent = lignes[i - 1]?.option?.groupe;
              const intertitre = o.groupe && o.groupe !== precedent ? o.groupe : null;

              return (
                <li key={o.id} role="option" aria-selected={o.id === valeur}>
                  {intertitre && (
                    <span className="mt-1 block px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {intertitre}
                    </span>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setSurvol(i)}
                    onClick={() => activer(i)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-foreground ${fond}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {o.id === valeur ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <span className="w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0 truncate">{o.nom}</span>
                    </span>
                    {o.mention && (
                      <span className="shrink-0 text-xs text-muted-foreground">{o.mention}</span>
                    )}
                  </button>
                </li>
              );
            })}

            {lignes.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                {onCreer || onDemanderCreation
                  ? "Tapez un nom pour l'ajouter."
                  : "Rien ne correspond. Cette liste se complète dans Paramètres → Listes."}
              </li>
            )}
          </ul>

          {dejaLa && recherche.trim() && dejaLa.nom.trim() !== recherche.trim() && (
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              « {dejaLa.nom} » existe déjà : c'est la même valeur, écrite autrement.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
