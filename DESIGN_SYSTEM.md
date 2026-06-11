# NianPlay - Guia de Identidade Visual

Este documento registra a identidade visual adotada a partir da versao 1.1.19. Ele deve servir como referencia para novas telas, componentes, correcoes e revisoes de interface.

## 1. Essencia da identidade

O NianPlay combina a atmosfera de um **estudio musical analogico** com a organizacao de um **arquivo pessoal de discos**. A interface deve parecer:

- quente, intimista e centrada na musica;
- premium, mas discreta;
- densa e eficiente como um aplicativo desktop profissional;
- contemporanea sem parecer generica, neon ou excessivamente futurista;
- visualmente silenciosa, deixando capas, artistas e faixas serem os protagonistas.

Palavras-chave: `warm studio`, `analogico`, `carvao`, `ambar`, `arquivo musical`, `console`, `editorial`, `tactil`.

## 2. Principios visuais

1. **A musica vem primeiro.** Capas, titulos e estado de reproducao recebem a maior enfase.
2. **Contraste por camadas.** A hierarquia nasce de pequenas variacoes de superficies escuras, bordas suaves e opacidade, nao de blocos muito coloridos.
3. **Ambar e marca, teal e funcao.** O ambar comunica identidade, selecao e acao principal. O teal indica recursos tecnicos, conexao ou estado funcional.
4. **Densidade com respiracao.** Listas podem ser compactas, mas cabecalhos, paineis e secoes precisam de espaco suficiente para organizar a leitura.
5. **Movimento com significado.** Animacoes devem indicar reproducao, progresso, entrada de contexto ou resposta a uma acao.
6. **Geometria macia.** Cantos arredondados e bordas finas tornam o aplicativo acolhedor sem perder o aspecto de ferramenta.

## 3. Arquitetura principal

A composicao atual e uma bancada de estudio em tres areas:

- **TitleBar:** barra superior de 32 px, muito discreta, com marca central e controles da janela.
- **NavRail:** navegacao lateral esquerda fixa com 56 px, composta principalmente por icones.
- **Conteudo:** area central flexivel, com `min-width: 0`, responsavel por cada pagina.
- **StudioPanel:** painel direito fixo com 288 px, reunindo capa, transporte, volume, fila e letras.

O player persistente oficial e o `StudioPanel`. O antigo `PlayerBar` e a antiga `Sidebar` nao fazem parte do shell atual e nao devem ser usados como referencia para novas implementacoes.

Arquivos principais:

- `src/renderer/App.jsx`
- `src/renderer/components/TitleBar.jsx`
- `src/renderer/components/NavRail.jsx`
- `src/renderer/components/StudioPanel.jsx`
- `src/renderer/components/NowPlayingModal.jsx`

## 4. Paleta de cores

### 4.1 Marca - ambar

O ambar e o elemento de reconhecimento do NianPlay.

| Token | Valor | Uso recomendado |
| --- | --- | --- |
| `primary-300` | `#fcd34d` | destaques luminosos e estados especiais |
| `primary-400` | `#fbbf24` | icones e textos ativos |
| `primary-500` | `#f59e0b` | cor principal da marca e botoes primarios |
| `primary-600` | `#d97706` | hover ou profundidade do ambar |
| `primary-700` | `#b45309` | fundos mais contidos |

Usar em selecao, faixa atual, progresso principal, chamadas de acao e detalhes de marca. Evitar grandes fundos ambar ou varios elementos ambar competindo simultaneamente.

### 4.2 Acento tecnico - teal

| Token | Valor | Uso recomendado |
| --- | --- | --- |
| `accent-300` | `#5eead4` | detalhe luminoso |
| `accent-400` | `#2dd4bf` | texto ou icone funcional |
| `accent-500` | `#14b8a6` | acao secundaria especial e estado pronto |
| `accent-600` | `#0d9488` | hover e contraste |

Usar para sincronizacao, conexao, disponibilidade, recursos online e acoes tecnicas. Nao usar como segunda cor de marca decorativa.

### 4.3 Superficies quentes

| Token | Valor | Papel |
| --- | --- | --- |
| `surface-900` | `#0c0b09` | fundo profundo, rail e painel de estudio |
| `surface-800` | `#141210` | superficie principal de paineis e modais |
| `surface-700` | `#1c1916` | cartoes e campos elevados |
| `surface-600` | `#252119` | hover, selecao sutil e controles |
| `surface-500` | `#312c23` | bordas e controles destacados |
| `surface-400` | `#403930` | divisores mais visiveis |
| `surface-300` | `#574e42` | texto ou borda de baixa prioridade |

