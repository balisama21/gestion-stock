import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { cleDeNom } from "../lib/teintes";
import { envoyerFichier, preparerPhotoAvatar, supprimerFichier } from "../lib/stockageFichiers";
import type { Traits } from "../lib/avatarPersonne";
import type { AvatarRegle, AvatarsPersonnes } from "../lib/avatarsPersonnes";
import type { Json } from "../lib/database.types";

/** Les liens des photos durent une heure ; on les renouvelle avant. */
const DUREE_LIEN = 3600;
const RENOUVELLEMENT = 50 * 60 * 1000;

/**
 * Charge les avatars réglés de la boutique et offre de les changer.
 *
 * Tant que la migration `avatars_personnes` n'est pas appliquée, la
 * lecture échoue : l'application garde alors les visages tirés du nom
 * et n'offre pas de les modifier, sans rien casser.
 */
export function useAvatarsPersonnes(
  storeId: string | null | undefined,
  userId: string | null | undefined,
): AvatarsPersonnes {
  const [regles, setRegles] = useState<Map<string, AvatarRegle>>(new Map());
  const [disponible, setDisponible] = useState(false);

  const charger = useCallback(async () => {
    if (!storeId) {
      setRegles(new Map());
      setDisponible(false);
      return;
    }
    const { data, error } = await supabase
      .from("avatars_personnes")
      .select("*")
      .eq("store_id", storeId);
    if (error || !data) {
      setDisponible(false);
      return;
    }
    const chemins = data.map((r) => r.photo_chemin).filter((c): c is string => !!c);
    const liens = new Map<string, string>();
    if (chemins.length > 0) {
      const { data: signes } = await supabase.storage
        .from("avatars")
        .createSignedUrls(chemins, DUREE_LIEN);
      for (const s of signes ?? []) if (s.path && s.signedUrl) liens.set(s.path, s.signedUrl);
    }
    const table = new Map<string, AvatarRegle>();
    for (const r of data) {
      table.set(r.cle, {
        traits: r.traits,
        photoChemin: r.photo_chemin,
        photoUrl: r.photo_chemin ? (liens.get(r.photo_chemin) ?? null) : null,
      });
    }
    setRegles(table);
    setDisponible(true);
  }, [storeId]);

  useEffect(() => {
    void charger();
    const minuteur = window.setInterval(() => void charger(), RENOUVELLEMENT);
    return () => window.clearInterval(minuteur);
  }, [charger]);

  const ecrire = useCallback(
    async (nom: string, champs: { traits?: Json | null; photo_chemin?: string | null }) => {
      if (!storeId || !userId) return { error: "Aucune boutique active." };
      const { error } = await supabase.from("avatars_personnes").upsert(
        {
          store_id: storeId,
          cle: cleDeNom(nom),
          created_by: userId,
          updated_at: new Date().toISOString(),
          ...champs,
        },
        { onConflict: "store_id,cle" },
      );
      return { error: error?.message ?? null };
    },
    [storeId, userId],
  );

  const photoActuelle = useCallback(
    (nom: string) => regles.get(cleDeNom(nom))?.photoChemin ?? null,
    [regles],
  );

  const enregistrerVisage = useCallback(
    async (nom: string, traits: Traits) => {
      const ancienne = photoActuelle(nom);
      const { error } = await ecrire(nom, {
        traits: traits as unknown as Json,
        photo_chemin: null,
      });
      if (!error && ancienne) await supprimerFichier("avatars", ancienne);
      await charger();
      return { error };
    },
    [ecrire, photoActuelle, charger],
  );

  const enregistrerPhoto = useCallback(
    async (nom: string, fichier: File) => {
      if (!storeId) return { error: "Aucune boutique active." };
      const ancienne = photoActuelle(nom);
      const pret = await preparerPhotoAvatar(fichier);
      const envoi = await envoyerFichier("avatars", storeId, "personnes", pret);
      if (envoi.error || !envoi.chemin) return { error: envoi.error ?? "Envoi impossible." };
      const { error } = await ecrire(nom, { photo_chemin: envoi.chemin });
      if (error) {
        await supprimerFichier("avatars", envoi.chemin);
      } else if (ancienne) {
        await supprimerFichier("avatars", ancienne);
      }
      await charger();
      return { error };
    },
    [storeId, ecrire, photoActuelle, charger],
  );

  const retirerPhoto = useCallback(
    async (nom: string) => {
      const ancienne = photoActuelle(nom);
      const { error } = await ecrire(nom, { photo_chemin: null });
      if (!error && ancienne) await supprimerFichier("avatars", ancienne);
      await charger();
      return { error };
    },
    [ecrire, photoActuelle, charger],
  );

  const revenirAuVisageDuNom = useCallback(
    async (nom: string) => {
      if (!storeId) return { error: "Aucune boutique active." };
      const ancienne = photoActuelle(nom);
      const { error } = await supabase
        .from("avatars_personnes")
        .delete()
        .eq("store_id", storeId)
        .eq("cle", cleDeNom(nom));
      if (!error && ancienne) await supprimerFichier("avatars", ancienne);
      await charger();
      return { error: error?.message ?? null };
    },
    [storeId, photoActuelle, charger],
  );

  return useMemo(
    () => ({
      regles,
      modifiable: disponible && !!storeId && !!userId,
      enregistrerVisage,
      enregistrerPhoto,
      retirerPhoto,
      revenirAuVisageDuNom,
    }),
    [
      regles,
      disponible,
      storeId,
      userId,
      enregistrerVisage,
      enregistrerPhoto,
      retirerPhoto,
      revenirAuVisageDuNom,
    ],
  );
}
