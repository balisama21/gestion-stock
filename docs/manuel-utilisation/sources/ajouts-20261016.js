// Tables créées le 16 octobre 2026, relevées dans les migrations du dépôt :
// supabase/migrations/20261016110000_ia_infrastructure.sql
// supabase/migrations/20261016120000_journal_des_imports.sql
// Même format que schema.js et descriptions.js, fusionné par eux.
const COLS = {
  imports_donnees:
    "id|uuid|NN|gen_random_uuid() ; store_id|uuid|NN| ; user_id|uuid||auth.uid() ; nom_fichier|text|NN| ; source|text|NN|'fichier' ; statut|text|NN|'en_cours' ; bilan|jsonb|NN|'[]' ; erreurs|jsonb|NN|'[]' ; cree_le|timestamptz|NN|now() ; termine_le|timestamptz||",
  ia_reglages_plateforme:
    "id|boolean|NN|true ; ia_active|boolean|NN|false ; fournisseur|text|NN|'openai' ; modele|text|| ; budget_mensuel_usd|numeric|NN|0 ; seuil_alerte_pct|integer|NN|80 ; requetes_par_minute|integer|NN|6 ; max_tokens_sortie|integer|NN|1500 ; max_caracteres_entree|integer|NN|60000 ; max_fichier_mo|integer|NN|8 ; updated_at|timestamptz|NN|now() ; updated_by|uuid||",
  ia_tarifs:
    "fournisseur|text|NN| ; modele|text|NN| ; prix_entree_par_million_usd|numeric|NN| ; prix_sortie_par_million_usd|numeric|NN| ; source|text|| ; updated_at|timestamptz|NN|now()",
  ia_reglages_boutique:
    "store_id|uuid|NN| ; ia_active|boolean|NN|false ; fonctionnalites|text[]|NN|'{}' ; plafond_mensuel_usd|numeric|NN|0 ; requetes_mensuelles_max|integer|| ; updated_at|timestamptz|NN|now()",
  ia_consommation:
    "id|uuid|NN|gen_random_uuid() ; store_id|uuid|| ; user_id|uuid|| ; fonctionnalite|text|NN| ; fournisseur|text|NN| ; modele|text|| ; tokens_entree|integer|| ; tokens_sortie|integer|| ; cout_reserve_usd|numeric|NN|0 ; cout_estime_usd|numeric|| ; statut|text|NN| ; code_erreur|text|| ; duree_ms|integer|| ; cree_le|timestamptz|NN|now() ; termine_le|timestamptz||",
  ia_actions:
    "id|uuid|NN|gen_random_uuid() ; store_id|uuid|NN| ; user_id|uuid|| ; consommation_id|uuid|| ; fonctionnalite|text|NN| ; type_action|text|NN| ; resume|text|| ; charge_utile|jsonb|| ; statut|text|NN|'proposee' ; resultat|jsonb|| ; cree_le|timestamptz|NN|now() ; decide_par|uuid|| ; decide_le|timestamptz||",
};

const CONS = {
  imports_donnees:
    "PK(id) ; FK store_id>stores CASCADE ; FK user_id>profiles SETNULL ; CK source ∈ {fichier, ia} ; CK statut ∈ {en_cours, termine, partiel, echec, interrompu} ; CK nom_fichier de 1 à 200 caractères ; CK bilan et erreurs = listes JSON de taille bornée",
  ia_reglages_plateforme:
    "PK(id) ; FK updated_by>profiles SETNULL ; CK une seule ligne (id = vrai) ; CK fournisseur ∈ {openai} ; CK seuil_alerte_pct 1–100 ; CK requetes_par_minute 1–120 ; CK max_tokens_sortie 64–16 000 ; CK max_fichier_mo 1–20",
  ia_tarifs: "PK(fournisseur,modele) ; CK fournisseur ∈ {openai} ; CK prix ≥ 0",
  ia_reglages_boutique:
    "PK(store_id) ; FK store_id>stores CASCADE ; CK fonctionnalites ⊂ {import_extraction, assistant, redaction, reapprovisionnement, anomalies} ; CK plafond ≥ 0",
  ia_consommation:
    "PK(id) ; FK store_id>stores SETNULL ; FK user_id>profiles SETNULL ; CK statut ∈ {reserve, reussi, echec, refuse} ; CK jetons ≥ 0",
  ia_actions:
    "PK(id) ; FK store_id>stores CASCADE ; FK user_id>profiles SETNULL ; FK consommation_id>ia_consommation SETNULL ; FK decide_par>profiles SETNULL ; CK statut ∈ {proposee, confirmee, rejetee, executee, echec}",
};

const TRIGGERS = {
  imports_donnees: "un import clos ne change plus ; ni la boutique, ni l'auteur, ni le fichier ne se modifient",
  ia_reglages_plateforme: "horodatage",
  ia_tarifs: "horodatage",
  ia_reglages_boutique: "horodatage",
};

