import React, { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Save, UserPlus, Users, X } from "lucide-react";
import { SettingsSection } from "./primitives";
import type { Database } from "../../lib/database.types";
import { cleDeListe } from "../../lib/listes";

type PersonneExterne = Database["public"]["Tables"]["personnes_externes"]["Row"];

interface PersonnesExternesSectionProps {
  personnes: PersonneExterne[];
  onAdd: (
    data: Omit<
      Database["public"]["Tables"]["personnes_externes"]["Insert"],
      "store_id" | "created_by"
    >,
  ) => Promise<{ personne: PersonneExterne | null; error: string | null }>;
  onUpdate: (
    id: string,
    data: Database["public"]["Tables"]["personnes_externes"]["Update"],
  ) => Promise<{ error: string | null }>;
  /** Les comptes de la boutique, pour relier une fiche à celui qui vient de la rejoindre. */
  membres?: { id: string; nom: string }[];
}

const VIDE = { nom: "", telephone: "", email: "", role: "", taux_commission: "", notes: "" };

/**
 * Les gens qui travaillent avec la boutique sans y avoir de compte :
 * une revendeuse, un chauffeur, une couturière payée à la pièce.
 *
 * Une fiche ne donne AUCUN accès — inviter quelqu'un se fait juste
 * au-dessus, et c'est un geste différent. Le rôle est un champ libre :
 * aucune liste fermée ne contient le métier qu'on cherche.
 */
