/**
 * La date du jour, celle de l'utilisateur.
 *
 * LE DÉFAUT QUE CECI CORRIGE
 *
 * L'application écrivait partout `new Date().toISOString().split("T")[0]`
 * pour dire « aujourd'hui ». `toISOString` rend la date en temps
 * universel : à Antananarivo, qui vit trois heures en avance, une saisie
 * faite entre minuit et trois heures du matin était datée de la VEILLE.
 *
 * Ce n'était pas une hypothèse — constaté en direct à 01 h 47 le
 * 8 septembre, où le code annonçait le 7. Une vente enregistrée à la
 * fermeture d'un commerce qui ferme tard tombait donc dans la mauvaise
 * journée, et le bilan du jour comptait faux, sans que rien ne le
 * signale.
 *
 * Le même calcul faussait aussi les filtres : « les ventes du jour »
 * cherchait celles de la veille pendant ces trois heures.
 *
 * COMMENT CELLE-CI S'Y PREND
 *
 * Elle lit l'année, le mois et le jour du calendrier local — ceux que
 * l'utilisateur a sous les yeux — et les assemble au format que la base
 * attend. Aucune conversion de fuseau n'intervient, donc aucune ne peut
 * décaler quoi que ce soit.
 *
 * Les colonnes concernées sont de type `date` en base : elles ne portent
 * ni heure ni fuseau, et n'attendent qu'un jour du calendrier.
 */
export const dateDuJour = (maintenant: Date = new Date()): string => {
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
};

/**
 * Le jour du calendrier dans `n` jours.
 *
 * On avance sur le calendrier plutôt que d'ajouter des millisecondes :
 * un changement d'heure fait des journées de vingt-trois ou vingt-cinq
 * heures, et « dans trente jours » cesserait alors de tomber juste.
 */
export const dateDansNJours = (n: number, maintenant: Date = new Date()): string => {
  const cible = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + n);
  return dateDuJour(cible);
};
