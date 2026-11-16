/**
 * Money as a table writes it on the PC (the FBMaker's `.ax-acct`, Excel's
 * "Contábil"): the currency at the left of the cell, the number at the
 * right. Formatting only: the amount comes already written ("R$ 1.234,56",
 * "−R$ 89,90", "+R$ 10,00"). Pure: tested in `money.test.ts`.
 */

/**
 * "R$ 1.234,56" → { currency: "R$", amount: "1.234,56" }. A sign stays with
 * the currency, at the left, as the Brazilian accounting format writes it
 * ("−R$ … 89,90", "+R$ … 10,00"), so the numbers line up at the right.
 * Anything that does not start with "R$" (a "—", "não disponível"): null.
 */
export function accountingParts(text: string): { currency: string; amount: string } | null {
  const match = /^([+−-]?R\$)\s*(\S.*)$/u.exec(text.trim());
  return match ? { currency: match[1], amount: match[2] } : null;
}
