import { normaliser, type Regime } from "./pharmacie";

/**
 * LES MÉDICAMENTS COURANTS D'UNE OFFICINE
 *
 * De quoi remplir une fiche d'un geste : on tape « amox », on choisit
 * « Amoxicilline 500 mg · Gélule », et la molécule, le dosage, la forme
 * et le régime de délivrance se posent. Le pharmacien garde la main : ce
 * ne sont que des propositions, qu'il corrige à sa guise (un laboratoire,
 * un régime différent dans son pays).
 *
 * La liste suit les médicaments essentiels qu'on trouve partout, plus le
 * petit matériel qu'une pharmacie vend chaque jour.
 */
export interface MedicamentCourant {
  nom: string;
  dci: string;
  dosage: string;
  forme: string;
  regime: Regime;
  frais?: boolean;
}

const m = (
  nom: string,
  dci: string,
  dosage: string,
  forme: string,
  regime: Regime = "libre",
  frais = false,
): MedicamentCourant => ({ nom, dci, dosage, forme, regime, frais });

export const MEDICAMENTS_COURANTS: MedicamentCourant[] = [
  // Douleur et fièvre
  m("Paracétamol", "Paracétamol", "500 mg", "Comprimé"),
  m("Paracétamol", "Paracétamol", "1 g", "Comprimé"),
  m("Paracétamol sirop", "Paracétamol", "120 mg/5 ml", "Sirop"),
  m("Ibuprofène", "Ibuprofène", "200 mg", "Comprimé"),
  m("Ibuprofène", "Ibuprofène", "400 mg", "Comprimé"),
  m("Aspirine", "Acide acétylsalicylique", "500 mg", "Comprimé"),
  m("Diclofénac", "Diclofénac", "50 mg", "Comprimé", "ordonnance"),
  m("Tramadol", "Tramadol", "50 mg", "Gélule", "liste_I"),
  m("Paracétamol codéiné", "Paracétamol, codéine", "500/30 mg", "Comprimé", "liste_I"),
  m("Morphine", "Morphine", "10 mg/ml", "Injectable", "stupefiant"),
  // Anti-infectieux
  m("Amoxicilline", "Amoxicilline", "500 mg", "Gélule", "ordonnance"),
  m("Amoxicilline suspension", "Amoxicilline", "250 mg/5 ml", "Suspension buvable", "ordonnance"),
  m(
    "Amoxicilline + Ac. clavulanique",
    "Amoxicilline, acide clavulanique",
    "1 g",
    "Comprimé",
    "ordonnance",
  ),
  m("Cloxacilline", "Cloxacilline", "500 mg", "Gélule", "ordonnance"),
  m("Cotrimoxazole", "Sulfaméthoxazole, triméthoprime", "480 mg", "Comprimé", "ordonnance"),
  m("Métronidazole", "Métronidazole", "250 mg", "Comprimé", "ordonnance"),
  m("Métronidazole", "Métronidazole", "500 mg", "Comprimé", "ordonnance"),
  m("Ciprofloxacine", "Ciprofloxacine", "500 mg", "Comprimé", "ordonnance"),
  m("Doxycycline", "Doxycycline", "100 mg", "Gélule", "ordonnance"),
  m("Azithromycine", "Azithromycine", "500 mg", "Comprimé", "ordonnance"),
  m("Érythromycine", "Érythromycine", "500 mg", "Comprimé", "ordonnance"),
  m("Ceftriaxone", "Ceftriaxone", "1 g", "Injectable", "ordonnance"),
  m("Gentamicine", "Gentamicine", "80 mg", "Injectable", "ordonnance"),
  m("Fluconazole", "Fluconazole", "150 mg", "Gélule", "ordonnance"),
  m("Miconazole", "Miconazole", "2 %", "Crème"),
  m("Nystatine", "Nystatine", "100 000 UI/ml", "Suspension buvable", "ordonnance"),
  // Paludisme et parasites
  m("Artéméther-Luméfantrine", "Artéméther, luméfantrine", "20/120 mg", "Comprimé", "ordonnance"),
  m("Artésunate-Amodiaquine", "Artésunate, amodiaquine", "100/270 mg", "Comprimé", "ordonnance"),
  m("Quinine", "Quinine", "300 mg", "Comprimé", "ordonnance"),
  m("Albendazole", "Albendazole", "400 mg", "Comprimé"),
  m("Mébendazole", "Mébendazole", "100 mg", "Comprimé"),
  m("Praziquantel", "Praziquantel", "600 mg", "Comprimé", "ordonnance"),
  // Digestion
  m("SRO", "Sels de réhydratation orale", "20,5 g", "Sachet"),
  m("Zinc", "Sulfate de zinc", "20 mg", "Comprimé"),
  m("Oméprazole", "Oméprazole", "20 mg", "Gélule", "ordonnance"),
  m("Antiacide", "Hydroxyde d'aluminium, hydroxyde de magnésium", "", "Suspension buvable"),
  m("Métoclopramide", "Métoclopramide", "10 mg", "Comprimé", "ordonnance"),
  m("Lopéramide", "Lopéramide", "2 mg", "Gélule"),
  m("Butylscopolamine", "Butylscopolamine", "10 mg", "Comprimé"),
  // Respiration et allergie
  m("Salbutamol", "Salbutamol", "100 µg/dose", "Inhalateur", "ordonnance"),
  m("Salbutamol", "Salbutamol", "2 mg", "Comprimé", "ordonnance"),
  m("Chlorphénamine", "Chlorphénamine", "4 mg", "Comprimé"),
  m("Cétirizine", "Cétirizine", "10 mg", "Comprimé"),
  m("Loratadine", "Loratadine", "10 mg", "Comprimé"),
  m("Prednisolone", "Prednisolone", "5 mg", "Comprimé", "ordonnance"),
  m("Dexaméthasone", "Dexaméthasone", "4 mg/ml", "Injectable", "ordonnance"),
  // Cœur, tension, diabète
  m("Amlodipine", "Amlodipine", "5 mg", "Comprimé", "ordonnance"),
  m("Captopril", "Captopril", "25 mg", "Comprimé", "ordonnance"),
  m("Hydrochlorothiazide", "Hydrochlorothiazide", "25 mg", "Comprimé", "ordonnance"),
  m("Nifédipine", "Nifédipine", "20 mg", "Comprimé", "ordonnance"),
  m("Metformine", "Metformine", "500 mg", "Comprimé", "ordonnance"),
  m("Glibenclamide", "Glibenclamide", "5 mg", "Comprimé", "ordonnance"),
  m("Insuline rapide", "Insuline humaine", "100 UI/ml", "Injectable", "ordonnance", true),
  // Femme, enfant, vitamines
  m("Fer + Acide folique", "Sulfate ferreux, acide folique", "60/0,4 mg", "Comprimé"),
  m("Acide folique", "Acide folique", "5 mg", "Comprimé"),
  m("Vitamine C", "Acide ascorbique", "500 mg", "Comprimé"),
  m("Multivitamines", "Vitamines", "", "Comprimé"),
  m("Oxytocine", "Oxytocine", "10 UI", "Injectable", "ordonnance", true),
  m("Diazépam", "Diazépam", "5 mg", "Comprimé", "liste_I"),
  // Soins et petit matériel
  m("Povidone iodée", "Povidone iodée", "10 %", "Solution cutanée"),
  m("Alcool", "Éthanol", "70 %", "Solution cutanée"),
  m("Eau oxygénée", "Peroxyde d'hydrogène", "10 volumes", "Solution cutanée"),
  m("Compresses stériles", "", "10 x 10 cm", "Matériel"),
  m("Bande de gaze", "", "", "Matériel"),
  m("Sparadrap", "", "", "Matériel"),
  m("Seringue", "", "5 ml", "Matériel"),
  m("Gants d'examen", "", "", "Matériel"),
  m("Test de grossesse", "", "", "Matériel"),
  m("Test rapide paludisme (TDR)", "", "", "Matériel"),
  m("Préservatifs", "", "", "Matériel"),
];

/** Les propositions pour ce qu'on vient de taper : par nom ou par molécule. */
export function proposerMedicaments(saisie: string, max = 5): MedicamentCourant[] {
  const q = normaliser(saisie);
  if (q.length < 2) return [];
  const mots = q.split(" ").filter(Boolean);
  return MEDICAMENTS_COURANTS.filter((x) => {
    const texte = normaliser(`${x.nom} ${x.dci} ${x.dosage}`);
    return mots.every((mot) => texte.includes(mot));
  })
    .sort(
      (a, b) => Number(!normaliser(a.nom).startsWith(q)) - Number(!normaliser(b.nom).startsWith(q)),
    )
    .slice(0, max);
}

/**
 * Le prix de vente à partir du prix d'achat et d'un coefficient, arrondi
 * au-dessus à 50 Ar : un prix qu'on rend facilement en monnaie.
 */
export const prixAuCoefficient = (prixAchat: number, coefficient: number) =>
  prixAchat > 0 ? Math.ceil((prixAchat * coefficient) / 50) * 50 : 0;
