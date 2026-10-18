/**
 * À QUEL CLIENT APPARTIENT UNE VENTE.
 *
 * Depuis l'étape 6, une vente porte la clé du client (`sales.client_id`)
 * dès qu'une fiche a été choisie à la caisse : c'est la seule source qui
 * fasse foi. Les ventes plus anciennes n'ont que le nom saisi à la main
 * (`client_credit`) ; on les rapproche par ce nom, à la casse près.
 *
 * DEUX GARDE-FOUS, pour ne jamais mélanger deux clients :
 *
 *  - une vente qui porte déjà une clé n'est JAMAIS rattachée par son nom à
 *    une autre fiche. Avant, une vente de A dont le nom libre ressemblait
 *    à B apparaissait chez les deux, et la dette comptait deux fois ;
 *  - un nom porté par plusieurs fiches ne rattache rien : on ne sait pas
 *    à laquelle la vente revient, et la donner aux deux serait faux.
 */
export function repartirVentesParClient<
  V extends { id: string; clientId?: string | null; clientCredit?: string | null },
>(clients: { id: string; nom: string }[], ventes: V[]): Record<string, V[]> {
  const norme = (t: string | null | undefined) => (t ?? "").trim().toLowerCase();

  const fichesParNom = new Map<string, string[]>();
  for (const c of clients) {
    const cle = norme(c.nom);
    if (!cle) continue;
    fichesParNom.set(cle, [...(fichesParNom.get(cle) ?? []), c.id]);
  }

  const parClient: Record<string, V[]> = {};
  for (const c of clients) parClient[c.id] = [];

  for (const v of ventes) {
    if (v.clientId) {
      parClient[v.clientId]?.push(v);
      continue;
    }
    const fiches = fichesParNom.get(norme(v.clientCredit));
    if (fiches && fiches.length === 1) parClient[fiches[0]].push(v);
  }
  return parClient;
}
