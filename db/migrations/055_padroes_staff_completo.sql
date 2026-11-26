-- Staff › Serviços pré-cadastrado com as 9 funções mais comuns de um buffet (backlog de 26/11/2026), para a conta nova
-- já ter uma referência de como as regras de dimensionamento funcionam. Cachê zerado: são exemplos para ajustar.
-- As seções do cardápio continuam as 8 da migration 052. Vale para contas novas (cadastro e reivindicação do Busca,
-- via aplicar_padroes_tenant_completo); não há backfill: empresas existentes mantêm o que já cadastraram.

CREATE OR REPLACE FUNCTION aplicar_padroes_cardapio_staff(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM catalogo_secoes WHERE tenant_id = p_tenant) THEN
    INSERT INTO catalogo_secoes (tenant_id, nome, descricao, ordem)
    VALUES
      (p_tenant, 'Entradas', 'Pratos leves servidos antes do prato principal', 1),
      (p_tenant, 'Prato Principal', 'Pratos principais do cardápio', 2),
      (p_tenant, 'Acompanhamentos', 'Guarnições que acompanham os pratos principais', 3),
      (p_tenant, 'Saladas', 'Saladas e folhas', 4),
      (p_tenant, 'Sobremesas', 'Doces e sobremesas', 5),
      (p_tenant, 'Bebidas não alcoólicas', 'Sucos, refrigerantes, águas e afins', 6),
      (p_tenant, 'Bebidas alcoólicas', 'Cervejas, vinhos, destilados e drinks', 7),
      (p_tenant, 'Coffee Break', 'Itens para coffee break e pausas', 8);
  END IF;

  -- Regras de exemplo: proporcionais ao número de convidados (com mínimo) ou fixas por evento. As que entram em todo
  -- orçamento ficam com incluir_por_padrao; as que dependem do evento (bar, vinhos, churrasco) ficam desmarcadas.
  IF NOT EXISTS (SELECT 1 FROM staff_servicos WHERE tenant_id = p_tenant) THEN
    INSERT INTO staff_servicos
      (tenant_id, funcao, descricao, cache_diaria, auxilio, por_evento, quantidade_fixa, convidados_por_profissional,
       minimo, incluir_por_padrao, ordem)
    VALUES
      (p_tenant, 'Garçom', 'Serviço às mesas e circulação de bandejas. Exemplo: ajuste o cachê e a proporção.',
       0, 0, false, 1, 15, 2, true, 1),
      (p_tenant, 'Chefe de salão', 'Coordena a equipe de salão durante o evento. Exemplo: ajuste o cachê.',
       0, 0, true, 1, NULL, 0, true, 2),
      (p_tenant, 'Recepcionista', 'Recebe e orienta os convidados na entrada. Exemplo: ajuste o cachê e a proporção.',
       0, 0, false, 1, 100, 1, true, 3),
      (p_tenant, 'Barman', 'Preparo e serviço de bebidas no bar. Exemplo: ajuste o cachê e a proporção.',
       0, 0, false, 1, 80, 1, false, 4),
      (p_tenant, 'Sommelier', 'Seleção e serviço de vinhos. Exemplo: ajuste o cachê.',
       0, 0, true, 1, NULL, 0, false, 5),
      (p_tenant, 'Chef de cozinha', 'Responsável pela cozinha e pela qualidade dos pratos. Exemplo: ajuste o cachê.',
       0, 0, true, 1, NULL, 0, true, 6),
      (p_tenant, 'Auxiliar de cozinha', 'Apoio na produção e na finalização dos pratos. Exemplo: ajuste o cachê e a proporção.',
       0, 0, false, 1, 30, 1, true, 7),
      (p_tenant, 'Churrasqueiro', 'Preparo e serviço do churrasco. Exemplo: ajuste o cachê e a proporção.',
       0, 0, false, 1, 50, 1, false, 8),
      (p_tenant, 'Auxiliar de limpeza', 'Limpeza do salão e dos banheiros durante o evento. Exemplo: ajuste o cachê e a proporção.',
       0, 0, false, 1, 100, 1, true, 9);
  END IF;
END $$;
