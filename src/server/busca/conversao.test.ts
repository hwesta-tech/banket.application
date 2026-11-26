// Pedidos de assumir no funil Conversão do Manager: cria o card uma vez, com os canais do perfil, e reenvia o que falhou.
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Linha {
  id: string; acao: string; status: string; buffet_nome: string; perfil_id: string | null; perfil_slug: string | null;
  nome: string; cargo: string | null; email: string; telefone: string | null; mensagem: string | null;
  perfil_email: string | null; perfil_whatsapp: string | null; perfil_telefone: string | null; perfil_instagram: string | null;
  perfil_site: string | null; perfil_endereco: string | null; cidade: string | null; crm_card_id: number | null; crm_card_url: string | null;
}
const linhas: Linha[] = [];
const chamadas: { path: string; method?: string; body?: any }[] = [];
let managerFora = false;
let configurado = true;

vi.mock('../../lib/db', () => ({
  systemQuery: async (sql: string, params: unknown[]) => {
    if (sql.trimStart().startsWith('SELECT')) {
      const [id] = params as [string | null];
      const rows = linhas.filter((r) => r.acao === 'assumir' && r.status === 'pendente' && r.crm_card_id === null && (id === null || r.id === id));
      return { rows: rows.map((r) => ({ ...r })) };
    }
    const r = linhas.find((l) => l.id === params[0])!;
    if (r.crm_card_id === null) { r.crm_card_id = params[1] as number; r.crm_card_url = params[2] as string; }
    return { rows: [] };
  },
}));
vi.mock('../../lib/hwesta/client', () => ({
  managerFetch: async (path: string, init: { method?: string; body?: any } = {}) => {
    chamadas.push({ path, ...init });
    if (managerFora) return { ok: false, status: 502, data: null };
    return { ok: true, status: 201, data: { data: { id: 42, url: 'https://manager.hwesta.tech/crm/board?funil=conversion&card=42' } } };
  },
}));
vi.mock('../../lib/hwesta/auth', () => ({ hwestaEnv: (n: string) => (configurado ? `valor-${n}` : undefined) }));
vi.mock('../../lib/busca/url', () => ({ buscaUrl: (p: string) => `https://busca.banket.com.br${p}` }));

const { sincronizarConversao } = await import('./conversao');

const pedido = (extra: Partial<Linha> = {}): Linha => ({
  id: 'r1', acao: 'assumir', status: 'pendente', buffet_nome: 'Buffet Sol', perfil_id: 'p1', perfil_slug: 'buffet-sol',
  nome: 'Ana Lima', cargo: 'Sócia', email: 'ana@sol.com', telefone: '11988887777', mensagem: 'Sou a dona',
  perfil_email: 'contato@sol.com', perfil_whatsapp: '11977776666', perfil_telefone: null, perfil_instagram: '@buffetsol',
  perfil_site: null, perfil_endereco: 'Rua A 10, Centro', cidade: 'Campinas/SP', crm_card_id: null, crm_card_url: null, ...extra,
});

describe('sincronizarConversao', () => {
  beforeEach(() => { linhas.length = 0; chamadas.length = 0; managerFora = false; configurado = true; });

  it('cria o lead com a origem, os canais do perfil e guarda o card', async () => {
    linhas.push(pedido());
    await sincronizarConversao('r1');
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toMatchObject({
      path: '/api/public/crm/leads', method: 'POST',
      body: {
        contact_name: 'Ana Lima', contact_email: 'ana@sol.com', company_name: 'Buffet Sol',
        origin_url: 'https://busca.banket.com.br/para-buffets/reivindicar/buffet-sol', origin_reference: 'banket-busca:reivindicacao:r1',
        origin_data: { claim_id: 'r1', profile_id: 'p1', profile_slug: 'buffet-sol' },
      },
    });
    const det = chamadas[0].body.details as string;
    expect(det).toContain('Canais do perfil');
    expect(det).toContain('E-mail: contato@sol.com');
    expect(det).toContain('WhatsApp: 11977776666');
    expect(det).toContain('Mensagem: Sou a dona');
    expect(det).not.toMatch(/\n\n\n/);
    expect(linhas[0].crm_card_id).toBe(42);
    await sincronizarConversao(); // já enviado: nada a fazer
    expect(chamadas).toHaveLength(1);
  });

  it('com o Manager fora do ar não lança e reenvia na próxima rodada', async () => {
    linhas.push(pedido());
    managerFora = true;
    await expect(sincronizarConversao('r1')).resolves.toBeUndefined();
    expect(linhas[0].crm_card_id).toBeNull();
    managerFora = false;
    await sincronizarConversao();
    expect(linhas[0].crm_card_id).toBe(42);
  });

  it('ignora remoções e não chama o Manager sem a integração configurada', async () => {
    linhas.push(pedido({ id: 'r2', acao: 'remover' }));
    await sincronizarConversao();
    expect(chamadas).toHaveLength(0);
    linhas.push(pedido());
    configurado = false;
    await sincronizarConversao();
    expect(chamadas).toHaveLength(0);
  });
});
