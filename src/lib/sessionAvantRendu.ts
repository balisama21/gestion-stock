/**
 * Page d'accueil rendue par le serveur, sans la montrer aux connectés.
 *
 * Le serveur ignore si le visiteur est connecté (la session Supabase vit
 * dans le localStorage du navigateur) : il rend donc toujours la page
 * d'accueil, que les robots de recherche lisent en entier. Ce script,
 * placé dans le `<head>`, s'exécute avant le premier affichage : si le
 * navigateur détient une session, il pose `data-session` sur `<html>`,
 * et la feuille de style montre l'écran de chargement à la place de la
 * page d'accueil (voir `.accueil-public` / `.ecran-session`).
 *
 * L'attribut est retiré par `App` dès que la session s'avère absente
 * (expirée, déconnectée) : la page d'accueil réapparaît alors.
 */

export const ATTRIBUT_SESSION = "data-session";

export function scriptSessionAvantRendu(): string {
  // Session stockée par supabase-js (`sb-<projet>-auth-token`), ou jetons
  // d'un lien d'invitation / de récupération (flux implicite, dans l'ancre).
  return `(function(){try{
var s=/(^|&)(access_token|refresh_token)=/.test(location.hash.slice(1));
for(var i=0;!s&&i<localStorage.length;i++){var k=localStorage.key(i);if(k&&/^sb-.+-auth-token$/.test(k))s=true;}
if(s)document.documentElement.setAttribute(${JSON.stringify(ATTRIBUT_SESSION)},"");
}catch(e){}})();`;
}

/** Plus de session : la page d'accueil redevient visible. */
export function oublierSessionAvantRendu(): void {
  document.documentElement.removeAttribute(ATTRIBUT_SESSION);
}
