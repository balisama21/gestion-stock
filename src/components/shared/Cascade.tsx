import React from "react";

/**
 * UNE CASCADE : comment un total se construit, poste après poste.
 *
 * Chaque étape ajoute ou retire un montant ; sous son libellé, une piste
 * montre où le solde en était avant elle et où il en est après — un pas
 * vers la droite pour ce qui entre (vert), vers la gauche pour ce qui
 * sort (rouge). Une étape « total » repart de zéro et montre le solde
 * atteint, en couleur pleine.
 *
 * C'est la lecture d'un état financier sans le tableau : on voit d'un
 * coup d'œil quels postes pèsent, et l'on refait l'addition de l'œil
 * jusqu'au total, sans relire les chiffres un à un.
 */
export interface EtapeCascade {
  cle: string;
  libelle: string;
  detail?: string;
  /** Le montant, signé : positif entre, négatif sort. Ignoré pour un total. */
  montant?: number;
  /** Une étape de total : elle montre le solde atteint, depuis zéro. */
  total?: boolean;
  icone?: React.ReactNode;
}

interface CascadeProps {
  etapes: EtapeCascade[];
  /** Met un montant en forme, sans signe : le signe est posé ici. */
  format: (n: number) => string;
  className?: string;
}

export const Cascade: React.FC<CascadeProps> = ({ etapes, format, className = "" }) => {
  // Le solde avant et après chaque étape.
  let solde = 0;
  const lignes = etapes.map((e) => {
    const avant = e.total ? 0 : solde;
    const apres = e.total ? solde : solde + (e.montant ?? 0);
    if (!e.total) solde = apres;
    return { ...e, avant, apres };
  });

  // L'échelle couvre tout ce que le solde a parcouru, zéro compris.
  const bornes = lignes.flatMap((l) => [l.avant, l.apres, 0]);
  const min = Math.min(...bornes);
  const max = Math.max(...bornes);
  const etendue = max - min || 1;
  const position = (v: number) => ((v - min) / etendue) * 100;

  return (
    <div className={`app-cascade ${className}`} role="list">
      {lignes.map((l) => {
        // Un poste qui retire, même à zéro, garde son « − » : on le passe
        // en « -0 », et c'est son signe qui le dit.
        const retire = (l.montant ?? 0) < 0 || Object.is(l.montant, -0);
        const sens = l.total ? "total" : retire ? "moins" : "plus";
        const bas = Math.min(l.avant, l.apres);
        const haut = Math.max(l.avant, l.apres);
        const valeur = l.total ? l.apres : (l.montant ?? 0);
        const texteMontant = l.total
          ? `${valeur < 0 ? "− " : ""}${format(Math.abs(valeur))}`
          : `${retire ? "−" : "+"} ${format(Math.abs(valeur))}`;
        return (
          <div key={l.cle} role="listitem" className={`app-cascade-etape est-${sens}`}>
            {l.icone && (
              <span className="app-cascade-ico" aria-hidden="true">
                {l.icone}
              </span>
            )}
            <span className="app-cascade-texte">
              <span className="app-cascade-libelle">{l.libelle}</span>
              {l.detail && <span className="app-cascade-detail">{l.detail}</span>}
            </span>
            <span className="app-cascade-montant">{texteMontant}</span>
            <span className="app-cascade-piste" aria-hidden="true">
              {min < 0 && <span className="app-cascade-zero" style={{ left: `${position(0)}%` }} />}
              <i
                style={{
                  left: `${position(bas)}%`,
                  width: `${Math.max(haut > bas ? 1.5 : 0, position(haut) - position(bas))}%`,
                }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
};
