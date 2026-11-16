/** Os tipos de coluna e o texto de um valor (a parte do relatório do Axyn que o Hub usa). */
export type ReportColumnType = "text" | "number" | "money" | "date";
export type ReportValue = string | number | null;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function paperText(value: ReportValue, type: ReportColumnType = "text"): string {
  if (value === null) return "";
  if (type === "money" && typeof value === "number") {
    const text = brl.format(Math.abs(value) / 100);
    return value < 0 ? `−${text}` : text;
  }
  if (type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  return value;
}
