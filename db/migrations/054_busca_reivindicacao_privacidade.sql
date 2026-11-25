-- Banket Busca: pedidos de REMOÇÃO de perfil viram pedidos de titular (LGPD, "Eliminação") na área Privacidade do
-- Manager Hwesta (decisão de 25/11/2026). A equipe continua decidindo e executando em /equipe/reivindicacoes; o Manager
-- acompanha o prazo de 15 dias e recebe o desfecho (server/busca/privacidade.ts). Compatível com a versão anterior:
-- só colunas novas, anuláveis.
-- Down (manual): ALTER TABLE busca_reivindicacoes DROP COLUMN privacidade_id, DROP COLUMN privacidade_fechado_em;

ALTER TABLE busca_reivindicacoes ADD COLUMN IF NOT EXISTS privacidade_id         UUID;        -- public_id do pedido no Manager
ALTER TABLE busca_reivindicacoes ADD COLUMN IF NOT EXISTS privacidade_fechado_em TIMESTAMPTZ; -- desfecho informado ao Manager

-- Reenvio: remoções ainda não enviadas ou já decididas e não informadas
CREATE INDEX IF NOT EXISTS idx_busca_reivindicacoes_privacidade ON busca_reivindicacoes (created_at)
  WHERE acao = 'remover' AND (privacidade_id IS NULL OR (status IN ('concluida', 'recusada') AND privacidade_fechado_em IS NULL));
