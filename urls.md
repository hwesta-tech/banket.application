# Banket Busca — URLs de categoria e local: o que foi feito e como continuar

Passagem de trabalho. Cobre **só** o escopo das URLs de categoria e local do Banket Busca (`busca.banket.com.br`).
Em 10/11/2026 o código está publicado no commit `75cbeee`. Há um ajuste visual pronto e ainda não publicado (seção 7).

---

## 1. Escopo pedido (especificação original, resumida)

- **Nova estrutura** (as URLs de perfil `/buffet/...` não mudam):
  - `/{categoria}/` — hub nacional
  - `/{categoria}/{cidade-uf}/` — categoria × cidade
  - `/{categoria}/{cidade-uf}/{bairro}/` — categoria × bairro
  - `/buffets-em/{cidade-uf}/` e `/buffets-em/{cidade-uf}/{bairro}/` — páginas só de local
  - Slugs em minúsculas, sem acento e com hífen, sempre com barra no fim; a cidade sempre leva a UF.
- **Categorias** (9; ficam numa tabela de configuração). Não há página para categorias sem inventário (confraternização, batizado…).

  | Slug | Substitui |
  |---|---|
  | `buffet-para-casamento` | `tipo=casamento` + `servico=buffet_casamento` |
  | `buffet-infantil` | `tipo=infantil` + `servico=buffet_infantil` + `servico=kids` |
  | `buffet-para-aniversario` | `tipo=aniversario` |
  | `buffet-para-festa-de-15-anos` | `tipo=debutante` |
  | `buffet-para-formatura` | `tipo=formatura` |
  | `buffet-para-eventos-corporativos` | `tipo=corporativo` |
  | `coffee-break` | `tipo=coffee_break` + `servico=coffee_break` |
  | `buffet-de-churrasco` | `tipo=churrasco` + `servico=churrasco` |
  | `buffet-a-domicilio` | `servico=buffet_domicilio` |

- **301** de `/buscar?tipo=…` (e equivalentes) para a nova URL.
- **Indexação condicional:**
  - cidade com 5+ buffets de perfil completo; bairro com 8+;
  - abaixo do piso: `noindex,follow` e fora do sitemap;
  - perfil completo = descrição própria + foto real + ao menos 1 serviço e 1 tipo de evento.
- **Canonical** autorreferenciada e sem parâmetros. Filtros, ordenação e `/buscar` ficam `noindex`, com canonical para a página-base.
- **Sitemaps:** `sitemap-categorias.xml` e `sitemap-cidades.xml`, só com as páginas indexáveis.
- **Template:**
  - H1 `{Categoria} em {Cidade}`; title `{Categoria} em {Cidade}: {N} buffets com orçamento grátis | Banket Busca`;
  - description e intro (80–150 palavras) únicas;
  - breadcrumb visível + `BreadcrumbList`;
  - nas páginas de local: H1 `Buffets em {Cidade}`, title `Buffets em {Cidade}: {N} opções com orçamento grátis | Banket Busca`.
- **Links internos:**
  - home: trocar os links `/buscar?tipo=` e criar o bloco "Cidades mais buscadas";
  - perfil: "Voltar aos resultados" e os tipos e serviços apontam para `/{categoria}/{cidade-uf}/`;
  - rodapé: os principais pares categoria × cidade;
  - o campo "Cidade" leva à página do local quando ela existe e é indexável.
- **Paginação** com link HTML real e canonical própria; `?pagina=1` vai por 301 para a URL base. O HTML é renderizado no servidor.

---

## 2. Decisões de implementação (tomadas nesta thread)

- **Perfil completo:**
  - "Descrição própria" = pelo menos 80 caracteres e não segue o padrão da frase gerada na importação ("X fica no bairro Y, em Cidade (UF). …"). Ver `descricaoPropria` em `src/lib/busca/categorias.ts`.
  - "Foto real" = foto não bloqueada que não é `/thumb-buffet.webp` nem `/busca-demo/*`.
  - Nenhuma migration foi necessária.
