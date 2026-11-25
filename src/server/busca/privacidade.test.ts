// Remoções do Banket Busca na Privacidade do Manager: cria o pedido uma vez, informa o desfecho e reenvia o que falhou.
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Linha {
  id: string; acao: string; status: string; buffet_nome: string; perfil_slug: string | null; nome: string; cargo: string | null;
  email: string; telefone: string | null; mensagem: string | null; observacao: string | null; recebido_em: string;
  privacidade_id: string | null; privacidade_fechado_em: Date | null;
}
const linhas: Linha[] = [];
const chamadas: { path: string; method?: string; body?: any }[] = [];
let managerFora = false;

vi.mock('../../lib/db', () => ({
  systemQuery: async (sql: string, params: unknown[]) => {
    if (sql.startsWith('SELECT')) {
      const [id] = params as [string | null];
      const rows = linhas.filter((r) => r.acao === 'remover'
        && (r.privacidade_id === null || (['concluida', 'recusada'].includes(r.status) && r.privacidade_fechado_em === null))
        && (id === null || r.id === id));
      return { rows: rows.map((r) => ({ ...r })) };
    }
    const r = linhas.find((l) => l.id === params[0])!;
    if (sql.includes('SET privacidade_id')) { if (r.privacidade_id === null) r.privacidade_id = params[1] as string; }
    else if (sql.includes('SET privacidade_fechado_em')) r.privacidade_fechado_em = new Date();
    return { rows: [] };
  },
}));
vi.mock('../../lib/hwesta/client', () => ({
  managerFetch: async (path: string, init: { method?: string; body?: any } = {}) => {
    chamadas.push({ path, ...init });
    if (managerFora) return { ok: false, status: 502, data: null };
    return init.method === 'POST' ? { ok: true, status: 201, data: { data: { public_id: 'pub-1' } } } : { ok: true, status: 200, data: {} };
  },
}));
vi.mock('../../lib/busca/url', () => ({ buscaUrl: (p: string) => `https://busca.banket.com.br${p}` }));

const { sincronizarPrivacidade } = await import('./privacidade');

const pedido = (extra: Partial<Linha> = {}): Linha => ({
  id: 'r1', acao: 'remover', status: 'pendente', buffet_nome: 'Buffet Sol', perfil_slug: 'buffet-sol', nome: 'Ana Lima',
  cargo: 'Sócia', email: 'ana@sol.com', telefone: '11988887777', mensagem: null, observacao: null, recebido_em: '2026-11-25',
  privacidade_id: null, privacidade_fechado_em: null, ...extra,
});

describe('sincronizarPrivacidade', () => {
  beforeEach(() => { linhas.length = 0; chamadas.length = 0; managerFora = false; });

  it('abre o pedido de eliminação com a origem e guarda o id do Manager', async () => {
    linhas.push(pedido());
    await sincronizarPrivacidade('r1');
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toMatchObject({
      path: '/api/public/privacy/requests', method: 'POST',
      body: { kind: 'deletion', controller: 'hwesta', channel: 'site', subject_name: 'Ana Lima', subject_contact: 'ana@sol.com', received_at: '2026-11-25',
        origin_url: 'https://busca.banket.com.br/para-buffets/reivindicar/buffet-sol', origin_reference: 'banket-busca:reivindicacao:r1' },
    });
    expect(chamadas[0].body).not.toHaveProperty('tenant_id'); // perfil do Busca, não conta de cliente
    expect(chamadas[0].body.details).toContain('Não envolve conta de cliente do Banket');
    expect(chamadas[0].body.details).toContain('https://busca.banket.com.br/buffet/buffet-sol');
    expect(linhas[0].privacidade_id).toBe('pub-1');
    await sincronizarPrivacidade(); // pendente e já enviado: nada a fazer
    expect(chamadas).toHaveLength(1);
  });

  it('informa a remoção aprovada como Atendido, uma vez', async () => {
    linhas.push(pedido({ status: 'concluida', privacidade_id: 'pub-1', observacao: 'Conferido pelo WhatsApp' }));
    await sincronizarPrivacidade('r1');
    expect(chamadas[0]).toMatchObject({ path: '/api/public/privacy/requests/pub-1', method: 'PATCH', body: { status: 'done' } });
    expect(chamadas[0].body.resolution).toContain('Conferido pelo WhatsApp');
    await sincronizarPrivacidade();
    expect(chamadas).toHaveLength(1);
  });

  it('informa a recusa com o motivo', async () => {
    linhas.push(pedido({ status: 'recusada', privacidade_id: 'pub-1', observacao: 'E-mail não confere com o do perfil' }));
    await sincronizarPrivacidade('r1');
    expect(chamadas[0].body).toMatchObject({ status: 'rejected' });
    expect(chamadas[0].body.resolution).toContain('E-mail não confere');
  });

  it('com o Manager fora do ar não lança e reenvia depois (criação e desfecho na mesma rodada)', async () => {
    linhas.push(pedido());
    managerFora = true;
    await expect(sincronizarPrivacidade('r1')).resolves.toBeUndefined();
    expect(linhas[0].privacidade_id).toBeNull();
    linhas[0].status = 'concluida';
    managerFora = false;
    await sincronizarPrivacidade();
    expect(chamadas.slice(-2).map((c) => c.method)).toEqual(['POST', 'PATCH']);
    expect(linhas[0].privacidade_fechado_em).not.toBeNull();
  });

  it('ignora pedidos de assumir', async () => {
    linhas.push(pedido({ acao: 'assumir' }));
    await sincronizarPrivacidade();
    expect(chamadas).toHaveLength(0);
  });
});
