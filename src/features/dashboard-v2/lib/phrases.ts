/**
 * LES PHRASES DU HAUT DE PAGE
 *
 * Deux séries : celle de la journée, celle du soir. Le texte change donc
 * deux fois par jour — au réveil, puis à l'heure du « Bonsoir » — et
 * chaque jour on passe à la phrase suivante de la série.
 *
 * QUATRE-VINGT-TREIZE PHRASES PAR SÉRIE sont livrées avec l'application :
 * plus de trois mois sans qu'aucune ne revienne. Le créateur de la
 * plateforme peut en ajouter d'autres (Paramètres → Phrases du tableau
 * de bord) ; elles prennent la suite des phrases livrées.
 *
 * QUAND LA SÉRIE EST ÉPUISÉE, deux choix, réglés dans les paramètres :
 *  - « reutiliser » : la série recommence à la première phrase ;
 *  - « attendre »   : la dernière phrase reste affichée jusqu'à ce que
 *    de nouvelles soient ajoutées, sans jamais revenir aux anciennes.
 *
 * Le rang du jour se compte depuis la date de début de chaque série :
 * relancer une série ou y ajouter des phrases une fois épuisée ne fait
 * que déplacer cette date.
 */

export interface Phrase {
  lignes: [string, string];
  devise: [string, string];
}

export type Moment = "jour" | "soir";

export type ALaFin = "reutiliser" | "attendre";

export interface ReglagesPhrases {
  aLaFin: ALaFin;
  /** Le premier jour de chaque série, « AAAA-MM-JJ ». */
  debut: Record<Moment, string>;
}

/** Le jour où les phrases livrées ont commencé à défiler. */
export const DEBUT_PAR_DEFAUT = "2026-10-11";

export const REGLAGES_PAR_DEFAUT: ReglagesPhrases = {
  aLaFin: "reutiliser",
  debut: { jour: DEBUT_PAR_DEFAUT, soir: DEBUT_PAR_DEFAUT },
};

/** [ligne 1, ligne 2, devise 1, devise 2] : la forme courte, pour lire la liste. */
type Brute = [string, string, string, string];
const enPhrase = ([a, b, c, d]: Brute): Phrase => ({ lignes: [a, b], devise: [c, d] });

