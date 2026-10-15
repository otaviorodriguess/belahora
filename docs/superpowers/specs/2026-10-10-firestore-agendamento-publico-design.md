# Banco Firebase e link de agendamento — desenho da solução

Data: 10/10/2026. Estado: desenho para revisão; implementação e publicação ainda não iniciadas.

## Objetivo aprovado na conversa

Cada conta terá uma agenda independente e um link próprio para enviar às clientes. A cliente não acessa a conta da profissional: escolhe serviço e horário, informa nome e telefone e recebe confirmação automática. Os agendamentos atuais devem ser preservados. A aplicação continuará hospedada no endereço atual da Vercel e funcionando com o notebook desligado.

Este documento detalha a proposta aprovada na conversa. Seus padrões de funcionamento abaixo serão revisados antes do plano de implementação.

## Experiência da profissional

- O login continua abrindo diretamente a agenda. A migração não reintroduz a tela de vinculação removida.
- Agendamentos, serviços, expediente, intervalo entre atendimentos e dados do espaço passam a ser armazenados por conta no Cloud Firestore.
- A agenda mostra quando está atualizada, em modo de consulta offline ou com migração pendente. Nunca apresenta uma falha de rede como uma agenda vazia.
- Configurações terá uma seção “Link de agendamento”, com copiar link, compartilhar pelo recurso nativo do aparelho e abrir a página para conferência. Não haverá envio automático de mensagens.
- O link só pode ser ativado após a primeira migração conferida. A profissional poderá pausar novas reservas sem apagar o link ou os atendimentos.
- Depois da mudança para a nuvem, criar, alterar, cancelar, restaurar backup e alterar configurações exige internet e confirmação do servidor. Os dados já carregados podem ser consultados offline. Não haverá fila invisível de reservas offline.

## Experiência da cliente

Página pública em `/agendar/{codigo}`, sem exigir cadastro ou instalar o PWA. O código será aleatório, estável e sem e-mail ou UID na URL.

Fluxo: nome do espaço e profissional → um serviço ativo → dia e horário livre → nome e telefone com DDD → revisão → confirmação automática com serviço, data, horário e valor. O primeiro escopo permite um serviço por reserva pública; a agenda interna mantém os recursos atuais de múltiplos serviços.

Padrões iniciais: fuso America/Sao_Paulo; próximos 60 dias; antecedência mínima de duas horas; sugestões de início a cada 15 minutos, respeitando expediente, duração e intervalo configurados. Valores são informativos, sem pagamento online. Esses padrões ficam centralizados para futura configuração.

Se o horário for ocupado durante o preenchimento, a cliente recebe uma mensagem e novos horários; os campos preenchidos permanecem. Só mostramos “Agendamento confirmado” depois da resposta de gravação do servidor. Em falha de conexão, permitimos repetir a mesma solicitação sem gerar outra reserva.

Não entram nesta entrega: equipe compartilhada, pagamentos, lembretes por e-mail/WhatsApp, cancelamento público, área de clientes, verificação de telefone por SMS ou gestão de múltiplas profissionais numa conta. A profissional altera ou cancela o atendimento pela agenda interna.

## Arquitetura escolhida

Manter React/Vite e Firebase Authentication. Adicionar Cloud Firestore como fonte central dos dados e funções de servidor na Vercel para operações de gravação e consultas públicas.

Alternativas consideradas: gravação pública direta pelo navegador exigiria regras e transações mais difíceis de proteger, especialmente com dados privados e limites de abuso; Cloud Functions acrescentaria outra superfície de implantação e requisitos de plano. A proposta usa o servidor da Vercel já associado ao projeto e o Admin SDK exclusivamente nesse servidor.

Separação de responsabilidades:

1. Repositório local existente: leitura do legado, backup de recuperação e origem da migração. Não apagar ou reutilizar suas chaves para outro formato.
2. Repositório remoto: leituras autenticadas por conta, atualização da interface e cache separado por conta para consulta offline.
3. Serviço de agenda no servidor: autorização, validação, controle de concorrência e gravações atômicas; reutilizado pelas reservas públicas e pelas operações internas.
4. Serviço de migração: importação reiniciável, identificação de duplicatas e reconciliação sem sobrescritas silenciosas.
5. Página pública e painel do link: interfaces separadas da área autenticada, reutilizando o estilo visual atual.

