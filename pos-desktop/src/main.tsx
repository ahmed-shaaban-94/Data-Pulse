import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@pos/router";

import "@pos/styles/fonts.css";
import "@pos/styles/globals.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
