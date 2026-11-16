import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TODOS = "__todos__";

/** Um seletor simples. Com `vazio`, a primeira opção volta o valor para "". */
export function Escolha({
  value,
  onChange,
  options,
  vazio,
  placeholder,
  id,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  vazio?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value === "" && vazio ? TODOS : value} onValueChange={(v) => onChange(v === TODOS ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {vazio && <SelectItem value={TODOS}>{vazio}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
