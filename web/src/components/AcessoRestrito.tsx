import { LockIcon } from "lucide-react";

import { EstadoVazio } from "@/components/EstadoVazio";

export function AcessoRestrito() {
  return (
    <div className="grid h-full place-items-center">
      <EstadoVazio icon={<LockIcon />} title="Acesso restrito" description="Seu perfil de acesso não libera esta tela. Peça ao administrador." />
    </div>
  );
}
