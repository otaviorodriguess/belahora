# Firebase e agendamento público — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disponibilizar uma agenda na nuvem por conta e um link que confirme reservas automaticamente sem perder registros existentes.

**Architecture:** Firestore armazena os dados por UID; funções Vercel validam e gravam todas as alterações. O painel autenticado acompanha os dados da conta; a página pública recebe somente catálogo e horários disponíveis. Migração reiniciável e cache de consulta mantêm separados dados legados, dados recuperáveis e dados confirmados na nuvem.

**Tech Stack:** React 19, TypeScript, Vite, Firebase Auth/Firestore/App Check, Firebase Admin SDK no servidor, Vercel Functions, Vitest, Playwright e emuladores Firebase.

**Spec:** `docs/superpowers/specs/2026-10-10-firestore-agendamento-publico-design.md` — aprovada pelo usuário com “continue”. Execução inline autorizada com “cuida arrocha”.

**Status em 10/10/2026:** tarefas 1–7 implementadas localmente; revisão independente e verificações registradas em `docs/firestore-validation.md`. As listas abaixo preservam o roteiro original; o relatório de validação distingue a cobertura efetiva das pendências. A tarefa 8 permanece parcialmente pendente: Firestore real, configuração segura, validação hospedada e publicação. Integração desligada em produção. Manual: `docs/firestore-deployment.md`.

## Global Constraints

- “Cada conta terá uma agenda independente e um link próprio para enviar às clientes.”
- “O login continua abrindo diretamente a agenda.”
- “Não apagar ou reutilizar suas chaves para outro formato.” Isso inclui IndexedDB `aura-local-agenda`, store `agenda`, chave `current` e chaves por conta.
- “O primeiro escopo permite um serviço por reserva pública; a agenda interna mantém os recursos atuais de múltiplos serviços.”
- “Padrões iniciais: fuso America/Sao_Paulo; próximos 60 dias; antecedência mínima de duas horas; sugestões de início a cada 15 minutos, respeitando expediente, duração e intervalo configurados.”
- “Não haverá envio automático de mensagens.”
- “Não haverá fila invisível de reservas offline.”
- “Chaves privadas jamais terão prefixo VITE_ nem entrarão no repositório ou no chat.”
- “Não assumir custo zero nem habilitar cobrança sem autorização.”
- Preservar domínio `agenda-estetica-phi.vercel.app`, manifest id/start_url `/` e estilo visual atual.
- Git ancestral abrange o perfil Windows: não executar git add/commit abrangente. Antes das edições, criar cópia de recuperação desta versão em `work/firestore-original`, sem substituir `work/firebase-auth-original`. Registrar checkpoints em `work/firestore-progress.md`; um repositório dedicado poderá ser tratado separadamente.
- Não ativar a integração em produção durante tarefas intermediárias. Emuladores usam exclusivamente projeto `demo-belahora`; publicar regras somente com projeto explícito.

## Review Focus

1. Telefone, nome e corpo de erro não vazam em resposta pública, log ou cache compartilhado — tarefas 2 e 6.
2. Repetir uma solicitação cuja resposta se perdeu não cria outra reserva, mesmo após reagendamento/cancelamento — tarefa 3.
3. Aparelhos em fusos diferentes e mudança de data UTC não alteram o dia de atendimento em São Paulo — tarefas 1 e 7.
4. Importação de um aparelho antigo não ressuscita um cancelamento ou apaga uma reserva pública posterior — tarefa 4.
5. Trocar de conta durante leitura, migração ou exportação não mostra dados da conta anterior — tarefas 4 e 5.

## Mapa de arquivos e contratos

Criar `shared/booking.ts` para contratos serializáveis e `shared/scheduling.ts` para cálculo puro, sem `window`, `localStorage` ou `import.meta.env`. Manter tipos existentes de `Appointment`/`Settings`, acrescentando metadados remotos em tipos separados.

