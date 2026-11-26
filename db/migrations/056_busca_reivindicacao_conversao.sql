-- Banket Busca: pedidos de ASSUMIR o perfil viram cards no funil "Conversão" do Board do Manager Hwesta (decisão de
-- 26/11/2026). A equipe confere a posse no Manager; mover para Ganho chama POST /api/hwesta/v1/profile-claims/approve,
-- que manda o link de criação do acesso (aprovarAssumir). Perdido não muda nada aqui. Envio e reenvio em
-- server/busca/conversao.ts. Compatível com a versão anterior: só colunas novas, anuláveis.
-- Down (manual): ALTER TABLE busca_reivindicacoes DROP COLUMN crm_card_id, DROP COLUMN crm_card_url;

ALTER TABLE busca_reivindicacoes ADD COLUMN IF NOT EXISTS crm_card_id  INTEGER; -- id do card no Board do Manager
ALTER TABLE busca_reivindicacoes ADD COLUMN IF NOT EXISTS crm_card_url TEXT;    -- link do card (para a fila da equipe)

-- Reenvio: pedidos de assumir ainda não enviados
CREATE INDEX IF NOT EXISTS idx_busca_reivindicacoes_conversao ON busca_reivindicacoes (created_at)
  WHERE acao = 'assumir' AND crm_card_id IS NULL AND status = 'pendente';
