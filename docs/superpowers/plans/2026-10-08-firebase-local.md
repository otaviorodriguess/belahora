# Firebase com agenda local — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Adicionar login Firebase ao PWA sem perder agendamentos locais, com separação por conta e persistência opcional.

**Architecture:** Um controlador de autenticação resolve a identidade antes de montar o provider da agenda. Um repositório IndexedDB com escopo imutável por conta encapsula transações e migração exclusiva da agenda antiga. Firebase hospeda somente autenticação; o frontend continua na Vercel.

**Tech Stack:** React 19, TypeScript, Vite 7, Firebase Web SDK, IndexedDB, Vitest, Playwright; Firebase Auth Emulator para testes de autenticação.

**Spec:** `docs/superpowers/specs/2026-10-08-firebase-local-design.md` (aprovada).

## Global Constraints

- Agendamentos e configurações permanecem no IndexedDB do aparelho, sem sincronização e sem Firestore.
- Nunca salvar senhas nem implementar armazenamento manual de tokens.
- Manter o banco `aura-local-agenda` e a store `agenda`.
- Não inicializar Analytics.
- Oferecer “Manter acesso neste aparelho” desmarcado por padrão.
- Não habilitar automaticamente em produção nem afirmar publicação concluída antes do deploy e da validação.
- Preservar o endereço, manifest ID e banco atuais do PWA.
- Não criar contas ou enviar e-mails reais como efeito de testes automáticos.
- O Git descoberto tem raiz em `C:/Users/Administrador`, não nesta pasta. Não adicionar arquivos do perfil nem criar commits abrangentes; antes da execução, avaliar isolamento conforme using-git-worktrees. Se não houver repositório dedicado apropriado, trabalhar apenas nesta pasta com cópia de recuperação dos arquivos alterados, sem inicializar ou modificar o Git do perfil.

## Review Focus

- Duas contas reivindicam a agenda antiga simultaneamente: somente uma transação deve obter a vinculação (tarefa 1).
- Restauração de backup e migração concorrentes: nenhuma pode sobrescrever uma agenda que deixou de estar vazia (tarefa 1).
- Usuário sai enquanto leitura/gravação está pendente: nenhum resultado antigo pode aparecer ou gravar na próxima conta (tarefa 3).
- PWA inicia desconectado com sessão persistida: abrir somente a identidade restaurada; sem persistência, mostrar login (tarefas 2 e 4).
- Atualização chega em uma instalação com registros anteriores: preservar banco, exportação e opção de vinculação (tarefa 4).

## Arquivos e limites de responsabilidade

- `src/services/localAgenda.ts`: repositório transacional por escopo; manter exports legados para modo local explícito.
- `src/services/agendaIdentity.ts`: tipos de escopo e geração de chave estável por projeto/UID.
- `src/services/firebaseClient.ts`: configuração validada, inicialização única e emulator apenas em desenvolvimento.
- `src/services/firebaseAuth.ts`: login, logout, persistência, observação e mensagens de erro.
- `src/contexts/AuthContext.tsx`, `AuthProvider.tsx`, `src/hooks/useAuth.ts`: estado e ciclo de vida da sessão.
- `src/components/AuthGate.tsx`, `LoginForm.tsx`, `LegacyAgendaPrompt.tsx`, `AccountPanel.tsx`: entrada, migração e conta atual.
- `src/contexts/AgendaProvider.tsx`: recebe repositório imutável; não depende de identidade global mutável.
- `src/main.tsx`, `src/pages/SettingsPage.tsx`, `src/components/BackupPanel.tsx`, `src/styles.css`: composição e textos compatíveis com login.
- Testes novos ao lado dos serviços e em `tests/auth-local.spec.ts`; configuração separada `playwright.auth.config.ts`.
- `package.json`, lockfile, `.env.example`, `README.md`, `firebase.json`, `.firebaserc`: dependências e execução documentada, sem credenciais administrativas.

### Tarefa 1: Repositório por conta e migração preservadora

