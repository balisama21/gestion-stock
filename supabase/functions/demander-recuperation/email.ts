export interface DonneesRecuperation {
  nomApp: string;
  couleur: string;
  logoUrl: string | null;
  lien: string;
}

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Même gabarit que l'invitation (send-invitation/email.ts).
const POLICE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function emailRecuperation(d: DonneesRecuperation): { html: string; text: string } {
  const nomApp = echapper(d.nomApp);
  const lien = echapper(d.lien);

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
<title>Réinitialiser votre mot de passe</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Choisissez un nouveau mot de passe pour votre compte ${nomApp}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 16px;">${marque}</td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
        <h1 style="margin:0 0 16px;font:600 20px/1.3 ${POLICE};color:#111827;">Réinitialiser votre mot de passe</h1>
        <p style="margin:0 0 12px;font:400 15px/1.6 ${POLICE};color:#374151;">Bonjour,</p>
        <p style="margin:0 0 24px;font:400 15px/1.6 ${POLICE};color:#374151;">
          Une réinitialisation du mot de passe a été demandée pour votre compte ${nomApp}. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:${d.couleur};border-radius:6px;">
            <a href="${lien}" style="display:inline-block;padding:12px 24px;font:600 15px ${POLICE};color:#ffffff;text-decoration:none;">Choisir un nouveau mot de passe</a>
          </td>
        </tr></table>
        <p style="margin:24px 0 0;font:400 13px/1.6 ${POLICE};color:#6b7280;">
          Ce lien n'est valable que peu de temps et ne sert qu'une fois.
        </p>
      </td></tr>
      <tr><td style="padding:16px 4px 0;font:400 12px/1.6 ${POLICE};color:#6b7280;">
        Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe reste inchangé.<br>
        ${nomApp}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    "Réinitialiser votre mot de passe",
    "",
    "Bonjour,",
    "",
    `Une réinitialisation du mot de passe a été demandée pour votre compte ${d.nomApp}.`,
    "",
    `Choisir un nouveau mot de passe : ${d.lien}`,
    "",
    "Ce lien n'est valable que peu de temps et ne sert qu'une fois.",
    "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe reste inchangé.",
    "",
    d.nomApp,
  ].join("\n");

  return { html, text };
}