Revisar a regra atual da Vercel que encaminha todas as URLs para index.html, mantendo `/api/*` disponível para as funções. O service worker não deve armazenar respostas de reserva nem tratar respostas antigas de disponibilidade como confirmação atual.

## Organização dos dados

- `accounts/{uid}`: configuração privada, revisão da configuração, estado da migração e do agendamento público.
- `accounts/{uid}/appointments/{id}`: dados privados da cliente, serviço e valor registrados no momento da reserva, início/fim, origem, revisão e timestamps do servidor. Cancelamento mantém um registro marcado, em vez de permitir que uma importação antiga ressuscite o atendimento.
- `accounts/{uid}/days/{YYYY-MM-DD}`: índice privado de intervalos ocupados com IDs dos atendimentos e revisão. Não contém nomes nem telefones. É o documento de coordenação das transações do dia.
- `bookingLinks/{codigo}`: associação ao proprietário e situação do link; leitura pelo servidor. A resposta pública expõe somente nome público do espaço/profissional, serviços ativos e opções de horários.
- `accounts/{uid}/operations/{chave}`: idempotência e resumo de operações concluídas.
- `accounts/{uid}/imports/{lote}`: resumo verificável da importação e situação de cada item problemático.

As regras do Firestore permitem à conta ler somente os seus dados privados e proíbem gravação direta pelo cliente. Coleções auxiliares e consultas públicas passam pelo servidor. O Admin SDK ignora essas regras; por isso toda função verifica explicitamente proprietário, parâmetros e permissões. O UID da operação interna vem do token Firebase validado, nunca do corpo enviado pelo navegador.

## Reserva sem duplicidade

Toda criação, reagendamento ou cancelamento usa o mesmo serviço e transação Firestore. A transação lê a configuração e os índices dos dias envolvidos, valida o intervalo e grava atendimento, ocupação e resultado da operação de forma atômica. Reagendamento retira o intervalo antigo e insere o novo dentro da mesma transação, inclusive entre dias diferentes.

Preço, duração, fim do atendimento e situação do serviço são calculados pelo servidor; o navegador público não pode escolhê-los livremente. A consulta de disponibilidade é apenas uma sugestão: a transação refaz a validação. Alterações concorrentes da configuração ou do dia forçam nova avaliação.

As edições internas incluem a revisão que a profissional viu, evitando sobrescrever uma alteração feita em outro aparelho. Cliques repetidos e retries usam uma chave aleatória por operação, vinculada ao corpo normalizado; reutilização com outro conteúdo é rejeitada. Um resultado já concluído é retornado sem criar outro atendimento.

O índice diário terá validação de tamanho antes da gravação. Ao atingir o limite seguro, novas gravações são recusadas com explicação, nunca truncadas. Reservas além da meia-noite continuam fora do escopo, como na validação atual.

## Migração e proteção da agenda atual

1. Ler a agenda local da conta e produzir uma cópia imutável de recuperação, com possibilidade de exportar arquivo. Manter intacto também o registro legado original.
2. Importar primeiro as configurações para uma conta remota nova. Configuração já existente na nuvem não será substituída automaticamente por outro aparelho.
3. Enviar registros em lotes limitados e reiniciáveis, preservando IDs e conteúdo. Gravar atendimentos e ocupação pelos mesmos controles de concorrência. Não usar apenas a quantidade de registros como prova de integridade: conferir IDs e conteúdo normalizado.
4. Se um ID já existe com conteúdo equivalente, reconhecer como já importado. Se o conteúdo diverge ou conflita com outra reserva, preservar a versão local em um registro privado de recuperação e pedir resolução nas configurações; não sobrescrever nem descartar silenciosamente.
5. Dados antigos fora das regras atuais continuam preservados. A importação não exige que datas históricas respeitem a antecedência do agendamento público. Problemas de formato ou sobreposições existentes são registrados para conferência, sem exclusão.
6. O link permanece inativo enquanto houver inconsistências iniciais que impeçam calcular disponibilidade. Após conferência, a profissional ativa o link e confirma que os aparelhos usados foram atualizados e conciliados. O login continua sem uma etapa obrigatória de confirmação.
7. Outros aparelhos podem apresentar agendas locais adicionais. Dados iguais não duplicam; dados diferentes são reconciliados. Uma importação tardia nunca substitui uma reserva já confirmada pela nuvem.

