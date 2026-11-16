import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { ErroApi } from "./lib/api";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: (n, erro) => !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) && n < 2,
    },
  },
});

// O CSS do padrão separa o navegador do app de computador por este atributo.
document.documentElement.setAttribute("data-web", "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
