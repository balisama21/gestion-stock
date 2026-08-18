import React, { useEffect, useState } from "react";
import { StoreSettings, Seller, LocaleSetting, CapitalSummary } from "../types";
import { SettingsLayout, SettingsTab } from "./settings/SettingsLayout";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "../hooks/useAuth";
import {
  Building,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  Save,
  Upload,
  Image as ImageIcon,
  XCircle,
  KeyRound,
  ShieldAlert,
  UserPlus,
  UserCheck,
  Trash2,
  Lock,
  Bell,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Copy,
  AlertCircle,
  Users,
} from "lucide-react";

interface ParametresViewProps {
  settings: StoreSettings;
  onUpdateSettings: (newSettings: Partial<StoreSettings>) => void;
  sellers: Seller[];
  onAddSeller: (nom: string) => void;
  onDeleteSeller: (id: string) => void;
  onToggleSellerStatus: (id: string) => void;
  locale: LocaleSetting;
  setLocale: (locale: LocaleSetting) => void;
  capital: CapitalSummary;
  onUpdateCapitalInitial: (val: number) => void;
  onUpdateSeuil: (val: number) => void;
  onOpenScriptModal: () => void;
  onOpenFormulaModal: () => void;
  onDownloadExcel: () => void;
  isFounder?: boolean;
  /**
   * Vrai UNIQUEMENT pour le compte administrateur de la plateforme
   * (celui qui vend les accès), jamais pour un simple propriétaire de
   * boutique. `isFounder` veut dire « propriétaire de SA boutique » —
   * ce n'est pas la même chose et ne doit plus servir à afficher la
   * gestion des codes d'activation (faille corrigée le 17/08/2026).
   */
  isPlatformAdmin?: boolean;
  currentUserId?: string | null;
}