// cat : M = métier, L = liaison / détail, T = technique, P = plateforme
const TABLES = {
  imports_donnees: [
    "T",
    "Journal des imports de données : un bilan par import (fichier, destinations, lignes ajoutées, mises à jour, ignorées, rejetées, premières erreurs). Les lignes importées vont dans leurs tables habituelles.",
    "Produits, Clients, Fournisseurs, Achats (bouton Importer › Imports récents)",
  ],
  ia_reglages_plateforme: [
    "P",
    "Réglages de l'intelligence artificielle pour toute la plateforme (une seule ligne) : activation, modèle, budget mensuel, limites. Éteinte par défaut.",
    "Paramètres › Plateforme (administrateur)",
  ],
  ia_tarifs: ["P", "Tarifs des modèles d'IA saisis par l'administrateur, pour estimer les coûts.", "Paramètres › Plateforme (administrateur)"],
  ia_reglages_boutique: [
    "P",
    "Activation de l'IA et plafond de dépense pour une boutique, fonctionnalité par fonctionnalité.",
    "Paramètres › Plateforme (administrateur)",
  ],
  ia_consommation: [
    "P",
    "Une ligne par requête d'IA : jetons, coût réservé puis estimé, statut. Aucun contenu (ni texte ni document) n'est conservé.",
    "Paramètres › Plateforme (administrateur)",
  ],
  ia_actions: [
    "T",
    "Propositions faites par l'IA (par exemple des lignes extraites d'un PDF). Une personne les confirme ou les rejette ; seule une action confirmée est exécutée.",
    "Import (extraction par IA)",
  ],
};

const SPEC = {
  "imports_donnees.user_id": "Auteur de l'import",
  "imports_donnees.nom_fichier": "Nom du fichier importé",
  "imports_donnees.source": "fichier ou ia (lignes extraites par l'IA)",
  "imports_donnees.statut": "en_cours, termine, partiel, echec, interrompu",
  "imports_donnees.bilan": "Bilan par module (ajoutés, mis à jour, ignorés, rejetés)",
  "imports_donnees.erreurs": "Premières erreurs, ligne par ligne (200 au plus)",
  "imports_donnees.termine_le": "Fin de l'import",
  "ia_reglages_plateforme.id": "Ligne unique",
  "ia_reglages_plateforme.ia_active": "IA activée pour la plateforme",
  "ia_reglages_plateforme.fournisseur": "Fournisseur d'IA",
  "ia_reglages_plateforme.modele": "Modèle utilisé",
  "ia_reglages_plateforme.budget_mensuel_usd": "Budget mensuel (dollars US)",
  "ia_reglages_plateforme.seuil_alerte_pct": "Seuil d'alerte du budget (%)",
  "ia_reglages_plateforme.requetes_par_minute": "Requêtes par minute au plus",
  "ia_reglages_plateforme.max_tokens_sortie": "Longueur de réponse au plus (jetons)",
  "ia_reglages_plateforme.max_caracteres_entree": "Longueur de texte envoyé au plus",
  "ia_reglages_plateforme.max_fichier_mo": "Taille de fichier au plus (Mo)",
  "ia_reglages_plateforme.updated_by": "Auteur du dernier changement",
  "ia_tarifs.fournisseur": "Fournisseur d'IA",
  "ia_tarifs.modele": "Modèle",
  "ia_tarifs.prix_entree_par_million_usd": "Prix d'un million de jetons envoyés",
  "ia_tarifs.prix_sortie_par_million_usd": "Prix d'un million de jetons reçus",
  "ia_tarifs.source": "Origine du tarif",
  "ia_reglages_boutique.ia_active": "IA activée pour la boutique",
  "ia_reglages_boutique.fonctionnalites": "Fonctionnalités autorisées",
  "ia_reglages_boutique.plafond_mensuel_usd": "Plafond mensuel (dollars US)",
  "ia_reglages_boutique.requetes_mensuelles_max": "Requêtes par mois au plus",
  "ia_consommation.user_id": "Auteur de la requête",
  "ia_consommation.fonctionnalite": "Fonctionnalité appelée",
  "ia_consommation.fournisseur": "Fournisseur d'IA",
  "ia_consommation.modele": "Modèle",
  "ia_consommation.tokens_entree": "Jetons envoyés",
  "ia_consommation.tokens_sortie": "Jetons reçus",
  "ia_consommation.cout_reserve_usd": "Coût maximal réservé avant l'appel",
  "ia_consommation.cout_estime_usd": "Coût estimé après l'appel",
  "ia_consommation.statut": "reserve, reussi, echec, refuse",
  "ia_consommation.code_erreur": "Code d'erreur",
  "ia_consommation.duree_ms": "Durée (millisecondes)",
  "ia_consommation.termine_le": "Fin de la requête",
  "ia_actions.user_id": "Auteur de la demande",
  "ia_actions.consommation_id": "Requête d'IA d'origine",
  "ia_actions.fonctionnalite": "Fonctionnalité",
  "ia_actions.type_action": "Nature de la proposition",
  "ia_actions.resume": "Résumé lisible",
  "ia_actions.charge_utile": "Contenu proposé (JSON)",
  "ia_actions.statut": "proposee, confirmee, rejetee, executee, echec",
  "ia_actions.resultat": "Résultat de l'exécution (JSON)",
  "ia_actions.decide_par": "Qui a confirmé ou rejeté",
  "ia_actions.decide_le": "Date de la décision",
};

module.exports = { COLS, CONS, TRIGGERS, TABLES, SPEC };
