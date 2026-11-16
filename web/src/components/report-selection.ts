import type { LucideIcon } from "lucide-react";
import { create } from "zustand";

/** A button of the ribbon for the rows selected in the report on display. */
export interface SelectionTool {
  id: string;
  label: string;
  icon: LucideIcon;
  /** The tile's colour (the ribbon's `RibbonTone`): green to pay, red to delete, grey for the rest. */
  tone: "green" | "red" | "gray";
  run: () => void;
}

/**
 * What the report on display offers for its rows selected (`ReportTable`), for the ribbon to show beside
 * "Adicionar" (the owner's of 2026-11-03): none while nothing is selected.
 */
export const useReportSelection = create<{
  count: number;
  tools: readonly SelectionTool[];
  publish: (count: number, tools: readonly SelectionTool[]) => void;
}>((set) => ({
  count: 0,
  tools: [],
  publish: (count, tools) => set({ count, tools }),
}));