**Interfaces:** `AgendaScope = { kind: 'legacy' } | { kind: 'account'; projectId: string; uid: string }`; `createAgendaRepository(scope: AgendaScope): AgendaRepository`. Métodos: `read(): Promise<LocalAgenda>`, `update(fn: (current: LocalAgenda) => LocalAgenda): Promise<LocalAgenda>`, `save(input: AppointmentInput, existing?: Appointment, id?: string): Promise<LocalAgenda>`, `remove(appointment: Appointment): Promise<LocalAgenda>`, `saveSettings(settings: Settings): Promise<LocalAgenda>`, `legacyStatus(): Promise<'available' | 'claimed' | 'absent' | 'target-not-empty'>`, `claimLegacy(): Promise<LocalAgenda>`, `readLegacyForBackup(): Promise<LocalAgenda>`. Propriedade `channelName: string`. Chave de conta: `JSON.stringify(['account', projectId, uid])`; chave de proprietário separada de dados da agenda.

- [x] Escrever `src/services/localAgenda.test.ts` com IndexedDB de teste (`fake-indexeddb`, dependência de desenvolvimento): `separatesAccounts` verifica A != B e configurações padrão em B; `claimsOnce` verifica cópia exata, chave original intacta e rejeição para B; `concurrentClaim` usa Promise.allSettled e exige exatamente um sucesso; `rollbackClaim` simula falha no put e exige agenda original e destino inalterados; `refusesNonEmptyTarget` verifica que restauração anterior impede migração.
- [x] Executar `npx vitest run src/services/localAgenda.test.ts`; confirmar falhas por interface ausente antes de implementar.
- [x] Implementar as interfaces acima em `agendaIdentity.ts` e `localAgenda.ts`. Reads/writes de migração, condição de destino vazio e proprietário devem ocorrer na mesma transação readwrite. Escopo legado preserva migração Google existente; escopos de conta jamais usam `readSettings()` ou snapshot Google como defaults. Disponibilizar exportação legada só antes da vinculação ou para o proprietário. Conta vazia pode reivindicar depois, via configurações. Sem auth, não enumerar ou retornar agendas vinculadas.
- [x] Executar o teste novamente; exigir todos os casos PASS e manter os testes existentes de validação/backup passando.

### Tarefa 2: Sessão Firebase e configuração explícita

**Interfaces:** `AuthIdentity = { projectId: string; uid: string; email: string | null }`; `AuthState` discriminado por `status: 'disabled' | 'loading' | 'signed-out' | 'signed-in' | 'error'`, com `identity` apenas no estado signed-in. Serviço `signIn(email: string, password: string, remember: boolean): Promise<void>`, `signOut(): Promise<void>`, `resetPassword(email: string): Promise<void>`, `subscribeAuth(listener: (state: AuthState) => void): () => void`. Contexto expõe estado e essas ações, mais `retry(): void` para recuperação de inicialização.

- [x] Criar `src/services/firebaseAuth.test.ts` e `firebaseClient.test.ts`: configuração incompleta + `VITE_AUTH_ENABLED=true` dá erro; false não inicializa SDK; remember=false seleciona persistência em memória antes de signIn; true seleciona browserLocalPersistence; erro de rede difere de credenciais; reset retorna texto neutro; logout entre abas sinaliza saída inclusive para sessão em memória; bootstrap aguarda resolução do SDK sem mostrar dados.
- [x] Executar `npx vitest run src/services/firebaseAuth.test.ts src/services/firebaseClient.test.ts` e confirmar falha inicial.
- [x] Instalar `firebase` e implementar serviço/contexto usando APIs modulares. Observar `onIdTokenChanged`, consultar token atualizado ao reconectar/retomar online e bloquear revogação conhecida; rede indisponível mantém estado da sessão previamente autorizada e aviso. Usar BroadcastChannel com fallback storage event para saída, sem circular mensagens nem transmitir tokens. Esperar gravação pendente terminar antes da saída solicitada na UI.
- [x] Configurar `VITE_AUTH_ENABLED` false por padrão e validação obrigatória de API key, auth domain, project ID e app ID quando ativado. SDK controla tokens. Emulator só quando `import.meta.env.DEV` e host local explícito; nunca permitir via parâmetro URL ou em produção.
- [x] Executar testes acima, incluindo erro de persistência indisponível: informar ao usuário e não fingir que “manter acesso” foi aplicado.

### Tarefa 3: Interface de entrada e montagem por identidade

**Interfaces:** `AuthGate({ children: ReactNode })` usa useAuth; `AgendaProvider({ repository: AgendaRepository, children: ReactNode })` usa repositório da tarefa 1; `useAuth()` usa contexto da tarefa 2. `LegacyAgendaPrompt` recebe repository e callbacks `onDone(): void`, `onSkip(): void`. `AccountPanel` usa identidade atual, saída e migração posterior quando elegível.