const JOUR_BRUTES: Brute[] = [
  [
    "Chaque jour est une nouvelle opportunité.",
    "Votre boutique grandit, pas à pas, vers de nouveaux horizons !",
    "Ensemble vers",
    "plus de réussite !",
  ],
  [
    "Une nouvelle journée commence.",
    "Chaque client servi avec le sourire est une victoire.",
    "Le succès se cultive",
    "chaque jour !",
  ],
  [
    "Les petites actions d'aujourd'hui",
    "font les grandes réussites de demain.",
    "Pas à pas,",
    "on avance !",
  ],
  [
    "Votre énergie donne le ton de la journée.",
    "Faites-en une belle journée de ventes !",
    "Belle journée",
    "de ventes !",
  ],
  [
    "Un stock bien tenu, des clients satisfaits :",
    "c'est ainsi que se bâtit une belle boutique.",
    "Rigueur",
    "et passion !",
  ],
  [
    "Osez, essayez, progressez.",
    "Chaque effort rapproche votre boutique de ses objectifs.",
    "Cap sur",
    "vos objectifs !",
  ],
  [
    "La réussite appartient à ceux qui avancent avec un projet.",
    "Le vôtre progresse aujourd'hui encore.",
    "Croyez en",
    "votre projet !",
  ],
  [
    "Chaque vente raconte une histoire de confiance.",
    "Continuez à l'écrire, client après client.",
    "La confiance,",
    "ça se construit !",
  ],
  [
    "Un client fidèle vaut mieux que dix promesses.",
    "Prenez soin de ceux qui reviennent.",
    "Fidélité",
    "avant tout !",
  ],
  [
    "Le matin appartient à ceux qui préparent.",
    "Un coup d'œil au stock, et la journée démarre bien.",
    "Bien préparé,",
    "bien parti !",
  ],
  ["Le sourire est gratuit,", "mais il rapporte toujours.", "Souriez,", "ça vend !"],
  [
    "Chaque produit bien rangé",
    "fait gagner du temps à toute l'équipe.",
    "L'ordre,",
    "c'est du temps !",
  ],
  [
    "Les grandes entreprises ont commencé petites.",
    "La vôtre écrit son histoire aujourd'hui.",
    "Grandir",
    "sans s'arrêter !",
  ],
  [
    "Écoutez vos clients :",
    "ils vous disent ce qu'il faut vendre demain.",
    "À l'écoute",
    "du client !",
  ],
  [
    "La constance bat le talent",
    "quand le talent manque de constance.",
    "Constance",
    "et courage !",
  ],
  [
    "Aujourd'hui, visez juste :",
    "les bons produits, au bon moment, au bon prix.",
    "Viser",
    "juste !",
  ],
  ["Une boutique vivante,", "c'est une boutique qui ose changer.", "Osez", "innover !"],
  [
    "Chaque chiffre de votre tableau de bord",
    "est une décision bien préparée.",
    "Les chiffres",
    "parlent !",
  ],
  [
    "Le service fait la différence",
    "là où les prix se ressemblent.",
    "Le service",
    "fait la différence !",
  ],
  [
    "Commencez par ce qui compte le plus.",
    "Le reste suivra naturellement.",
    "L'essentiel",
    "d'abord !",
  ],
  ["Une journée bien organisée", "vaut deux journées agitées.", "Organisé", "et serein !"],
  [
    "Votre travail fait vivre des familles",
    "et anime votre quartier.",
    "Fier de",
    "votre métier !",
  ],
  [
    "Chaque matin, une page blanche.",
    "À vous d'y écrire une belle journée.",
    "Une page",
    "à écrire !",
  ],
  [
    "Les clients reviennent là où ils se sentent bien.",
    "Faites de votre boutique un lieu accueillant.",
    "Accueil",
    "chaleureux !",
  ],
  ["Ne comptez pas les jours,", "faites que les jours comptent.", "Chaque jour", "compte !"],
  [
    "Un réapprovisionnement à temps,",
    "c'est une vente qui ne s'échappe pas.",
    "Jamais",
    "en rupture !",
  ],
  [
    "Le succès n'est pas un hasard :",
    "c'est du travail, de la patience et de l'envie.",
    "Travail",
    "et envie !",
  ],
  ["Avancez avec confiance.", "Vous savez ce que vous faites.", "Confiance", "en vous !"],
  [
    "Une petite amélioration chaque jour",
    "devient une grande différence en un an.",
    "Mieux",
    "chaque jour !",
  ],
  ["Les meilleures ventes", "commencent par une bonne conversation.", "Parlez", "à vos clients !"],
  [
    "Soyez fier de ce que vous avez construit.",
    "Et continuez de bâtir.",
    "Bâtir",
    "pierre par pierre !",
  ],
  ["La qualité se remarque,", "même quand on ne la dit pas.", "La qualité", "avant tout !"],
  ["Votre équipe est votre force.", "Une journée réussie se fait ensemble.", "L'équipe", "gagne !"],
  [
    "Ce qui se mesure s'améliore.",
    "Gardez un œil sur vos chiffres.",
    "Mesurer",
    "pour progresser !",
  ],
  [
    "Un bon commerçant connaît ses produits",
    "aussi bien que ses clients.",
    "Connaître",
    "pour mieux vendre !",
  ],
  ["L'optimisme est un moteur.", "Démarrez la journée du bon pied !", "Du bon", "pied !"],
  [
    "Mora mora, mais sûrement :",
    "chaque pas compte vers vos objectifs.",
    "Mora mora,",
    "on avance !",
  ],
  [
    "Les occasions ne frappent qu'une fois.",
    "Soyez prêt à ouvrir la porte.",
    "Saisir",
    "sa chance !",
  ],
  [
    "Un client satisfait en parle à ses proches.",
    "Votre meilleure publicité, c'est votre service.",
    "Le bouche",
    "à oreille !",
  ],
  ["Faites simple, faites bien.", "La clarté rassure vos clients.", "Simple", "et efficace !"],
  ["Prenez soin des détails :", "ce sont eux qui font l'excellence.", "Le soin", "du détail !"],
  ["Chaque jour est une chance", "de faire mieux qu'hier.", "Mieux", "qu'hier !"],
  ["Votre boutique reflète votre énergie.", "Rayonnez aujourd'hui !", "Rayonnez", "aujourd'hui !"],
  [
    "Fixez-vous un objectif pour la journée",
    "et donnez-vous les moyens de l'atteindre.",
    "Un objectif,",
    "une victoire !",
  ],
  ["Le courage, c'est d'ouvrir chaque matin,", "quoi qu'il arrive.", "Courage", "et ténacité !"],
  ["Les clients achètent d'abord une relation,", "puis un produit.", "Créer", "du lien !"],
  ["Une caisse juste, un stock exact :", "la sérénité commence là.", "Justesse", "et sérénité !"],
  ["Chaque problème cache une solution.", "Gardez l'esprit ouvert.", "Toujours", "une solution !"],
  ["Votre persévérance d'aujourd'hui", "sera votre fierté de demain.", "Persévérez", "encore !"],
  ["Le commerce, c'est l'art de rendre service.", "Faites-le avec cœur.", "Vendre", "avec cœur !"],
  [
    "Rien ne remplace l'expérience.",
    "Chaque journée vous en apporte un peu plus.",
    "Apprendre",
    "chaque jour !",
  ],
  [
    "Mettez en avant vos meilleurs produits :",
    "ils méritent d'être vus.",
    "Montrez",
    "le meilleur !",
  ],
  [
    "Un client pressé apprécie la rapidité,",
    "un client curieux apprécie le conseil.",
    "Servir",
    "chacun !",
  ],
  [
    "La régularité construit la réputation.",
    "Soyez fidèle à vos engagements.",
    "Tenir",
    "parole !",
  ],
  ["Ce matin, pensez grand", "et agissez concrètement.", "Penser grand,", "agir juste !"],
  [
    "Vos clients comptent sur vous,",
    "et vous pouvez compter sur vous-même.",
    "Fiable",
    "et présent !",
  ],
  ["Le dynamisme attire,", "la sincérité retient.", "Dynamique", "et sincère !"],
  ["Chaque vente, même petite,", "est un pas vers vos rêves.", "Petit pas,", "grand chemin !"],
  [
    "Une bonne journée commence",
    "par un espace propre et accueillant.",
    "Place nette,",
    "esprit clair !",
  ],
  [
    "Ne craignez pas l'effort :",
    "c'est lui qui fait la différence.",
    "L'effort",
    "paie toujours !",
  ],
  ["Le travail bien fait", "se voit et se ressent.", "Le travail", "bien fait !"],
  ["Soyez curieux :", "une nouvelle idée peut tout changer.", "Curiosité", "et idées !"],
  ["Les clients d'aujourd'hui", "sont les ambassadeurs de demain.", "Clients", "ambassadeurs !"],
  [
    "Restez concentré sur l'essentiel :",
    "vos clients et vos produits.",
    "Cap sur",
    "l'essentiel !",
  ],
  ["Avec de la volonté,", "tout devient possible.", "Tout est", "possible !"],
  ["Un prix juste et un service sincère", "créent une confiance durable.", "Juste", "et sincère !"],
  ["Votre boutique a de l'avenir.", "Préparez-le dès aujourd'hui.", "Préparer", "l'avenir !"],
  ["La réussite se construit", "une journée après l'autre.", "Jour après", "jour !"],
  ["Chaque client a une histoire.", "Prenez le temps de l'écouter.", "Écouter", "pour servir !"],
  ["Anticiper, c'est déjà réussir.", "Pensez à la semaine qui vient.", "Anticiper", "toujours !"],
  ["Votre passion se transmet", "à chaque client qui passe la porte.", "Passion", "contagieuse !"],
  [
    "Restez positif,",
    "même quand la journée commence doucement.",
    "Positif",
    "quoi qu'il arrive !",
  ],
  ["Des objectifs clairs", "font des journées efficaces.", "Clarté", "et efficacité !"],
  [
    "La patience est la mère des grandes réussites.",
    "Continuez sans vous décourager.",
    "Patience",
    "récompensée !",
  ],
  ["Aujourd'hui, faites un pas de plus", "que ce que vous aviez prévu.", "Un pas", "de plus !"],
  [
    "Le client n'achète pas qu'un produit :",
    "il vit une expérience.",
    "Offrir",
    "une expérience !",
  ],
  [
    "Prenez une bonne décision aujourd'hui :",
    "vos chiffres sont là pour vous guider.",
    "Décider",
    "avec sagesse !",
  ],
  ["Chaque matin est une promesse.", "Tenez-la avec énergie.", "Une promesse", "à tenir !"],
  [
    "Votre réputation se construit",
    "à chaque échange avec un client.",
    "Une réputation",
    "en or !",
  ],
  [
    "Ensemble, on va plus loin.",
    "Appuyez-vous sur votre équipe et vos partenaires.",
    "Plus loin",
    "ensemble !",
  ],
  ["Ce qui compte, ce n'est pas la vitesse,", "c'est la direction.", "La bonne", "direction !"],
  ["Simplifiez, organisez, avancez.", "La journée vous appartient.", "Avancez", "sereinement !"],
  ["Un stock vivant", "est un stock qui tourne.", "Ça tourne,", "ça vend !"],
  ["Chaque difficulté surmontée", "vous rend plus fort.", "Plus fort", "chaque jour !"],
  ["La générosité d'un conseil", "crée des clients pour la vie.", "Conseiller", "généreusement !"],
  [
    "Croyez en la valeur de ce que vous vendez :",
    "vos clients la sentiront.",
    "Vendre",
    "avec conviction !",
  ],
  [
    "Soyez le commerçant que vous aimeriez rencontrer.",
    "C'est la plus belle des vitrines.",
    "Être",
    "exemplaire !",
  ],
  ["Un tableau de bord consulté,", "c'est une boutique bien pilotée.", "Bien", "piloter !"],
  [
    "Chaque saison apporte ses occasions.",
    "Restez attentif aux besoins du moment.",
    "Saisir",
    "le moment !",
  ],
  ["Rêvez grand, commencez petit,", "mais commencez aujourd'hui.", "Commencez", "aujourd'hui !"],
  [
    "Votre détermination est votre meilleur atout.",
    "Faites-en bon usage !",
    "Détermination",
    "totale !",
  ],
  ["La journée est à vous.", "Faites-en quelque chose de beau !", "Une belle", "journée !"],
  [
    "Le succès sourit à ceux qui persévèrent.",
    "Souriez-lui en retour !",
    "Le succès",
    "vous sourit !",
  ],
];

