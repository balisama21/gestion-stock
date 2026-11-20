import React from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { installer } from "./faussebase";
import { MaquettePharmacie } from "./MaquettePharmacie";

installer();
createRoot(document.getElementById("racine")!).render(
  <React.StrictMode>
    <MaquettePharmacie />
  </React.StrictMode>,
);