- [x] Escrever cenários Playwright em `tests/auth-local.spec.ts`: entrada acessível por labels “E-mail” e “Senha”; checkbox “Manter acesso neste aparelho” inicialmente desmarcado; sem botão de cadastro; recuperação neutra; conta A só vê A; logout durante operação não transfere resultado a B; exportação antes de confirmação preserva conteúdo legado; iniciar vazia mantém opção de vincular em Configurações.
- [x] Executar esses cenários com emulador conforme tarefa 4; antes de criar UI, confirmar falha pela ausência da tela de login.
- [x] Implementar componentes com classes e controles existentes, textos em português e estados desabilitados durante operações. Incluir aviso de acesso em aparelho pessoal. Nenhuma senha persistida em estado após logout.
- [x] Integrar AuthProvider → AuthGate → AgendaProvider em `main.tsx`, montando provider com key do escopo. Ajustar provider para repository e cancelar efeitos/resultados após desmontagem. Operações já iniciadas permanecem no escopo capturado. Remover texto “Sem login” de BackupPanel no modo autenticado. Corrigir configuração inicial para não ler settings de outra conta.
- [x] Executar cenários da tarefa e verificar interface estreita (390px) e desktop, incluindo foco, mensagens role=alert/status e operação de teclado.

### Tarefa 4: Integração, offline, atualização e guia de ativação

**Interfaces:** Configuração `playwright.auth.config.ts` usa servidor Vite em localhost com `VITE_AUTH_ENABLED=true`, `VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099` e projeto demo `demo-belahora`. `firebase.json` define Auth Emulator; `.firebaserc` usa projeto demo apenas para testes. Testes existentes permanecem em preview de build com auth explicitamente false. Para PWA offline, build autenticado de teste usa interceptação de rede Firebase pelo Playwright com respostas de fixture, sem backdoor no bundle de produção.

- [x] Configurar scripts e ferramentas de emulador em desenvolvimento (`firebase-tools`), verificar requisitos Java da versão instalada e reportar falta do runtime sem instalar globalmente silenciosamente. Preparar contas fictícias A/B usando API do emulador, nunca o projeto belahora real. Proteger setup de teste rejeitando projeto sem prefixo demo e endpoint não local.
- [x] Executar teste de SDK real contra emulador: login, credenciais inválidas, reset sem envio real, logout, reload com/sem persistência e conta desativada detectada online. Comando documentado: `npx firebase emulators:exec --only auth --project demo-belahora "npx playwright test --config playwright.auth.config.ts"`.
- [x] Adicionar cenários de PWA: sessão persistida + offline restaura agenda correta; sessão não persistida + reload offline não abre agenda; logout entre abas bloqueia ambas; atualização preserva banco legado e possibilidade de migração. Fixtures simuladas devem ser identificadas no relatório, nunca descritas como validação em produção.
- [x] Atualizar `.env.example` e README: variáveis, criação manual de usuários no Firebase, domínios já configurados, distinção entre login e proteção dos dados locais, backups, política offline e ativação na Vercel. Não copiar configurações administrativas. Não inicializar Analytics.
- [x] Executar `npm run lint`, `npm test`, `npm run build` e testes e2e legados com auth desativado; executar suíte autenticada separada. Usar variáveis de processo em scripts de teste para evitar que `.env.local` aponte testes ao projeto real.
- [x] Revisar diff limitado à pasta do projeto e verificar que nenhum segredo administrativo ou modificação de banco destrutiva entrou. Registrar comandos/resultados, separar checks reais de simulados e limitações de teste Android/iOS.
- [x] Entregar código e instruções concretas de ativação. Publicação e teste real de login serão etapa separada, sem pedir senha pessoal no chat. Antes de ativar no site, exportar backup no aparelho que contém a agenda real.

## Auto-revisão do plano

As quatro tarefas cobrem configuração, sessão, separação de identidade, preservação, vinculação posterior, offline, concorrência, interface, testes e entrega. Interfaces usam o mesmo AgendaRepository/AgendaScope em serviços e provider. O plano não pressupõe acesso administrativo Firebase nem credenciais de usuário reais, e não altera a publicação durante a implementação.

## Execução proposta

Recomendada: execução direta nesta conversa, tarefa por tarefa, com revisão independente ao final segundo a skill de execução. Alternativa: implementação e revisão por subagentes a cada tarefa. Execução direta autorizada pelo usuário e concluída; resultados, adaptações e limites em docs/firebase-validation.md e work/firebase-progress.md.

