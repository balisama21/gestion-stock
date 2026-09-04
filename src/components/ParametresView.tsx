import React, { useEffect, useMemo, useState } from "react";
import { StoreSettings, Seller, LocaleSetting, CapitalSummary } from "../types";
import { SettingsLayout, SettingsTab } from "./settings/SettingsLayout";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "../hooks/useAuth";
import {
  normalizePermissions,
  type PermissionsMap,
  type RoleKey,
} from "../lib/permissions";
import { AccountSection } from "./settings/AccountSection";
import { SecuritySection } from "./settings/SecuritySection";
import { StoreSection, type StoreFormValues } from "./settings/StoreSection";
import { TeamSection, type TeamMember } from "./settings/TeamSection";
import { BillingSection } from "./settings/BillingSection";
import { PreferencesSection } from "./settings/PreferencesSection";
import { NotificationsSection } from "./settings/NotificationsSection";
import { InvoiceSection } from "./settings/InvoiceSection";
import { Trash2 } from "lucide-react";

interface ParametresViewProps {
  settings: StoreSettings;
  onUpdateSettings: (newSettings: Partial<StoreSettings>) => void;
  sellers: Seller[];
  onDeleteSeller: (id: string) => void;
  locale: LocaleSetting;
  setLocale: (locale: LocaleSetting) => void;
  capital: CapitalSummary;
  onDownloadExcel: () => void;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
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

// Contact admin réel de la plateforme (celui affiché dans AuthPage.tsx et
// ici doivent toujours rester synchronisés).
const ADMIN_CONTACT = "+261 38 97 234 12";
const MVOLA_NUMBER = "0389723412";

export const ParametresView: React.FC<ParametresViewProps> = ({
  settings,
  onUpdateSettings,
  onDeleteSeller,
  locale,
  setLocale,
  onDownloadExcel,
  theme,
  setTheme,
  isPlatformAdmin = false,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("compte");
  const workspace = useWorkspace();
  const { user, profile, refreshProfile, reauthenticate, updatePassword, deleteAccount } =
    useAuth();

  // ─── Onglet « Ma boutique » ───────────────────────────────────────────
  // Un seul objet de formulaire, comparé à sa référence enregistrée pour
  // savoir s'il reste des modifications en attente.
  const storeBaseline: StoreFormValues = useMemo(
    () => ({
      storeName: settings.storeName || "",
      subtitle: settings.subtitle || "",
      address: settings.address || "",
      phone: settings.phone || "",
      email: settings.email || "",
      nifStat: settings.nifStat || "",
      logoUrl: settings.logoUrl,
      currencySymbol: settings.currencySymbol || "Ar",
      tvaRate: settings.tvaRate ?? 0,
      receiptFooter: settings.receiptFooter || "",
      suppliers: settings.suppliers || [],
    }),
    [settings],
  );

  const [storeForm, setStoreForm] = useState<StoreFormValues>(storeBaseline);
  const [savingStore, setSavingStore] = useState(false);
  const [storeSaved, setStoreSaved] = useState(false);

  // Resynchronise le formulaire quand la boutique active change (bascule
  // d'espace de travail) ou quand les valeurs enregistrées reviennent de
  // la base après une sauvegarde.
  useEffect(() => {
    setStoreForm(storeBaseline);
  }, [storeBaseline]);

  const patchStore = (patch: Partial<StoreFormValues>) =>
    setStoreForm((prev) => ({ ...prev, ...patch }));

  const handleSaveStore = () => {
    setSavingStore(true);
    // masterPin et enablePinSecurity ne sont volontairement PAS envoyés
    // ici : ils s'éditent dans l'onglet Sécurité et sont stockés dans
    // `profiles`. Les inclure faisait réécrire, depuis cet onglet, une
    // valeur venue d'un autre.
    onUpdateSettings({
      storeName: storeForm.storeName,
      subtitle: storeForm.subtitle,
      address: storeForm.address,
      phone: storeForm.phone,
      email: storeForm.email,
      nifStat: storeForm.nifStat,
      logoUrl: storeForm.logoUrl,
      currencySymbol: storeForm.currencySymbol,
      tvaRate: storeForm.tvaRate,
      receiptFooter: storeForm.receiptFooter,
      suppliers: storeForm.suppliers,
    });
    setSavingStore(false);
    setStoreSaved(true);
    setTimeout(() => setStoreSaved(false), 3000);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => patchStore({ logoUrl: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  // ─── Onglet « Sécurité » ──────────────────────────────────────────────
  // Reflète l'état réel stocké dans `profiles` (PIN + délai avant
  // verrouillage automatique), jamais dans `stores`.
  const [masterPin, setMasterPin] = useState(settings.masterPin || "");
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(
    profile?.session_timeout_minutes ?? 30,
  );
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securitySaved, setSecuritySaved] = useState(false);

  const securityBaseline = useMemo(
    () => ({ pin: profile?.pin_hash || "", timeout: profile?.session_timeout_minutes ?? 30 }),
    [profile?.pin_hash, profile?.session_timeout_minutes],
  );

  useEffect(() => {
    setMasterPin(securityBaseline.pin);
    setSessionTimeoutMinutes(securityBaseline.timeout);
  }, [securityBaseline]);

  const handleSaveSecurity = async () => {
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
  // jamais de changement de mot de passe « à l'aveugle ».
  const [currentPasswordForPwChange, setCurrentPasswordForPwChange] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  // ─── Onglet « Mon compte » ────────────────────────────────────────────
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [accountEmail, setAccountEmail] = useState(profile?.email || user?.email || "");
  const [accountPhone, setAccountPhone] = useState(profile?.phone || "");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);

  const accountBaseline = useMemo(
    () => ({
      fullName: profile?.full_name || "",
      email: profile?.email || user?.email || "",
      phone: profile?.phone || "",
    }),
    [profile?.full_name, profile?.email, profile?.phone, user?.email],
  );

  useEffect(() => {
    setFullName(accountBaseline.fullName);
    setAccountEmail(accountBaseline.email);
    setAccountPhone(accountBaseline.phone);
  }, [accountBaseline]);

  const handleSaveAccount = async () => {
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

  // ─── Suppression de compte ────────────────────────────────────────────
  // Toujours protégée par le mot de passe actuel. Action irréversible
  // (RPC delete_own_account) — supprime le compte, sa boutique et toutes
  // ses données.
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

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

  // ─── Onglet « Équipe » ────────────────────────────────────────────────
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteStoreId, setInviteStoreId] = useState<string>("");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<
    Array<{
      id: string;
      invited_email: string;
      role: string;
      token: string;
      invite_code: string | null;
      store_id: string;
    }>
  >([]);
  const [realMembers, setRealMembers] = useState<TeamMember[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<PermissionsMap>({});
  const [savingMemberPermissions, setSavingMemberPermissions] = useState(false);

  const fetchRealMembers = async () => {
    if (!inviteStoreId) return;
    const { data } = await supabase
      .from("store_members")
      .select("id, user_id, role, permissions, profile:profiles!user_id(full_name, email)")
      .eq("store_id", inviteStoreId);
    setRealMembers(
      (data ?? []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        // normalizePermissions() lit aussi bien l'ancien format (tableau)
        // que le nouveau (carte détaillée) — aucun collaborateur existant
        // n'affiche « aucune permission » par erreur après la migration.
        permissions: normalizePermissions(m.permissions),
        full_name: m.profile?.full_name ?? null,
        email: m.profile?.email ?? "",
      })),
    );
  };

  const openEditPermissions = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setEditingPermissions(member.permissions);
  };

  const handleSaveMemberPermissions = async () => {
    if (!editingMemberId) return;
    setSavingMemberPermissions(true);
    const { error } = await supabase
      .from("store_members")
      .update({ permissions: editingPermissions })
      .eq("id", editingMemberId);
    setSavingMemberPermissions(false);
    if (!error) {
      setEditingMemberId(null);
      fetchRealMembers();
    }
  };

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
    fetchRealMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteStoreId]);