Uma instalação antiga ainda offline pode continuar criando dados que o servidor desconhece. Não há garantia técnica de disponibilidade global enquanto essa versão continua em uso. A ativação orientará atualizar os aparelhos; somente operações confirmadas pelo servidor participam da garantia contra reservas simultâneas.

Backup continua disponível. Restauração na nuvem será uma importação com conferência e resolução de conflitos, sem o comportamento anterior de substituir toda a agenda por um arquivo. Cancelamentos já registrados não são desfeitos automaticamente pela restauração.

## Segurança e operação

Clientes não podem consultar nomes, telefones, observações, registros privados ou listas de reservas. Endpoints públicos retornam campos explicitamente permitidos. As respostas privadas e de confirmação não entram em caches compartilhados; logs não registram corpos contendo dados de clientes, credenciais ou tokens.

Reservas públicas usam App Check validado pelo servidor e limites persistentes de tentativa por origem e link, com limites separados para consultas e gravações. Não usar contador em memória de uma função como proteção principal. Restringir tamanho de requisições, intervalos de datas, campos e frequência. App Check reduz abuso, mas não comprova a identidade da cliente; sem SMS, nome e telefone são autodeclarados.

Pré-requisitos antes de publicar: criar Firestore no projeto belahora, escolher localização adequada aos usuários no Brasil após verificar disponibilidade/custos, configurar credencial de servidor somente no ambiente seguro da Vercel, publicar regras e índices, configurar App Check nos domínios e validar limites dos planos Firebase/Vercel. Chaves privadas jamais terão prefixo VITE_ nem entrarão no repositório ou no chat. Não assumir custo zero nem habilitar cobrança sem autorização.

Falhas de permissão, cota ou rede preservam o cache e explicam o problema. A interface distingue dados locais, importação pendente e confirmação remota. Nunca declarar sincronização bem-sucedida apenas porque o cache foi atualizado.

## Implantação e recuperação

Introduzir a integração atrás de uma configuração, mantendo o mesmo domínio e identidade do PWA. Validar primeiro em ambiente de teste e conta de teste; nenhuma agenda real é usada para testes destrutivos.

Ativar banco e migração antes de disponibilizar o link público. Guardar uma versão de recuperação compatível com a leitura dos dados remotos. Depois de receber reservas públicas, não reverter simplesmente para uma versão que conhece somente o banco local: em incidente, pausar novas reservas e preservar o acesso aos dados remotos e backups.

## Critérios de aceite

- Uma conta não consegue acessar ou gravar na agenda de outra; visitante não lê dados privados.
- Link abre sem login, lista serviços e horários e confirma uma reserva que aparece na agenda correta.
- Duas reservas concorrentes conflitantes resultam em uma confirmação; dupla submissão gera um único registro.
- Edição, cancelamento e alteração de serviço respeitam revisões, ocupação e configurações do servidor.
- Atualização real do PWA conserva o agendamento existente e a migração mantém cópia local verificável.
- Interrupção e retomada da migração não duplicam nem perdem registros; divergências de outro aparelho ficam visíveis.
- Sem internet, consulta usa cache da conta correta; gravação não produz confirmação falsa. Sair e trocar de conta não expõe o cache anterior.
- Testar regras, concorrência e migração com emuladores; testar página pública e fluxo autenticado no navegador, celular e desktop; executar build e lint antes da publicação.

## Referências técnicas

- Transações atômicas e limites offline: https://firebase.google.com/docs/firestore/manage-data/transactions
- Credenciais e Admin SDK no servidor: https://firebase.google.com/docs/admin/setup
- Verificação de App Check no backend: https://firebase.google.com/docs/app-check/custom-resource-backend

Próxima etapa após aprovação deste documento: plano de implementação com etapas verificáveis. Não foi criado commit porque o Git ancestral deste workspace abrange o perfil inteiro do Windows; manter os artefatos apenas nesta pasta até haver um repositório dedicado.