Esses tons nao sao cinzas neutros: todos carregam uma temperatura marrom/carvao. Novos fundos devem permanecer nessa familia.

### 4.4 Texto e estados

- Texto principal: `#f0ede8` ou branco com alta opacidade.
- Texto secundario: branco entre 55% e 70%.
- Texto auxiliar: branco entre 30% e 45%.
- Bordas: branco entre 5% e 10%.
- Erro/destrutivo: vermelho, preferencialmente em fundo translucido.
- Sucesso: verde ou teal, conforme o significado.
- Aviso: ambar.

Nunca usar branco puro em todos os niveis. A hierarquia por opacidade e parte central da identidade.

## 5. Tipografia

A tipografia atual prioriza legibilidade e compactacao. A familia de interface e `Inter`, com fallbacks de sistema.

### Hierarquia

- Titulos de pagina editoriais: 24 px, `font-black`, tracking apertado.
- Titulos de pagina compactos: 16 px, `font-bold` ou `font-extrabold`.
- Titulos de painel/modal: 14-18 px, `font-bold`.
- Texto comum: 12-14 px.
- Metadados e controles: 10-12 px.
- Rotulos tecnicos: 9-11 px, caixa alta, peso forte e tracking amplo.
- Duracoes, versoes e estatisticas: preferir numeros tabulares.

Titulos grandes devem ser curtos. Rotulos em caixa alta funcionam como marcadores de equipamento, nao como texto corrido.

## 6. Forma, espaco e profundidade

### Raios

- Controles pequenos: 8-10 px.
- Botoes e campos principais: 12 px (`rounded-xl`).
- Cartoes e paineis: 16 px (`rounded-2xl`).
- Modais e elementos de destaque: 16-20 px.
- Capas: normalmente 8-16 px, conforme o contexto.

### Bordas

- Padrao: 1 px com branco entre 5% e 10%.
- Estado ativo: ambar com baixa opacidade.
- Evitar bordas claras, grossas ou totalmente opacas.

### Sombras e vidro

- Sombras devem ser profundas e suaves, quase sempre combinadas com superficie escura.
- Blur e transparencia so devem aparecer quando existe wallpaper ou sobreposicao real por tras.
- O efeito `glass` e um recurso de profundidade, nao um estilo para todos os cartoes.

### Textura

O ruido global muito sutil cria uma sensacao analogica. Ele deve permanecer quase imperceptivel e nunca prejudicar texto, capas ou contraste.

## 7. Componentes fundamentais

As classes globais em `src/renderer/styles/globals.css` sao a fonte de verdade inicial.

### Botoes

- `btn-primary`: acao principal em ambar.
- `btn-secondary`: acao neutra sobre superficie elevada.
- `btn-ghost`: acao discreta ou de apoio.
- `btn-accent`: acao tecnica em teal.
- `btn-destructive`: exclusao ou acao irreversivel em vermelho translucido.

Regras:

- apenas uma acao primaria dominante por contexto;
- icones e textos devem ter alinhamento optico e espacamento compacto;
- feedback pressionado usa escala aproximada de 0,95;
- botoes somente com icone precisam de `title` ou tooltip e nome acessivel.

### Campos

- Usar `input-base` como base.
- Fundo quente, borda discreta e foco ambar.
- Placeholder deve ter baixa prioridade, mas continuar legivel.
- Mensagens de erro devem aparecer proximas ao campo, sem depender apenas da cor.

### Cartoes e paineis

- `card`: conteudo agrupado padrao.
- `card-elevated`: conteudo com maior prioridade.
- `panel`: regiao funcional extensa.
- Cartoes de capa podem reduzir a moldura para dar protagonismo a imagem.

### Abas e badges

- Aba ativa: texto ambar e sublinhado ou fundo muito sutil.
- Aba inativa: texto secundario, sem competir.
- Badges devem ser pequenos, densos e sem capsulas exageradamente grandes.
- `badge-brand` representa marca/selecao; `badge-accent`, estado tecnico; `badge-muted`, informacao auxiliar.

### Modais e menus