- **Quem entra em cada página:**
  - Cidade: os buffets com sede nela (`busca_perfis.cidade_id`) ou que a atendem (`busca_perfil_cidades`). Antes, a lista misturava cidades num raio de 200 km.
  - Bairro: só os buffets com sede no bairro (`slugTexto(busca_perfis.bairro)`). O nome exibido é a grafia mais usada.
  - Categoria: o perfil entra por um tipo de evento OU um serviço da categoria. Em `buffet-a-domicilio`, também entra quem tem `atende_domicilio = true`.
- **Pisos:** `PISO_CIDADE = 5` (vale também para o hub nacional) e `PISO_BAIRRO = 8`.
- **Página sem nenhum buffet** dá **404**, assim como categoria, cidade ou bairro desconhecidos.
- **Paginação:** 24 por página (`POR_PAGINA_LOCAL`). Página além da última vai por 301 para a base.
- **Redirecionamentos de `/buscar`:**
  - Só tipo/serviço (+ cidade), sem outro filtro → **301** para a categoria, se a página existir.
  - Só a cidade → **302** para `/buffets-em/{cidade}/`, quando ela é indexável. É 302 porque a indexabilidade muda com o tempo.
  - Campos vazios do formulário (`data=`, `convidados=`) não contam como filtro.
  - Com outros filtros, fica em `/buscar`: `noindex`, com canonical para a página-base.
- **Landing antiga** `/buffet/{tipo}/{cidade}`: 301 para a categoria × cidade. Tipos sem categoria vão para `/buffets-em/{cidade}/`.
- **Inventário em memória:** os perfis publicados ficam em cache por 10 minutos, por processo. Ele decide quais páginas existem, quais são indexáveis, o sitemap e os links. Uma página entra sozinha no sitemap ao atingir o piso.
- **Nas páginas de categoria e local:**
  - a lista reaproveita os cards, os filtros e o ranking da busca, e os filtros levam a `/buscar`;
  - os cards levam ao perfil **sem** `?tipo=&cidade=`;
  - o "Como ordenamos os resultados" não aparece;
  - a intro ocupa a largura toda (ajuste da seção 7, ainda não publicado).
- **Sitemaps:** foi criado também o `/sitemap.xml` (índice que aponta para os dois). Não existia sitemap de perfis, e ele não foi criado.
- **Home:** os tipos e serviços sem categoria, ou com categoria sem buffets, continuam linkando para `/buscar?tipo=`/`?servico=`, como a especificação permite.
- **Removidos por ficarem sem uso:** `textoLanding` e `jsonLdPerguntas` (seo.ts), `combinacoesLanding` e `slugCurtoDaCidade` (publico.ts).

---

## 3. Arquivos

### Novos
| Arquivo | Papel |
|---|---|
| `src/lib/busca/categorias.ts` | Puro: `CATEGORIAS`, `PREFIXO_LOCAL`, pisos, `encaixa`, `categoriaDaBusca`/`categoriaDoTipo`/`categoriaDoServico`, `slugBairro`, `descricaoPropria`, `caminhoCategoria`/`caminhoLocal`/`comPagina`, `tituloH1`/`tituloPagina`/`descricaoPagina`/`introPagina`, `migalhas` |
| `src/lib/busca/categorias.test.ts` | Testes do módulo acima |
| `src/server/busca/locais.ts` | Inventário (cache), `paginaLocal`, `resolverPagina` (barra final, minúsculas, `?pagina`, 404), `paginasIndexaveis` (sitemaps), `localIndexavel`, `existePagina`, `cidadesEmAlta`, `paresEmAlta`, `totaisPorCategoria` |
| `src/server/busca/sitemap.ts` | Respostas XML dos sitemaps (cache público de 1 h) |
| `src/components/busca/PaginaLocal.astro` | Template das páginas: breadcrumb, barra de busca, `Resultados` com intro e paginação, links para bairros/cidades e outras categorias, JSON-LD |
| `src/pages/vitrine/[categoria]/index.astro`, `[categoria]/[cidade]/index.astro`, `[categoria]/[cidade]/[bairro]/index.astro` | Rotas de categoria (finas: `resolverPagina` → 404/301/`PaginaLocal`) |
| `src/pages/vitrine/buffets-em/[cidade]/index.astro`, `buffets-em/[cidade]/[bairro]/index.astro` | Rotas de local |
| `src/pages/vitrine/sitemap.xml.ts`, `sitemap-categorias.xml.ts`, `sitemap-cidades.xml.ts` | Sitemaps |

