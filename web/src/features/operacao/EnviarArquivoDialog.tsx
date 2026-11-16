import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUpIcon, XIcon } from "lucide-react";

import { FormField } from "@/components/FormPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, enviarArquivos } from "@/lib/api";
import { tamanho } from "@/lib/formato";
import type { ItemOperacao } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Os formatos que o envio aceita agora (Configurações › Geral). Padrão: PDF, PNG e JPEG. */
export function useFormatosAceitos(): { extensoes: string[]; nomes: string[] } {
  const config = useQuery({
    queryKey: ["configuracoes"],
    queryFn: () => api<{ extensoes_aceitas: string[]; formatos: { chave: string; nome: string }[]; formatos_aceitos: string[] }>("/configuracoes"),
  });
  const d = config.data;
  if (!d) return { extensoes: [".pdf", ".png", ".jpg", ".jpeg"], nomes: ["PDF", "PNG", "JPEG"] };
  return { extensoes: d.extensoes_aceitas, nomes: d.formatos.filter((f) => d.formatos_aceitos.includes(f.chave)).map((f) => f.nome) };
}

const juntarNomes = (nomes: string[]) => (nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} ou ${nomes.at(-1)}` : (nomes[0] ?? ""));

/** Uma área para escolher arquivo (tracejada), com o nome do escolhido. */
export function EscolherArquivo({
  label,
  arquivos,
  onChange,
  multiplo,
  extensoes,
  formatos,
}: {
  label: string;
  arquivos: File[];
  onChange: (f: File[]) => void;
  multiplo?: boolean;
  extensoes: string[];
  formatos: string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          const lista = Array.from(e.dataTransfer.files);
          if (lista.length) onChange(multiplo ? [...arquivos, ...lista] : lista.slice(0, 1));
        }}
        className={cn(
          "flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-3 text-center text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          sobre ? "border-primary bg-primary/[0.06]" : "border-input hover:border-primary/60 hover:bg-muted/50",
        )}
      >
        <FileUpIcon className="size-5 text-muted-foreground" aria-hidden />
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">Clique ou arraste aqui · {juntarNomes(formatos)}</span>
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={extensoes.join(",")}
        multiple={multiplo}
        onChange={(e) => {
          const lista = Array.from(e.target.files ?? []);
          if (lista.length) onChange(multiplo ? [...arquivos, ...lista] : lista.slice(0, 1));
          e.target.value = "";
        }}
      />
      {arquivos.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-sm">
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{tamanho(f.size)}</span>
          <button type="button" aria-label={`Tirar ${f.name}`} onClick={() => onChange(arquivos.filter((_, j) => j !== i))} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Enviar um documento por dentro do sistema (entra já aprovado). Documento com frente e verso
 * pede os dois lados; documento com validade pede "Vence em". Sem item: vai para "Outros arquivos".
 */
export function EnviarArquivoDialog({ operacaoId, item, onClose }: { operacaoId: number; item: ItemOperacao | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [frente, setFrente] = useState<File[]>([]);
  const [verso, setVerso] = useState<File[]>([]);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [validade, setValidade] = useState(item?.atual?.validade ?? "");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const doisLados = !!item?.frente_verso;
  const { extensoes, nomes } = useFormatosAceitos();

  const enviar = useMutation({
    mutationFn: () => {
      const dados = new FormData();
      if (item) dados.append("item_id", String(item.id));
      if (validade) dados.append("validade", validade);
      if (observacao) dados.append("observacao", observacao);
      if (doisLados) {
        dados.append("frente", frente[0]);
        dados.append("verso", verso[0]);
      } else {
        for (const f of arquivos) dados.append("arquivos", f);
      }
      return enviarArquivos(`/operacoes/${operacaoId}/documentos`, dados);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["operacao", operacaoId] });
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Documento guardado na pasta da operação.");
      onClose();
    },
    onError: (e) => setErro((e as Error).message),
  });

  const pronto = doisLados ? frente.length === 1 && verso.length === 1 : arquivos.length > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && !enviar.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pronto) return setErro(doisLados ? "Escolha a frente e o verso." : "Escolha o arquivo.");
            if (item?.exige_validade && !validade) return setErro('Este documento tem validade: preencha "Vence em".');
            setErro("");
            enviar.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{item ? `Enviar ${item.nome}` : "Enviar outro arquivo"}</DialogTitle>
            <DialogDescription>
              {item?.atual ? "A versão atual vai para o histórico e esta passa a valer." : "Enviado por aqui, o documento entra já aprovado."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {doisLados ? (
              <div className="grid grid-cols-2 gap-3">
                <EscolherArquivo label="Frente" arquivos={frente} onChange={setFrente} extensoes={extensoes} formatos={nomes} />
                <EscolherArquivo label="Verso" arquivos={verso} onChange={setVerso} extensoes={extensoes} formatos={nomes} />
              </div>
            ) : (
              <EscolherArquivo label="Escolher arquivos" arquivos={arquivos} onChange={setArquivos} multiplo extensoes={extensoes} formatos={nomes} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Vence em" htmlFor="env-validade" required={item?.exige_validade} help={item?.exige_validade ? undefined : "Opcional"}>
                <Input id="env-validade" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
              </FormField>
            </div>
            <FormField label="Observação" htmlFor="env-obs">
              <Textarea id="env-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} placeholder="Opcional" />
            </FormField>
            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={enviar.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviar.isPending}>
              {enviar.isPending && <Spinner data-icon="inline-start" />}
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
