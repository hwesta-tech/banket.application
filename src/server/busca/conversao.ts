// Pedidos de ASSUMIR o perfil do Banket Busca no funil "Conversão" do Board do Manager Hwesta (decisão de 26/11/2026).
// O pedido vira card em "Novo Lead"; a equipe confere a posse no Manager ("Em contato") e, em "Ganho", o Manager chama
// POST /api/hwesta/v1/profile-claims/approve (src/pages/api/hwesta/v1/profile-claims/approve.ts), que manda o link de
// criação do acesso no plano Busca (aprovarAssumir). "Perdido" não muda nada aqui. Contrato: PROTOCOLO.md, seção 4.4.
//
// Best-effort, como privacidade.ts: o Manager fora do ar nunca impede o pedido. O que não foi enviado fica com
// crm_card_id nulo e é reenviado por sincronizarConversao(), chamada depois de cada pedido e ao abrir a fila da equipe.
// O Manager é idempotente por origin_reference.
import { systemQuery } from '../../lib/db';
import { managerFetch } from '../../lib/hwesta/client';
import { hwestaEnv } from '../../lib/hwesta/auth';
import { buscaUrl } from '../../lib/busca/url';

interface Pendente {
  id: string;
  buffet_nome: string;
  perfil_id: string | null;
  perfil_slug: string | null;
  nome: string;
  cargo: string | null;
  email: string;
  telefone: string | null;
  mensagem: string | null;
  perfil_email: string | null;
  perfil_whatsapp: string | null;
  perfil_telefone: string | null;
  perfil_instagram: string | null;
  perfil_site: string | null;
  perfil_endereco: string | null;
  cidade: string | null;
}

export const referenciaConversao = (id: string) => `banket-busca:reivindicacao:${id}`;

/** A decisão de assumir acontece no Manager (Board de Conversão) quando a integração está configurada. */
export function conversaoNoManager(): boolean {
  return Boolean(hwestaEnv('HWESTA_MANAGER_URL') && hwestaEnv('HWESTA_APP_KEY'));
}

/** Texto da conferência: o que a pessoa informou e os canais REAIS do perfil, por onde a equipe confirma a posse. */
export function detalhesConversao(r: Pendente): string {
  const canais = [
    r.perfil_email && `E-mail: ${r.perfil_email}`,
    r.perfil_whatsapp && `WhatsApp: ${r.perfil_whatsapp}`,
    r.perfil_telefone && `Telefone: ${r.perfil_telefone}`,
    r.perfil_instagram && `Instagram: ${r.perfil_instagram}`,
    r.perfil_site && `Site: ${r.perfil_site}`,
    r.perfil_endereco && `Endereço: ${r.perfil_endereco}${r.cidade ? ` (${r.cidade})` : ''}`,
  ].filter(Boolean);
  return [
    `Pedido para assumir o perfil do "${r.buffet_nome}" no Banket Busca.`,
    r.perfil_slug ? `Perfil: ${buscaUrl(`/buffet/${r.perfil_slug}`)}` : '',
    '',
    'Informado por quem pediu:',
    `Nome: ${r.nome}${r.cargo ? ` (${r.cargo})` : ''}`,
    `E-mail: ${r.email}`,
    r.telefone ? `Telefone: ${r.telefone}` : '',
    r.mensagem ? `Mensagem: ${r.mensagem}` : '',
    '',
    'Canais do perfil (confira a posse por eles):',
    ...(canais.length ? canais : ['nenhum canal cadastrado']),
    '',
    'Em Ganho, o Banket manda ao e-mail do card o link para criar o acesso gratuito (plano Busca) e assumir o perfil.',
  ].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n');
}

async function enviar(r: Pendente): Promise<void> {
  const res = await managerFetch<{ data?: { id?: number; url?: string } }>('/api/public/crm/leads', {
    method: 'POST',
    body: {
      title: `${r.buffet_nome} — assumir perfil`.slice(0, 255),
      contact_name: r.nome,
      contact_email: r.email,
      contact_phone: r.telefone,
      company_name: r.buffet_nome,
      details: detalhesConversao(r).slice(0, 8000),
      origin_url: buscaUrl(`/para-buffets/reivindicar${r.perfil_slug ? `/${r.perfil_slug}` : ''}`),
      origin_reference: referenciaConversao(r.id),
      origin_data: { claim_id: r.id, profile_id: r.perfil_id, profile_slug: r.perfil_slug },
    },
  });
  const card = res.data?.data;
  if (!res.ok || !card?.id) {
    console.error(`[conversao] pedido ${r.id} não enviado ao Manager (${res.status})`);
    return;
  }
  await systemQuery('UPDATE busca_reivindicacoes SET crm_card_id = $2, crm_card_url = $3 WHERE id = $1 AND crm_card_id IS NULL', [
    r.id, card.id, card.url ?? null,
  ]);
}

/** Envia ao Manager os pedidos de assumir ainda pendentes e não enviados. Com `id`, só aquele. Nunca lança. */
export async function sincronizarConversao(id?: string): Promise<void> {
  if (!conversaoNoManager()) return;
  try {
    const { rows } = await systemQuery<Pendente>(
      `SELECT r.id, r.buffet_nome, r.perfil_id, p.slug AS perfil_slug, r.nome, r.cargo, r.email, r.telefone, r.mensagem,
              p.email_contato AS perfil_email, p.whatsapp AS perfil_whatsapp, p.telefone AS perfil_telefone,
              p.instagram AS perfil_instagram, p.site AS perfil_site,
              nullif(concat_ws(', ', nullif(concat_ws(' ', p.logradouro, p.numero), ''), p.bairro), '') AS perfil_endereco,
              nullif(concat_ws('/', c.nome, c.uf), '') AS cidade
         FROM busca_reivindicacoes r
         LEFT JOIN busca_perfis p ON p.id = r.perfil_id
         LEFT JOIN busca_cidades c ON c.id = p.cidade_id
        WHERE r.acao = 'assumir' AND r.status = 'pendente' AND r.crm_card_id IS NULL
          AND ($1::uuid IS NULL OR r.id = $1::uuid)
        ORDER BY r.created_at
        LIMIT 20`,
      [id ?? null]
    );
    for (const r of rows) await enviar(r);
  } catch (err) {
    console.error('[conversao] sincronização com o Manager falhou:', (err as Error).message);
  }
}