const SOIR_BRUTES: Brute[] = [
  [
    "Belle journée accomplie.",
    "Prenez un moment pour mesurer le chemin parcouru.",
    "Fier du",
    "chemin parcouru !",
  ],
  [
    "Le travail d'aujourd'hui prépare les succès de demain.",
    "Reposez-vous, vous l'avez bien mérité.",
    "Demain sera",
    "encore meilleur !",
  ],
  [
    "Chaque journée compte, même les plus calmes.",
    "L'essentiel est de continuer d'avancer.",
    "On continue,",
    "ensemble !",
  ],
  [
    "Faites le point, souriez, et préparez demain :",
    "votre boutique est entre de bonnes mains.",
    "Bravo pour",
    "cette journée !",
  ],
  [
    "Les belles boutiques se construisent soir après soir,",
    "avec patience et constance.",
    "Patience",
    "et constance !",
  ],
  [
    "Un bilan clair ce soir,",
    "c'est une journée plus sereine demain.",
    "Sereinement",
    "vers demain !",
  ],
  [
    "Merci pour votre engagement aujourd'hui.",
    "Chaque effort compte pour l'avenir de votre boutique.",
    "Merci pour",
    "vos efforts !",
  ],
  [
    "Ce soir, célébrez vos petites victoires :",
    "ce sont elles qui font les grandes réussites.",
    "Petites victoires,",
    "grandes réussites !",
  ],
  [
    "La journée se termine,",
    "mais vos projets continuent de grandir.",
    "Les projets",
    "grandissent !",
  ],
  ["Un dernier coup d'œil aux chiffres,", "et place au repos bien mérité.", "Repos", "mérité !"],
  [
    "Ce que vous avez semé aujourd'hui",
    "fleurira dans les jours à venir.",
    "Semer",
    "pour récolter !",
  ],
  [
    "Chaque soir est l'occasion",
    "de remercier ceux qui vous font confiance.",
    "Merci",
    "aux clients !",
  ],
  ["Vous avez donné le meilleur de vous-même.", "Soyez-en fier.", "Fier", "de vous !"],
  [
    "Le repos fait partie du travail.",
    "Rechargez vos forces pour demain.",
    "Recharger",
    "les batteries !",
  ],
  ["Une journée difficile", "ne fait pas une mauvaise semaine.", "Demain,", "on repart !"],
  [
    "Notez une idée avant de partir :",
    "elle pourrait changer demain.",
    "Une idée",
    "pour demain !",
  ],
  [
    "La caisse est faite, le stock est vérifié :",
    "vous pouvez dormir tranquille.",
    "Esprit",
    "tranquille !",
  ],
  [
    "Ce soir, pensez à ce qui a bien marché",
    "et refaites-le demain.",
    "Ce qui marche,",
    "on le garde !",
  ],
  ["Le succès, c'est la somme", "de petites journées bien remplies.", "Journée", "bien remplie !"],
  ["Merci à votre équipe :", "c'est ensemble que vous avancez.", "Merci", "l'équipe !"],
  [
    "Chaque soir, votre boutique",
    "est un peu plus solide que la veille.",
    "Plus solide",
    "chaque soir !",
  ],
  [
    "Prenez le temps de souffler.",
    "Les grands projets demandent de l'endurance.",
    "Souffler",
    "pour durer !",
  ],
  [
    "Demain est une nouvelle chance.",
    "Ce soir, savourez ce qui a été fait.",
    "Savourez",
    "ce soir !",
  ],
  [
    "Les clients servis aujourd'hui",
    "se souviendront de votre accueil.",
    "Un accueil",
    "qui marque !",
  ],
  ["La persévérance d'aujourd'hui", "est la réussite de demain.", "Persévérance", "payante !"],
  ["Fermez la boutique le cœur léger :", "vous avez fait de votre mieux.", "Cœur", "léger !"],
  ["Une soirée calme", "prépare une matinée efficace.", "Calme", "et sérénité !"],
  [
    "Regardez le chemin parcouru depuis vos débuts.",
    "Il est impressionnant !",
    "Quel",
    "chemin parcouru !",
  ],
  ["Les erreurs d'aujourd'hui", "sont les leçons de demain.", "Apprendre", "et grandir !"],
  ["Votre boutique vous ressemble :", "travailleuse et pleine d'avenir.", "Pleine", "d'avenir !"],
  [
    "Ce soir, déconnectez un peu.",
    "Votre boutique vous attend demain, en forme.",
    "Déconnecter",
    "pour revenir !",
  ],
  ["Chaque vente de la journée", "est une preuve de confiance.", "Merci pour", "la confiance !"],
  [
    "La réussite n'est pas une destination,",
    "c'est un voyage : profitez-en.",
    "Profiter",
    "du voyage !",
  ],
  [
    "Préparez la liste de demain",
    "et laissez vos soucis au comptoir.",
    "Liste prête,",
    "esprit libre !",
  ],
  ["Les fondations solides", "se posent un soir après l'autre.", "Des bases", "solides !"],
  ["Votre courage d'aujourd'hui", "mérite d'être salué.", "Bravo", "pour le courage !"],
  ["Mora mora :", "ce qui se construit lentement dure longtemps.", "Lentement", "mais sûrement !"],
  ["Un bon repos,", "et demain tout sera plus clair.", "Bonne", "nuit !"],
  ["Ce soir, remerciez-vous", "pour tout le travail accompli.", "Merci", "à vous !"],
  ["Les jours se suivent et votre boutique grandit.", "Continuez ainsi !", "Continuez", "ainsi !"],
  ["Chaque fin de journée", "est le début de la préparation du lendemain.", "Préparer", "demain !"],
  [
    "Les petites ventes d'aujourd'hui",
    "bâtissent les grands chiffres de demain.",
    "Petit à petit,",
    "on grandit !",
  ],
  ["La journée a apporté son lot de défis.", "Vous les avez relevés.", "Défis", "relevés !"],
  ["Ce soir, votre boutique se repose.", "Faites de même.", "Repos", "bien gagné !"],
  ["Un commerce qui dure", "est un commerce qui sait se reposer.", "Durer", "dans le temps !"],
  [
    "Pensez aux clients que vous avez aidés aujourd'hui.",
    "C'est ça, le vrai succès.",
    "Aider,",
    "c'est réussir !",
  ],
  [
    "Le soir est le moment de la réflexion.",
    "Prenez un instant pour vous.",
    "Un instant",
    "pour soi !",
  ],
  [
    "Demain, de nouveaux clients",
    "découvriront votre boutique.",
    "De nouveaux",
    "clients demain !",
  ],
  [
    "Votre régularité est votre force.",
    "Encore une journée de gagnée.",
    "Une journée",
    "de gagnée !",
  ],
  ["Le calme du soir", "est le meilleur des conseillers.", "Écouter", "le calme !"],
  ["Rangez, notez, souriez :", "demain commencera du bon pied.", "Demain,", "du bon pied !"],
  ["Chaque soir vous rapproche", "de vos plus grands objectifs.", "Toujours", "plus près !"],
  [
    "Ce que vous faites a de la valeur.",
    "Ne l'oubliez jamais.",
    "Votre travail",
    "a de la valeur !",
  ],
  ["La journée est finie,", "mais l'aventure continue.", "L'aventure", "continue !"],
  ["Un bilan honnête", "est le meilleur outil de progrès.", "Bilan", "et progrès !"],
  [
    "Vos efforts ne passent pas inaperçus :",
    "vos clients les voient.",
    "Des efforts",
    "qui se voient !",
  ],
  [
    "Remerciez vos fournisseurs et partenaires :",
    "ils font partie de votre réussite.",
    "Merci",
    "aux partenaires !",
  ],
  ["Le soir est fait pour rêver", "à ce que votre boutique deviendra.", "Rêver", "grand !"],
  [
    "Une journée sans vente n'est pas perdue :",
    "elle vous apprend quelque chose.",
    "Toujours",
    "apprendre !",
  ],
  [
    "Chaque soir, un peu plus d'expérience.",
    "Chaque matin, un peu plus d'assurance.",
    "Expérience",
    "et assurance !",
  ],
  [
    "Vous avez tenu bon aujourd'hui.",
    "C'est ce qui fait les grands commerçants.",
    "Tenir",
    "bon !",
  ],
  [
    "Laissez les soucis à la boutique.",
    "La maison est faite pour se ressourcer.",
    "Se",
    "ressourcer !",
  ],
  ["Le succès appartient", "à ceux qui reviennent chaque jour.", "Fidèle", "au poste !"],
  [
    "Ce soir, regardez vos chiffres sans crainte :",
    "ils vous montrent le chemin.",
    "Les chiffres",
    "guident !",
  ],
  ["Une boutique bien tenue", "est une fierté partagée.", "Fierté", "partagée !"],
  [
    "Vous avez semé la confiance aujourd'hui.",
    "Demain, vous en récolterez les fruits.",
    "Récolter",
    "les fruits !",
  ],
  ["La gratitude transforme", "ce que nous avons en abondance.", "Gratitude", "du soir !"],
  ["Une étape de plus", "vers la boutique de vos rêves.", "Une étape", "de plus !"],
  ["Votre engagement fait la différence,", "jour après jour.", "Engagement", "total !"],
  [
    "Ce soir, accordez-vous une pause :",
    "le travail d'aujourd'hui est fait.",
    "Pause",
    "méritée !",
  ],
  ["Les journées passent,", "votre savoir-faire grandit.", "Un savoir-faire", "qui grandit !"],
  [
    "Ce qui n'a pas été fait aujourd'hui",
    "trouvera sa place demain.",
    "Chaque chose",
    "en son temps !",
  ],
  ["Les meilleures idées", "naissent souvent le soir.", "Les idées", "du soir !"],
  [
    "Vous avez fait vivre votre boutique aujourd'hui.",
    "Merci pour cette énergie.",
    "Merci pour",
    "l'énergie !",
  ],
  ["La sérénité du soir", "vient du travail bien fait.", "Travail", "accompli !"],
  [
    "Votre boutique a rendu service aujourd'hui.",
    "C'est une belle raison d'être fier.",
    "Rendre",
    "service !",
  ],
  ["Chaque jour vous apprend", "à mieux connaître vos clients.", "Connaître", "ses clients !"],
  [
    "Fermez les yeux sur une journée utile.",
    "Demain vous attend avec de nouvelles chances.",
    "Nouvelles",
    "chances !",
  ],
  ["La réussite est un marathon,", "pas un sprint.", "Un marathon,", "pas un sprint !"],
  [
    "Une journée de plus dans l'histoire",
    "de votre boutique : une belle histoire !",
    "Une belle",
    "histoire !",
  ],
  [
    "Ce soir, soyez reconnaissant",
    "pour chaque client qui est venu.",
    "Reconnaissant",
    "ce soir !",
  ],
  ["La discipline d'aujourd'hui", "est la liberté de demain.", "Discipline", "et liberté !"],
  ["Repensez au meilleur moment de la journée", "et gardez-le en tête.", "Le meilleur", "moment !"],
  ["Votre boutique compte", "pour tous ceux qui la fréquentent.", "Une boutique", "qui compte !"],
  ["Bonne soirée !", "Vous avez bien travaillé aujourd'hui.", "Bien", "travaillé !"],
  ["Demain, vous ferez encore mieux.", "Ce soir, reposez-vous.", "Encore mieux", "demain !"],
  ["Les grandes choses prennent du temps.", "Vous êtes sur la bonne voie.", "La bonne", "voie !"],
  ["Chaque soir ferme un chapitre,", "chaque matin en ouvre un autre.", "Un nouveau", "chapitre !"],
  ["La fidélité de vos clients", "est la récompense de votre sérieux.", "Sérieux", "récompensé !"],
  ["Ce soir, rien ne presse.", "Profitez du calme bien mérité.", "Rien", "ne presse !"],
  [
    "Une boutique, c'est une aventure humaine.",
    "Merci d'en être le cœur.",
    "Le cœur",
    "de la boutique !",
  ],
  [
    "Encore une journée de construite.",
    "Votre avenir se dessine, soir après soir.",
    "L'avenir",
    "se dessine !",
  ],
  ["Bravo pour aujourd'hui.", "À demain, pour une nouvelle belle journée !", "À", "demain !"],
];

