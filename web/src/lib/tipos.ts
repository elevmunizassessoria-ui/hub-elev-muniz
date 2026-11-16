/** O formato dos dados que o servidor devolve. */

export type Nivel = "ver" | "editar" | "excluir";
export type Modulo = "dashboard" | "operacoes" | "clientes" | "documentos" | "solicitacoes" | "aprovacao" | "sla" | "financeiro" | "credito" | "instituicoes" | "carteira" | "comissoes" | "compliance" | "cadastro_documentos" | "acessos" | "configuracoes";

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  admin: boolean;
  ativo: boolean;
  trocar_senha: boolean;
  perfil_acesso_id: number | null;
  perfil_acesso_nome: string;
  ultimo_acesso_em: string | null;
  criado_em: string;
  permissoes: Partial<Record<Modulo, Nivel>>;
}

export interface PerfilAcesso {
  id: number;
  nome: string;
  descricao: string;
  ativo: boolean;
  permissoes: Partial<Record<Modulo, Nivel>>;
  usuarios: number;
}

export interface ModuloInfo {
  chave: Modulo;
  nome: string;
  descricao: string;
}

export interface Resumo {
  total?: number;
  obrigatorios: number;
  obrigatorios_ok: number;
  aprovados?: number;
  aguardando: number;
  vencidos: number;
  vencendo: number;
  recusados: number;
  faltando?: number;
}

export interface Cliente {
  id: number;
  nome: string;
  pasta: string;
  razao_social: string;
  documento: string;
  contato: string;
  email: string;
  telefone: string;
  observacao: string;
  ativo: boolean;
  criado_por: string;
  criado_em: string;
  operacoes?: number;
  pedidos_abertos?: number;
  resumo?: Resumo;
}

export type SituacaoPedido = "aguardando" | "em_analise" | "concluida" | "cancelada" | "vencida";

export interface Operacao {
  id: number;
  cliente_id: number;
  nome: string;
  pasta: string;
  descricao: string;
  perfil_documento_id: number | null;
  perfil_documento_nome: string;
  situacao: "ativa" | "encerrada";
  criado_por: string;
  criado_em: string;
  resumo?: Resumo;
  pedido_aberto?: { id: number; situacao: SituacaoPedido; expira_em: string } | null;
  codigo: string;
  cliente_nome?: string;
  consultor_id: number | null;
  consultor_nome: string;
  etapa_id: number | null;
  etapas: EtapaOperacao[];
  etapa_nome: string;
  etapa_ordem: number;
  prazo_dias: number;
  dias_na_etapa: number;
  sla: SlaOperacao;
}

export type SlaOperacao = "no_prazo" | "perto" | "atrasada" | "encerrada" | "sem_prazo";

export interface EtapaOperacao {
  id: number;
  nome: string;
  prazo_dias: number;
  ordem: number;
  final: boolean;
}

export interface Consultor {
  id: number;
  nome: string;
  admin: boolean;
  operacoes_ativas: number;
}

export interface Transferencia {
  id: number;
  operacao_id: number;
  cliente_id: number;
  codigo: string;
  cliente_nome: string;
  operacao_nome: string;
  de_nome: string;
  para_nome: string;
  motivo: string;
  por: string;
  quando: string;
}

export interface LinhaSla {
  nome: string;
  total: number;
  dentro: number;
  fora: number;
  abertas: number;
  sla: number | null;
  tempo_medio: number | null;
  prazo_medio: number | null;
}

export interface Sla {
  dias: number;
  geral: { sla: number | null; total: number; dentro: number; fora: number };
  consultores: { consultor_id: number | null; nome: string; periodos: number; dentro: number; fora: number; atrasadas_agora: number; sla: number | null; tempo_medio: number | null }[];
  processos: LinhaSla[];
  etapas: LinhaSla[];
}

export interface DocumentoGeral {
  id: number;
  nome: string;
  grupo: string;
  obrigatorio: boolean;
  estado: EstadoItem;
  dias_para_vencer: number | null;
  validade: string | null;
  enviado_em: string | null;
  motivo_recusa: string;
  arquivo_id: number | null;
  operacao_id: number;
  operacao_codigo: string;
  operacao_nome: string;
  cliente_id: number;
  cliente_nome: string;
  consultor_nome: string;
}

