import React, { useEffect, useState } from "react";
import { StoreSettings, Seller, LocaleSetting, CapitalSummary } from "../types";
import { SettingsLayout, SettingsTab } from "./settings/SettingsLayout";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "../hooks/useAuth";
import { APP_NAME } from "../lib/appConfig";
import { AVAILABLE_PERMISSIONS } from "../lib/permissions";
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
  // Permissions choisies par le propriétaire AVANT l'envoi (cases à
  // cocher). Par défaut, aucune coché — le propriétaire choisit
  // explicitement ce que le collaborateur pourra voir.
  const [invitePermissions, setInvitePermissions] = useState<string[]>([]);
  // Boutique ciblée par l'invitation — utile si le propriétaire possède
  // plusieurs boutiques (ex: après une duplication) : l'invité ne
  // rejoint QUE celle sélectionnée ici, jamais les autres.
  const [inviteStoreId, setInviteStoreId] = useState<string>("");
  // Lien + code générés après l'envoi, à copier manuellement (l'envoi
  // d'e-mail automatique reste peu fiable tant qu'aucun domaine pro n'est
  // configuré pour Resend).
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<
    Array<{ id: string; invited_email: string; role: string; token: string; invite_code: string | null; store_id: string }>
  >([]);

  const ownedStoresForInvite = workspace.accessibleStores.filter((s) => s.owner_id === user?.id);

  useEffect(() => {
    if (!inviteStoreId && workspace.activeStore) {
      setInviteStoreId(workspace.activeStore.id);
    }
  }, [inviteStoreId, workspace.activeStore]);

  const fetchPendingInvitations = async () => {
    if (!inviteStoreId) return;
    const { data } = await supabase
      .from("collaborator_invitations")
      .select("id, invited_email, role, token, invite_code, store_id")
      .eq("store_id", inviteStoreId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingInvitations(data ?? []);
  };

  useEffect(() => {
    fetchPendingInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteStoreId]);

  const togglePermission = (key: string) => {
    setInvitePermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  // Contact admin réel de la plateforme (celui affiché à AuthPage.tsx et
  // ici doivent toujours être synchronisés — voir aussi la constante du
  // même nom dans AuthPage.tsx).
  const ADMIN_CONTACT = "+261 38 97 234 12";

  const [myLicenseCode, setMyLicenseCode] = useState<string | null>(null);
  const [loadingMyLicense, setLoadingMyLicense] = useState(true);
  const [storesNeedingActivation, setStoresNeedingActivation] = useState<
    Array<{
      id: string;
      name: string;
      activation_status: string;
      trial_ends_at: string;
      owner_email: string;
      owner_name: string | null;
    }>
  >([]);
  const [selectedStoreToActivateId, setSelectedStoreToActivateId] = useState<string | null>(null);
  const [loadingStoresNeedingActivation, setLoadingStoresNeedingActivation] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [activationCode, setActivationCode] = useState("");

  // Récupère le VRAI code d'activation utilisé par ce compte (au lieu
  // d'un code factice codé en dur), pour l'afficher sur la carte
  // "Licence Active".
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchMyLicense = async () => {
      setLoadingMyLicense(true);
      const { data } = await supabase
        .from("access_codes")
        .select("code, activated_at")
        .eq("user_id", user.id)
        .eq("status", "used")
        .order("activated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setMyLicenseCode(data?.code ?? null);
        setLoadingMyLicense(false);
      }
    };

    fetchMyLicense();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!isPlatformAdmin) return;

    const fetchStoresNeedingActivation = async () => {
      setLoadingStoresNeedingActivation(true);
      const { data, error } = await supabase
        .from("stores")
        .select(
          "id, name, activation_status, trial_ends_at, owner:profiles!stores_owner_id_fkey(email, full_name)",
        )
        .neq("activation_status", "active")
        .order("trial_ends_at", { ascending: true });

      if (!error && data) {
        const next = (data as any[]).map((s) => ({
          id: s.id,
          name: s.name,
          activation_status: s.activation_status,
          trial_ends_at: s.trial_ends_at,
          owner_email: s.owner?.email ?? "—",
          owner_name: s.owner?.full_name ?? null,
        }));
        setStoresNeedingActivation(next);
        if (!selectedStoreToActivateId && next[0]) {
          setSelectedStoreToActivateId(next[0].id);
        }
      }
      setLoadingStoresNeedingActivation(false);
    };

    fetchStoresNeedingActivation();
  }, [isPlatformAdmin, selectedStoreToActivateId]);

  const handleGenerateActivationCode = async () => {
    if (!isPlatformAdmin || !currentUserId || !selectedStoreToActivateId) return;

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "BLSM-";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    code += "-";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];

    setGeneratingCode(true);
    // Le code est désormais rattaché DIRECTEMENT à la boutique concernée
    // (store_id) plutôt qu'à un utilisateur au hasard — il ne pourra donc
    // être utilisé que pour activer CETTE boutique précise (voir la RPC
    // activate_store_with_code, qui vérifie store_id IS NULL OR = la
    // boutique demandée).
    const payload: any = {
      code,
      store_id: selectedStoreToActivateId,
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
    }
  };

  const handleSendInvitation = async () => {
    const targetStoreId = inviteStoreId || workspace.activeStore?.id;
    if (!inviteEmail || !targetStoreId) return;
    setInviting(true);
    setInviteStatus("");
    setLastInviteLink(null);
    setLastInviteCode(null);

    const targetStore = ownedStoresForInvite.find((s) => s.id === targetStoreId);

    try {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: {
          invited_email: inviteEmail.trim(),
          store_id: targetStoreId,
          role: inviteRole,
          permissions: invitePermissions,
          invited_by_name: profile?.full_name || "Propriétaire",
          store_name: targetStore?.name || workspace.activeStore?.name,
          app_url: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setInviteStatus(
        data?.warning
          ? "Invitation créée. E-mail non envoyé (voir lien/code ci-dessous à partager manuellement)."
          : "Invitation envoyée avec succès par e-mail ! Lien/code disponibles ci-dessous en secours.",
      );
      if (data?.token) {
        setLastInviteLink(`${window.location.origin}/accept-invite?token=${data.token}`);
      }
      if (data?.invite_code) {
        setLastInviteCode(data.invite_code);
      }
      setInviteEmail("");
      setInvitePermissions([]);
      fetchPendingInvitations();
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

  const MVOLA_NUMBER = "0389723412";

  const [storeActivationCode, setStoreActivationCode] = useState("");
  const [activatingStore, setActivatingStore] = useState(false);
  const [storeActivationError, setStoreActivationError] = useState<string | null>(null);

  // Statut réel de la boutique active (calculé côté client pour
  // l'affichage uniquement — le vrai verrouillage des fonctionnalités,
  // lui, est appliqué côté Supabase, voir Étape 5).
  const storeActivationStatus = workspace.activeStore?.activation_status ?? "trial";
  const trialEndsAt = workspace.activeStore?.trial_ends_at
    ? new Date(workspace.activeStore.trial_ends_at)
    : null;
  const isTrialExpired = trialEndsAt ? trialEndsAt.getTime() < Date.now() : false;
  const storeIsLocked = storeActivationStatus === "locked" || (storeActivationStatus === "trial" && isTrialExpired);
  const storeIsActive = storeActivationStatus === "active";
  const daysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleActivateStoreWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace.activeStore) return;
    setStoreActivationError(null);

    const normalized = storeActivationCode.toUpperCase().trim();
    if (!normalized) {
      setStoreActivationError("Entrez un code d'activation.");
      return;
    }

    setActivatingStore(true);
    try {
      const { error } = await supabase.rpc("activate_store_with_code", {
        p_store_id: workspace.activeStore.id,
        p_code: normalized,
      });
      if (error) {
        setStoreActivationError(error.message || "Code invalide ou déjà utilisé.");
        return;
      }
      setStoreActivationCode("");
      await workspace.refreshStores();
    } finally {
      setActivatingStore(false);
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

            <div className="bg-muted border border-border rounded-2xl p-5 mb-6 space-y-5">
              <h3 className="font-bold text-foreground">Inviter un Collaborateur par e-mail</h3>

              {ownedStoresForInvite.length > 1 && (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    Boutique concernée
                  </label>
                  <select
                    value={inviteStoreId}
                    onChange={(e) => setInviteStoreId(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground"
                  >
                    {ownedStoresForInvite.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    L'invité rejoindra UNIQUEMENT cette boutique, jamais vos autres boutiques.
                  </p>
                </div>
              )}

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
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Permissions accordées (onglets visibles pour l'invité)
                  </label>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setInvitePermissions(AVAILABLE_PERMISSIONS.map((p) => p.key))}
                      className="text-emerald-500 hover:underline font-semibold"
                    >
                      Tout cocher
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvitePermissions([])}
                      className="text-muted-foreground hover:underline font-semibold"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-background border border-border rounded-xl p-3">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={invitePermissions.includes(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                        className="w-4 h-4 rounded border-muted-foreground/40 accent-emerald-500"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
                {invitePermissions.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1.5">
                    Aucune permission cochée : l'invité n'aura accès à aucun onglet.
                  </p>
                )}
              </div>

              <button
                onClick={handleSendInvitation}
                disabled={inviting || !inviteEmail}
                className="w-full px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl"
              >
                {inviting ? "Envoi..." : "Envoyer Invitation"}
              </button>

              {inviteStatus && (
                <p
                  className={`text-sm font-semibold ${inviteStatus.includes("Erreur") ? "text-rose-500" : "text-emerald-500"}`}
                >
                  {inviteStatus}
                </p>
              )}

              {(lastInviteLink || lastInviteCode) && (
                <div className="bg-background border border-emerald-500/30 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">
                    À partager manuellement (l'envoi automatique par e-mail est peu fiable sans
                    domaine pro pour l'instant)
                  </p>
                  {lastInviteLink && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Lien d'invitation
                      </label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={lastInviteLink}
                          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(lastInviteLink)}
                          className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground hover:bg-accent"
                          title="Copier"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  {lastInviteCode && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Ou code d'invitation (alternative au lien)
                      </label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={lastInviteCode}
                          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono tracking-widest text-center"
                        />
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(lastInviteCode)}
                          className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground hover:bg-accent"
                          title="Copier"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Ne fonctionne que pour l'adresse e-mail saisie ci-dessus.
                  </p>
                </div>
              )}

              {pendingInvitations.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Invitations en attente ({pendingInvitations.length})
                  </p>
                  <div className="space-y-1.5 text-sm">
                    {pendingInvitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2"
                      >
                        <span className="text-foreground">{inv.invited_email}</span>
                        <span className="text-xs text-muted-foreground">{inv.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
                Gérez le statut de votre boutique et son activation.
              </p>
            </div>

            {/* ── BOUTIQUE DÉJÀ ACTIVE À VIE ── */}
            {storeIsActive && (
              <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/25 rounded-2xl p-6">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2.5 py-1">
                      Active — à vie
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    Votre boutique est déjà active
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Vous pouvez utiliser {workspace.activeStore?.name || "votre boutique"} sans
                    limite, à vie. Aucune action supplémentaire n'est nécessaire.
                  </p>
                  {workspace.activeStore?.activated_at && (
                    <p className="text-xs text-muted-foreground">
                      Activée le{" "}
                      {new Date(workspace.activeStore.activated_at).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  <div className="mt-4">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Code d'activation utilisé
                    </label>
                    <div className="bg-background/80 rounded-xl p-3 border border-border text-sm font-mono text-center tracking-wider">
                      {loadingMyLicense
                        ? "Chargement..."
                        : myLicenseCode
                          ? myLicenseCode
                          : "Activée par l'administrateur"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ESSAI GRATUIT EN COURS ── */}
            {storeActivationStatus === "trial" && !storeIsLocked && (
              <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent border border-blue-500/25 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/10 border border-blue-500/25 rounded-full px-2.5 py-1">
                    Essai gratuit
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  Votre boutique est en période d'essai gratuit
                </h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Il vous reste{" "}
                  <strong className="text-foreground">
                    {daysRemaining} jour{daysRemaining > 1 ? "s" : ""}
                  </strong>
                  . Votre essai gratuit se termine le{" "}
                  <strong className="text-foreground">
                    {trialEndsAt?.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                  . Activez avant cette date pour ne pas être interrompu.
                </p>
              </div>
            )}

            {/* ── VERROUILLÉE (essai expiré, non activée) ── */}
            {storeIsLocked && (
              <div className="relative overflow-hidden bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent border border-rose-500/25 rounded-2xl p-6">
                <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-rose-400" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  Votre période d'essai est terminée
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Votre boutique est temporairement verrouillée. Activez-la ci-dessous pour
                  retrouver un accès normal.
                </p>
              </div>
            )}

            {/* ── PAIEMENT + CODE : affiché tant que non active ── */}
            {!storeIsActive && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Phone className="w-4.5 h-4.5 text-emerald-500" />
                    </div>
                    <h3 className="font-bold text-foreground">Activer par paiement</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Effectuez le paiement de{" "}
                    <strong className="text-foreground">100 000 Ar</strong> via MVola, puis
                    envoyez la référence de transaction à l'administrateur pour recevoir votre
                    code d'activation.
                  </p>
                  <div className="bg-muted/60 border border-border rounded-xl p-4 text-center mb-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                      MVola
                    </p>
                    <p className="text-xl font-mono font-bold text-foreground tracking-wider">
                      {MVOLA_NUMBER}
                    </p>
                  </div>
                  <a
                    href={`tel:${ADMIN_CONTACT.replace(/\s/g, "")}`}
                    className="flex items-center gap-3 bg-muted/60 hover:bg-muted border border-border rounded-xl p-3.5 text-sm transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <span className="block font-semibold text-foreground text-xs">
                        Contact admin
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {ADMIN_CONTACT}
                      </span>
                    </div>
                  </a>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <KeyRound className="w-4.5 h-4.5 text-blue-500" />
                    </div>
                    <h3 className="font-bold text-foreground">Activer avec un code</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Vous avez déjà reçu un code de l'administrateur ? Entrez-le ici pour activer
                    {workspace.activeStore?.name ? ` ${workspace.activeStore.name}` : " votre boutique"}{" "}
                    immédiatement.
                  </p>
                  <form onSubmit={handleActivateStoreWithCode} className="space-y-3">
                    <input
                      type="text"
                      value={storeActivationCode}
                      onChange={(e) => setStoreActivationCode(e.target.value.toUpperCase())}
                      placeholder="BLSM-XXXX-XXXX"
                      maxLength={20}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-mono tracking-widest text-center focus:outline-none focus:border-emerald-500"
                    />
                    {storeActivationError && (
                      <p className="text-rose-500 text-sm font-semibold text-center">
                        {storeActivationError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={activatingStore}
                      className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl transition-colors"
                    >
                      {activatingStore ? "Vérification..." : "Activer ma boutique"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {storeIsActive && (
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <h3 className="font-bold text-foreground mb-1">Besoin de plus de licences ?</h3>
                  <p className="text-sm text-muted-foreground">
                    Vous pouvez acheter de nouveaux codes pour gérer d'autres boutiques.
                  </p>
                </div>
                <button className="shrink-0 px-6 py-2.5 bg-foreground/95 hover:bg-foreground text-background font-bold rounded-xl transition-colors">
                  Acheter un Code (100 000 Ar)
                </button>
              </div>
            )}

            {isPlatformAdmin && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-foreground">Gestion des codes d’activation</h3>
                </div>

                <div className="space-y-4">
                  {storesNeedingActivation.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1">
                        Boutique concernée
                      </label>
                      <select
                        value={selectedStoreToActivateId ?? ""}
                        onChange={(e) => setSelectedStoreToActivateId(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground"
                      >
                        {storesNeedingActivation.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name} — {store.owner_name || store.owner_email} (
                            {store.activation_status === "trial" ? "essai" : "verrouillée"})
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Ce code n'activera QUE la boutique sélectionnée ci-dessus.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleGenerateActivationCode}
                      disabled={generatingCode || !selectedStoreToActivateId}
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
                      Boutiques non activées ({storesNeedingActivation.length})
                    </div>
                    {loadingStoresNeedingActivation ? (
                      <p className="text-muted-foreground">Chargement...</p>
                    ) : storesNeedingActivation.length === 0 ? (
                      <p className="text-muted-foreground">
                        Toutes les boutiques sont activées pour le moment.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-muted-foreground">
                        {storesNeedingActivation.map((store) => {
                          const daysLeft = Math.max(
                            0,
                            Math.ceil(
                              (new Date(store.trial_ends_at).getTime() - Date.now()) /
                                (1000 * 60 * 60 * 24),
                            ),
                          );
                          const expired = new Date(store.trial_ends_at).getTime() < Date.now();
                          return (
                            <li key={store.id}>
                              • {store.name} ({store.owner_email}) —{" "}
                              {expired ? (
                                <span className="text-rose-400 font-semibold">
                                  essai expiré, verrouillée
                                </span>
                              ) : (
                                `${daysLeft} j restant${daysLeft > 1 ? "s" : ""}`
                              )}
                            </li>
                          );
                        })}
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