import { useRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A list's search, full width under the page header (the Conecta's): the
 * magnifier inside at the left, an X to clear at the right while there is
 * text. 40 px tall, 16 px text (no zoom on the iPhone). The placeholder is
 * plain and short: "Buscar tarefas", "Buscar lançamentos".
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label = placeholder,
  id,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** For screen readers (default: the placeholder). */
  label?: string;
  id?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={input}
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-card pr-9 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
