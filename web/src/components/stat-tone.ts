/** The colours of the status bar's numbers: green what came through, orange what is still to come, red what is out or late. */
const GOOD = "text-[#0a7d55] dark:text-[#30d158]";
const PENDING = "text-[#c76a00] dark:text-[#ff9230]";
const BAD = "text-destructive";

const TONES: Record<string, string> = {
  pago: GOOD,
  pagas: GOOD,
  "já pago": GOOD,
  quitadas: GOOD,
  recebido: GOOD,
  recebidas: GOOD,
  entrou: GOOD,
  "a entrar": GOOD,
  receitas: GOOD,
  "a pagar": PENDING,
  "a receber": PENDING,
  "falta pagar": PENDING,
  "em aberto": PENDING,
  agendado: PENDING,
  agendadas: PENDING,
  saiu: BAD,
  "a sair": BAD,
  despesas: BAD,
};

/** Red only when there is something late: "Vencidas 0" is good news, in the text's colour. */
const LATE = new Set(["vencidas", "vencida", "atrasadas"]);

/**
 * A number's colour by what it says (the owner's of 2026-11-04: "umas cores"), the same on every page of the status
 * bar. Only the number; its name stays grey. Nothing for what has no meaning of its own (Total do mês, Ativas…).
 */
export function statTone(label: string, value: string | number | undefined): string | undefined {
  const name = label.trim().toLocaleLowerCase("pt-BR");
  if (LATE.has(name)) return /[1-9]/.test(String(value ?? "")) ? BAD : undefined;
  return TONES[name];
}
