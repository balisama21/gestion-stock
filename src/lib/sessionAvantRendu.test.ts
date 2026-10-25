import { afterEach, describe, expect, it } from "vitest";
import {
  ATTRIBUT_SESSION,
  oublierSessionAvantRendu,
  scriptSessionAvantRendu,
} from "./sessionAvantRendu";

const executer = () => new Function(scriptSessionAvantRendu())();
const pose = () => document.documentElement.hasAttribute(ATTRIBUT_SESSION);

afterEach(() => {
  localStorage.clear();
  window.location.hash = "";
  document.documentElement.removeAttribute(ATTRIBUT_SESSION);
});

describe("session avant le rendu", () => {
  it("visiteur sans session : la page d'accueil reste visible", () => {
    localStorage.setItem("tantana.marque.v1", "{}");
    executer();
    expect(pose()).toBe(false);
  });

  it("session supabase stockée : l'écran de chargement la remplace", () => {
    localStorage.setItem("sb-abcdefgh-auth-token", "{}");
    executer();
    expect(pose()).toBe(true);
    oublierSessionAvantRendu();
    expect(pose()).toBe(false);
  });

  it("lien d'invitation ou de récupération : jetons dans l'ancre", () => {
    window.location.hash = "#access_token=x&type=recovery";
    executer();
    expect(pose()).toBe(true);
  });
});
