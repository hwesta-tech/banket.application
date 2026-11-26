// POST /api/hwesta/v1/profile-claims/approve — "Ganho" no funil Conversão do Manager Hwesta (PROTOCOLO.md, seção 4.4).
// A equipe conferiu a posse no Manager: manda ao e-mail do card o link para criar o acesso gratuito (plano Busca) e
// assumir o perfil (aprovarAssumir). Idempotente: pedido já concluído responde "already"; já aprovado, reenvia o link.
// Body: { reference: 'banket-busca:reivindicacao:<id>', data: { claim_id }, name, email, actor_name, card_id }
import type { APIRoute } from 'astro';
import { requireManager } from '../../../../../lib/hwesta/auth';
import { systemQuery } from '../../../../../lib/db';
import { UserError } from '../../../../../lib/forms';
import { aprovarAssumir } from '../../../../../server/busca/reivindicacao';

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async ({ request }) => {
  const negado = requireManager(request);
  if (negado) return negado;
  let body: any;
  try { body = await request.json(); } catch { return json({ message: 'JSON inválido' }, 400); }
  const ref = String(body?.reference ?? '');
  const id = String(body?.data?.claim_id ?? ref.replace(/^banket-busca:reivindicacao:/, ''));
  if (!UUID.test(id)) return json({ message: 'Referência do pedido inválida.' }, 422);
  const email = String(body?.email ?? '').trim().toLowerCase();

  const { rows } = await systemQuery<{ acao: string; status: string; tenant_id: string | null; usuario_id: string | null }>(
    'SELECT acao, status, tenant_id, usuario_id FROM busca_reivindicacoes WHERE id = $1', [id]
  );
  const r = rows[0];
  if (!r) return json({ message: 'Pedido não encontrado no Banket.' }, 404);
  if (r.acao !== 'assumir') return json({ message: 'Este pedido é de remoção, não de assumir o perfil.' }, 422);
  if (r.status === 'concluida') return json({ data: { account_id: r.tenant_id, status: 'already', message: 'O acesso já foi criado.' } });
  if (r.status === 'recusada') return json({ message: 'O pedido foi recusado no Banket.' }, 409);

  try {
    const quem = typeof body?.actor_name === 'string' && body.actor_name.trim() ? body.actor_name.trim().slice(0, 120) : 'Equipe Hwesta';
    await aprovarAssumir(id, email, `Aprovado no Board de Conversão do Manager por ${quem}.`, null);
  } catch (err) {
    if (err instanceof UserError) return json({ message: err.message }, 409);
    throw err;
  }
  const { rows: conta } = await systemQuery<{ existe: boolean }>('SELECT EXISTS (SELECT 1 FROM usuarios WHERE lower(email) = $1) AS existe', [email]);
  return json({
    data: {
      account_id: r.tenant_id,
      status: conta[0]?.existe ? 'existing' : 'invited',
      message: conta[0]?.existe
        ? `Link enviado a ${email}: essa pessoa já tem acesso ao Banket e só confirma a senha para assumir o perfil (vale 72 h).`
        : `Link para criar a senha enviado a ${email} (vale 72 h). O perfil continua no plano Busca.`,
    },
  });
};
