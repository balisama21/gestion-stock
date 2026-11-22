/**
 * PETITES AIDES DE SAISIE
 *
 * Ce qui se met en forme tout seul quand on quitte un champ : un numéro
 * de téléphone, une note à laquelle on ajoute un mot.
 */

/**
 * Un numéro malgache lisible : « 0341234567 » devient « 034 12 345 67 »,
 * « 261341234567 » devient « +261 34 12 345 67 ». Tout autre numéro est
 * laissé tel qu'il a été tapé.
 */
export function formaterTelephone(saisie: string): string {
  const brut = saisie.trim();
  const c = brut.replace(/\D/g, "");
  if (c.length === 10 && c.startsWith("0")) {
    return `${c.slice(0, 3)} ${c.slice(3, 5)} ${c.slice(5, 8)} ${c.slice(8)}`;
  }
  if (c.length === 12 && c.startsWith("261")) {
    return `+261 ${c.slice(3, 5)} ${c.slice(5, 7)} ${c.slice(7, 10)} ${c.slice(10)}`;
  }
  return brut;
}

/** Ajoute un mot à une note, séparé d'une virgule, sans le répéter. */
export function ajouterALaNote(note: string, mot: string): string {
  const n = note.trim();
  if (!n) return mot;
  if (n.toLowerCase().includes(mot.toLowerCase())) return n;
  return `${n.replace(/[,.;]\s*$/, "")}, ${mot}`;
}

/** Le même jour décalé, AAAA-MM-JJ. */
export function decalerJour(jour: string, jours: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}