  const handleSendInvitation = async (data: {
    email: string;
    storeId: string;
    role: RoleKey;
    permissions: PermissionsMap;
  }) => {
    setInviting(true);
    setInviteStatus("");
    setLastInviteLink(null);
    setLastInviteCode(null);

    const targetStore = ownedStoresForInvite.find((s) => s.id === data.storeId);

    try {
      const { data: res, error } = await supabase.functions.invoke("send-invitation", {
        body: {
          invited_email: data.email,
          store_id: data.storeId,
          role: data.role,
          permissions: data.permissions,
          invited_by_name: profile?.full_name || "Propriétaire",
          store_name: targetStore?.name || workspace.activeStore?.name,
          app_url: window.location.origin,
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);

      setInviteStatus(
        res?.warning
          ? "Invitation créée. E-mail non envoyé — partagez le lien ou le code ci-dessous."
          : "Invitation envoyée par e-mail. Le lien et le code ci-dessous servent de secours.",
      );
      if (res?.token) {
        setLastInviteLink(`${window.location.origin}/accept-invite?token=${res.token}`);
      }
      if (res?.invite_code) {
        setLastInviteCode(res.invite_code);
      }
      fetchPendingInvitations();
    } catch (e: any) {
      setInviteStatus("Erreur : " + e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    onDeleteSeller(id);
    // Rafraîchit la liste locale une fois la suppression partie côté
    // base, sans attendre le prochain changement de boutique.
    setTimeout(fetchRealMembers, 400);
  };

  // ─── Onglet « Abonnement » ────────────────────────────────────────────
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
  // « Licence active ».
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
    // Le code est rattaché DIRECTEMENT à la boutique concernée (store_id)
    // plutôt qu'à un utilisateur au hasard — il ne pourra donc être
    // utilisé que pour activer CETTE boutique précise (voir la RPC
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

  const [storeActivationCode, setStoreActivationCode] = useState("");
  const [activatingStore, setActivatingStore] = useState(false);
  const [storeActivationError, setStoreActivationError] = useState<string | null>(null);

  // Statut réel de la boutique active (calculé côté client pour
  // l'affichage uniquement — le vrai verrouillage des fonctionnalités est
  // appliqué côté Supabase par les RLS).
  const storeActivationStatus = workspace.activeStore?.activation_status ?? "trial";
  const trialEndsAt = workspace.activeStore?.trial_ends_at
    ? new Date(workspace.activeStore.trial_ends_at)
    : null;
  const isTrialExpired = trialEndsAt ? trialEndsAt.getTime() < Date.now() : false;
  const storeIsLocked =
    storeActivationStatus === "locked" || (storeActivationStatus === "trial" && isTrialExpired);
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

  return (
    <SettingsLayout activeTab={activeTab} onTabChange={setActiveTab} isOwner={workspace.isOwner}>
      {activeTab === "compte" && (
        <AccountSection
          fullName={fullName}
          setFullName={setFullName}
          accountEmail={accountEmail}
          setAccountEmail={setAccountEmail}
          accountPhone={accountPhone}
          setAccountPhone={setAccountPhone}
          baseline={accountBaseline}
          saving={savingAccount}
          saved={accountSaved}
          onSave={handleSaveAccount}
        />
      )}

      {activeTab === "securite" && (
        <SecuritySection
          masterPin={masterPin}
          setMasterPin={setMasterPin}
          sessionTimeoutMinutes={sessionTimeoutMinutes}
          setSessionTimeoutMinutes={setSessionTimeoutMinutes}
          baseline={securityBaseline}
          savingSecurity={savingSecurity}
          securitySaved={securitySaved}
          onSaveSecurity={handleSaveSecurity}
          currentPassword={currentPasswordForPwChange}
          setCurrentPassword={setCurrentPasswordForPwChange}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          changingPassword={changingPassword}
          passwordMessage={passwordChangeMessage}
          onChangePassword={handleChangePassword}
        />
      )}

      {activeTab === "notifications" && <NotificationsSection />}

      {activeTab === "preferences" && (
        <PreferencesSection
          theme={theme}
          setTheme={setTheme}
          locale={locale}
          setLocale={setLocale}
          onDownloadExcel={onDownloadExcel}
          onRequestDeleteAccount={() => {
            setDeleteAccountError(null);
            setDeleteAccountPassword("");
            setShowDeleteAccountModal(true);
          }}
        />
      )}

      {activeTab === "boutique" && (
        <StoreSection
          values={storeForm}
          onChange={patchStore}
          baseline={storeBaseline}
          saving={savingStore}
          saved={storeSaved}
          onSave={handleSaveStore}
          onReset={() => setStoreForm(storeBaseline)}
          onLogoChange={handleLogoChange}
        />
      )}

      {activeTab === "facture" && <InvoiceSection settings={settings} />}

      {activeTab === "equipe" && (
        <TeamSection
          ownedStores={ownedStoresForInvite.map((s) => ({ id: s.id, name: s.name }))}
          defaultStoreId={inviteStoreId || workspace.activeStore?.id || ""}
          inviting={inviting}
          inviteStatus={inviteStatus}
          lastInviteLink={lastInviteLink}
          lastInviteCode={lastInviteCode}
          onSendInvitation={handleSendInvitation}
          pendingInvitations={pendingInvitations}
          members={realMembers}
          editingMemberId={editingMemberId}
          editingPermissions={editingPermissions}
          setEditingPermissions={setEditingPermissions}
          savingMemberPermissions={savingMemberPermissions}
          onEditPermissions={openEditPermissions}
          onCancelEdit={() => setEditingMemberId(null)}
          onSaveMemberPermissions={handleSaveMemberPermissions}
          onRemoveMember={handleRemoveMember}
        />
      )}

      {activeTab === "paiement" && (
        <BillingSection
          storeName={workspace.activeStore?.name}
          activatedAt={workspace.activeStore?.activated_at}
          storeIsActive={storeIsActive}
          storeIsLocked={storeIsLocked}
          isTrial={storeActivationStatus === "trial"}
          daysRemaining={daysRemaining}
          trialEndsAt={trialEndsAt}
          myLicenseCode={myLicenseCode}
          loadingMyLicense={loadingMyLicense}
          mvolaNumber={MVOLA_NUMBER}
          adminContact={ADMIN_CONTACT}
          activationCodeInput={storeActivationCode}
          setActivationCodeInput={setStoreActivationCode}
          activating={activatingStore}
          activationError={storeActivationError}
          onActivate={handleActivateStoreWithCode}
          isPlatformAdmin={isPlatformAdmin}
          storesNeedingActivation={storesNeedingActivation}
          loadingStoresNeedingActivation={loadingStoresNeedingActivation}
          selectedStoreToActivateId={selectedStoreToActivateId}
          setSelectedStoreToActivateId={setSelectedStoreToActivateId}
          generatedCode={activationCode}
          setGeneratedCode={setActivationCode}
          generatingCode={generatingCode}
          onGenerateCode={handleGenerateActivationCode}
        />
      )}

      {/* Modale de confirmation — Supprimer mon compte */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="app-card w-full max-w-md space-y-4 border-danger-border p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold t-danger">
              <Trash2 className="h-5 w-5" />
              Supprimer définitivement mon compte
            </h3>

            <p className="text-sm leading-relaxed text-muted-foreground">
              Cette action est <strong className="text-foreground">irréversible</strong>. Votre
              compte, votre boutique et toutes ses données — produits, ventes, achats, clients,
              historique — seront supprimés définitivement.
            </p>

            <div>
              <label
                htmlFor="delete-account-pw"
                className="mb-1 block text-sm font-semibold text-foreground"
              >
                Confirmez avec votre mot de passe
              </label>
              <input
                id="delete-account-pw"
                type="password"
                value={deleteAccountPassword}
                onChange={(e) => setDeleteAccountPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Mot de passe actuel"
                className="app-field"
              />
            </div>

            {deleteAccountError && (
              <p className="text-sm font-semibold t-danger">{deleteAccountError}</p>
            )}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={deletingAccount}
                className="app-btn-ghost"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={deletingAccount}
                className="app-btn bg-destructive text-white hover:opacity-90"
              >
                {deletingAccount ? "Suppression…" : "Supprimer mon compte"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
};