/** Les phrases livrées avec l'application, par moment. */
export const PHRASES_LIVREES: Record<Moment, Phrase[]> = {
  jour: JOUR_BRUTES.map(enPhrase),
  soir: SOIR_BRUTES.map(enPhrase),
};

/** Le soir commence avec le « Bonsoir » : de 18 h à 4 h. */
export const estLeSoir = (d: Date): boolean => d.getHours() >= 18 || d.getHours() < 4;

/** Le moment d'une heure donnée. */
export const momentDe = (d: Date): Moment => (estLeSoir(d) ? "soir" : "jour");

/**
 * Le jour de référence, « AAAA-MM-JJ » : avant 4 h, c'est encore la
 * veille — la nuit ne change pas de phrase en cours.
 */
export function jourDeReference(d: Date): string {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getHours() < 4 ? 1 : 0));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${r.getFullYear()}-${p(r.getMonth() + 1)}-${p(r.getDate())}`;
}

/** Le nombre de jours de `a` à `b`, deux dates « AAAA-MM-JJ ». */
export function joursEntre(a: string, b: string): number {
  const ms = (s: string) => {
    const [y, m, j] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, j);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/** « AAAA-MM-JJ » décalé de `n` jours. */
export function decaler(jour: string, n: number): string {
  const [y, m, j] = jour.split("-").map(Number);
  const r = new Date(Date.UTC(y, m - 1, j + n));
  return r.toISOString().slice(0, 10);
}

export interface EtatSerie {
  /** La phrase à afficher. */
  phrase: Phrase;
  /** Le rang du jour depuis le début de la série (0 = premier jour). */
  rang: number;
  /** Le nombre de phrases de la série. */
  total: number;
  /** Combien de jours de phrases jamais vues restent, aujourd'hui compris. */
  restants: number;
  /** Toutes les phrases ont déjà été affichées. */
  epuisee: boolean;
}

/**
 * Où en est une série, un jour donné.
 *
 * Fonction pure : le tableau de bord et les paramètres la partagent, et
 * les tests la vérifient sans base ni horloge.
 */
export function etatSerie(liste: Phrase[], debut: string, jour: string, aLaFin: ALaFin): EtatSerie {
  const total = liste.length;
  const rang = Math.max(0, joursEntre(debut, jour));
  if (total === 0) {
    return { phrase: PHRASES_LIVREES.jour[0], rang, total, restants: 0, epuisee: true };
  }
  const epuisee = rang >= total;
  const indice = !epuisee ? rang : aLaFin === "reutiliser" ? rang % total : total - 1;
  return { phrase: liste[indice], rang, total, restants: Math.max(0, total - rang), epuisee };
}

/** La série complète d'un moment : les phrases livrées, puis celles ajoutées. */
export const serieComplete = (moment: Moment, ajoutees: Phrase[]): Phrase[] => [
  ...PHRASES_LIVREES[moment],
  ...ajoutees,
];

/** La phrase du moment, compte tenu des phrases ajoutées et des réglages. */
export function phraseDuMoment(
  d: Date,
  ajoutees: Record<Moment, Phrase[]> = { jour: [], soir: [] },
  reglages: ReglagesPhrases = REGLAGES_PAR_DEFAUT,
): Phrase {
  const moment = momentDe(d);
  return etatSerie(
    serieComplete(moment, ajoutees[moment]),
    reglages.debut[moment],
    jourDeReference(d),
    reglages.aLaFin,
  ).phrase;
}
