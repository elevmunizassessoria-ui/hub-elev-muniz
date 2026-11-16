import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { FormField, FormPage, FormSection, YesNo } from "@/components/FormPage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Cliente } from "@/lib/tipos";

const VAZIO = { nome: "", razao_social: "", documento: "", contato: "", email: "", telefone: "", observacao: "", ativo: true };

/** Cadastro do cliente (página inteira). O nome também é o nome da pasta no computador. */
export function ClienteForm({ cliente, onClose, onSaved }: { cliente: Cliente | null; onClose: () => void; onSaved: (c: Cliente, novo: boolean) => void }) {
  const qc = useQueryClient();
  const [dados, setDados] = useState(() => (cliente ? { ...VAZIO, ...cliente } : VAZIO));
  const [erro, setErro] = useState<string | null>(null);
  const campo = (k: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDados((d) => ({ ...d, [k]: e.target.value }));

  const salvar = useMutation({
    mutationFn: () =>
      cliente
        ? api<{ cliente: Cliente }>(`/clientes/${cliente.id}`, { metodo: "PUT", corpo: dados })
        : api<{ cliente: Cliente }>("/clientes", { corpo: dados }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      await qc.invalidateQueries({ queryKey: ["cliente", r.cliente.id] });
      toast.success(cliente ? "Cliente salvo." : "Cliente cadastrado. A pasta dele já foi criada.");
      onSaved(r.cliente, !cliente);
    },
    onError: (e) => setErro((e as Error).message),
  });

  return (
    <FormPage
      title={cliente ? `Editar ${cliente.nome}` : "Novo cliente"}
      onBack={onClose}
      onSubmit={() => {
        if (!dados.nome.trim()) return setErro("Preencha o nome do cliente.");
        setErro(null);
        salvar.mutate();
      }}
      busy={salvar.isPending}
      footerNote={erro && <span className="text-destructive">{erro}</span>}
    >
      <FormSection title="Dados do cliente">
        <FormField label="Nome do cliente" htmlFor="c-nome" required span={2} help={cliente ? "Mudar o nome também renomeia a pasta no computador." : "É também o nome da pasta no computador."}>
          <Input id="c-nome" autoFocus value={dados.nome} onChange={campo("nome")} maxLength={120} />
        </FormField>
        <FormField label="Razão social" htmlFor="c-razao" span={2}>
          <Input id="c-razao" value={dados.razao_social} onChange={campo("razao_social")} maxLength={160} />
        </FormField>
        <FormField label="CNPJ/CPF" htmlFor="c-doc">
          <Input id="c-doc" value={dados.documento} onChange={campo("documento")} maxLength={30} />
        </FormField>
        {cliente && (
          <FormField label="Cliente ativo">
            <YesNo label="Cliente ativo" value={dados.ativo} onChange={(ativo) => setDados((d) => ({ ...d, ativo }))} />
          </FormField>
        )}
      </FormSection>
      <FormSection title="Contato">
        <FormField label="Pessoa de contato" htmlFor="c-contato" span={2}>
          <Input id="c-contato" value={dados.contato} onChange={campo("contato")} maxLength={120} />
        </FormField>
        <FormField label="E-mail" htmlFor="c-email">
          <Input id="c-email" type="email" value={dados.email} onChange={campo("email")} maxLength={160} />
        </FormField>
        <FormField label="Telefone / WhatsApp" htmlFor="c-tel">
          <Input id="c-tel" value={dados.telefone} onChange={campo("telefone")} maxLength={30} placeholder="(11) 99999-0000" />
        </FormField>
        <FormField label="Observação" htmlFor="c-obs" span="full">
          <Textarea id="c-obs" value={dados.observacao} onChange={campo("observacao")} maxLength={1000} />
        </FormField>
      </FormSection>
    </FormPage>
  );
}
