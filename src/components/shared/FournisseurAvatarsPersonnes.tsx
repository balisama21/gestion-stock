import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useAvatarsPersonnes } from "../../hooks/useAvatarsPersonnes";
import { AvatarsPersonnesContext } from "../../lib/avatarsPersonnes";

/** Met les avatars réglés de la boutique active à disposition de tous les écrans. */
export const FournisseurAvatarsPersonnes: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { activeStore } = useWorkspace();
  const avatars = useAvatarsPersonnes(activeStore?.id ?? null, user?.id ?? null);
  return (
    <AvatarsPersonnesContext.Provider value={avatars}>{children}</AvatarsPersonnesContext.Provider>
  );
};