### Alterados
| Arquivo | Mudança |
|---|---|
| `src/server/busca/publico.ts` | `SQL_CANDIDATOS` aceita a lista de ids (`$7`); `buffetsPorIds` (ranking da busca para uma lista); `facetasDe` extraída; `cidade_slug` no `PerfilPublico` |
| `src/components/busca/Resultados.astro` | Props `intro`, `paginacao` (links reais anterior/próxima), `paginaDe` (links de limpar/remover filtro vão direto à página equivalente), `cardsSemCriterios`; sem "Como ordenamos" quando há `paginacao` |
| `src/pages/vitrine/buscar.astro` | 301/302 para as páginas equivalentes; canonical para a página-base; `paginaDe` |
| `src/pages/vitrine/buffet/[tipo]/[cidade].astro` | Virou só redirecionamento 301 |
| `src/pages/vitrine/index.astro` | Links de tipo/serviço → categorias; bloco "Cidades mais buscadas" |
| `src/pages/vitrine/buffet/[slug].astro` | "Voltar aos resultados" (categoria × cidade ou local do buffet; a última busca da sessão continua valendo), tipos de evento e serviços com link para a categoria na cidade do buffet |
| `src/pages/api/vitrine/sugestoes.ts` + `src/components/busca/BuscaUnica.astro` | As sugestões de tipo e cidade trazem a `url` da página (categoria / local indexável) |
| `src/layouts/VitrineLayout.astro` | Prop `tituloCompleto`; rodapé com categorias, "Mais buscados" (pares) e "Cidades" |
| `src/lib/busca/host.ts` (+ teste) | `VITRINE` inclui as categorias, `/buffets-em` e os sitemaps (servidos no host do Busca) |
| `src/lib/busca/seo.ts` (+ teste) | `jsonLdMigalhas` (BreadcrumbList) |
| `src/styles/busca.css` | `.vr-intro`, `.vr-paginas`, `.vl-migalhas`, `.vl-links`, links das tags do perfil; rodapé com 6 colunas |
| `tests/e2e/busca-vitrine.spec.ts` | Teste novo das páginas de categoria/local (substitui o da landing antiga) |
| `CLAUDE.md` / `AGENTS.md` | Seção "Páginas de categoria e local" em "Banket Busca: vitrine pública" |

---

## 4. Situação em produção (10/11/2026)

- Publicado no commit `75cbeee` (deploy blue-green, cor green). Conferido em produção:
  - `/buffet-para-casamento/sao-paulo-sp/` → 200; title "Buffet para casamento em São Paulo: 734 buffets com orçamento grátis | Banket Busca"; canonical correta.
  - `/buscar?tipo=casamento` → 301 para `/buffet-para-casamento/`.
  - `/buffet/casamento/campinas` → 301 para `/buffet-para-casamento/campinas-sp/`.
  - `/sitemap.xml` → índice com os 2 sitemaps.
- **Hoje nenhuma página atinge o piso.** Só 1 dos 3.442 perfis publicados tem foto real, e os importados têm a descrição gerada. Por isso todas as páginas estão em `noindex,follow` e os sitemaps saem vazios. Isso é o esperado: as páginas entram sozinhas quando os perfis forem completados.
- Sitemap para o Search Console: `https://busca.banket.com.br/sitemap.xml`.
- **Atenção:** o commit `75cbeee` levou também arquivos de outra sessão (`FormularioEditor.tsx`, `OpcoesDrawer.tsx`, `formularios.css`, `scripts/_shot-tmp.mjs`). O editor de formulários é de outra thread e está **fora deste escopo**.

---

## 5. Checklist de aceite

- [x] Nenhum link interno para `?tipo=` / `?servico=` mapeados (restam só os de tipos sem categoria).
- [x] 301 funcionando para as novas URLs.
- [x] URLs `/buffet/...` inalteradas.
- [x] `/buffets-em/{cidade-uf}/` e `/buffets-em/{cidade-uf}/{bairro}/` funcionando, com o mesmo piso, canonical e template.
- [x] O campo "Cidade" leva à URL do local quando ela existe (e é indexável).
- [x] Páginas abaixo do piso em `noindex` e fora do sitemap.
- [x] Canonical, title, H1 e description corretos por página.

