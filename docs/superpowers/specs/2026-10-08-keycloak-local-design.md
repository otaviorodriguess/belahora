# Keycloak com agenda local — proposta para revisão

## Objetivo confirmado

Adicionar login com Keycloak à Bela Hora, mantendo agendamentos e configurações no IndexedDB de cada aparelho. O frontend continua na Vercel. Não criar API de agendamentos, banco remoto ou sincronização. Preservar os registros reais já existentes e o endereço do PWA.

O usuário ainda não tem uma instância do Keycloak hospedada. A integração pode ser desenvolvida e testada localmente, mas só pode ser ativada em produção depois que houver uma instância HTTPS disponível.

## Estrutura proposta

- Adicionar `keycloak-js` com Authorization Code e PKCE S256, cliente público e tokens somente em memória.
- Inicializar autenticação antes de montar o AgendaProvider. Exibir estados de entrada, carregamento, erro e nova tentativa, sem ciclos automáticos de redirecionamento.
- Usar configuração explícita de ativação, URL, realm e client ID. Configuração parcialmente preenchida com autenticação ativada bloqueia a entrada com erro; nunca libera a agenda silenciosamente.
- Sem ativação explícita, manter o comportamento local atual para permitir uma entrega gradual antes de existir o servidor.
- Adicionar conta atual e ação Sair nas configurações. Não alterar o visual das telas de agendamento além do necessário.

## Dados locais e preservação

Hoje o banco `aura-local-agenda`, store `agenda`, guarda uma única chave `current`. A proposta mantém esse banco e não apaga a chave antiga.

- Separar novos registros por identidade estável composta pelo emissor Keycloak e `sub`; não usar e-mail ou nome como identificador.
- No primeiro login em um aparelho com agenda anterior, pedir confirmação explícita para vincular os dados existentes à conta exibida. Permitir exportar backup antes dessa escolha.
- Copiar a agenda anterior para a conta e registrar sua vinculação em uma única transação IndexedDB, sem sobrescrever agenda de conta já existente. Preservar a cópia original para recuperação.
- Uma segunda conta recebe agenda vazia e configurações padrão; não herda dados, configurações nem cache Google de outra conta. A agenda anterior não pode ser reivindicada novamente por outra conta.
- Capturar o escopo da conta em cada operação. Ao sair ou trocar de conta, desmontar o provider e descartar resultados assíncronos antigos para evitar exibição ou gravação na conta errada.
- Separar notificações BroadcastChannel por conta. Backup e restauração operam somente na agenda ativa e preservam os metadados de vinculação.
- Sair da conta não apaga os agendamentos. Reentrar na mesma conta, no mesmo armazenamento do PWA, recupera sua agenda.

## Proposta para uso offline

O login inicial exige internet. Para preservar a utilidade offline do PWA, oferecer após o login a opção desmarcada por padrão “Permitir acesso offline neste aparelho”, explicando que qualquer pessoa com acesso ao aplicativo desbloqueado poderá abrir essa agenda local.

- Com essa opção, guardar somente uma referência local à identidade e o consentimento; nunca persistir access token ou refresh token.
- Disponibilizar entrada offline explícita para a conta autorizada nesse aparelho. Essa entrada é uma permissão local, não uma sessão Keycloak validada.
- Sem essa opção, exigir autenticação online ao reabrir o aplicativo. Uma sessão expirada não abre a agenda silenciosamente.
- Ao sair, remover a permissão offline e bloquear as demais abas da mesma conta. Finalizar o logout no Keycloak quando houver conexão; informar quando apenas a saída local foi possível.
- Quando conectado, renovar sessão e tratar revogação conhecida sem recorrer automaticamente ao modo offline. Alterar a senha ou revogar a sessão no servidor não bloqueia imediatamente um aparelho desconectado.

O Keycloak controla a entrada normal no aplicativo. Ele não criptografa o IndexedDB nem cria proteção contra alguém com acesso ao perfil do navegador e suas ferramentas. A separação por conta evita mistura no aplicativo, mas não é isolamento de segurança imposto por um servidor.

## Configuração e hospedagem

Preparar instruções e configuração de desenvolvimento local com Keycloak em container, realm `bela-hora` e cliente público `bela-hora-pwa`. Credenciais de administração devem ser fornecidas pelo operador, fora do repositório; nunca embutidas no frontend.

Em produção, usar uma instância Keycloak HTTPS com armazenamento persistente, banco suportado e backups. A escolha do provedor e de eventual custo será feita antes de contratar ou provisionar infraestrutura externa. O modo de desenvolvimento do Keycloak não será publicado como servidor de produção.

Cadastrar redirects exatos para `https://agenda-estetica-phi.vercel.app/` e logout no mesmo endereço. Usar origem exata, sem curingas amplos. URLs locais de desenvolvimento ficam separadas da configuração de produção.

O service worker mantém o cache dos arquivos do aplicativo; não deve cachear endpoints do Keycloak, respostas de login ou tokens.

## Validação necessária

- Agenda antiga preservada após atualização; vinculação explícita, transacional e exclusiva.
- Contas A e B separadas, inclusive configurações, backups, restauração e múltiplas abas.
- Falha ou interrupção de gravação não perde registros nem confirma migração incompleta.
- Login, cancelamento, falha do servidor, renovação, expiração, saída e retorno à conta.
- Offline autorizado e não autorizado; logout remove autorização offline.
- Regressão de CRUD, conflitos de horário, exportação/importação e atualização do PWA.
- Lint, testes unitários, build e testes de navegador pertinentes.
- Testes com servidor Keycloak real local; validação final de login no PWA Android/iOS depende de aparelho e da instância HTTPS de produção.

## Entrega e ativação

Entregar código, testes e guia de configuração após revisão desta proposta e do plano de implementação. Manter autenticação desativada no site publicado até configurar e validar a instância de produção. Não afirmar que login está ativo na Vercel quando apenas a integração local estiver pronta.

Referência técnica: https://www.keycloak.org/securing-apps/javascript-adapter
