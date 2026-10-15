/**
 * Qui est qui, dans les listes de l'organisation.
 *
 * Les membres viennent de `useStoreMembers` (table `store_members` +
 * `profiles`). Soi-même s'appelle « Vous », comme dans les écrans
 * actuels. La couleur d'une pastille se déduit de l'identifiant : la
 * même personne garde la même couleur d'un écran à l'autre.
 */
export interface Membre {
  user_id: string;
  full_name: string | null;
  email: string;
}

const PALETTE = ["#3A72A6", "#B06F12", "#7A5AA6", "#2F8F8A", "#A6527A", "#5D7A2E"];

export const nomDe = (id: string | null, membres: Membre[], moiId: string | null): string => {
  if (!id) return "Personne";
  if (id === moiId) return "Vous";
  const m = membres.find((x) => x.user_id === id);
  return m ? m.full_name?.trim() || m.email : "Un membre";
};

export const initialeDe = (nom: string): string =>
  nom === "Vous" ? "V" : (nom.trim().charAt(0) || "?").toUpperCase();

export const couleurDe = (id: string | null, moiId: string | null): string => {
  if (!id) return "var(--muted)";
  if (id === moiId) return "var(--accent)";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
