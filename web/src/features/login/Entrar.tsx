import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AppLogo } from "@/components/AppMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CHAVE_SESSAO, useSair } from "@/app/sessao";
import { api } from "@/lib/api";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

/** O cartão no meio da tela, sem barras (o login do Axyn One). */
function Cartao({ children, onSubmit, aviso }: { children: ReactNode; onSubmit: () => void; aviso?: ReactNode }) {
  return (
    <div className="grid h-full place-items-center overflow-auto bg-background p-6">
      <form
        noValidate
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <AppLogo label={APP_NAME} completo className="h-16" />
          <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        {aviso}
        {children}
      </form>
    </div>
  );
}

function Campo({ id, label, children, dica }: { id: string; label: string; children: ReactNode; dica?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

export function Entrar({ primeiroAcesso }: { primeiroAcesso: boolean }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    setErro("");
    if (primeiroAcesso) {
      if (!nome.trim()) return setErro("Escreva o seu nome.");
      if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
      if (senha !== repetir) return setErro("As senhas não são iguais.");
    }
    setOcupado(true);
    try {
      await api(primeiroAcesso ? "/sessao/primeiro-acesso" : "/sessao/entrar", { corpo: { nome, email, senha } });
      await qc.invalidateQueries({ queryKey: CHAVE_SESSAO });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Cartao
      onSubmit={enviar}
      aviso={
        primeiroAcesso && (
          <div className="rounded-lg border border-primary/25 bg-primary/[0.07] px-3 py-2.5 text-sm text-foreground">
            <p className="font-medium">Primeiro acesso</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Crie o administrador do sistema. Depois ele cadastra os outros usuários.</p>
          </div>
        )
      }
    >
      {primeiroAcesso && (
        <Campo id="nome" label="Nome">
          <Input id="nome" autoFocus autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
      )}
      <Campo id="email" label="E-mail">
        <Input id="email" type="email" autoFocus={!primeiroAcesso} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Campo>
      <Campo id="senha" label="Senha" dica={primeiroAcesso ? "Pelo menos 8 caracteres." : undefined}>
        <Input id="senha" type="password" autoComplete={primeiroAcesso ? "new-password" : "current-password"} value={senha} onChange={(e) => setSenha(e.target.value)} />
      </Campo>
      {primeiroAcesso && (
        <Campo id="repetir" label="Repita a senha">
          <Input id="repetir" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </Campo>
      )}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      <Button type="submit" disabled={ocupado}>
        {ocupado && <Spinner data-icon="inline-start" />}
        {primeiroAcesso ? "Criar administrador e entrar" : "Entrar"}
      </Button>
      {!primeiroAcesso && <p className="text-center text-xs text-muted-foreground">Esqueceu a senha? Peça ao administrador para criar uma nova.</p>}
    </Cartao>
  );
}

/** Depois que o administrador define uma senha nova, a pessoa troca por uma só dela. */
export function TrocarSenhaObrigatoria() {
  const qc = useQueryClient();
  const sair = useSair();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const enviar = async () => {
    setErro("");
    if (nova.length < 8) return setErro("A senha nova precisa ter pelo menos 8 caracteres.");
    if (nova !== repetir) return setErro("As senhas novas não são iguais.");
    setOcupado(true);
    try {
      await api("/sessao/senha", { metodo: "PUT", corpo: { senha_atual: atual, nova_senha: nova } });
      await qc.invalidateQueries({ queryKey: CHAVE_SESSAO });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Cartao
      onSubmit={enviar}
      aviso={<p className="text-center text-sm text-muted-foreground">Crie uma senha sua para continuar.</p>}
    >
      <Campo id="atual" label="Senha que você recebeu">
        <Input id="atual" type="password" autoFocus autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} />
      </Campo>
      <Campo id="nova" label="Senha nova" dica="Pelo menos 8 caracteres.">
        <Input id="nova" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
      </Campo>
      <Campo id="repetir" label="Repita a senha nova">
        <Input id="repetir" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      </Campo>
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      <Button type="submit" disabled={ocupado}>
        {ocupado && <Spinner data-icon="inline-start" />}
        Salvar senha
      </Button>
      <button type="button" onClick={() => void sair()} className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
        Sair
      </button>
    </Cartao>
  );
}
