import React, { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { SelecteurListe } from "./SelecteurListe";
import { GROUPES, type Personne } from "../../lib/personnes";
import { cleDeListe } from "../../lib/listes";

interface SelecteurPersonneProps {
  label: string;
  personnes: Personne[];
  /** Le nom écrit sur l'enregistrement. C'est lui la vérité, pas l'identifiant. */
  valeur: string;
  onChange: (choix: { nom: string; membreId: string | null; personneId: string | null }) => void;
  /**
   * Créer une fiche « personne externe ». Absente, le sélecteur ne
   * propose pas d'ajouter.
   *
   * Le téléphone est demandé en même temps que le nom, et non après :
   * une personne hors équipe qu'on ne peut pas rappeler n'est pas un
   * contact, c'est une ligne de plus dans une liste.
   */
  onCreer?: (data: {
    nom: string;
    telephone: string;
    role: string | null;
  }) => Promise<{ personne: { id: string; nom: string } | null; error: string | null }>;
  libelleVide?: string;
  requis?: boolean;
  compact?: boolean;
  id?: string;
}

/**
 * QUI A FAIT QUOI — MEMBRE DE L'ÉQUIPE OU NON.
 *
 * Le champ « Vendeur » d'une dépense ne désignait déjà plus un vendeur :
 * c'est qui a sorti l'argent. Un livreur, le comptable, ou quelqu'un
 * qu'on a envoyé acheter du carburant et qui n'a pas de compte.
 *
 * Les trois origines sont distinguées à l'œil — Équipe, Hors équipe,
 * Déjà saisis — parce que deux personnes peuvent porter le même prénom
 * et que « Lanto » de l'équipe et « Lanto » le voisin ne se paient pas
 * de la même façon.
 *
 * ── CE QUI S'ÉCRIT ──
 *
 * Le NOM, comme avant, dans la colonne texte. Les identifiants viennent
 * à côté, facultatifs. C'est ce qui permet à cet écran de ne rien
 * casser : une boutique dont personne n'a de fiche continue de
 * fonctionner exactement comme hier.
 */
export const SelecteurPersonne: React.FC<SelecteurPersonneProps> = ({
  label,
  personnes,
  valeur,
  onChange,
  onCreer,
  libelleVide,
  requis = false,
  compact = false,
  id,
}) => {
  const [aCreer, setACreer] = useState<string | null>(null);
  const [telephone, setTelephone] = useState("");
  const [role, setRole] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const options = useMemo(
    () =>
      personnes.map((p) => ({
        id: p.cle,
        nom: p.nom,
        mention: p.mention,
        groupe: GROUPES[p.nature],
      })),
    [personnes],
  );

  const choisie = useMemo(() => {
    const cle = cleDeListe(valeur);
    return personnes.find((p) => cleDeListe(p.nom) === cle) ?? null;
  }, [personnes, valeur]);

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreer || !aCreer) return;
    if (!telephone.trim()) {
      setErreur("Le téléphone est demandé : c'est ce qui permet de la rappeler.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    const { personne, error } = await onCreer({
      nom: aCreer,
      telephone: telephone.trim(),
      role: role.trim() || null,
    });
    setEnCours(false);
    if (error || !personne) {
      setErreur(error ?? "La fiche n'a pas pu être créée.");
      return;
    }
    onChange({ nom: personne.nom, membreId: null, personneId: personne.id });
    setACreer(null);
    setTelephone("");
    setRole("");
  };

  return (
    <div className="space-y-2">
      <SelecteurListe
        id={id}
        label={label}
        options={options}
        valeur={choisie?.cle ?? null}
        requis={requis}
        compact={compact}
        libelleVide={libelleVide}
        placeholder="Chercher une personne…"
        onChange={(cle) => {
          const p = personnes.find((x) => x.cle === cle) ?? null;
          onChange({
            nom: p?.nom ?? "",
            membreId: p?.membreId ?? null,
            personneId: p?.personneId ?? null,
          });
        }}
        onDemanderCreation={
          onCreer
            ? (nom) => {
                setACreer(nom);
                setTelephone("");
                setRole("");
                setErreur(null);
              }
            : undefined
        }
        aide={
          onCreer ? "Quelqu'un hors équipe ? Tapez son nom pour lui créer une fiche." : undefined
        }
      />

      {aCreer && onCreer && (
        <form onSubmit={creer} className="rounded-xl border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Nouvelle personne : « {aCreer} »
            </span>
            <button
              type="button"
              onClick={() => setACreer(null)}
              className="app-btn-icon h-8 w-8"
              aria-label="Annuler"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Une fiche de contact, pas un compte : elle ne donne aucun accès à l&apos;application.
          </p>
          {erreur && (
            <p role="alert" className="mb-2 text-xs t-danger">
              {erreur}
            </p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Téléphone
              </span>
              <input
                type="tel"
                inputMode="tel"
                required
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="03X XX XXX XX"
                className="app-field"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Rôle — facultatif
              </span>
              {/* Un champ libre, pas une liste : « couturière »,
                  « chauffeur », « revendeuse au marché » sont des métiers
                  qu'aucune liste prévue d'avance ne contient. */}
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="chauffeur, revendeuse…"
                className="app-field"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={enCours}
            className="app-btn-primary mt-3 w-full sm:w-auto"
          >
            <UserPlus className="h-4 w-4" />
            {enCours ? "Création…" : "Créer la fiche"}
          </button>
        </form>
      )}
    </div>
  );
};
