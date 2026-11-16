import logoClaro from "@/assets/marca/logo-claro.png";
import logoCompletoClaro from "@/assets/marca/logo-completo-claro.png";
import logoCompletoEscuro from "@/assets/marca/logo-completo-escuro.png";
import logoEscuro from "@/assets/marca/logo-escuro.png";
import simbolo from "@/assets/marca/simbolo.png";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * A marca da Elev Muniz (arte original, fundo transparente). O "uniz" é branco na arte:
 * no tema claro entra a versão com ele em grafite. A altura vem da classe (h-6, h-8...).
 */

/** O símbolo (o "M" dourado) sozinho. */
export function AppIcon({ className }: { className?: string }) {
  return <img src={simbolo} alt="" aria-hidden className={cn("block aspect-square w-auto shrink-0 object-contain", className)} />;
}

/** Símbolo + "elev Muniz". Com `completo`, também "Inteligência Financeira" embaixo. */
export function AppLogo({ className, label = APP_NAME, completo = false }: { className?: string; label?: string; completo?: boolean }) {
  const [escuro, claro] = completo ? [logoCompletoEscuro, logoCompletoClaro] : [logoEscuro, logoClaro];
  return (
    <span role="img" aria-label={label} className={cn("inline-flex shrink-0", className)}>
      <img src={claro} alt="" aria-hidden draggable={false} className="block h-full w-auto dark:hidden" />
      <img src={escuro} alt="" aria-hidden draggable={false} className="hidden h-full w-auto dark:block" />
    </span>
  );
}