export const ParametresView: React.FC<ParametresViewProps> = ({
  settings,
  onUpdateSettings,
  sellers,
  onAddSeller,
  onDeleteSeller,
  onToggleSellerStatus,
  locale,
  setLocale,
  capital,
  onUpdateCapitalInitial,
  onUpdateSeuil,
  onDownloadExcel,
  isFounder = false,
  isPlatformAdmin = false,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("compte");
  const workspace = useWorkspace();
  const { user, profile, refreshProfile, reauthenticate, updatePassword, deleteAccount, signOut } =
    useAuth();

  // Form states...
  const [storeName, setStoreName] = useState(settings.storeName || "GESTIONS STOCK");
  const [subtitle, setSubtitle] = useState(settings.subtitle || "");
  const [address, setAddress] = useState(settings.address || "");
  const [phone, setPhone] = useState(settings.phone || "");
  const [email, setEmail] = useState(settings.email || "");
  const [nifStat, setNifStat] = useState(settings.nifStat || "");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(settings.logoUrl);
  const [masterPin, setMasterPin] = useState(settings.masterPin || "");
  const [enablePinSecurity, setEnablePinSecurity] = useState(settings.enablePinSecurity ?? true);
  // "Sécurité" — reflète l'état réel stocké dans `profiles` (PIN + délai
  // avant verrouillage automatique), pas dans `stores`.
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(
    profile?.session_timeout_minutes ?? 30,
  );
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securitySaved, setSecuritySaved] = useState(false);

  // "Changer le mot de passe" — toujours protégé par une revérification
  // du mot de passe actuel avant d'accepter le nouveau.
  const [currentPasswordForPwChange, setCurrentPasswordForPwChange] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // "Supprimer mon compte" — zone dangereuse, protégée par mot de passe.
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  useEffect(() => {
    setSessionTimeoutMinutes(profile?.session_timeout_minutes ?? 30);
    setMasterPin(profile?.pin_hash || "");
  }, [profile]);

  // "Mon compte" — infos personnelles du compte connecté (pas de la
  // boutique). Pré-remplies automatiquement à la première connexion avec
  // le nom/e-mail réels du compte, puis modifiables et sauvegardées dans
  // `profiles` (jamais dans `stores`).
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [accountEmail, setAccountEmail] = useState(profile?.email || user?.email || "");
  const [accountPhone, setAccountPhone] = useState(profile?.phone || "");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setAccountEmail(profile?.email || user?.email || "");
    setAccountPhone(profile?.phone || "");
  }, [profile, user]);

  // Reflète en local toute mise à jour de la boutique reçue via props
  // (ex: après un rafraîchissement du workspace).
  useEffect(() => {
    setStoreName(settings.storeName || "GESTIONS STOCK");
    setSubtitle(settings.subtitle || "");
    setAddress(settings.address || "");
    setPhone(settings.phone || "");
    setEmail(settings.email || "");
    setNifStat(settings.nifStat || "");
    setLogoUrl(settings.logoUrl);
  }, [settings]);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("seller");
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState("");

  const [activationCode, setActivationCode] = useState("BLSM-7K9F-3D2P");
  const [adminContact, setAdminContact] = useState("+261 34 12 345 67");
  const [pendingUsers, setPendingUsers] = useState<
    Array<{ id: string; email: string; full_name: string | null; created_at: string }>
  >([]);
  const [selectedPendingUserId, setSelectedPendingUserId] = useState<string | null>(null);
  const [loadingPendingUsers, setLoadingPendingUsers] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    if (!isPlatformAdmin) return;

    const fetchPendingUsers = async () => {
      setLoadingPendingUsers(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, status, role")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const nextPendingUsers = data as typeof pendingUsers;
        setPendingUsers(nextPendingUsers);
        if (!selectedPendingUserId && nextPendingUsers[0]) {
          setSelectedPendingUserId(nextPendingUsers[0].id);
        }
      }
      setLoadingPendingUsers(false);
    };

    fetchPendingUsers();
  }, [isPlatformAdmin, selectedPendingUserId]);

  const handleGenerateActivationCode = async () => {
    if (!isPlatformAdmin || !currentUserId || !selectedPendingUserId) return;

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "BLSM-";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    code += "-";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];

    setGeneratingCode(true);
    const payload: any = {
      code,
      user_id: selectedPendingUserId,
      status: "generated",
      activation_type: "paid",
      payment_method: "mobile_money",
      amount_paid: 100000,
      payment_reference: "Paiement par admin",
      generated_by: currentUserId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      reason: "Activation premium",
    };

    const { error } = await supabase.from("access_codes").insert(payload);
    setGeneratingCode(false);

    if (!error) {
      setActivationCode(code);
      setAdminContact("+261 34 12 345 67");
    }
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail || !workspace.activeStore) return;
    setInviting(true);
    setInviteStatus("");

    try {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: {
          invited_email: inviteEmail.trim(),
          store_id: workspace.activeStore.id,
          role: inviteRole,
          invited_by_name: profile?.full_name || "Propriétaire",
          store_name: workspace.activeStore.name,
          app_url: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInviteStatus("Invitation envoyée avec succès par e-mail!");
      setInviteEmail("");
    } catch (e: any) {
      setInviteStatus("Erreur : " + e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingAccount(true);

    try {
      // Nom & téléphone : propres au compte, stockés dans `profiles`.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: accountPhone.trim() || null,
        })
        .eq("id", user.id);

      if (profileError) throw new Error(profileError.message);

      // L'e-mail de connexion est géré par Supabase Auth : un e-mail de
      // confirmation est envoyé au nouvel e-mail avant que le changement
      // soit réellement effectif.
      const currentEmail = profile?.email || user.email || "";
      if (accountEmail.trim() && accountEmail.trim() !== currentEmail) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: accountEmail.trim(),
        });
        if (emailError) throw new Error(emailError.message);
      }

      await refreshProfile();
      setAccountSaved(true);
      setTimeout(() => setAccountSaved(false), 3000);
    } catch (err: any) {
      alert("Erreur lors de la mise à jour du compte : " + err.message);
    } finally {
      setSavingAccount(false);
    }
  };

  // "Sécurité" : PIN + délai avant verrouillage automatique. Stockés dans
  // `profiles` (pin_hash, session_timeout_minutes), jamais dans `stores`.
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedPin = masterPin.trim();
    if (trimmedPin && !/^\d{4,6}$/.test(trimmedPin)) {
      alert("Le code PIN doit contenir entre 4 et 6 chiffres.");
      return;
    }

    setSavingSecurity(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        pin_hash: trimmedPin || null,
        session_timeout_minutes: sessionTimeoutMinutes,
      })
      .eq("id", user.id);
    setSavingSecurity(false);

    if (error) {
      alert("Erreur lors de la sauvegarde de la sécurité : " + error.message);
      return;
    }

    await refreshProfile();
    setSecuritySaved(true);
    setTimeout(() => setSecuritySaved(false), 3000);
  };

  // Changement de mot de passe : le mot de passe ACTUEL est toujours
  // revérifié d'abord (reauthenticate) avant d'accepter le nouveau —
  // jamais de changement de mot de passe "à l'aveugle".
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeMessage(null);

    if (!currentPasswordForPwChange) {
      setPasswordChangeMessage({ type: "error", text: "Entrez votre mot de passe actuel." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordChangeMessage({
        type: "error",
        text: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { error: reauthError } = await reauthenticate(currentPasswordForPwChange);
      if (reauthError) {
        setPasswordChangeMessage({ type: "error", text: reauthError });
        return;
      }

      const { error: updateError } = await updatePassword(newPassword);
      if (updateError) {
        setPasswordChangeMessage({ type: "error", text: updateError });
        return;
      }

      setPasswordChangeMessage({ type: "success", text: "Mot de passe changé avec succès !" });
      setCurrentPasswordForPwChange("");
      setNewPassword("");
    } finally {
      setChangingPassword(false);
    }
  };

  // Suppression de compte : toujours protégée par le mot de passe actuel.
  // Action irréversible (RPC delete_own_account, voir migration du
  // 18/08/2026) — supprime le compte, sa boutique et toutes ses données.
  const handleConfirmDeleteAccount = async () => {
    setDeleteAccountError(null);
    if (!deleteAccountPassword) {
      setDeleteAccountError("Entrez votre mot de passe pour confirmer.");
      return;
    }

    setDeletingAccount(true);
    try {
      const { error: reauthError } = await reauthenticate(deleteAccountPassword);
      if (reauthError) {
        setDeleteAccountError(reauthError);
        return;
      }

      const { error: deleteError } = await deleteAccount();
      if (deleteError) {
        setDeleteAccountError(deleteError);
        return;
      }

      // Le compte n'existe plus : on ne peut plus utiliser signOut() qui
      // dépend d'une session déjà invalidée. Un rechargement suffit à
      // ramener l'utilisateur sur l'écran de connexion.
      window.location.href = "/";
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      storeName,
      subtitle,
      address,
      phone,
      email,
      nifStat,
      logoUrl,
      masterPin,
      enablePinSecurity,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <SettingsLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="p-6">
        {/* TAB: COMPTE */}
        {activeTab === "compte" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Informations Personnelles</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Gérez votre identité sur la plateforme.
              </p>
            </div>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Nom Complet
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Votre nom complet"
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Adresse E-mail
                </label>
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-emerald-500"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Changer l'e-mail envoie un lien de confirmation à la nouvelle adresse.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Numéro de Téléphone
                </label>
                <input
                  type="tel"
                  value={accountPhone}
                  onChange={(e) => setAccountPhone(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 border-t border-border mt-6">
                <h3 className="font-bold text-foreground mb-1">Changer le mot de passe</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Votre mot de passe actuel est toujours requis pour confirmer le changement.
                </p>
                <div className="space-y-4">
                  <input
                    type="password"
                    placeholder="Mot de passe actuel"
                    value={currentPasswordForPwChange}
                    onChange={(e) => setCurrentPasswordForPwChange(e.target.value)}
                    autoComplete="current-password"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground"
                  />
                  <input
                    type="password"
                    placeholder="Nouveau mot de passe (min. 8 caractères)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground"
                  />
                </div>
                {passwordChangeMessage && (
                  <p
                    className={`text-sm font-semibold mt-2 ${
                      passwordChangeMessage.type === "success" ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {passwordChangeMessage.text}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="mt-4 px-6 py-2.5 bg-background border border-border hover:bg-muted disabled:opacity-60 text-foreground font-bold rounded-xl flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {changingPassword ? "Changement..." : "Changer le mot de passe"}
                </button>
              </div>

              <button
                onClick={handleSaveAccount}
                disabled={savingAccount}
                className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {savingAccount ? "Enregistrement..." : "Enregistrer les modifications"}
              </button>
              {accountSaved && (
                <p className="text-emerald-500 text-sm font-semibold">
                  Modifications du compte sauvegardées !
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB: SÉCURITÉ */}
        {activeTab === "securite" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Sécurité & Authentification</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Protégez l'accès à votre compte et configurez les règles de sécurité.
              </p>
            </div>

            <div className="space-y-6 max-w-xl">
              <div className="bg-muted border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3 text-amber-500 font-bold">
                  <Lock className="w-5 h-5" /> Code PIN pour reconnexion rapide
                </div>
                <p className="text-sm text-muted-foreground">
                  Le code PIN permet de déverrouiller l'écran après une période d'inactivité ou de
                  valider des opérations sensibles. Laissez vide pour désactiver le verrouillage
                  PIN.
                </p>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    Votre Code PIN Master (4-6 chiffres)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={masterPin}
                    onChange={(e) => setMasterPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="****"
                    maxLength={6}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground font-mono tracking-widest focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="bg-muted border border-border rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-foreground">Déconnexion Automatique</h3>
                <p className="text-sm text-muted-foreground">
                  Protégez votre session en cas d'oubli. Un code PIN doit être défini ci-dessus
                  pour que le verrouillage automatique soit actif — sinon l'écran ne fera que se
                  reverrouiller sans code pour le déverrouiller.
                </p>
                <select
                  value={sessionTimeoutMinutes}
                  onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-emerald-500"
                >
                  <option value={0}>Jamais</option>
                  <option value={3}>Après 3 minutes d'inactivité</option>
                  <option value={5}>Après 5 minutes d'inactivité</option>
                  <option value={15}>Après 15 minutes d'inactivité</option>
                  <option value={30}>Après 30 minutes d'inactivité</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Quoi qu'il arrive, si un code PIN est défini, il sera systématiquement demandé
                  à chaque nouvelle ouverture du site (nouvel onglet, retour après fermeture du
                  navigateur, etc.).
                </p>
              </div>

              <div>
                <button
                  onClick={handleSaveSecurity}
                  disabled={savingSecurity}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {savingSecurity ? "Sauvegarde..." : "Sauvegarder la sécurité"}
                </button>
                {securitySaved && (
                  <p className="text-emerald-500 text-sm font-semibold mt-2">
                    Paramètres de sécurité sauvegardés !
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: BOUTIQUE */}
        {activeTab === "boutique" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Ma Boutique</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Gérez l'identité visuelle et les informations légales de votre commerce.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-muted border border-border rounded-2xl p-5 space-y-4">
                  <label className="block text-sm font-semibold text-foreground">
                    Logo Officiel
                  </label>
                  <div className="flex items-center gap-4">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-20 h-20 rounded-xl object-cover border-2 border-border bg-background"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-background border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                        Logo
                      </div>
                    )}
                    <label className="cursor-pointer px-4 py-2 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-sm font-semibold transition-colors">
                      Changer la photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    Nom de la Boutique
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    Slogan / Sous-titre
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    Adresse
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    Téléphone (affiché sur les factures/reçus)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+261 34 12 345 67"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    NIF & STAT
                  </label>
                  <input
                    type="text"
                    value={nifStat}
                    onChange={(e) => setNifStat(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground font-mono text-sm"
                  />
                </div>
                <div className="pt-4">
                  <button
                    onClick={handleSaveGeneral}
                    className="w-full px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Enregistrer Boutique
                  </button>
                  {savedSuccess && (
                    <p className="text-emerald-500 text-sm text-center mt-2 font-semibold">
                      Modifications sauvegardées !
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: EQUIPE */}
        {activeTab === "equipe" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Équipe & Invitations</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Invitez des collaborateurs et gérez leurs permissions d'accès à votre boutique.
              </p>
            </div>

            <div className="bg-muted border border-border rounded-2xl p-5 mb-6">
              <h3 className="font-bold text-foreground mb-4">
                Inviter un Collaborateur par e-mail
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Adresse e-mail du collaborateur"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-foreground"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-background border border-border rounded-xl px-4 py-2 text-foreground"
                >
                  <option value="seller">Vendeur</option>
                  <option value="collaborator">Collaborateur / Magasinier</option>
                  <option value="cashier">Gérant Caisse</option>
                </select>
                <button
                  onClick={handleSendInvitation}
                  disabled={inviting || !inviteEmail}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl"
                >
                  {inviting ? "Envoi..." : "Envoyer Invitation"}
                </button>
              </div>
              {inviteStatus && (
                <p
                  className={`mt-3 text-sm font-semibold ${inviteStatus.includes("Erreur") ? "text-rose-500" : "text-emerald-500"}`}
                >
                  {inviteStatus}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-foreground border-b border-border pb-2">
                Collaborateurs Actifs ({sellers.length})
              </h3>
              <div className="grid gap-3">
                {sellers.map((seller) => (
                  <div
                    key={seller.id}
                    className="flex items-center justify-between p-4 bg-background border border-border rounded-xl"
                  >
                    <div>
                      <div className="font-bold text-foreground">{seller.nom}</div>
                      <div className="text-xs text-muted-foreground">Rôle: Vendeur</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onToggleSellerStatus(seller.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${seller.statut === "Actif" ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"}`}
                      >
                        {seller.statut}
                      </button>
                      <button
                        onClick={() => onDeleteSeller(seller.id)}
                        className="p-2 text-muted-foreground hover:text-rose-500 bg-muted rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: PAIEMENTS & ACTIVATION */}
        {activeTab === "paiement" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Paiements & Activation</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Gérez le statut de votre licence et activez votre compte complet.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Licence Active</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Votre compte est activé et vous avez accès à toutes les fonctionnalités premium de
                  GESTIONS STOCK.
                </p>
                <div className="bg-background rounded-xl p-3 border border-border text-sm font-mono text-center">
                  CODE: BALSAMA-PRO-X892
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                <h3 className="font-bold text-foreground mb-2">Besoin de plus de licences ?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Vous pouvez générer ou acheter de nouveaux codes pour d'autres boutiques.
                </p>
                <button className="px-6 py-2.5 bg-background border border-border hover:bg-muted text-foreground font-bold rounded-xl transition-colors">
                  Acheter un Code (100 000 Ar)
                </button>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <h3 className="font-bold text-foreground mb-2">Processus d’activation</h3>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>1. Effectuez le paiement de 100 000 Ar via Mobile Money.</li>
                    <li>2. Envoyez le numéro de transaction à l’administrateur.</li>
                    <li>3. L’administrateur génère votre code d’activation.</li>
                    <li>
                      4. Vous l’entrez dans le formulaire de connexion pour activer votre compte.
                    </li>
                  </ul>
                  <div className="mt-3 flex items-center gap-3 bg-background/70 border border-border rounded-xl p-3 text-sm">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    <span className="font-semibold text-foreground">Contact admin:</span>
                    <span className="text-muted-foreground">{adminContact}</span>
                  </div>
                </div>
              </div>
            </div>

            {isPlatformAdmin && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-foreground">Gestion des codes d’activation</h3>
                </div>

                <div className="space-y-4">
                  {pendingUsers.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1">
                        Compte concerné
                      </label>
                      <select
                        value={selectedPendingUserId ?? ""}
                        onChange={(e) => setSelectedPendingUserId(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground"
                      >
                        {pendingUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1">
                      Nouveau code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={activationCode}
                        onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                        className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-foreground font-mono uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(activationCode)}
                        className="px-3 py-2 bg-background border border-border rounded-xl text-foreground hover:bg-muted"
                        title="Copier"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleGenerateActivationCode}
                      disabled={generatingCode || !selectedPendingUserId}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl"
                    >
                      {generatingCode ? "Génération..." : "Générer un code"}
                    </button>
                    <button className="px-4 py-3 bg-background border border-border hover:bg-muted text-foreground font-bold rounded-xl">
                      Envoyer par e-mail
                    </button>
                  </div>

                  <div className="bg-background rounded-xl p-4 border border-border text-sm">
                    <div className="flex items-center gap-2 text-foreground font-semibold mb-2">
                      <Users className="w-4 h-4 text-emerald-500" />
                      Comptes en attente
                    </div>
                    {loadingPendingUsers ? (
                      <p className="text-muted-foreground">Chargement...</p>
                    ) : pendingUsers.length === 0 ? (
                      <p className="text-muted-foreground">
                        Aucun compte en attente pour le moment.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-muted-foreground">
                        {pendingUsers.map((user) => (
                          <li key={user.id}>• {user.email} — 100 000 Ar — en attente</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: PREFERENCES */}
        {activeTab === "preferences" && (
          <div className="space-y-6 max-w-xl">
            <div>
              <h2 className="text-xl font-bold text-foreground">Préférences</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Personnalisez votre expérience de l'application.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Devise principale
                </label>
                <select className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground">
                  <option>Ariary (Ar)</option>
                  <option>Euro (€)</option>
                  <option>Dollar ($)</option>
                </select>
              </div>

              <div className="pt-6 mt-6 border-t border-border">
                <h3 className="font-bold text-foreground mb-4 text-rose-500 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5" /> Zone Dangereuse
                </h3>
                <div className="space-y-3">
                  <button className="w-full px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold rounded-xl flex items-center justify-center gap-2 border border-rose-500/20">
                    <RefreshCw className="w-4 h-4" /> Réinitialiser la base de données
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteAccountError(null);
                      setDeleteAccountPassword("");
                      setShowDeleteAccountModal(true);
                    }}
                    className="w-full px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Supprimer définitivement mon compte
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Supprime votre compte, votre boutique et toutes ses données (produits, ventes,
                    achats, clients...). Action irréversible.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder for Notifications to prevent crash */}
        {activeTab === "notifications" && (
          <div className="text-center py-10">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-bold text-foreground">Aucune Notification</h2>
            <p className="text-muted-foreground">
              Vos préférences de notification apparaîtront ici.
            </p>
          </div>
        )}
      </div>

      {/* Modale de confirmation — Supprimer mon compte */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-xl text-foreground space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-rose-500">
              <Trash2 className="w-5 h-5" />
              Supprimer définitivement mon compte
            </h3>

            <p className="text-sm text-muted-foreground">
              Cette action est <strong className="text-foreground">irréversible</strong>. Votre
              compte, votre boutique et toutes ses données (produits, ventes, achats, clients,
              historique...) seront supprimés définitivement.
            </p>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Confirmez avec votre mot de passe
              </label>
              <input
                type="password"
                value={deleteAccountPassword}
                onChange={(e) => setDeleteAccountPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Mot de passe actuel"
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground"
              />
            </div>

            {deleteAccountError && (
              <p className="text-rose-500 text-sm font-semibold">{deleteAccountError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={deletingAccount}
                className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium text-sm disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={deletingAccount}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm"
              >
                {deletingAccount ? "Suppression..." : "Supprimer mon compte"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
};