Criar módulos focados no servidor: `server/firebaseAdmin.ts`, `server/http.ts`, `server/access.ts`, `server/agendaService.ts`, `server/importService.ts`, `server/publicBooking.ts`. Dois adaptadores Vercel: `api/agenda.ts` e `api/booking.ts`; o campo `action` seleciona uma lista fechada de operações e não caminhos arbitrários.

Criar no cliente `src/services/cloudAgenda.ts`, `src/services/cloudCache.ts`, `src/services/agendaMigration.ts`, `src/services/publicBooking.ts`, `src/contexts/CloudAgendaProvider.tsx`, `src/components/CloudAgendaGate.tsx`, `src/components/BookingLinkPanel.tsx`, `src/components/MigrationPanel.tsx` e `src/pages/PublicBookingPage.tsx`.

Criar regras/índices e testes em `firestore.rules`, `firestore.indexes.json`, `tests/server/`, `tests/firestore/` e `tests/booking.spec.ts`. Adaptar `tsconfig.json`, criar `tsconfig.server.json`, `vitest.server.config.ts`, `playwright.booking.config.ts`, `scripts/serve-booking-test.mjs`. Scripts e dependências são acrescentados junto à tarefa que os usa.

## Tarefa 1 — Contratos e disponibilidade comum

**Arquivos:** criar `shared/booking.ts`, `shared/scheduling.ts`, `shared/scheduling.test.ts`; ajustar `tsconfig.json`, `vitest.config.ts`, `src/utils/availability.ts` e `src/utils/validation.ts` apenas para compartilhar cálculos sem mudar o modo legado.

