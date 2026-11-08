import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useAuthState } from "./useAuth";

const db = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({
  retourGoogleAndroid: null,
  supabase: { auth: { onAuthStateChange: db.onAuthStateChange }, from: db.from },
}));

it("libère le callback Auth et ne lit le profil qu’une fois à la restauration", async () => {
  db.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  const profile = { id: "test", status: "activated" };
  db.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: profile, error: null }),
      }),
    }),
  });
  const { result, unmount } = renderHook(useAuthState);
  const notify = db.onAuthStateChange.mock.calls[0][0];
  const session = { user: { id: profile.id } };
  act(() => {
    expect(notify("INITIAL_SESSION", session)).toBeUndefined();
    notify("SIGNED_IN", session);
    expect(db.from).not.toHaveBeenCalled();
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.profile).toEqual(profile);
  expect(db.from).toHaveBeenCalledTimes(1);
  unmount();
});
