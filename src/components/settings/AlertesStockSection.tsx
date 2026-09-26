import React, { useEffect, useState } from "react";
import { Loader2, Mail, Monitor, PackageSearch, Save } from "lucide-react";
import { SettingsBlock, SettingsFeedback, SettingsRow, SettingsSection } from "./primitives";
import { Toggle } from "../shared/Toggle";
import {
  BORNES,
  bornerReglages,
  exempleDePrealerte,
  type ProduitPourExemple,
  type ReglagesAlertesStock,
} from "../../lib/prealerteStock";
import { niveauCibleParRegle } from "../../lib/reapprovisionnement";

/**
 * QUAND PRÉVENIR, AVANT LA RUPTURE.
 *
 * Le seuil d'alerte existe déjà et se règle produit par produit. Il
 * prévient au moment où le stock l'atteint, ce qui est souvent trop
 * tard : le temps de joindre son fournisseur et d'être livré, on a vendu
 * ce qui restait. La préalerte pose un second niveau AU-DESSUS de ce
 * seuil, réglé une fois pour toute la boutique, et laisse le temps de
 * commander.
 *
 * ── Deux modes, et pourquoi il en faut deux ──
 *
 * Deux unités d'avance suffisent sur un produit dont le seuil est à
 * trois ; sur un seuil de deux cents, elles ne laissent aucun temps de
 * réaction. L'écart fixe sert les petites quantités, le pourcentage les
 * gros volumes. Un seul est actif à la fois, et seul le champ du mode
 * choisi est affiché : deux cases dont une ne sert pas font hésiter sur
 * celle qui compte.
 *
 * ── L'exemple sous le champ ──
 *
 * « 2 » posé dans une case ne dit rien. La phrase rejoue la règle avec
 * les valeurs en cours de saisie et sur un VRAI produit de la boutique,
 * si bien qu'on voit ce qu'on règle avant d'enregistrer — l'arrondi du
 * pourcentage compris, qui est justement ce qu'on ne devine pas. C'est
 * le procédé déjà employé par l'écran des rappels, qui avait exactement
 * le même problème.
 *
 * ── Tant que c'est éteint, il n'y a rien à régler ──
 *
 * Les réglages n'apparaissent qu'une fois la préalerte activée. Cinq
 * lignes grisées au-dessus d'un interrupteur fermé font croire à un
 * formulaire à remplir alors qu'il n'y a rien à faire.
 */

/**
 * Deux choix qui s'excluent, dans la pilule employée ailleurs.
 *
 * `role="group"` et son libellé : le titre de la ligne est un `<label>`
 * qui ne peut viser aucun des deux boutons. Sans cela, un lecteur
 * d'écran annoncerait « Écart fixe » sans dire de quoi il s'agit.
 */
