import React from "react";
import { SelecteurListe } from "../shared/SelecteurListe";
import { UNITES } from "../../lib/detailsProduit";

interface SelecteurUniteProps {
  id: string;
  valeur: string;
  onChange: (unite: string) => void;
  label?: string;
  aide?: string;
}

/**
 * L'unité de base d'un produit : celle dans laquelle le stock se compte.
 *
 * Les unités courantes sont proposées, mais la saisie reste ouverte —
 * « bidon de 20 L » est une unité légitime pour qui vend au bidon.
 */
export const SelecteurUnite: React.FC<SelecteurUniteProps> = ({
  id,
  valeur,
  onChange,
  label = "Unité de base",
  aide = "Celle dans laquelle le stock se compte : la plus petite quantité vendue.",
}) => {
  const options = React.useMemo(() => {
    const u = valeur.trim();
    const liste =
      u && !UNITES.some((x) => x.toLowerCase() === u.toLowerCase()) ? [u, ...UNITES] : UNITES;
    return liste.map((nom) => ({ id: nom, nom }));
  }, [valeur]);

  return (
    <SelecteurListe
      id={id}
      label={label}
      options={options}
      valeur={valeur.trim() || null}
      onChange={(u) => onChange(u ?? "")}
      onCreer={async (nom) => ({ id: nom.trim(), error: null })}
      libelleVide="Non précisée"
      placeholder="Chercher ou saisir une unité…"
      aide={aide}
    />
  );
};
