import { toast } from "sonner";


export async function copiar(texto: string, aviso = "Copiado.") {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(aviso);
  } catch {
    // Sem permissão de área de transferência (endereço de rede sem https): seleção manual.
    const campo = document.createElement("textarea");
    campo.value = texto;
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand("copy");
    campo.remove();
    if (ok) toast.success(aviso);
    else toast.error("Não foi possível copiar. Selecione o texto e copie com Ctrl C.");
  }
}

/** Link do WhatsApp com a mensagem pronta (número só com dígitos, com 55 na frente). */
export function linkWhatsApp(telefone: string, mensagem: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const numero = digitos.length >= 10 && digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

export function mensagemDoLink({ empresa, contato, operacao, link, prazo }: { empresa: string; contato: string; operacao: string; link: string; prazo: string }) {
  const ola = contato ? `Olá, ${contato.split(" ")[0]}!` : "Olá!";
  return `${ola} Aqui é da ${empresa}. Para a operação "${operacao}", envie os documentos por este link: ${link} (vale até ${prazo}).`;
}

