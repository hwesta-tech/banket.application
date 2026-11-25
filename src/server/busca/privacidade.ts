// Pedidos de REMOÇÃO de perfil do Banket Busca na área Privacidade do Manager Hwesta (LGPD, "Eliminação").
// Decisão de 25/11/2026: a equipe continua decidindo e executando em /equipe/reivindicacoes (aprovarRemocao/recusar);
// o Manager controla o prazo de 15 dias e recebe o desfecho. Contrato: PROTOCOLO.md do HCP, seção 4.3.
//
// Tudo aqui é best-effort: o Manager fora do ar nunca impede o pedido nem a decisão. O que não foi enviado fica marcado
// no banco (privacidade_id nulo, ou decidido sem privacidade_fechado_em) e é reenviado por sincronizarPrivacidade(),
// chamada depois de cada pedido/decisão e ao abrir a fila da equipe. O Manager é idempotente por origin_reference.
//
// Escopo: só o PERFIL PÚBLICO do buffet no Busca. Remoção só é aceita para perfil importado e sem nenhum usuário
// (registrarPedido); buffet com conta Banket despublica o próprio perfil em /busca. Por isso o controlador é a Hwesta
// e o pedido não vai ligado a nenhuma conta cliente: a "empresa" que aprovarRemocao apaga é só a casca criada pela
// importação (origem_cadastro = 'importacao', sem usuário), não uma conta de cliente.
import { systemQuery } from '../../lib/db';
import { managerFetch } from '../../lib/hwesta/client';
import { buscaUrl } from '../../lib/busca/url';

interface Pendente {
  id: string;
  status: 'pendente' | 'aprovada' | 'concluida' | 'recusada';
  buffet_nome: string;
  perfil_slug: string | null;
  nome: string;
  cargo: string | null;
  email: string;
  telefone: string | null;
  mensagem: string | null;
  observacao: string | null;
  recebido_em: string;
  privacidade_id: string | null;
}

const referencia = (id: string) => `banket-busca:reivindicacao:${id}`;

/** Texto do atendimento que vai ao Manager quando a equipe decide no Banket. */
function desfecho(r: Pendente): { status: 'done' | 'rejected'; resolution: string } | null {
  if (r.status === 'concluida') {
    return {
      status: 'done',
      resolution: [
        `Perfil "${r.buffet_nome}" removido do Banket Busca e dados de contato apagados; exclusão registrada para a importação não trazê-lo de volta. Titular avisado por e-mail.`,
        r.observacao ? `Nota da equipe: ${r.observacao}` : '',
      ].filter(Boolean).join('\n'),
    };
  }
  if (r.status === 'recusada') {
    return { status: 'rejected', resolution: `Posse não confirmada; titular avisado por e-mail. Motivo: ${r.observacao ?? '—'}` };
  }
  return null;
}

async function criarNoManager(r: Pendente): Promise<string | null> {
  const detalhes = [
    `Remoção do perfil público do buffet "${r.buffet_nome}" no Banket Busca (pedido na página de reivindicação).`,
    'Escopo: só o perfil do Busca, importado e sem usuário (busca_perfis). Não envolve conta de cliente do Banket: buffet com conta despublica o próprio perfil pela área /busca.',
    r.perfil_slug ? `Perfil: ${buscaUrl(`/buffet/${r.perfil_slug}`)}` : '',
    r.cargo ? `Cargo informado: ${r.cargo}` : '',
    r.telefone ? `Telefone informado: ${r.telefone}` : '',
    r.mensagem ? `Mensagem: ${r.mensagem}` : '',
    'A equipe confere a posse pelos canais do perfil e decide em /equipe/reivindicacoes do Banket; o desfecho volta para cá automaticamente.',
  ].filter(Boolean).join('\n');
  const res = await managerFetch<{ data?: { public_id?: string } }>('/api/public/privacy/requests', {
    method: 'POST',
    body: {
      subject_name: r.nome,
      subject_contact: r.email,
      kind: 'deletion',
      controller: 'hwesta',
      channel: 'site',
      received_at: r.recebido_em,
      details: detalhes.slice(0, 4000),
      origin_url: buscaUrl(`/para-buffets/reivindicar${r.perfil_slug ? `/${r.perfil_slug}` : ''}`),
      origin_reference: referencia(r.id),
    },
  });
  const publicId = res.data?.data?.public_id;
  if (!res.ok || !publicId) {
    console.error(`[privacidade] pedido ${r.id} não enviado ao Manager (${res.status})`);
    return null;
  }
  await systemQuery('UPDATE busca_reivindicacoes SET privacidade_id = $2 WHERE id = $1 AND privacidade_id IS NULL', [r.id, publicId]);
  return publicId;
}

async function fecharNoManager(r: Pendente, publicId: string): Promise<void> {
  const d = desfecho(r);
  if (!d) return;
  const res = await managerFetch(`/api/public/privacy/requests/${encodeURIComponent(publicId)}`, {
    method: 'PATCH',
    body: { ...d, actor_name: 'Equipe Banket' },
  });
  if (!res.ok) {
    console.error(`[privacidade] desfecho do pedido ${r.id} não enviado ao Manager (${res.status})`);
    return;
  }
  await systemQuery('UPDATE busca_reivindicacoes SET privacidade_fechado_em = now() WHERE id = $1', [r.id]);
}

/**
 * Envia ao Manager as remoções ainda não enviadas e os desfechos ainda não informados. Com `id`, só aquele pedido.
 * Nunca lança: falha fica para a próxima rodada.
 */
export async function sincronizarPrivacidade(id?: string): Promise<void> {
  try {
    const { rows } = await systemQuery<Pendente>(
      `SELECT r.id, r.status, r.buffet_nome, p.slug AS perfil_slug, r.nome, r.cargo, r.email, r.telefone, r.mensagem,
              r.observacao, to_char(r.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS recebido_em, r.privacidade_id
         FROM busca_reivindicacoes r LEFT JOIN busca_perfis p ON p.id = r.perfil_id
        WHERE r.acao = 'remover'
          AND (r.privacidade_id IS NULL OR (r.status IN ('concluida', 'recusada') AND r.privacidade_fechado_em IS NULL))
          AND ($1::uuid IS NULL OR r.id = $1::uuid)
        ORDER BY r.created_at
        LIMIT 20`,
      [id ?? null]
    );
    for (const r of rows) {
      const publicId = r.privacidade_id ?? (await criarNoManager(r));
      if (publicId) await fecharNoManager(r, publicId);
    }
  } catch (err) {
    console.error('[privacidade] sincronização com o Manager falhou:', (err as Error).message);
  }
}
