import type { OngletOrg } from "./contexte";

/**
 * Les quatre entrées du groupe « Organisation » du menu, et l'onglet de
 * la page v2 qui répond à chacune. Fichier sans dépendance : la coquille
 * de l'application le lit sans télécharger la page.
 */
export const VUE_DE_L_ONGLET: Record<OngletOrg, string> = {
  apercu: "vue_equipe",
  taches: "taches",
  agenda: "agenda",
  rappels: "rappels",
};

const ONGLET_DE_LA_VUE: Record<string, OngletOrg> = {
  vue_equipe: "apercu",
  taches: "taches",
  agenda: "agenda",
  rappels: "rappels",
};

export const ongletDeLaVue = (vue: string): OngletOrg | null => ONGLET_DE_LA_VUE[vue] ?? null;

/** Les onglets que le menu montre, dans l'ordre de la maquette. */
export const ongletsVisibles = (vuesDuMenu: string[]): OngletOrg[] =>
  (["apercu", "taches", "agenda", "rappels"] as OngletOrg[]).filter((o) =>
    vuesDuMenu.includes(VUE_DE_L_ONGLET[o]),
  );