- Modais comuns usam `modal-overlay`, `modal-box`, `modal-header` e `modal-footer`.
- Overlay: preto translucido com blur leve.
- Menus flutuantes que podem ultrapassar cartoes ou containers com `overflow` devem ser renderizados em portal no `document.body`.
- Popovers precisam permanecer dentro da janela e ter `z-index` acima dos paineis.

## 8. Padroes por tipo de pagina

### Biblioteca - catalogo de dados

- Lista/tabela densa, voltada a muitas faixas.
- Cabecalho funcional compacto com busca, importacao e ordenacao.
- Acoes secundarias podem surgir no hover, mas as principais devem continuar acessiveis por teclado.
- Selecao multipla usa barra contextual ambar.
- Cabecalho da tabela pode permanecer fixo durante a rolagem.

### Downloads - bancada de operacoes

- Entrada de nova tarefa no topo.
- Controle segmentado para origem do download.
- Fila exibida como monitor de tarefas, com progresso, estado e erro claros.
- Ambar representa progresso principal; teal/verde representa pronto ou conectado.

### Playlists e comunidade - galeria editorial

- Grade responsiva baseada em capas quadradas.
- Titulo forte e metadados discretos.
- Acoes aparecem sobre a capa no hover, com contraste por gradiente.
- A capa e sempre o primeiro nivel visual; textos e controles nao devem cobri-la permanentemente.
- Menus de contexto ficam fora da area recortada do cartao via portal.

### Detalhe de playlist - colecao e organizacao

- Hero com capa, titulo, resumo e acao principal.
- Ferramentas secundarias em grupo compacto.
- Faixas em lista densa.
- Grupos usam cor como marcador auxiliar; a cor nao substitui nome ou icone.
- Estados especiais, como faixa virtual ou arquivo ausente, precisam de texto e simbolo.

### Configuracoes - formulario organizado

- Coluna central com largura limitada.
- Secoes nomeadas e separadas por cartoes.
- Rotulos explicam o efeito antes do controle.
- Toggles, caminhos e credenciais seguem a mesma linguagem de campos e estados.
- Acoes perigosas ou de conta devem ficar visualmente separadas das preferencias comuns.

### Atualizacoes - historico e confianca

- Versao atual e disponibilidade devem ser identificadas imediatamente.
- O texto de mudancas vem do log real da versao, nunca de uma mensagem generica.
- Progresso e erros devem ser legiveis e oferecer proxima acao clara.

## 9. Player e linguagem musical

O `StudioPanel` concentra a assinatura mais forte do redesign:

- capa grande e quadrada;
- gradiente sobre a parte inferior da capa para dados da faixa;
- controles centrais e compactos;
- barra de progresso ambar;
- volume em popover vertical;
- fila e letras em abas;
- medidores VU para indicar reproducao ativa.

O modal de reproducao expandida pode ser mais cenografico: vinil, sulcos, rotacao e fundo derivado da capa. Ainda assim, informacao e controles devem permanecer legiveis.

Animacoes musicais devem respeitar o estado real do player. O disco e os medidores nao devem se mover quando a reproducao estiver pausada.

## 10. Capas, wallpaper e imagens

- Capas devem usar `object-cover` e manter proporcao quadrada.
- Quando nao houver capa, usar fallback coerente com as superficies e a marca.
- Wallpapers podem operar em modo normal, desfocado ou transparente.
- Paineis sobre wallpaper usam as variantes `wallpaper-panel`, `wallpaper-row` e `playlist-track-row` para preservar contraste.
- Video de wallpaper deve obedecer as mesmas regras de contraste da imagem estatica.
- Nunca colocar texto diretamente sobre uma imagem complexa sem gradiente, sombra ou superficie de apoio.

## 11. Movimento

Duracao padrao: 150-200 ms.

Movimentos aceitos:

- entrada curta de modal ou painel;
- fade de conteudo;
- escala de pressionamento em botao;
- progresso pulsante durante tarefa indeterminada;
- rotacao de vinil durante reproducao;
- medidores VU na faixa atual;
- revelacao de controles sobre capas.

Evitar animacoes decorativas continuas, saltos elasticos, brilho neon e transicoes longas. Implementacoes futuras devem respeitar `prefers-reduced-motion`.

## 12. Interacao e acessibilidade

