/** Mots de l'offre du logiciel, interdits à l'écran d'un domaine client. */
export const MOT_OFFRE =
  /(?<![\w-])(essais?|gratuit(e|s|ement)?|abonnements?|tarifs?|licence|aucun paiement requis|sans paiement|cr[ée]+ez votre boutique|cr[ée]+r (ma|votre) boutique)(?![\w-])/i;
