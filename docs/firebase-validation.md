# Integração Firebase — entrega em 08/10/2026

Implementada no projeto, habilitada em `.env.local` e publicada na Vercel em 08/10/2026, após autorização explícita. Endereço preservado: https://agenda-estetica-phi.vercel.app. O servidor de desenvolvimento está em `http://localhost:5173` enquanto o processo local estiver rodando; o site publicado e o Firebase hospedado independem desse processo.

## Publicação verificada

- Deployment ativo: `dpl_C58YybcXgCoyAJvBuYdHMdwxS9Wc` (`agenda-estetica-7q5txw00h-tavinnew.vercel.app`).
- Deployment anterior registrado para recuperação: `dpl_DKYC97P8YwYvmFdJo7vjBkx8MY4J` (`agenda-estetica-q212vbze9-tavinnew.vercel.app`).
- Configuração Firebase e ativação gravadas no ambiente Production da Vercel; build remoto terminou READY.
- Antes de trocar o alias original, conferidos HTML/bundle/manifest/service worker do deployment autenticado pela CLI. O endereço temporário estava protegido pelo login da Vercel; a URL pública final não exigiu essa autenticação.
- Alias `agenda-estetica-phi.vercel.app` atribuído ao novo deployment. Smoke test em contexto de navegador limpo: HTTP 200, tela de login visível, manifest com `id` e `start_url` iguais a `/`, service worker válido com cache de atualização desativado e nenhum erro de JavaScript.
- Reexecutados antes da publicação: lint, 35 testes unitários e atualização real do service worker com atendimento preservado. Não foram acessadas contas reais nem dados de usuários; o login autenticado com conta real e entrega de e-mails ainda dependem da validação operacional.
- Nenhum banco de navegador foi apagado pela publicação. Desde a alteração de 10/10/2026, o primeiro login vincula automaticamente a agenda antiga disponível à conta sem agendamentos, mantendo sua cópia. Cópias de segurança dos aparelhos continuam importantes: o servidor não tem acesso aos registros locais.

## Verificação

- `npm run lint`: sem erros ou avisos.
- `npm test`: 35 testes passaram.
- `npm run build`: TypeScript e build PWA passaram com login habilitado.
- `npm run test:local`: 12 testes passaram (CRUD, conflitos, backup, restauração, offline, instalação e layout).
- `npm run test:auth`: 12 testes passaram; 2 testes offline foram reservados ao build PWA.
- `npm run test:auth:pwa`: 14 testes passaram, incluindo os casos offline e os casos corrigidos na revisão independente.
- Teste adicional de atualização real: build anterior, agendamento salvo, atualização do service worker, entrada e vinculação na versão nova; o atendimento permaneceu. Passou usando a cópia de recuperação pré-alteração em `work/firebase-auth-original`. Esse teste é pulado em checkouts sem a cópia histórica.
- Capturas de celular e desktop revisadas visualmente em `work/firebase-login-mobile.png` e `work/firebase-login-desktop.png`.
- `npm audit --omit=dev`: nenhum alerta. A árvore de ferramentas de desenvolvimento ainda apresenta avisos; não foi aplicado downgrade forçado do Firebase CLI. O SDK usa somente App/Auth no bundle, sem Firestore ou Analytics.

As suítes de login usam o SDK real e Auth Emulator com projeto fictício. O teste do bundle PWA redireciona o tráfego Firebase ao emulador pelo Playwright, sem desvio de autenticação no código de produção. Contas reais, entrega de e-mails do Firebase hospedado e aparelhos Android/iOS físicos ainda precisam de validação operacional.

## Decisões e proteção dos dados

- Como o Git ancestral abrange o perfil do Windows, alterações ficaram somente nesta pasta, com cópia de recuperação; nenhum commit abrangente, merge ou push foi feito.
- Cada operação captura a conta; resultados pendentes da conta anterior não produzem downloads depois da saída nem encerram a sessão de outra conta.
- A migração mantém a cópia antiga, tem proprietário exclusivo e também reconhece o cache Google das primeiras versões.
- Restaurações com confirmação obsoleta são rejeitadas transacionalmente: a pessoa precisa selecionar novamente o backup para não substituir mudanças concorrentes.
- A opção de manter acesso permite abrir offline e depende da proteção do aparelho; o login não criptografa o banco local.
- Dependências transitivas de produção foram corrigidas sem downgrade amplo. Avisos das ferramentas de desenvolvimento não foram confundidos com vulnerabilidades do bundle publicado.

## Próximo passo operacional

Se ainda não houver conta, criá-la em Firebase → Authentication → Usuários → Adicionar usuário. No aparelho de uso diário, salvar edições e exportar backup antes de atualizar o PWA, entrar na conta correta; a agenda antiga disponível será vinculada automaticamente, sem tela intermediária. O endereço de produção foi mantido; os registros de cada aparelho continuam locais e não foram acessados durante a publicação.

## Atualização de 10/10/2026 — entrada direta

Removida a confirmação de vinculação no login. A primeira conta sem agendamentos reivindica automaticamente a agenda antiga disponível, em transação, sem apagar a cópia original nem substituir destino preenchido. Concorrência com outra aba é reavaliada; falhas reais de armazenamento continuam visíveis.

Validação: os dois testes de entrada direta falharam antes da mudança e passaram depois. Lint, build e 35 testes unitários passaram. Na suíte PWA, 14 de 15 passaram (incluindo atualização real com atendimento preservado); o teste de exportação pendente entre abas teve timeout na primeira execução e passou na repetição isolada, sem alteração de produto ou teste para contorná-lo. A causa desse comportamento intermitente não foi determinada.

Publicado no mesmo endereço, agenda-estetica-phi.vercel.app. Deployment: dpl_7vhrNYD2vhwrRaku5YXVCANZAT4J. Versão anterior: dpl_C58YybcXgCoyAJvBuYdHMdwxS9Wc. Nenhuma conta real ou agenda de usuário foi acessada.
