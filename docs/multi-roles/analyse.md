# Plusieurs rôles pour une même personne dans une boutique — analyse

Statut : proposition, à valider avant tout code. Rien n'est appliqué en base.

## Le besoin

Un propriétaire doit pouvoir confier à une même personne plusieurs rôles dans
sa boutique (par exemple vendeur **et** livreur), dans toutes les boutiques du
SaaS, pas seulement chez Kinvest. Aujourd'hui c'est impossible : accepter une
deuxième invitation **remplace** le premier rôle sans prévenir. C'est ce qui
est arrivé le 3 octobre : le rôle vendeur chez Kinvest a été remplacé par le
rôle livreur.

## Ce qui existe

### En base

- `store_members` : une ligne par personne et par boutique (contrainte
  `UNIQUE (store_id, user_id)`), avec `role text` (texte libre, défaut
  `seller`) et `permissions jsonb`, qui porte les **droits réels**.
- Le rôle sert de **gabarit** : à l'invitation, il pré-remplit `permissions`,
  que le propriétaire peut ensuite ajuster. En dehors du livreur, ce sont les
  permissions qui décident des droits, pas le rôle.
- **Le livreur est une frontière de sécurité.** `is_store_member()` exclut
  `role = 'livreur'` (migration `20260908190000_etape8_role_livreur.sql`) :
  un livreur n'est pas membre du personnel, ne lit pas les données de la
  boutique, et ne voit que ses propres livraisons. Toutes les politiques RLS
  qui s'appuient sur `is_store_member()` en dépendent.
- Fonctions qui lisent ou écrivent `store_members.role` : `is_store_member`,
  `accept_invitation`, `accept_invitation_by_code`,
  `rejoindre_invitation_sur_marque` (appelée par `rejoindre_par_lien_sur_marque`),
  `transferer_boutique`, `garder_le_proprietaire`,
  `sync_profile_store_membership`. Les acceptations font
  `ON CONFLICT (store_id, user_id) DO UPDATE SET role = EXCLUDED.role,
  permissions = EXCLUDED.permissions` : d'où le remplacement.
- Données réelles au 3 octobre : **2 lignes** dans `store_members` sur tout
  le SaaS (un vendeur, un livreur). La reprise de données est donc minime.

### Dans l'application

- `useWorkspace` construit `memberRoles[store_id] = role` (un seul rôle par
  boutique) et expose `memberRole`.
- `BalsamaApp` : `memberRole === "livreur"` affiche `EspaceLivreur` **à la
  place** de l'application. Il n'y a aucun moyen d'en sortir vers l'autre
  espace.
- `admin` / `manager` ouvrent certains réglages (`BalsamaApp.tsx:426`, `:501`).
- Le tableau de bord choisit sa vue par défaut d'après le rôle (`vueDuRole`).
- `LivraisonsView` liste les livreurs avec `role === "livreur"`.
- `TransfertBoutiqueSection` exclut les livreurs des repreneurs possibles.
- `InviteWizard` et la section équipe de `ParametresView` ne gèrent qu'un rôle.
- Gabarits : `admin`, `manager`, `comptable`, `vendeur`,
  `gestionnaire_stock`, `livreur` (`src/lib/permissions.ts`).

## Structure de données proposée

**Recommandation : garder une seule ligne par personne et par boutique, et
lui ajouter une liste de rôles.**

```sql
ALTER TABLE store_members ADD COLUMN roles text[];
UPDATE store_members SET roles = ARRAY[role];   -- reprise : 2 lignes
```

- `roles` devient la vérité. `role` est **conservé** et tenu à jour par un
  déclencheur comme « rôle principal » (le premier rôle qui n'est pas livreur,
  sinon livreur). C'est ce qui garde compatibles les navigateurs encore
  ouverts sur l'ancienne version, qui ne lisent que `role`.
- Si un ancien client écrit seulement `role`, le déclencheur en déduit
  `roles = ARRAY[role]`.
- `permissions` reste **une seule carte par personne et par boutique**. Quand
  on ajoute un rôle, la carte devient l'union des droits déjà accordés et du
  gabarit du nouveau rôle. Le propriétaire peut toujours l'ajuster ensuite.

Alternative écartée : une ligne par rôle. Elle casserait la contrainte
d'unicité, et tout le code qui suppose une ligne par personne (listes
d'équipe en double, `memberRoles`, `is_store_member`, transfert). Le coût est
bien plus élevé pour le même résultat.

## Logique métier et arbitrages