---

## 6. Como testar localmente (na VPS)

O dev roda no host, contra o Postgres do contêiner. Para a vitrine responder em `/vitrine/...`, **é preciso zerar o `BUSCA_URL`**: com ele definido, o middleware manda tudo para o domínio do Busca, e o Vite recusa o host.

```bash
cd /var/www/banket
IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' banket-postgres-1 | awk '{print $1}')
# Exporte DATABASE_URL / DATABASE_URL_SYSTEM com esse IP (usuários e senhas do .env), JWT_SECRET, PORT=4400,
# APP_URL=http://localhost:4400, UPLOAD_DIR=/var/lib/docker/volumes/banket_uploads_data/_data, BANKET_SEM_AGENDADOR=1
export BUSCA_URL=
npx astro dev --port 4400 --host 127.0.0.1      # vira daemon: npx astro dev stop / logs
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://127.0.0.1:4400/vitrine/buffet-para-casamento/sao-paulo-sp/
```

- Exemplos que já foram testados:
  - `/vitrine/buffets-em/sao-paulo-sp/vila-olimpia/` → 200
  - `/vitrine/buffet-para-confraternizacao/` → 404
  - `/vitrine/buscar?tipo=casamento&cidade=sao-paulo-sp&convidados=100` → 200 (fica na busca)
  - `/vitrine/buscar?servico=kids` → 301 para `/buffet-infantil/`
- Unitários: `npx vitest run src/lib/busca`. Tipos: `npx astro check`.
- O e2e `tests/e2e/busca-vitrine.spec.ts` depende dos seeds (buffets de demonstração em Campinas e Santo André). O banco da VPS não tem esses dados, então ele não foi executado aqui.

---

## 7. Pendente

**Ajuste pronto e não publicado:** a intro na largura toda e a remoção do "Como ordenamos os resultados" nas páginas de categoria e local. Arquivos: `src/components/busca/Resultados.astro` e `src/styles/busca.css`. Para publicar:

```bash
cd /var/www/banket
git add src/components/busca/Resultados.astro src/styles/busca.css
git commit -m 'fix(busca): introdução em largura total e sem "Como ordenamos" nas páginas de categoria e local'
git push
git worktree add --detach /tmp/banket-deploy HEAD \
  && cp .env .deploy-ativo /tmp/banket-deploy/ \
  && (cd /tmp/banket-deploy && bash scripts/deploy-remoto.sh) \
  && cp /tmp/banket-deploy/.deploy-ativo . \
  && git worktree remove --force /tmp/banket-deploy
curl -s https://busca.banket.com.br/buffet-para-casamento/sao-paulo-sp/ | grep -c "Como ordenamos"   # deve dar 0
```

**Ideias levantadas e não feitas:**
- Um relatório de quantos perfis completos faltam para cada cidade ou bairro atingir o piso.
- Um sitemap de perfis (a especificação dizia "não muda", mas ele não existe).

---

## 8. Regras de trabalho deste projeto (para o próximo agente)

- **Commits sem `Co-Authored-By` e sem menção ao Claude Code.** Ao fim de cada entrega, trazer o texto do commit e o bloco de comandos para publicar. O usuário roda os comandos.
- **Commitar só os arquivos da entrega.** Outras sessões editam a mesma pasta ao mesmo tempo (hoje, o editor de formulários).
- **O deploy empacota a pasta de trabalho, não o git.** Por isso, deployar sempre de uma worktree limpa, como no bloco acima.
- **Produção é pré-lançamento**, com dados fictícios: pode testar contra o banco da VPS.
- **Documentação:** `CLAUDE.md` é a fonte e `AGENTS.md` é uma cópia idêntica; ao mudar um, copie para o outro. A reorganização do CLAUDE.md, que está muito longo, ficou para depois por decisão do usuário. Não fazer agora.
- **Neutralidade no Busca:** nunca citar um buffet real em placeholder ou exemplo da vitrine.
