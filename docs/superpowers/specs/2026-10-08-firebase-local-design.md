# Firebase Authentication com agenda local

Proposta para revisão. Substitui a proposta anterior de Keycloak.

## Escopo confirmado

Login hospedado no Firebase, independente do notebook. Aplicativo React/Vite e PWA continuam na Vercel. Agendamentos e configurações permanecem no IndexedDB do aparelho, sem sincronização e sem Firestore. Atualizações devem preservar a agenda existente.

O projeto Firebase é `belahora`. A configuração web foi fornecida e salva em `.env.local`. As imagens do console confirmam E-mail/senha ativado e os domínios `localhost` e `agenda-estetica-phi.vercel.app` autorizados. Ainda não há integração de autenticação no código.

## Fluxo proposto

- Adicionar a dependência `firebase`, usando apenas os módulos de app e autenticação. Não inicializar Analytics.
- Tela de entrada com e-mail e senha, recuperação de senha e mensagens em português.
- Para esta agenda interna, não oferecer cadastro público na interface. As contas iniciais serão criadas pelo administrador no console Firebase. Isso não é uma barreira de autorização contra cadastro pela API; a separação das agendas não depende dessa restrição visual.
- Montar o AgendaProvider apenas depois de resolver a identidade e selecionar sua agenda local. Oferecer Sair nas configurações.
- Tratar inicialização, credenciais inválidas, rede indisponível e sessão inválida sem liberar automaticamente a agenda.
- Usar os mecanismos do SDK Firebase para gerenciar a sessão. Nunca salvar senhas nem implementar armazenamento manual de tokens.

## Preservação dos dados

- Manter o banco `aura-local-agenda` e a store `agenda`. Separar as agendas por projeto Firebase e UID estável, nunca por e-mail.
- Preservar a chave antiga `current`. No primeiro acesso autenticado, oferecer exportação e confirmação explícita para vincular a agenda antiga à conta exibida.
- Copiar os dados e registrar o proprietário da agenda antiga na mesma transação. Não sobrescrever uma agenda já existente e não permitir que outra conta reivindique a mesma agenda antiga.
- Permitir iniciar uma agenda vazia sem destruir a antiga. A vinculação posterior fica disponível para uma conta ainda vazia, mediante confirmação.
- Novas contas começam com configurações padrão; não herdam configurações ou cache legado de outra conta.
- Cada operação captura sua identidade. Desmontar e limpar o estado visual na saída ou troca de conta; ignorar resultados assíncronos de uma identidade anterior.
- Separar BroadcastChannel por conta. Exportação e restauração operam só na agenda ativa; restauração não sobrescreve o registro de proprietário da migração.
- Sair não apaga agendamentos. Entrar novamente na mesma conta, no mesmo aparelho e perfil, recupera sua agenda.

## Offline e persistência da sessão

Oferecer “Manter acesso neste aparelho” desmarcado por padrão. Quando selecionado, utilizar persistência local do Firebase e permitir continuar na agenda local com a identidade previamente restaurada, inclusive ao abrir sem conexão. Sem essa opção, usar persistência em memória; fechar ou recarregar exige novo login.

Mostrar que manter acesso é apropriado para aparelho pessoal: outra pessoa que abra o mesmo PWA poderá acessar a conta mantida. Login inicial e recuperação de senha exigem internet. A sessão restaurada offline não equivale a validação atual no servidor.

Sair limpa a sessão persistida e bloqueia outras abas dessa conta, sem apagar a agenda. Uma revogação ou conta desativada conhecida online bloqueia o acesso normal; falha de rede não deve ser apresentada como senha incorreta. Revogações não podem ser detectadas enquanto o aparelho estiver offline. Não descartar um formulário em andamento silenciosamente durante falha transitória de rede.

Firebase não criptografa os agendamentos locais. A separação de contas protege o fluxo normal da interface, não o armazenamento contra alguém que controla o perfil do navegador.

## Configuração e publicação

Usar variáveis `VITE_FIREBASE_*` para a configuração web pública já fornecida. Nunca colocar chave de conta de serviço ou credenciais administrativas no frontend.

A ativação do login será explícita. Se ativado com configuração incompleta, exibir erro e não abrir a agenda. Durante o desenvolvimento, o modo local legado continua disponível explicitamente para verificar regressões; desativar autenticação não deve exibir agendas vinculadas a contas.

Documentar variáveis da Vercel e configurar os testes locais em `localhost`, que está autorizado. Não habilitar automaticamente em produção nem afirmar publicação concluída antes do deploy e da validação.

O service worker continua cacheando os arquivos do aplicativo, sem cache de requisições de autenticação. Preservar o endereço, manifest ID e banco atuais do PWA.

## Verificação

Testar login, recuperação, saída, persistência escolhida e erros com Firebase Auth Emulator quando disponível. Não criar contas ou enviar e-mails reais como efeito de testes automáticos.

Testar separação de duas contas, troca durante operação assíncrona, saída entre abas, migração concorrente e falha transacional sem perda da agenda antiga. Verificar backup/restauração por conta e ausência de herança de configurações legadas.

Executar lint, testes unitários, build e testes de navegador de CRUD, conflitos, migração, offline e atualização do PWA. Login real com Firebase hospedado exige uma conta de teste autorizada e deve ser reportado separadamente dos testes simulados.

## Próxima etapa

Após revisão desta proposta, escrever o plano de implementação e apresentar sua execução para revisão, conforme o fluxo de planejamento adotado. Nenhum servidor Keycloak será instalado.
