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
   * Créer une fiche « hors équipe ». Le téléphone est demandé avec le
   * nom : un contact qu'on ne peut pas rappeler n'en est pas un.
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
  /** Le nom se lit mais ne se change pas. */
  desactive?: boolean;
  /** Remplace la phrase d'aide sous le champ. */
  aide?: React.ReactNode;
}

/**
 * Qui a fait quoi, membre de l'équipe ou non. Les trois origines sont
 * distinguées à l'œil : « Lanto » de l'équipe et « Lanto » le voisin ne
 * se paient pas de la même façon.
 *
 * C'est le NOM qui s'écrit, comme avant ; les identifiants viennent à
 * côté, facultatifs. Une boutique sans aucune fiche marche comme hier.
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
  desactive = false,
  aide,
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

  /*
   * PAS DE <form> ICI. Ce panneau s'ouvre au milieu d'une vente, d'une
   * dépense, d'une note de frais — c'est-à-dire DANS leur formulaire. Un
   * formulaire imbriqué ne s'arrête pas à lui-même : son envoi remontait
   * jusqu'au formulaire parent, qui enregistrait la vente ou la dépense
   * à moitié remplie et refermait la fiche. Le bouton est donc un simple
   * bouton, et Entrée est rattrapée champ par champ.
   */
  const creer = async () => {
    if (!onCreer || !aCreer || enCours) return;
    if (!telephone.trim()) {
      setErreur("Le téléphone est demandé : c'est ce qui permet de la rappeler.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    let resultat: { personne: { id: string; nom: string } | null; error: string | null };
    try {
      resultat = await onCreer({
        nom: aCreer,
        telephone: telephone.trim(),
        role: role.trim() || null,
      });
    } catch {
      resultat = {
        personne: null,
        error: "Connexion impossible. Vérifiez le réseau, puis réessayez.",
      };
    }
    setEnCours(false);
    const { personne, error } = resultat;
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
        desactive={desactive}
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
          aide ??
          (onCreer ? "Quelqu'un hors équipe ? Tapez son nom pour lui créer une fiche." : undefined)
        }
      />

      {aCreer && onCreer && (
        <div
          role="group"
          aria-label={`Nouvelle personne : ${aCreer}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
              e.preventDefault();
              void creer();
            }
          }}
          className="rounded-xl border border-border p-3"
        >
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
              {/* `aria-required` et non `required` : le champ vit dans le
                  formulaire parent, qui refuserait sinon de s'envoyer
                  tant que ce panneau est ouvert. Le contrôle est fait
                  par `creer`. */}
              <input
                type="tel"
                inputMode="tel"
                aria-required="true"
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
              {/* Champ libre : aucune liste ne contient « revendeuse au marché ». */}
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
            type="button"
            disabled={enCours}
            onClick={() => void creer()}
            className="app-btn-primary mt-3 w-full sm:w-auto"
          >
            <UserPlus className="h-4 w-4" />
            {enCours ? "Création…" : "Créer la fiche"}
          </button>
        </div>
      )}
    </div>
  );
};
