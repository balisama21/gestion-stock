import React, { useContext, useState } from "react";
import { User, Mail, Phone, Camera } from "lucide-react";
import { SettingsSection, SettingsRow, SaveBar } from "./primitives";
import { AvatarPersonne } from "../shared/AvatarPersonne";
import { ChoixAvatar } from "../shared/ChoixAvatar";
import { AvatarsPersonnesContext } from "../../lib/avatarsPersonnes";

interface AccountSectionProps {
  fullName: string;
  setFullName: (v: string) => void;
  accountEmail: string;
  setAccountEmail: (v: string) => void;
  accountPhone: string;
  setAccountPhone: (v: string) => void;
  /** Valeurs actuellement enregistrées, pour détecter les modifications. */
  baseline: { fullName: string; email: string; phone: string };
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  fullName,
  setFullName,
  accountEmail,
  setAccountEmail,
  accountPhone,
  setAccountPhone,
  baseline,
  saving,
  saved,
  onSave,
}) => {
  const dirty =
    fullName !== baseline.fullName ||
    accountEmail !== baseline.email ||
    accountPhone !== baseline.phone;

  const reset = () => {
    setFullName(baseline.fullName);
    setAccountEmail(baseline.email);
    setAccountPhone(baseline.phone);
  };

  const emailChanged = accountEmail.trim() !== baseline.email;

  /*
   * LA PHOTO DE PROFIL : l'avatar de l'application (`AvatarPersonne`) —
   * la photo choisie, ou le visage illustré tiré du nom. Elle suit le nom
   * ENREGISTRÉ, à défaut l'e-mail : la même clé que l'avatar de la barre
   * du haut et que l'écran Équipe, qui affichent donc le même visage. Le
   * choix est celui de partout (`ChoixAvatar`) : un visage, ou une photo.
   */
  const nomAvatar = baseline.fullName.trim() || baseline.email;
  const { modifiable: avatarModifiable } = useContext(AvatarsPersonnesContext);
  const [choixAvatarOuvert, setChoixAvatarOuvert] = useState(false);

  return (
    <>
      <SettingsSection
        title="Informations personnelles"
        description="Votre identité sur la plateforme. Le nom apparaît dans les invitations que vous envoyez."
        icon={<User className="w-4 h-4" />}
      >
        <SettingsRow
          label="Photo de profil"
          hint={
            avatarModifiable
              ? "Affichée dans la barre du haut et auprès de vos collaborateurs. Choisissez une photo, ou ajustez le visage tiré de votre nom."
              : "Affichée dans la barre du haut et auprès de vos collaborateurs. Le visage est tiré de votre nom."
          }
        >
          <div className="flex items-center gap-4">
            <AvatarPersonne nom={nomAvatar} taille={64} />
            {avatarModifiable && nomAvatar && (
              <button
                type="button"
                onClick={() => setChoixAvatarOuvert(true)}
                className="app-btn-secondary"
              >
                <Camera className="h-4 w-4" />
                Changer la photo
              </button>
            )}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Nom complet"
          hint="Affiché à vos collaborateurs."
          htmlFor="account-name"
        >
          <input
            id="account-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Votre nom complet"
            className="app-field"
          />
        </SettingsRow>

        <SettingsRow
          label="Adresse e-mail"
          hint={
            emailChanged
              ? "Un lien de confirmation sera envoyé à la nouvelle adresse. Le changement ne prend effet qu'une fois ce lien ouvert."
              : "Sert à vous connecter et à recevoir les liens de sécurité."
          }
          htmlFor="account-email"
        >
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="account-email"
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              autoComplete="email"
              className="app-field pl-9"
            />
          </div>
        </SettingsRow>

        <SettingsRow
          label="Numéro de téléphone"
          hint="Facultatif. Utile à vos collaborateurs pour vous joindre."
          htmlFor="account-phone"
        >
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="account-phone"
              type="tel"
              value={accountPhone}
              onChange={(e) => setAccountPhone(e.target.value)}
              placeholder="+261 34 12 345 67"
              autoComplete="tel"
              className="app-field pl-9"
            />
          </div>
        </SettingsRow>
      </SettingsSection>

      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={onSave} onReset={reset} />

      {choixAvatarOuvert && nomAvatar && (
        <ChoixAvatar
          nom={nomAvatar}
          open={choixAvatarOuvert}
          onClose={() => setChoixAvatarOuvert(false)}
        />
      )}
    </>
  );
};
