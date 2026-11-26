// Edição das opções de uma pergunta padrão (ex.: faixas de budget), aberta logo abaixo da pergunta no editor: o grupo
// "Opções" com o X de cada uma, o campo para incluir novas (a nova vai para o fim) e Cancelar / Aplicar opções.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../ui/Icon';
import { confirmar, toast } from '../../lib/ui';

interface Props {
  /** id da pergunta: prefixo dos ids dos campos */
  id: string;
  opcoes: string[];
  ajuda?: string;
  onAplicar: (opcoes: string[]) => void;
  onFechar: () => void;
}

const MAX_OPCAO = 120;

export default function OpcoesEditor({ id, opcoes: iniciais, ajuda, onAplicar, onFechar }: Props) {
  const [opcoes, setOpcoes] = useState<string[]>(iniciais);
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState('');
  const novaRef = useRef<HTMLInputElement>(null);

  const alterado = nova.trim() !== '' || opcoes.join('\n') !== iniciais.join('\n');

  async function fechar() {
    if (alterado) {
      const sim = await confirmar({
        titulo: 'Descartar as alterações?',
        texto: 'As opções alteradas ainda não foram aplicadas.',
        confirmar: 'Descartar',
        cancelar: 'Continuar editando',
        perigo: true,
      });
      if (!sim) return;
    }
    onFechar();
  }

  useEffect(() => {
    novaRef.current?.focus({ preventScroll: true });
  }, []);

  function adicionar() {
    const texto = nova.trim();
    if (!texto) return setErro('Digite a opção.');
    if (texto.length > MAX_OPCAO) return setErro(`Cada opção pode ter no máximo ${MAX_OPCAO} caracteres.`);
    if (opcoes.some((o) => o.toLowerCase() === texto.toLowerCase())) return setErro('Esta opção já está na lista.');
    setOpcoes([...opcoes, texto]);
    setNova('');
    setErro('');
    novaRef.current?.focus();
  }

  function remover(idx: number) {
    setOpcoes(opcoes.filter((_, i) => i !== idx));
    novaRef.current?.focus();
  }

  function aplicar() {
    if (nova.trim()) return setErro('Clique em Adicionar para incluir a opção digitada, ou apague o campo.');
    if (opcoes.length < 2) return toast('Informe ao menos 2 opções.', 'error');
    onAplicar(opcoes);
  }

  const idNova = `fe-opcao-nova-${id}`;
  const idLista = `fe-opcoes-lista-${id}`;

  return (
    <div
      class="fe-rascunho fe-opcoes-editor"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
          e.preventDefault();
          fechar();
        }
      }}
    >
      {ajuda && <p class="fe-opcoes-ajuda">{ajuda}</p>}

      <section class="fe-opcoes-grupo" aria-labelledby={idLista}>
        <header class="fe-opcoes-grupo-header">
          <span id={idLista} class="eyebrow">Opções</span>
          <span class="fe-opcoes-contagem tabular">{String(opcoes.length).padStart(2, '0')}</span>
        </header>
        {opcoes.length > 0 ? (
          <ul class="fe-opcoes-lista">
            {opcoes.map((o, i) => (
              <li class="fe-opcao" key={o}>
                <span class="fe-opcao-texto">{o}</span>
                <button type="button" class="fe-opcao-remover" onClick={() => remover(i)} aria-label={`Remover a opção ${o}`} title="Remover">
                  <Icon name="x" size={16} stroke={1.75} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p class="fe-opcoes-vazio">Nenhuma opção. Adicione ao menos 2 abaixo.</p>
        )}
      </section>

      <div class="fe-opcoes-nova field">
        <label for={idNova}>Adicionar opção</label>
        <div class="fe-opcoes-nova-linha">
          <input
            id={idNova}
            ref={novaRef}
            value={nova}
            maxLength={MAX_OPCAO}
            placeholder="Ex.: De R$ 25.000 a R$ 50.000"
            aria-invalid={erro ? 'true' : undefined}
            onInput={(e) => {
              setNova(e.currentTarget.value);
              if (erro) setErro('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionar();
              }
            }}
          />
          <button type="button" class="btn btn-secondary btn-md" onClick={adicionar}>
            <Icon name="plus" size={16} stroke={1.75} class="btn-icon" /> Adicionar
          </button>
        </div>
        {erro ? <span class="field-erro" role="alert">{erro}</span> : <span class="field-hint">Enter também adiciona. A nova opção entra no fim da lista.</span>}
      </div>

      <div class="fe-rascunho-acoes">
        <button type="button" class="btn btn-secondary btn-md" onClick={fechar}>Cancelar</button>
        <button type="button" class="btn btn-primary btn-md" onClick={aplicar}>Aplicar opções</button>
      </div>
    </div>
  );
}
