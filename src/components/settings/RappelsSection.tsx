import React, { useState } from "react";
import { BellRing, RotateCcw, Save } from "lucide-react";
import { SettingsSection } from "./primitives";
import type { Personnalisation } from "../../lib/personnalisation";
import { DELAIS_PAR_DEFAUT, delaisDeRappel } from "../../lib/rappels";

interface RappelsSectionProps {
  personnalisation: Personnalisation;
  onSave: (p: Personnalisation) => Promise<void> | void;
}

/**
 * Quand l'application prévient d'un rendez-vous.
 *
 * Deux nombres, et deux moments qui n'ont rien à voir l'un avec l'autre.
 *
 * La VEILLE, à une heure fixe : c'est le moment où l'on range sa journée
 * et où l'on regarde la suivante. Dix-huit heures convient à un
 * commerce qui ferme le soir ; un boulanger qui ouvre à quatre heures du
 * matin veut être prévenu bien plus tôt, et un salon qui ferme à vingt
 * heures bien plus tard. C'est exactement le genre de réglage qu'aucune
 * valeur par défaut ne peut deviner.
 *
 * LE JOUR MÊME, un délai avant l'heure dite : prévenir la veille d'un
 * rendez-vous d'aujourd'hui ne sert à rien, il faut compter en minutes.
 *
 * ── Pourquoi l'aperçu en toutes lettres ──
 *
 * « 18 » et « 60 » ne disent pas grand-chose posés dans deux cases. La
 * phrase sous les champs rejoue la règle avec les valeurs choisies, si
 * bien qu'on voit ce qu'on règle avant d'enregistrer.
 */
export const RappelsSection: React.FC<RappelsSectionProps> = ({ personnalisation, onSave }) => {
  const actuels = delaisDeRappel(personnalisation.rappels);
  const [veille, setVeille] = useState(String(actuels.veilleHeure));
  const [minutes, setMinutes] = useState(String(actuels.memeJourMinutes));
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);

  // Ce que la saisie donnera vraiment : les bornes sont celles de la
  // base de calcul, pas une seconde règle écrite ici.
  const apercu = delaisDeRappel({ veilleHeure: Number(veille), memeJourMinutes: Number(minutes) });
  const modifie =
    apercu.veilleHeure !== actuels.veilleHeure ||
    apercu.memeJourMinutes !== actuels.memeJourMinutes;
  const parDefaut =
    apercu.veilleHeure === DELAIS_PAR_DEFAUT.veilleHeure &&
    apercu.memeJourMinutes === DELAIS_PAR_DEFAUT.memeJourMinutes;

  const enregistrer = async () => {
    setEnregistrement(true);
    // Le reste de la personnalisation est recopié : cet écran ne règle
    // que les rappels et ne doit pas emporter le vocabulaire au passage.
    //
    // Revenu aux valeurs du logiciel, on RETIRE la clé plutôt que
    // d'écrire les mêmes nombres : une clé absente veut dire « comme
    // prévu », et suivra donc une évolution future des valeurs par
    // défaut. Un choix figé un jour donné ne le ferait pas.
    const suite: Personnalisation = { ...personnalisation };
    if (parDefaut) delete suite.rappels;
    else
      suite.rappels = { veilleHeure: apercu.veilleHeure, memeJourMinutes: apercu.memeJourMinutes };

    await onSave(suite);
    setEnregistrement(false);
    setEnregistre(true);
    window.setTimeout(() => setEnregistre(false), 3000);
  };

  const revenirAuxDefauts = () => {
    setVeille(String(DELAIS_PAR_DEFAUT.veilleHeure));
    setMinutes(String(DELAIS_PAR_DEFAUT.memeJourMinutes));
  };

  return (
    <SettingsSection
      title="Rappels"
      icon={<BellRing className="h-4 w-4" />}
      description="Combien de temps à l'avance la cloche prévient d'un rendez-vous."
      aside={
        <div className="flex flex-wrap items-center gap-2">
          {!parDefaut && (
            <button type="button" onClick={revenirAuxDefauts} className="app-btn-secondary">
              <RotateCcw className="h-4 w-4" />
              Valeurs d&apos;origine
            </button>
          )}
          <button
            type="button"
            onClick={enregistrer}
            disabled={!modifie || enregistrement}
            className="app-btn-primary"
          >
            <Save className="h-4 w-4" />
            {enregistrement ? "Enregistrement…" : enregistre ? "Enregistré" : "Enregistrer"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="rap-veille"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              La veille, à
            </label>
            <div className="flex items-center gap-2">
              <input
                id="rap-veille"
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={veille}
                onChange={(e) => setVeille(e.target.value)}
                className="app-field"
              />
              <span className="shrink-0 text-sm text-muted-foreground">h</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Pour un rendez-vous de demain ou plus tard. Entre 0 et 23.
            </p>
          </div>

          <div>
            <label
              htmlFor="rap-minutes"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Le jour même
            </label>
            <div className="flex items-center gap-2">
              <input
                id="rap-minutes"
                type="number"
                inputMode="numeric"
                min={5}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="app-field"
              />
              <span className="shrink-0 text-sm text-muted-foreground">min avant</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Pour un rendez-vous d&apos;aujourd&apos;hui. Entre 5 minutes et 24 heures.
            </p>
          </div>
        </div>

        <p className="rounded-xl border border-border p-3 text-sm leading-relaxed text-muted-foreground">
          Un rendez-vous de demain sera annoncé{" "}
          <strong className="text-foreground">aujourd&apos;hui à {apercu.veilleHeure} h</strong>. Un
          rendez-vous de cet après-midi le sera{" "}
          <strong className="text-foreground">
            {apercu.memeJourMinutes} minutes avant l&apos;heure dite
          </strong>
          .
        </p>
      </div>
    </SettingsSection>
  );
};