export type TipoLancamento = "receita" | "despesa";

export interface Lancamento {
  id: number;
  tipo: TipoLancamento;
  codigo: string;
  descricao: string;
  categoria: string;
  valor_centavos: number;
  vencimento: string;
  pago_em: string | null;
  cliente_id: number | null;
  cliente_nome: string | null;
  operacao_id: number | null;
  operacao_nome: string | null;
  operacao_codigo: string;
  consultor_nome: string | null;
  observacao: string;
  situacao: "pago" | "aberto" | "atrasado";
}

export interface Arquivo {
  id: number;
  arquivo_nome: string;
  arquivo_tipo: string;
  arquivo_tamanho: number;
  caminho?: string;
  lado: string;
  situacao?: "pendente" | "aprovado" | "recusado";
}

export interface Envio {
  envio_id: string;
  criado_em: string;
  situacao: "pendente" | "aprovado" | "recusado";
  validade: string | null;
  origem: "interno" | "link";
  enviado_por: string;
  analisado_por: string | null;
  analisado_em: string | null;
  motivo_recusa: string;
  observacao: string;
  solicitacao_id: number | null;
  arquivos: Arquivo[];
}

export type EstadoItem = "falta" | "aguardando" | "aprovado" | "vencendo" | "vencido" | "recusado";

export interface ItemOperacao {
  id: number;
  tipo_id: number | null;
  nome: string;
  grupo: string;
  descricao: string;
  obrigatorio: boolean;
  frente_verso: boolean;
  exige_validade: boolean;
  estado: EstadoItem;
  dias_para_vencer: number | null;
  atual: Envio | null;
  pendente: Envio | null;
  recusado: Envio | null;
  versoes: Envio[];
}

export type EstadoNoPedido = "faltando" | "em_analise" | "aprovado" | "recusado";

export interface ItemPedido {
  id: number;
  nome: string;
  descricao: string;
  grupo: string;
  frente_verso: boolean;
  exige_validade: boolean;
  obrigatorio: boolean;
  estado: EstadoNoPedido;
  motivo_recusa: string;
}

export interface Solicitacao {
  id: number;
  operacao_id: number;
  operacao_nome: string;
  cliente_id: number;
  cliente_nome: string;
  cliente_email: string;
  cliente_telefone: string;
  cliente_contato: string;
  mensagem: string;
  situacao: SituacaoPedido;
  expira_em: string;
  ultimo_envio_em: string | null;
  criado_por: string;
  criado_em: string;
  concluida_em: string | null;
  cancelado_em: string | null;
  cancelado_por: string | null;
  itens: ItemPedido[];
  enviados: number;
  aprovados: number;
  link: string | null;
}

export interface Historico {
  id: number;
  quando: string;
  usuario: string;
  acao: string;
  cliente_id: number | null;
  operacao_id: number | null;
  detalhe: string;
  cliente_nome?: string | null;
  operacao_nome?: string | null;
}

export interface TipoDocumento {
  id: number;
  nome: string;
  grupo: string;
  descricao: string;
  frente_verso: boolean;
  exige_validade: boolean;
  ordem: number;
}

export interface PerfilDocumento {
  id: number;
  nome: string;
  descricao: string;
  ativo: boolean;
  operacoes: number;
  etapas: { id?: number; nome: string; prazo_dias: number; final: boolean }[];
  itens: { tipo_id: number; obrigatorio: boolean; nome: string; grupo: string; frente_verso: boolean; exige_validade: boolean }[];
}

export interface EnvioAprovacao {
  envio_id: string;
  operacao_id: number;
  operacao_nome: string;
  cliente_id: number;
  cliente_nome: string;
  item_id: number | null;
  item_nome: string;
  exige_validade: boolean;
  situacao: "pendente" | "aprovado" | "recusado";
  validade: string | null;
  criado_em: string;
  analisado_por: string | null;
  analisado_em: string | null;
  motivo_recusa: string;
  arquivos: Arquivo[];
}

export interface Configuracoes {
  empresa_nome: string;
  link_validade_dias: string;
  aviso_vencimento_dias: string;
  tamanho_maximo_mb: string;
  endereco_publico: string;
  formatos_aceitos: string;
}
