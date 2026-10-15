# Ativação do banco e do link de agendamento

Atualização em 12/10/2026: Firestore `(default)` criado em São Paulo e regras de leitura por proprietário publicadas. Firebase CLI autenticado. Credencial do servidor, segredo do limitador e App Check reCAPTCHA v3 configurados na Vercel. A validação com Firebase real confirmou catálogo inicialmente vazio, criação sem duplicação, leitura em duas sessões independentes, atualização em tempo real, cancelamento e isolamento entre contas. Consulte `work/firestore-progress.md` para o registro da publicação final.

O servidor usa a conta de serviço `belahora-vercel`, com os papéis `roles/datastore.user` e `roles/firebaseauth.viewer`. A chave privada foi transmitida diretamente ao armazenamento de secrets da Vercel, sem arquivo no repositório. Não foi associado faturamento nem alterado o plano Spark.

Os imports do servidor usam extensões `.js` e são verificados com resolução NodeNext. O teste `npm run test:server:runtime` carrega as APIs compiladas em Node sem `require(esm)`, reproduzindo a restrição da Vercel. Há override restrito de `jwks-rsa → jose@5.10.0` para contornar a [incompatibilidade documentada do Firebase Admin 14 na Vercel](https://github.com/firebase/firebase-admin-node/issues/3181); não altera outras dependências de `jose`.

Contas novas começam com `services: []` e cadastram o catálogo em Configurações → Serviços e preços → Adicionar serviço → Salvar serviços. Agendas já salvas e migrações legadas preservam seus serviços. A alteração não limpa nem reescreve o catálogo da conta existente.

Se um aparelho novo inicializar a nuvem antes do antigo, o catálogo antigo é adotado apenas enquanto as configurações remotas continuam na revisão inicial e sem serviços. Configurações já editadas na nuvem nunca são sobrescritas. Cada lote também preserva uma cópia das configurações recebidas.

## 1. Banco no projeto correto

No console Firebase, abra **belahora → Firestore Database → Criar banco**. Use **Standard**, banco **(default)** e **modo de produção**. Para o público no Brasil, considere `southamerica-east1` (São Paulo); confirme a região antes de criar, pois a localização é permanente. Não crie outro projeto nem altere `.firebaserc`, que aponta intencionalmente para o ambiente demo de testes.

Documentação: [criação do Firestore](https://firebase.google.com/docs/firestore/quickstart), [localizações](https://firebase.google.com/docs/firestore/locations).

Após autenticação interativa pelo próprio administrador:

```powershell
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project belahora
```

As regras permitem apenas leituras da própria conta autenticada. Gravações passam pelos handlers de servidor; o público recebe somente catálogo, horários livres e comprovante sem nome/telefone. Não abra as regras para leitura/gravação pública.

## 2. Servidor da Vercel

Cadastre variáveis nos ambientes apropriados do projeto Vercel:

| Variável | Conteúdo |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Credencial Admin do projeto belahora, somente servidor |
| `BOOKING_RATE_SECRET` | Segredo aleatório longo para HMAC do limitador |
| `VITE_AUTH_ENABLED` | `true` |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | Configuração Web já usada pelo login |
| `VITE_CLOUD_AGENDA_ENABLED` | `true` somente na etapa de validação/ativação |
| `VITE_PUBLIC_BOOKING_ORIGIN` | Origem exata onde o link será aberto |
| `VITE_APPCHECK_SITE_KEY` | Chave pública do site reCAPTCHA v3 registrado no App Check |

Não cole credenciais privadas no chat, repositório, arquivos públicos ou variáveis `VITE_*`. Configure pelo painel seguro da Vercel. O JSON Admin precisa permitir acesso ao Firestore e verificação do estado do usuário Firebase Auth. Não configure variáveis de emulador na Vercel.

Os handlers são `api/agenda.ts` e `api/booking.ts`. O rewrite de `/agendar/*` serve o PWA sem capturar `/api/*`. As respostas da API usam `no-store`, e o service worker exclui navegação de API.

## 3. App Check

Registre o aplicativo Web com reCAPTCHA v3 no Firebase App Check, incluindo os domínios de produção e de validação no cadastro do site. Coloque a chave pública em `VITE_APPCHECK_SITE_KEY` e a chave secreta no console correspondente, nunca no cliente. Consulte [a configuração oficial](https://firebase.google.com/docs/app-check/web/recaptcha-provider).

A API pública exige token App Check real. O token do teste só é aceito no harness local/demo; não há bypass no handler de produção. Nesta implementação, o App Check é inicializado na página pública. Não ative enforcement global do Firestore antes de integrar/verificar App Check também no painel privado.

## 4. Migração e ativação por conta

1. Exporte backup em **cada aparelho que contém agenda local** e guarde os arquivos.
2. Valide o deploy de teste com conta e dados de teste, banco/regras/credenciais reais, App Check e endpoints Vercel. Teste login, criação, reagendamento, cancelamento e reserva anônima. Nunca use dados da conta real para criar reservas de teste.
3. Publique mantendo o domínio original `agenda-estetica-phi.vercel.app`. A importação ocorre ao entrar na conta; a base local original e uma cópia imutável são preservadas.
4. Aguarde a conclusão da importação. Diferenças ficam em **Configurações → Conferência da agenda**. É possível manter a versão remota e preservar a antiga ou corrigir a cópia em outro horário.
5. Abra a mesma conta nos outros aparelhos atualizados e concilie as agendas antes de ativar o link. Somente então marque a conferência e ative em **Link de agendamento**.
6. Copie/compartilhe o link. Reservas confirmadas entram automaticamente na conta correspondente. O notebook pode ficar desligado: Vercel e Firebase executam os serviços hospedados.

O link aceita um serviço, slots de 15 minutos, antecedência mínima de duas horas e horizonte de 60 dias, em São Paulo. O servidor verifica disponibilidade novamente na confirmação e mantém o resultado de retries do mesmo pedido. A agenda em nuvem permite consulta offline do cache; alterações exigem internet.

## Recuperação

- **Importação interrompida:** reconecte e recarregue no aparelho que iniciou. O lote ativo é retomado da cópia imutável. Em outro aparelho, selecione novamente o mesmo arquivo de backup. Não inicie um backup diferente enquanto houver lote pendente.
- **Conflitos:** resolva em Configurações e conclua a conferência. Importações pausam o link; sua reativação é explícita.
- **Falha de rede:** um cache existente continua disponível. Sem dados carregados, o app informa indisponibilidade; não apresenta uma agenda vazia como se estivesse sincronizada.
- **Cancelamentos:** tombstones impedem que uma importação antiga ressuscite atendimentos cancelados. A cópia antiga é preservada como pendência.
- **Rollback após ativação:** pause os links e use uma versão que já leia Firestore. Voltar ao app exclusivamente local depois de receber reservas na nuvem ocultaria essas reservas. Preserve o deployment anterior para diagnóstico, não para retorno automático ao modo local.

Não é possível importar automaticamente dados que só existam num aparelho desligado ou em uma versão antiga ainda usada offline. Todos esses aparelhos precisam ser atualizados e conciliados. Não apague dados do navegador antes de exportar/verificar a migração.

## Custos e limites

Firestore tem cotas gratuitas, mas leituras, gravações, armazenamento e tráfego consomem quota. As consultas e o limitador também consomem operações. Monitorar Firebase e Vercel faz parte da operação. Não foi autorizado nem habilitado upgrade de plano. Consulte [preços e cotas atuais](https://firebase.google.com/docs/firestore/pricing) antes de qualquer mudança de cobrança.

TTL de exclusão exige faturamento e não está ativado no arquivo de índices padrão. `_limits.expiresAt` indica expiração lógica, porém documentos antigos continuam ocupando espaço até limpeza administrativa ou ativação futura de TTL autorizada. Não apagar operações de idempotência, imports ou tombstones como se fossem contadores temporários.

Backups aceitam até 10 MB/20.000 registros; os testes de retomada cobrem 51 registros, não a carga máxima. Há limites adicionais de transação/documento do Firestore; importações grandes precisam de ensaio antes da ativação. O bundle atual também gera aviso de tamanho no build.

## Testes locais

Requisitos: Node compatível, Chrome e Java 21. No PowerShell, se o Java falhar por diretório temporário abreviado do Windows:

```powershell
$env:JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=$((Resolve-Path work).Path)"
npm run test:cloud
npm run test:booking
npm run test:auth:pwa
npm run test:local
```

Execute as suítes de emulador em sequência, pois compartilham portas. Os testes usam somente `demo-belahora`, Auth 9099 e Firestore 8080. O harness de API usa porta 4181 e recusa execução na Vercel.
