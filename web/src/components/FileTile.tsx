import { cn } from "@/lib/utils";

/** The band's colour by the kind of file (Excel green, Word blue, PDF red…). */
const BAND: Record<string, string> = {
  xlsx: "bg-[#107c41]",
  xls: "bg-[#107c41]",
  csv: "bg-[#107c41]",
  docx: "bg-[#185abd]",
  doc: "bg-[#185abd]",
  pptx: "bg-[#c43e1c]",
  ppt: "bg-[#c43e1c]",
  pdf: "bg-[#d0312d]",
  png: "bg-[#7a5af5]",
  jpg: "bg-[#7a5af5]",
  jpeg: "bg-[#7a5af5]",
  gif: "bg-[#7a5af5]",
  webp: "bg-[#7a5af5]",
  zip: "bg-[#8e6c3a]",
};

/** A file's kind from its name: "xlsx"; "" without one. */
export function fileKind(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "";
}

/**
 * A sheet of paper with a folded corner and a coloured band: with `name`, its kind written on the band in the
 * kind's colour ("XLSX"); with `band`, that colour and nothing written (a notice that is no file).
 */
export function FileTile({ name, band, className }: { name?: string; band?: string; className?: string }) {
  const kind = name ? fileKind(name) : "";
  return (
    <span aria-hidden className={cn("relative inline-block h-10 w-8 shrink-0", className)}>
      <svg viewBox="0 0 32 40" className="size-full" fill="none">
        <path d="M7 1.5h13.5L29.5 10.5V35a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 35V5A3.5 3.5 0 0 1 7 1.5Z" fill="var(--card)" stroke="currentColor" strokeOpacity=".28" />
        <path d="M20.5 1.5V7a3.5 3.5 0 0 0 3.5 3.5h5.5" stroke="currentColor" strokeOpacity=".28" />
      </svg>
      <span className={cn("absolute right-1 bottom-[7px] left-0 grid h-[13px] place-items-center rounded-[3px] text-[8px] leading-none font-bold tracking-tight text-white", band ?? BAND[kind] ?? "bg-[#6e6e73]")}>{kind.toUpperCase()}</span>
    </span>
  );
}