function Choix<T extends string>({
  nom,
  valeur,
  options,
  onChange,
}: {
  nom: string;
  valeur: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={nom}
      className="flex w-full gap-1 rounded-xl border border-border bg-muted p-1"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={valeur === opt.value}
          className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${
            valeur === opt.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Les trois champs numériques vivent en texte le temps de la saisie. */
interface Champs {
  ecart: string;
  pourcentage: string;
  heure: string;
  valeurCible: string;
}

/**
 * Tout vient de la racine, rien n'est relu ici.
 *
 * Le catalogue produits et le tableau de bord lisent les mêmes
 * réglages : deux lectures séparées divergeraient dès qu'on enregistre,
 * et le patron activerait la préalerte sans que le reste de
 * l'application le sache avant un rechargement.
 */
export interface ReglagesAlertesStockProps {
  reglages: ReglagesAlertesStock;
  /** Le catalogue, réduit à ce que la phrase d'exemple demande. */
  produits: ProduitPourExemple[];
  chargement: boolean;
  enregistrer: (r: ReglagesAlertesStock) => Promise<{ error: string | null }>;
}

export const AlertesStockSection: React.FC<ReglagesAlertesStockProps> = ({
  reglages,
  produits,
  chargement,
  enregistrer,
}) => {
  const [brouillon, setBrouillon] = useState<ReglagesAlertesStock>(reglages);
  const [champs, setChamps] = useState<Champs>({
    ecart: "",
    pourcentage: "",
    heure: "",
    valeurCible: "",
  });
  const [envoi, setEnvoi] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // La lecture est asynchrone : le brouillon se cale dessus à l'arrivée.
  useEffect(() => {
    setBrouillon(reglages);
    setChamps({
      ecart: String(reglages.ecart),
      pourcentage: String(reglages.pourcentage),
      heure: String(reglages.heureResume),
      valeurCible: String(reglages.reapproValeur).replace(".", ","),
    });
  }, [reglages]);

  // Ce qui partira vraiment : un champ vide ou aberrant est ramené dans
  // les bornes ici, et non à l'enregistrement, pour que la phrase
  // d'exemple décrive le réglage réel plutôt qu'une saisie en cours.
  const effectifs = bornerReglages({
    ...brouillon,
    ecart: Number(champs.ecart),
    pourcentage: Number(champs.pourcentage),
    heureResume: Number(champs.heure),
    reapproValeur: Number(champs.valeurCible.replace(",", ".")),
  });

  const modifie = JSON.stringify(effectifs) !== JSON.stringify(reglages);
  const exemple = exempleDePrealerte(produits, effectifs);
  const seuilExemple = exemple.seuil;
  const cibleExemple = niveauCibleParRegle(seuilExemple, effectifs);
  const soumettre = async () => {
    setEnvoi(true);
    setErreur(null);
    const { error } = await enregistrer(effectifs);
    setEnvoi(false);
    if (error) {
      setErreur(error);
      return;
    }
    setEnregistre(true);
    window.setTimeout(() => setEnregistre(false), 3000);
  };

  return (
    <SettingsSection
      title="Alertes de stock"
      description="Être prévenu avant d'atteindre le seuil, pour avoir le temps de commander."
      icon={<PackageSearch className="h-4 w-4" />}
      aside={
        <button
          type="button"
          onClick={soumettre}
          disabled={!modifie || envoi || chargement}
          className="app-btn-primary"
        >
          {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {envoi ? "Enregistrement…" : enregistre ? "Enregistré" : "Enregistrer"}
        </button>
      }
    >
      <SettingsRow
        label="Préalerte de stock"
        hint="Un second niveau au-dessus du seuil de chaque produit. Tant qu'elle est éteinte, rien ne change : ni notification, ni affichage supplémentaire."
        htmlFor="prealerte-active"
      >
        <div className="sm:flex sm:justify-end">
          <Toggle
            id="prealerte-active"
            label="Préalerte de stock"
            checked={brouillon.prealerteActive}
            disabled={chargement}
            onChange={(v) => setBrouillon((p) => ({ ...p, prealerteActive: v }))}
          />
        </div>
      </SettingsRow>

      {brouillon.prealerteActive && (
        <>
          <SettingsRow
            label="Mode de déclenchement"
            hint="L'écart fixe convient aux petites quantités ; le pourcentage aux gros volumes, où deux unités d'avance ne laissent aucun temps de réaction."
          >
            <Choix
              nom="Mode de déclenchement"
              valeur={brouillon.mode}
              onChange={(mode) => setBrouillon((p) => ({ ...p, mode }))}
              options={[
                { value: "ecart", label: "Écart fixe" },
                { value: "pourcentage", label: "Pourcentage" },
              ]}
            />
          </SettingsRow>

          {brouillon.mode === "ecart" ? (
            <SettingsRow
              label="Unités au-dessus du seuil"
              hint={`La préalerte se déclenche à « seuil + écart ». Entre ${BORNES.ecart.min} et ${BORNES.ecart.max}.`}
              htmlFor="prealerte-ecart"
            >
              <div className="flex items-center gap-2">
                <input
                  id="prealerte-ecart"
                  type="number"
                  inputMode="numeric"
                  min={BORNES.ecart.min}
                  max={BORNES.ecart.max}
                  value={champs.ecart}
                  onChange={(e) => setChamps((c) => ({ ...c, ecart: e.target.value }))}
                  className="app-field"
                />
                <span className="shrink-0 text-sm text-muted-foreground">unités</span>
              </div>
            </SettingsRow>
          ) : (
            <SettingsRow
              label="Pourcentage au-dessus du seuil"
              hint={`La préalerte se déclenche à « seuil × (1 + pourcentage) », arrondi au supérieur. Entre ${BORNES.pourcentage.min} et ${BORNES.pourcentage.max}.`}
              htmlFor="prealerte-pourcentage"
            >
              <div className="flex items-center gap-2">
                <input
                  id="prealerte-pourcentage"
                  type="number"
                  inputMode="numeric"
                  min={BORNES.pourcentage.min}
                  max={BORNES.pourcentage.max}
                  value={champs.pourcentage}
                  onChange={(e) => setChamps((c) => ({ ...c, pourcentage: e.target.value }))}
                  className="app-field"
                />
                <span className="shrink-0 text-sm text-muted-foreground">%</span>
              </div>
            </SettingsRow>
          )}

          <SettingsBlock>
            <p
              aria-live="polite"
              className="rounded-xl border border-border p-3 text-sm leading-relaxed text-muted-foreground"
            >
              {exemple.produit ? (
                <>
                  <strong className="text-foreground">{exemple.produit}</strong>, dont le seuil est
                  de {exemple.seuil} :{" "}
                </>
              ) : (
                <>Avec un seuil de {exemple.seuil}, </>
              )}
              vous serez prévenu à partir de{" "}
              <strong className="text-foreground">
                {exemple.niveau} unité{exemple.niveau > 1 ? "s" : ""}
              </strong>
              .
              {!exemple.produit && (
                <>
                  {" "}
                  Aucun de vos produits n&apos;a encore de seuil d&apos;alerte : cet exemple en
                  suppose un.
                </>
              )}
            </p>
          </SettingsBlock>

          <SettingsRow
            label="Fréquence"
            hint="Le résumé quotidien évite d'être interrompu toute la journée. Le tableau de bord, lui, montre l'état réel à tout moment dans les deux cas."
          >
            <Choix
              nom="Fréquence"
              valeur={brouillon.frequence}
              onChange={(frequence) => setBrouillon((p) => ({ ...p, frequence }))}
              options={[
                { value: "quotidien", label: "Une fois par jour" },
                { value: "mouvement", label: "À chaque mouvement" },
              ]}
            />
          </SettingsRow>

          {brouillon.frequence === "quotidien" && (
            <SettingsRow
              label="Heure du résumé"
              hint="Heure de Madagascar. Le moment où vous ouvrez la boutique convient bien : la liste est prête avant les premières ventes."
              htmlFor="prealerte-heure"
            >
              <div className="flex items-center gap-2">
                <input
                  id="prealerte-heure"
                  type="number"
                  inputMode="numeric"
                  min={BORNES.heureResume.min}
                  max={BORNES.heureResume.max}
                  value={champs.heure}
                  onChange={(e) => setChamps((c) => ({ ...c, heure: e.target.value }))}
                  className="app-field"
                />
                <span className="shrink-0 text-sm text-muted-foreground">h</span>
              </div>
            </SettingsRow>
          )}

          <SettingsRow
            label="Dans l'application"
            hint="La cloche en haut de l'écran, avec la liste des produits concernés. Chacun la voit en ouvrant la sienne."
          >
            <div className="flex items-center gap-2 sm:justify-end">
              <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-muted-foreground">Toujours</span>
            </div>
          </SettingsRow>

          {/* L'E-MAIL NE SE RÈGLE PAS ICI, ET C'EST VOULU.
              Cette section décide du stock de la boutique ; recevoir un
              message dans sa boîte est une décision personnelle, que
              chacun prend pour lui — vous compris. On dit donc où elle
              se prend, plutôt que de laisser chercher. */}
          <SettingsBlock>
            <div className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                L&apos;envoi par e-mail se règle personne par personne, dans{" "}
                <strong className="font-semibold text-foreground">
                  Paramètres → Notifications
                </strong>
                . Chacun de vos collaborateurs peut y demander le résumé pour sa propre adresse, et
                personne ne le reçoit tant qu&apos;il ne l&apos;a pas demandé.
              </span>
            </div>
          </SettingsBlock>
        </>
      )}

      <SettingsRow
        label="Niveau cible de réapprovisionnement"
        hint="Chaque produit peut porter un niveau cible : la quantité suggérée remonte le stock jusque-là, et non plus au double du seuil. Ajoute l'écran « Réapprovisionnement » et sa feuille A4 dans Produits. Éteint, rien ne change."
        htmlFor="reappro-active"
      >
        <div className="sm:flex sm:justify-end">
          <Toggle
            id="reappro-active"
            label="Niveau cible de réapprovisionnement"
            checked={brouillon.reapproActive}
            disabled={chargement}
            onChange={(v) => setBrouillon((p) => ({ ...p, reapproActive: v }))}
          />
        </div>
      </SettingsRow>

      {brouillon.reapproActive && (
        <>
          <SettingsRow
            label="Cible par défaut"
            hint="Pour les produits dont la fiche ne précise pas de niveau cible. Chaque fiche reste libre d'en fixer un."
          >
            <Choix
              nom="Cible par défaut"
              valeur={brouillon.reapproMode}
              onChange={(reapproMode) => setBrouillon((p) => ({ ...p, reapproMode }))}
              options={[
                { value: "multiple", label: "Multiple du seuil" },
                { value: "ecart", label: "Seuil + quantité" },
              ]}
            />
          </SettingsRow>

          <SettingsRow
            label={brouillon.reapproMode === "multiple" ? "Multiplicateur" : "Quantité ajoutée"}
            hint={
              brouillon.reapproMode === "multiple"
                ? "Niveau cible = seuil × multiplicateur, arrondi au supérieur. 2 reproduit le calcul actuel."
                : "Niveau cible = seuil + cette quantité."
            }
            htmlFor="reappro-valeur"
          >
            <div className="flex items-center gap-2">
              <input
                id="reappro-valeur"
                type="text"
                inputMode="decimal"
                value={champs.valeurCible}
                onChange={(e) => setChamps((c) => ({ ...c, valeurCible: e.target.value }))}
                className="app-field"
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                {brouillon.reapproMode === "multiple" ? "× seuil" : "unités"}
              </span>
            </div>
          </SettingsRow>

          <SettingsBlock>
            <p
              aria-live="polite"
              className="rounded-xl border border-border p-3 text-sm leading-relaxed text-muted-foreground"
            >
              Avec un seuil de {seuilExemple}, un produit sans niveau cible sera réapprovisionné
              jusqu&apos;à{" "}
              <strong className="text-foreground">
                {cibleExemple} unité{cibleExemple > 1 ? "s" : ""}
              </strong>
              .
            </p>
          </SettingsBlock>
        </>
      )}

      {erreur && (
        <SettingsBlock>
          <SettingsFeedback type="error">{erreur}</SettingsFeedback>
        </SettingsBlock>
      )}
    </SettingsSection>
  );
};