- Todo controle precisa de estados `hover`, `focus-visible`, `active` e `disabled` quando aplicavel.
- Icones isolados precisam de rotulo acessivel.
- Contraste nao pode depender do wallpaper escolhido pelo usuario.
- Estado nao deve ser comunicado somente por cor.
- Areas clicaveis principais devem ter aproximadamente 36-40 px, mesmo quando o icone for menor.
- Menus fecham com clique externo e tecla `Escape`.
- Modais devem manter foco, fechar com `Escape` quando seguro e retornar o foco ao acionador.
- Acoes disponiveis apenas no hover precisam de equivalente para teclado/touchpad.

## 13. Responsividade desktop

O produto e desktop-first e trabalha com janela minima aproximada de 1000 x 650 px.

- `NavRail` e `StudioPanel` permanecem fixos no layout normal.
- A area central deve usar `min-width: 0` para evitar estouro horizontal acidental.
- Galerias devem usar `auto-fill/minmax` para reorganizar cartoes.
- Listas densas podem reduzir metadados secundarios antes de comprimir controles essenciais.
- Modais devem usar `max-width` e `max-height` relativos a viewport.
- Novas telas precisam ser verificadas na janela minima e em 1920 x 1080.
- Se futuramente houver modo compacto abaixo de 1000 px, ele deve recolher primeiro o `StudioPanel`, nao reduzir indiscriminadamente todos os elementos.

## 14. Convencoes de implementacao

- Tokens de cor e extensoes de tema: `tailwind.config.js`.
- Componentes e utilitarios globais: `src/renderer/styles/globals.css`.
- Shell oficial: `src/renderer/App.jsx`.
- Evitar cores hexadecimais novas quando ja existir token equivalente.
- Valores dinamicos, como cores de grupos e fundos derivados de capas, podem usar estilo inline.
- Reutilizar componentes existentes antes de criar uma variante quase identica.
- Menus e popovers recortaveis devem usar portal.
- Textos visiveis ao usuario devem permanecer em portugues brasileiro e arquivos em UTF-8.

## 15. O que fazer e o que evitar

### Fazer

- usar carvao quente como base;
- reservar ambar para marca, selecao e acao principal;
- usar teal para funcao tecnica;
- destacar capas e conteudo musical;
- manter bordas e sombras discretas;
- criar hierarquia por peso, opacidade e espacamento;
- preferir paineis bem definidos a muitos cartoes soltos;
- testar estados vazio, carregando, erro, offline e sem capa.

### Evitar

- cinza azulado ou preto puro como nova base;
- roxo, neon e gradientes genericos de aplicativo de IA;
- excesso de glassmorphism;
- grandes areas coloridas sem funcao;
- capsulas em todos os elementos;
- bordas brancas fortes;
- animacoes sem relacao com musica ou estado;
- misturar o antigo player inferior com o novo `StudioPanel`;
- menus presos dentro de containers com `overflow: hidden`.

## 16. Inconsistencias conhecidas

Estas nao impedem o uso atual, mas devem orientar futuras melhorias:

- Titulos de pagina variam entre 16 px e 24 px sem uma regra totalmente explicita.
- Alguns modais internos de playlist ainda repetem estilos manualmente em vez das classes globais.
- Cores e estilos de moldura de perfil aparecem duplicados em varios componentes.
- Existem componentes legados (`Sidebar` e `PlayerBar`) que nao representam o shell atual.
- A responsividade depende principalmente de grades fluidas; ha poucos breakpoints dedicados.
- Algumas acoes de tabela dependem de hover e merecem revisao de teclado/acessibilidade.
- O dropdown de grupos no detalhe da playlist deve ser observado para o mesmo risco de recorte ja corrigido no menu de playlists.

Esses pontos devem ser tratados por consolidacao gradual, sem uma reescrita visual desnecessaria.

## 17. Checklist para novas mudancas

Antes de considerar uma tela ou componente concluido:

- [ ] Usa os tokens existentes de cor e superficie.
- [ ] Tem uma unica hierarquia primaria clara.
- [ ] Preserva ambar como marca e teal como funcao.
- [ ] Funciona com e sem wallpaper.
- [ ] Foi testado na janela minima e em tela ampla.
- [ ] Possui estados vazio, carregando, erro e desabilitado quando aplicaveis.
- [ ] Tem foco visivel e rotulos acessiveis.
- [ ] Menus e modais nao sao recortados por containers.
- [ ] Animacoes refletem estado real e sao curtas.
- [ ] Textos estao em portugues brasileiro.
- [ ] Nao reutiliza componentes legados como referencia visual.
- [ ] O resultado parece parte de um estudio musical quente, nao de um dashboard generico.