export const PersonnesExternesSection: React.FC<PersonnesExternesSectionProps> = ({
  personnes,
  onAdd,
  onUpdate,
  membres = [],
}) => {
  const [formulaire, setFormulaire] = useState(VIDE);
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [voirArchivees, setVoirArchivees] = useState(false);

  const actives = useMemo(
    () => personnes.filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [personnes],
  );
  const archivees = useMemo(
    () => personnes.filter((p) => !p.actif).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [personnes],
  );

  const nomDuCompte = (id: string) => membres.find((m) => m.id === id)?.nom ?? null;

  /** Celles que la reprise a créées sans téléphone : à compléter. */
  const aCompleter = actives.filter((p) => !p.telephone);

  const champ = (cle: keyof typeof VIDE) => ({
    value: formulaire[cle],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormulaire((f) => ({ ...f, [cle]: e.target.value })),
  });

  const ouvrirCreation = () => {
    setFormulaire(VIDE);
    setEnEdition(null);
    setErreur(null);
    setOuvert(true);
  };

  const ouvrirEdition = (p: PersonneExterne) => {
    setFormulaire({
      nom: p.nom,
      telephone: p.telephone ?? "",
      email: p.email ?? "",
      role: p.role ?? "",
      taux_commission: p.taux_commission == null ? "" : String(p.taux_commission),
      notes: p.notes ?? "",
    });
    setEnEdition(p.id);
    setErreur(null);
    setOuvert(true);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    const nom = formulaire.nom.trim();
    if (!nom) {
      setErreur("Le nom est obligatoire.");
      return;
    }
    if (!formulaire.telephone.trim()) {
      setErreur("Le téléphone est obligatoire : c'est ce qui permet de la rappeler.");
      return;
    }
    const doublon = personnes.find(
      (p) => p.id !== enEdition && cleDeListe(p.nom) === cleDeListe(nom),
    );
    if (doublon) {
      setErreur(`« ${doublon.nom} » existe déjà dans cette boutique.`);
      return;
    }
    const taux = formulaire.taux_commission.trim();
    const donnees = {
      nom,
      telephone: formulaire.telephone.trim(),
      email: formulaire.email.trim() || null,
      role: formulaire.role.trim() || null,
      taux_commission: taux === "" ? null : Number(taux),
      notes: formulaire.notes.trim() || null,
    };
    setEnCours(true);
    setErreur(null);
    const { error } = enEdition ? await onUpdate(enEdition, donnees) : await onAdd(donnees);
    setEnCours(false);
    if (error) {
      setErreur(error);
      return;
    }
    setOuvert(false);
    setFormulaire(VIDE);
    setEnEdition(null);
  };

  const archiver = async (p: PersonneExterne, actif: boolean) => {
    setEnCours(true);
    const { error } = await onUpdate(p.id, { actif });
    setEnCours(false);
    if (error) setErreur(error);
  };

  return (
    <SettingsSection
      title="Hors équipe"
      description="Des contacts, pas des comptes : ces fiches ne donnent aucun accès à l'application."
      icon={<Users className="w-4 h-4" />}
    >
      {erreur && (
        <p
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
        >
          {erreur}
        </p>
      )}

      {aCompleter.length > 0 && (
        <p className="rounded-xl border border-warning-border bg-warning-soft px-3.5 py-3 text-sm t-warning">
          {aCompleter.length} fiche{aCompleter.length > 1 ? "s" : ""} sans téléphone —{" "}
          {aCompleter.map((p) => p.nom).join(", ")}. Elles viennent des noms déjà écrits dans vos
          ventes et vos dépenses ; complétez-les pour pouvoir les rappeler.
        </p>
      )}

      {actives.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Personne pour l&apos;instant. Une fiche se crée aussi depuis une vente ou une dépense, au
          moment où le nom manque.
        </p>
      ) : (
        <div className="app-list">
          {actives.map((p) => (
            <div key={p.id} className="app-list-row justify-between gap-3">
              <span className="min-w-0">
                <span className="app-list-primary block">{p.nom}</span>
                <span className="app-list-secondary block">
                  {[
                    p.role,
                    p.telephone,
                    p.taux_commission != null ? `${p.taux_commission} % de commission` : null,
                    p.user_id
                      ? `a rejoint l'équipe${nomDuCompte(p.user_id) ? ` — ${nomDuCompte(p.user_id)}` : ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>

                {/* Relier une fiche à un compte ne déplace rien : le lien
                    dit seulement que ces deux-là sont la même personne. */}
                {membres.length > 0 && (
                  <label className="mt-1.5 block">
                    <span className="mb-1 block text-[11px] text-muted-foreground">
                      Compte de cette personne, si elle a rejoint l&apos;équipe
                    </span>
                    <select
                      value={p.user_id ?? ""}
                      onChange={(e) => void onUpdate(p.id, { user_id: e.target.value || null })}
                      className="app-field-sm"
                    >
                      <option value="">Aucun — c&apos;est un contact</option>
                      {membres.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nom}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => ouvrirEdition(p)}
                  className="app-btn-icon h-8 w-8"
                  aria-label={`Modifier ${p.nom}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void archiver(p, false)}
                  disabled={enCours}
                  className="app-btn-icon h-8 w-8"
                  aria-label={`Archiver ${p.nom}`}
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {ouvert ? (
        <form onSubmit={enregistrer} className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {enEdition ? "Modifier la fiche" : "Nouvelle personne"}
            </span>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="app-btn-icon h-8 w-8"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Nom</span>
              <input type="text" required className="app-field" {...champ("nom")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Téléphone
              </span>
              <input
                type="tel"
                inputMode="tel"
                required
                className="app-field"
                {...champ("telephone")}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                E-mail — facultatif
              </span>
              <input type="email" className="app-field" {...champ("email")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Rôle — facultatif
              </span>
              <input
                type="text"
                placeholder="chauffeur, revendeuse, couturière…"
                className="app-field"
                {...champ("role")}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Commission — facultatif
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                inputMode="decimal"
                placeholder="%"
                className="app-field font-mono"
                {...champ("taux_commission")}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Notes — facultatif
              </span>
              <textarea rows={2} className="app-field" {...champ("notes")} />
            </label>
          </div>
          <button type="submit" disabled={enCours} className="app-btn-primary mt-3">
            <Save className="h-4 w-4" />
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      ) : (
        <button type="button" onClick={ouvrirCreation} className="app-btn-secondary">
          <UserPlus className="h-4 w-4" />
          Ajouter une personne
        </button>
      )}

      {archivees.length > 0 && (
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setVoirArchivees((v) => !v)}
            aria-expanded={voirArchivees}
            className="w-full px-4 py-3 text-left text-sm font-medium text-foreground"
          >
            {archivees.length} fiche{archivees.length > 1 ? "s" : ""} archivée
            {archivees.length > 1 ? "s" : ""}
          </button>
          {voirArchivees && (
            <div className="app-list border-t border-border">
              {archivees.map((p) => (
                <div key={p.id} className="app-list-row justify-between gap-3">
                  <span className="min-w-0">
                    <span className="app-list-primary block">{p.nom}</span>
                    <span className="app-list-secondary block">
                      Retirée des sélecteurs. Ce qu&apos;elle a fait reste écrit.
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void archiver(p, true)}
                    disabled={enCours}
                    className="app-btn-icon h-8 w-8"
                    aria-label={`Remettre ${p.nom} en service`}
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SettingsSection>
  );
};
