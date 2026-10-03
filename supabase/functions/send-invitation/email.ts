export interface DonneesInvitation {
  nomApp: string;
  piedDePage: string;
  couleur: string;
  logoUrl: string | null;
  boutique: string;
  invitePar: string;
  role: string;
  lien: string;
}

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Polices système : Gmail et Outlook ignorent les polices web.
const POLICE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function emailInvitation(d: DonneesInvitation): { html: string; text: string } {
  const nomApp = echapper(d.nomApp);
  const boutique = echapper(d.boutique);
  const invitePar = echapper(d.invitePar);
  const role = echapper(d.role);
  const lien = echapper(d.lien);
  // « l'équipe de Kinvest sur Kinvest » : on ne répète pas le nom.
  const surApp = d.boutique === d.nomApp ? "" : ` sur ${d.nomApp}`;

  // Logo de la marque, sinon son initiale sur sa couleur.
  const marque = d.logoUrl
    ? `<img src="${echapper(d.logoUrl)}" alt="${nomApp}" height="32" style="display:block;height:32px;width:auto;border:0;">`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="32" height="32" align="center" valign="middle" style="width:32px;height:32px;background:${d.couleur};border-radius:6px;color:#ffffff;font:600 15px ${POLICE};">${echapper(d.nomApp.charAt(0).toUpperCase())}</td>
        <td style="padding-left:10px;font:600 15px ${POLICE};color:#111827;">${nomApp}</td>
      </tr></table>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Invitation à rejoindre ${boutique}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${invitePar} vous invite à rejoindre ${boutique}${echapper(surApp)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 16px;">${marque}</td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
        <h1 style="margin:0 0 16px;font:600 20px/1.3 ${POLICE};color:#111827;">Invitation à rejoindre ${boutique}</h1>
        <p style="margin:0 0 12px;font:400 15px/1.6 ${POLICE};color:#374151;">Bonjour,</p>
        <p style="margin:0 0 24px;font:400 15px/1.6 ${POLICE};color:#374151;">
          ${invitePar} vous invite à rejoindre l'équipe de <strong style="color:#111827;">${boutique}</strong>${echapper(surApp)}, en tant que <strong style="color:#111827;">${role}</strong>.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:${d.couleur};border-radius:6px;">
            <a href="${lien}" style="display:inline-block;padding:12px 24px;font:600 15px ${POLICE};color:#ffffff;text-decoration:none;">Accepter l'invitation</a>
          </td>
        </tr></table>
        <p style="margin:24px 0 0;font:400 13px/1.6 ${POLICE};color:#6b7280;">
          Ce lien est valable 7 jours et ne fonctionne qu'avec cette adresse e-mail.
        </p>
        <p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #f3f4f6;font:400 12px/1.6 ${POLICE};color:#6b7280;">
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
          <a href="${lien}" style="color:#374151;word-break:break-all;">${lien}</a>
        </p>
      </td></tr>
      <tr><td style="padding:16px 4px 0;font:400 12px/1.6 ${POLICE};color:#6b7280;">
        Vous n'attendiez pas cette invitation ? Ignorez simplement cet e-mail.<br>
        ${echapper(d.piedDePage)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `Invitation à rejoindre ${d.boutique}`,
    "",
    "Bonjour,",
    "",
    `${d.invitePar} vous invite à rejoindre l'équipe de ${d.boutique}${surApp}, en tant que ${d.role}.`,
    "",
    `Accepter l'invitation : ${d.lien}`,
    "",
    "Ce lien est valable 7 jours et ne fonctionne qu'avec cette adresse e-mail.",
    "Vous n'attendiez pas cette invitation ? Ignorez simplement cet e-mail.",
    "",
    d.piedDePage,
  ].join("\n");

  return { html, text };
}