1. **Les droits s'additionnent.** Vendeur + livreur = les droits du vendeur,
   plus l'espace livreur pour ses courses. Le rôle qui donne le plus l'emporte,
   c'est le sens même de « confier deux rôles ».
2. **Membre du personnel = au moins un rôle autre que livreur.**
   `is_store_member()` devient « existe une ligne dont `roles` contient
   autre chose que `livreur` ». Un livreur seul reste isolé exactement comme
   aujourd'hui. Un vendeur-livreur voit ce qu'un vendeur voit.
3. **Une invitation ajoute, elle ne remplace plus.** Accepter une invitation
   dans une boutique où l'on est déjà membre ajoute le rôle à la liste et
   fusionne les permissions. Retirer un rôle reste un geste du propriétaire,
   dans Paramètres, jamais un effet de bord.
4. **Pas d'interrupteur par boutique.** Rien ne change pour une personne qui
   n'a qu'un rôle : la fonction ne s'active que si un propriétaire confie
   réellement un deuxième rôle. Seul changement de comportement : la
   deuxième invitation ajoute au lieu d'écraser, ce qui corrige un défaut.

## Écrans

- **Choix de l'espace.** Si la personne est livreur **et** a un autre rôle
  dans la boutique active, un sélecteur « Espace boutique / Espace livreur »
  apparaît, dans l'en-tête de l'application et dans l'en-tête de l'espace
  livreur (là où se trouvent déjà actualiser et déconnexion). Le dernier
  choix est retenu par boutique et par navigateur, comme la boutique active
  (`lireBoutiqueActive`). Par défaut : l'espace boutique.
- **Paramètres, équipe.** Le rôle unique devient une liste de cases à cocher.
  Cocher un rôle propose d'ajouter son gabarit aux permissions, avec un
  aperçu avant d'enregistrer. Décocher ne retire pas de permission en
  silence : on montre ce qui serait retiré et on demande confirmation.
- **Invitation d'une personne déjà membre.** L'assistant l'indique (« déjà
  vendeur ; l'invitation ajoutera le rôle livreur ») et la page d'acceptation
  le redit avant de valider.
- **Libellés.** Partout où un rôle s'affiche (liste d'équipe, en-tête), on
  affiche la liste : « Vendeur · Livreur ».
- **Tableau de bord.** Vue par défaut = celle du rôle principal.

## Permissions

Le moteur de permissions ne change pas : il lit toujours une seule carte
`permissions` par membre. Seuls `is_store_member()` et les fonctions
d'acceptation passent à `roles`. Les tests de `src/lib/permissions` restent
valables. Il faut ajouter des tests pour l'union des gabarits.

## Trésorerie

Aucun impact. Les rôles ne touchent ni aux montants ni aux écritures. Les
salaires ne dépendent pas du rôle (`SalairesView` ne le lit pas).

## Vie dans le temps

- Un nouveau gabarit de rôle s'ajoute à `RoleKey` comme aujourd'hui, sans
  migration (la colonne est en texte libre).
- `role` (le rôle principal) pourra être supprimé plus tard, quand plus aucun
  code ne le lit. Ce n'est pas nécessaire pour ce chantier.
- Le journal d'activité garde ses entrées : les rôles ne sont pas historisés,
  comme aujourd'hui.

## Découpage en étapes (chacune utilisable seule sur `main`)

1. **Base, en SQL que tu exécutes toi-même** : colonne `roles` + reprise +
   déclencheur de synchronisation, `is_store_member()` sur `roles`,
   acceptations qui ajoutent au lieu d'écraser. Le site actuel continue de
   fonctionner sans changement, puisqu'il lit encore `role`.
2. **Application** : `useWorkspace` lit `roles`, sélecteur d'espace,
   `LivraisonsView` / transfert / tableau de bord sur `roles`.
3. **Paramètres et invitation** : cases à cocher dans l'équipe, assistant et
   page d'acceptation qui annoncent l'ajout d'un rôle.

Chaque étape se livre en PR séparée. L'étape 1 se présente en bloc SQL prêt
à coller, avec son retour arrière dans `supabase/retours-arriere/`.

## Points à trancher

1. **Espace par défaut** pour une personne vendeur-livreur : je recommande
   l'espace boutique, puis son dernier choix.
2. **Décocher un rôle** : je recommande de proposer de retirer les
   permissions de son gabarit qui ne sont couvertes par aucun autre rôle, avec
   un aperçu et une confirmation, jamais en silence.
3. **Propriétaire et rôles** : le propriétaire garde tous les droits. Je
   recommande de lui permettre d'être aussi livreur dans sa propre boutique
   (pour voir ses courses), mais seulement dans une étape ultérieure.