**Interfaces produzidas:**
- `Occupancy = { appointmentId: string; startMinute: number; endMinute: number }`.
- `CloudAppointment = { value: Appointment; revision: number; status: 'confirmed' | 'cancelled'; origin: 'owner' | 'public' | 'import' }`.
- `CloudState = { settings: Settings; settingsRevision: number; appointments: CloudAppointment[]; publicEnabled: boolean; linkCode: string | null; migrationReady: boolean }`.
- `PublicBookingInput = { code: string; serviceId: string; date: string; start: string; name: string; phone: string; operationId: string }`.
- `Receipt = { reference: string; serviceName: string; date: string; start: string; end: string; price: number }`, sem nome ou telefone na resposta.
- `calculatePublicSlots({date, duration, settings, occupancy, nowMs}): string[]` e `assertFree({startMinute, endMinute, gap, occupancy, ignoreId?}): void`.
- Códigos de erro estáveis: `INVALID_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `CONFLICT`, `STALE_REVISION`, `LINK_PAUSED`, `MIGRATION_REQUIRED`, `RATE_LIMITED`, `UNAVAILABLE`.

- [ ] Escrever testes: aceitar exatamente duas horas de antecedência, rejeitar um minuto antes; aceitar dias locais de hoje a hoje+59; duração de 45 minutos não cabe num intervalo de 30; respeitar gap; rejeitar data inexistente, serviço inativo e fim após 23:59. Usar relógio fixo e repetir sob TZ UTC e America/Sao_Paulo.
- [ ] Rodar `npx vitest run shared/scheduling.test.ts`; verificar falha por implementação ausente.
- [ ] Implementar contratos e cálculos puros usando São Paulo explicitamente. Usar o expediente como origem da grade de 15 minutos, preservando o comportamento atual.
- [ ] Rodar os testes novos e os testes existentes de availability/validation; confirmar que o modo local conserva seu comportamento.
- [ ] Registrar checkpoint, incluindo valores de fronteira e arquivos alterados.

## Tarefa 2 — Acesso ao banco, regras e infraestrutura de testes

**Arquivos:** criar `server/firebaseAdmin.ts`, `server/http.ts`, `server/access.ts`, `firestore.rules`, `firestore.indexes.json`, `tests/firestore/access.test.ts`, `tests/server/access.test.ts`, `tsconfig.server.json`, `vitest.server.config.ts`; modificar `firebase.json`, `package.json`, lockfile e `.env.example`.

**Interfaces produzidas:** `adminDb(): Firestore`, `requireOwner(req): Promise<{uid: string}>`, `requirePublicProof(req): Promise<void>`, `consumeRateLimit({kind, originHash, code, nowMs}): Promise<void>`, `respondError(res, error): void`.

- [ ] Escrever testes de regras: A lê sua agenda; B e visitante não leem A; ninguém pelo SDK cliente grava appointments/days/operations/bookingLinks. Testar token ausente, expirado e UID adulterado no body da função.
- [ ] Configurar emuladores Auth 9099 e Firestore 8080, com UI desativada; script `test:cloud` executa `firebase emulators:exec --only auth,firestore --project demo-belahora "vitest run --config vitest.server.config.ts"`. A configuração seleciona somente `tests/server` e `tests/firestore`; a configuração unitária exclui essas pastas e specs Playwright. Testes de integração abortam sem hosts localhost e projeto demo.
- [ ] Rodar `npm run test:cloud` e verificar as falhas esperadas.
- [ ] Adicionar versões compatíveis de `firebase-admin`, `@vercel/node` e `@firebase/rules-unit-testing`, verificando documentação e lockfile. Admin usa credencial somente de ambiente do servidor; simulador usa configuração demo explícita. Cliente nunca importa `server/`.
- [ ] Implementar verificação de tokens, regras e erros sanitizados. Rejeitar corpos acima de 16 KiB nas rotas comuns; migração terá limite próprio de 512 KiB. `Cache-Control: no-store` nas APIs; não registrar corpo de requisição.
- [ ] Implementar App Check e limites persistentes no Firestore: 120 consultas públicas/minuto por origem, 10 tentativas de reserva/10 minutos por origem+link e 300 consultas/minuto por link. Origem identificada por cabeçalho confiável da Vercel e armazenada como HMAC com segredo do servidor, nunca confiar em IP enviado no body. Limites valem antes de operações dispendiosas; falha de verificação/limitação bloqueia a operação.
- [ ] Testar limites sob concorrência, ausência de prova e respostas sem telefone/token; rodar `npm run test:cloud` e typecheck do servidor. Registrar checkpoint.

## Tarefa 3 — Gravação transacional da agenda

**Arquivos:** criar `server/agendaService.ts`, `api/agenda.ts`, `tests/server/agendaService.test.ts`; ajustar regras/índices quando os testes demonstrarem necessidade.

**Consome:** tipos/cálculos da tarefa 1 e acesso da tarefa 2.
**Produz:** `mutateAppointment(uid, command): Promise<CloudAppointment>`, `updateSettings(uid, settings, expectedRevision, operationId): Promise<CloudState>`, `setBookingEnabled(uid, enabled, expectedRevision): Promise<{code:string; enabled:boolean}>`.
`command` é união discriminada: create com input e operationId; update com id/input/expectedRevision/operationId; cancel com id/expectedRevision/operationId. Origem pública é atribuída exclusivamente pelo servidor.

- [ ] Escrever teste de vinte requisições simultâneas para o mesmo intervalo: uma confirmação, dezenove conflitos; idempotência do mesmo corpo/chave retorna o mesmo ID; mesma chave/corpo diferente é rejeitada.
- [ ] Acrescentar casos: manual versus pública, reagendamento entre dois dias, revisão obsoleta, cancelamento liberando ocupação, mudança concorrente de configuração e índice diário no limite de tamanho.
- [ ] Rodar `npm run test:cloud` e observar falhas novas.
- [ ] Implementar transação que lê todos os documentos necessários antes de gravar. Índice diário coordena qualquer escrita daquele dia; rejeitar índice serializado acima de 512 KiB. Cancelamento mantém tombstone privado. Repetição de operação concluída não reativa registro posteriormente cancelado.
- [ ] Implementar configurações com revisão e criação de código aleatório de 128 bits em transação com verificação de unicidade. Ativação exige migração pronta; desativação permite consulta privada normalmente. Endpoints internos aceitam apenas UID derivado do token.
- [ ] Rodar testes e typecheck; registrar checkpoint. Não expor ainda página pública nem ativar produção.

## Tarefa 4 — Migração reiniciável e restauração segura

**Arquivos:** criar `server/importService.ts`, `src/services/agendaMigration.ts`, `tests/server/importService.test.ts`, `src/services/agendaMigration.test.ts`; ampliar `api/agenda.ts`; preservar `src/services/localAgenda.ts` e suas chaves.

**Interfaces:** `MigrationManifest = { batchId: string; settings: Settings; items: {id:string; hash:string}[] }`; `ImportResult = { imported: string[]; identical: string[]; conflicts: {id:string; reason:string}[]; complete:boolean }`.
Produzir `prepareMigration(scope, snapshot): Promise<MigrationManifest>`, `importBatch(uid, manifest, records): Promise<ImportResult>`, `completeImport(uid, batchId): Promise<ImportResult>` e `resolveImportConflict(uid, batchId, id, resolution): Promise<void>`; resolution permite manter nuvem ou salvar como registro distinto corrigido, passando pelas validações da tarefa 3.

- [ ] Escrever testes: repetir lote não duplica; falha no meio seguida de retomada importa os itens restantes; mesmo ID diferente fica em recuperação; tombstone impede ressurreição; configuração remota existente permanece; IDs iguais com normalizações equivalentes contam como idênticos.
- [ ] Acrescentar agenda histórica fora do expediente, dados inválidos preservados para recuperação, sobreposição preexistente, novo aparelho com reservas adicionais e logout enquanto upload aguarda resposta.
- [ ] Rodar testes unitários e `npm run test:cloud`, verificar falhas.
- [ ] Criar cópia local imutável do snapshot por conta/lote antes de enviar; hash canônico sem undefined, com IDs e conteúdo. Importar até 50 registros por chamada, respeitando 512 KiB; manifest grande é enviado em páginas, sem documento único ilimitado. Nunca aceitar UID do manifest.
- [ ] Importar dias em transações que usam os índices da tarefa 3. Preservar itens inválidos/conflitantes em recuperação privada dividida por registro; não habilitar link antes da conferência. Finalização confere os IDs/hashes esperados, não somente contagem.
- [ ] Implementar restauração usando o mesmo importador: apresentar diferenças, não substituir a agenda inteira. Resolução de conflito valida revisão remota novamente e mantém original recuperável.
- [ ] Rodar testes; verificar original byte a byte e bloqueio de ativação com conflitos. Registrar checkpoint.

## Tarefa 5 — Agenda autenticada na nuvem e consulta offline

**Arquivos:** criar `src/services/cloudAgenda.ts`, `src/services/cloudCache.ts`, `src/contexts/CloudAgendaProvider.tsx`, `src/components/CloudAgendaGate.tsx`, `src/components/MigrationPanel.tsx`; modificar `src/components/AuthGate.tsx`, `src/contexts/AgendaContext.tsx`, `src/components/BackupPanel.tsx`, `src/components/SyncStatus.tsx`, `src/pages/SettingsPage.tsx`, `src/components/AppointmentForm.tsx`, `src/components/AppointmentDetails.tsx`.

**Interfaces:** `createCloudAgendaRepository(scope): { subscribe(onState, onError): () => void; mutate(command): Promise<CloudAppointment>; saveSettings(settings, revision, operationId): Promise<CloudState> }`; `readCloudCache(scope): Promise<CloudState|null>`, `writeCloudCache(scope,state): Promise<void>`.
Provider mantém contrato de leitura do AgendaContext e acrescenta `storageMode`, `canWrite`, `migrationState`; revisões remotas ficam no repositório, sem usar updatedAt local como prova de concorrência.

- [ ] Escrever testes de provider/repositório: sem rede lê somente cache da conta; sem cache mostra indisponibilidade, não cria agenda vazia; escrita só conclui com resposta do servidor; leitura pendente A não aparece em B; saída impede download pendente.
- [ ] Rodar testes e confirmar falhas; implementar camada remota e cache em namespace novo. Desabilitar persistência em disco do SDK Firestore nesta primeira versão e usar cache próprio por conta, evitando gravações offline ocultas.
- [ ] Selecionar integração por `VITE_CLOUD_AGENDA_ENABLED`; ausente mantém modo atual. Na nuvem, mostrar imediatamente a agenda local durante migração com estado visível e edição bloqueada até confirmação; nunca voltar silenciosamente a gravar no modo local após falha remota.
- [ ] Adaptar criação/edição/cancelamento/configurações para internet obrigatória e preservação do formulário em erro. A confirmação visual só aparece após resposta remota. Cancelamentos não aparecem como atendimentos ativos.
- [ ] Adicionar acompanhamento de migração/conflitos nas configurações, sem tela extra no login. Exportar backup da conta ativa; restauração importa com conferência pela tarefa 4. O restante da agenda continua acessível para consulta enquanto houver conflito de migração.
- [ ] Executar testes novos, os 35 unitários legados, testes de login e typechecks; registrar checkpoint.

## Tarefa 6 — API pública, catálogo e confirmação

**Arquivos:** criar `server/publicBooking.ts`, `api/booking.ts`, `tests/server/publicBooking.test.ts`; ajustar `vercel.json`, `vite.config.ts` e `src/services/firebaseClient.ts` somente para a integração App Check e as rotas.

**Interfaces:** `getPublicCatalog(code): Promise<{studio:string; professional:string; services:Service[]}>`, `getPublicSlots(code, serviceId, date, nowMs): Promise<string[]>`, `confirmPublicBooking(input:PublicBookingInput): Promise<Receipt>`.
GET `/api/booking?action=catalog|slots`; POST com action `confirm`. Nada permite listar clientes ou obter atendimento por ID público. Resultados de idempotência contêm somente Receipt, sem dados pessoais.

- [ ] Escrever testes: link inexistente/pausado, serviço desativado, preço/duração adulterados, cliente anônima válida, telefone inválido, campo extra inesperado, requisição acima do limite e requisição sem App Check.
- [ ] Escrever teste de resposta/log sem dados privados e teste que reserva interna ocupa o horário público. Repetir confirmação após perda de resposta retorna o mesmo Receipt.
- [ ] Rodar `npm run test:cloud`, observar falhas; implementar handlers usando os serviços anteriores. Recalcular serviço, valor e duração dentro da leitura transacional, não em uma consulta anterior sem revisão.
- [ ] Excluir `/api/*` do fallback SPA e service worker; manter fallback para `/agendar/*`. Verificar com teste HTTP que erro de API não vira HTML index com status 200.
- [ ] Rodar testes de servidor e build; registrar checkpoint.

## Tarefa 7 — Página da cliente e compartilhamento

**Arquivos:** criar `src/services/publicBooking.ts`, `src/pages/PublicBookingPage.tsx`, `src/components/BookingLinkPanel.tsx`, `tests/booking.spec.ts`, `playwright.booking.config.ts`, `scripts/serve-booking-test.mjs`; modificar `src/main.tsx`, `src/pages/SettingsPage.tsx`, `src/styles.css` e scripts no package.json.

**Interfaces:** cliente público consome exatamente catálogo, slots e Receipt da tarefa 6. Rota `/agendar/{codigo}` é escolhida antes de montar AuthProvider/AuthGate; demais rotas preservam login. `BookingLinkPanel` usa o código retornado pelo servidor e o domínio de produção configurado, nunca deriva link do e-mail.

- [ ] Escrever Playwright com emuladores: profissional migra e ativa link; visitante escolhe serviço/horário, fornece dados e confirma; profissional recebe atendimento; duas clientes disputando o último horário recebem uma confirmação e um conflito.
- [ ] Testar dia local em navegador de outro fuso, serviço com duração que não cabe, offline durante confirmação, retry com mesma chave, manter dados digitados ao perder horário, link pausado e ausência de login na página pública.
- [ ] Criar servidor de teste que adapta os handlers reais Vercel para HTTP local. Script `test:booking`: `firebase emulators:exec --only auth,firestore --project demo-belahora "playwright test --config playwright.booking.config.ts"`, com uma worker e servidor na porta 4181, hosts demo obrigatórios. Injeção de validação App Check somente na construção do harness local/demo; produção jamais aceita bypass por parâmetro, cabeçalho ou token debug inventado. Não usar dados reais.
- [ ] Rodar suíte com falha inicial; implementar fluxo responsivo com estilo atual, labels acessíveis e confirmação explícita da resposta do servidor. Um serviço por reserva pública, sem pagamento/cancelamento público. Preservar operationId enquanto o resultado for incerto.
- [ ] Implementar copiar link, compartilhamento nativo com fallback para cópia, abrir página e pausar/ativar. Antes de ativar, confirmar atualização/conciliação dos aparelhos; mostrar pendências da tarefa 4.
- [ ] Rodar suíte E2E em 390px e desktop; revisar capturas. Registrar checkpoint.

## Tarefa 8 — Verificação integrada e ativação controlada

**Arquivos:** modificar `README.md`, `.env.example`, docs de validação; criar `docs/firestore-deployment.md`; ampliar teste histórico de atualização em `tests/booking.spec.ts` sem modificar a cópia antiga.

- [ ] Testar atualização real: versão local publicada com atendimento → nova versão → importação → abrir em outro contexto autenticado → mesmo atendimento. Testar backup/restauração, segundo aparelho divergente, cancelamento seguido de importação antiga e migração interrompida.
- [ ] Rodar sequencialmente `npm run lint`, `npm test`, typecheck servidor, `npm run build`, `npm run test:local`, `npm run test:auth:pwa`, `npm run test:cloud` e `npm run test:booking` (criado na tarefa 7). Exigir saídas verificadas e documentar falhas intermitentes sem escondê-las.
- [ ] Revisar regras, filtros por conta, caminhos Admin e ausência de credenciais no dist. Executar auditoria de dependências de produção e registrar eventuais achados com alcance real.
- [ ] Fazer revisão independente da integração após a implementação, conforme skill de execução escolhida, e resolver achados antes de publicar.
- [ ] Preparar manual operacional: localização do banco, credencial do servidor, segredo HMAC, App Check, flags, índices, limites de plano e procedimento de recuperação. Não pedir senhas/chaves privadas no chat. Se faltar acesso ao console, listar a ação exata necessária ao usuário.
- [ ] Verificar planos/custos atuais e obter autorização se houver cobrança a habilitar. Criar infraestrutura apenas no projeto confirmado belahora; nunca trocar o projeto padrão de testes para produção.
- [ ] Publicar regras/índices e versão de teste; validar com conta e dados de teste autorizados. Manter link público desativado para contas não migradas. Preservar deployment anterior, além de uma versão de recuperação que já saiba ler a nuvem.
- [ ] Ativar no domínio original somente após validação e autorização de publicação aplicável. Conferir APIs, login, página pública e PWA; documentar o que foi testado em produção e o que foi testado no emulador.
- [ ] Entregar link, instruções curtas de ativação por conta e limites conhecidos. Não prometer proteção contra dados produzidos por versões antigas ainda offline.

## Revisão do plano e execução

Cobertura: tarefas 1/3 cobrem disponibilidade e concorrência; 2/6 cobrem acesso e abuso; 4 cobre migração e recuperação; 5 cobre painel e offline; 7 cobre cliente/compartilhamento; 8 cobre publicação, atualização e operação. Os cinco focos de revisão têm testes atribuídos. Nenhum recurso público será ativado antes das dependências estarem verificadas.

Recomendação: execução pelo assistente nesta conversa, em sequência, com revisão independente ao final. Os contratos são fortemente dependentes e a migração precisa ser conferida junto à agenda; tarefas independentes podem ser revisadas sem dividir a implementação entre várias frentes. A escolha do método e a revisão deste plano precedem as alterações de produto.
