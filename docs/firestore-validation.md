# Validação de produção — 14/10/2026

Publicado em https://agenda-estetica-phi.vercel.app, deployment `dpl_5GBmSQHYaJQBAKrLCpaaUmwKhaST`, Ready, nuvem ativada. Firebase Admin, regras por proprietário e App Check configurados; APIs reCAPTCHA e Firebase App Check habilitadas. Sem associação de faturamento.

Verificação hospedada em conta técnica: catálogo inicial vazio, criação idempotente, leitura em segundo cliente Firebase independente, edição recebida pelo listener, cancelamento sincronizado e leitura de outra conta negada. Reserva anônima pelo navegador com App Check real confirmada e lida na conta proprietária. Evidência visual: `work/booking-production-confirmed.png`.

Regressões finais: 41 testes unitários, 10 testes de servidor, cenário completo de booking, 16 Auth/PWA e 12 locais passaram. Lint, build, TypeScript de servidor e importação dos handlers compilados em Node nativo passaram. Auditoria de dependências de produção: zero vulnerabilidades. Corrigidos imports ESM, compatibilidade transitiva jwks-rsa/jose e preservação do catálogo antigo quando outro aparelho inicializa a conta primeiro.

Os dados do aparelho real da Maria não foram inspecionados. A importação dos registros que ainda estão somente nesse aparelho depende de abrir o aplicativo atualizado nele, conectado à internet. A validação não substitui um ensaio de atualização em Android/iOS físico.

## Histórico: validação local — 10/10/2026

Implementação do plano de Firestore/agendamento público aprovada para execução inline. Não houve deploy ou alteração de dados de produção. O Git ancestral cobre o perfil Windows; a cópia de recuperação está em `work/firestore-original`, sem commits abrangendo o perfil.

## Evidências

| Verificação | Resultado observado |
| --- | --- |
| Vitest de domínio/cache/migração e regressões existentes | 40 testes passaram |
| Emuladores Auth + Firestore | 9 testes passaram em 5 arquivos |
| Fluxo completo do link (Playwright, emuladores) | 1 cenário passou, com múltiplos contextos/aparelhos |
| Auth + PWA compilado | 15 testes passaram |
| Agenda local compilada | 12 testes passaram |
| Lint e TypeScript de servidor | Sem erros |
| Build de produção | Concluído, com aviso de bundle acima de 500 kB |
| Auditoria das dependências de produção | Zero vulnerabilidades no relatório `work/firestore-audit.json` |

Os testes de servidor cobrem 20 pedidos concorrentes para um horário com apenas um vencedor, idempotência, revisão obsoleta, reagendamento, tombstone, limites persistentes, isolamento por UID, bloqueio de gravações diretas, importação repetida, correção de registro antigo, conteúdo público sem PII e comprovante recuperável após pausar o link.

O cenário do navegador migrou um atendimento legado, ativou um link, reservou anonimamente em contexto com fuso de Tóquio, conferiu os dados no proprietário e em outro aparelho, testou consulta offline, bloqueou Firestore num contexto sem cache e retomou um backup de 51 registros interrompido após o primeiro lote. As capturas mobile/desktop foram inspecionadas em `work/booking-mobile.png` e `work/booking-owner-desktop.png`.

O teste de atualização real do service worker cobre a versão local histórica para a versão autenticada. A migração para nuvem foi testada separadamente com fixture IndexedDB no servidor de desenvolvimento. Não é um ensaio completo de atualização de um PWA publicado diretamente para nuvem real.

## Revisão independente e correções

A revisão independente encontrou quatro itens, corrigidos antes da ativação:

1. Restauração interrompida bloqueava gravações sem caminho de retomada. O boot agora retoma o lote ativo da cópia imutável; reenvio do mesmo backup é permitido durante migração pendente.
2. `etag` gerava conflito artificial em backup idêntico. A comparação semântica o ignora; o hash integral e a cópia original continuam preservados.
3. Snapshot vazio recém-criado podia aparecer como agenda carregada numa falha de rede. O provider não o trata como dados disponíveis e a tela aguarda carregamento real.
4. Pausar o link impedia recuperar uma confirmação já concluída. A transação consulta o pedido anterior antes de validar novas reservas; novos pedidos continuam bloqueados.

Os dois defeitos de servidor foram reproduzidos em testes falhando e passaram após a correção. A ausência da retomada foi reproduzida em teste unitário e o caminho real foi exercitado no navegador. O teste de indisponibilidade inicialmente mostrou a agenda como disponível sem dados remotos; passou após ajuste do provider e da tela.

Na regressão local, Playwright tentou coletar novos arquivos Vitest (`tests/server/*.test.ts`). A configuração passou a selecionar apenas specs de navegador e excluir os cenários que exigem emuladores. Depois da correção, os 12 testes locais passaram.

## Decisões e pendências

- Flag de nuvem continua desligada. Produção não foi publicada nem validada nesta etapa.
- Usuário informou que ainda não criou Firestore. CLI Firebase sem autenticação (`Failed to authenticate` na tentativa de listar bancos de belahora).
- Faltam banco, regras publicadas, credencial Admin segura na Vercel, segredo do limitador, App Check real e validação hospedada com conta de teste.
- TTL foi removido do arquivo de índices padrão para não exigir habilitação de faturamento. Expiração lógica permanece; limpeza física de contadores exige operação administrativa ou TTL futuramente autorizado.
- Nenhum teste de carga com 20.000 registros foi executado. Os máximos de arquivo não garantem que toda importação caiba em limites operacionais da plataforma.
- Existem avisos no ferramental de desenvolvimento e aviso de tamanho do bundle. O relatório de auditoria citado acima se refere às dependências de produção.
- A política de rollback precisa manter leitura Firestore após receber reservas reais; não retornar silenciosamente à agenda exclusivamente local.
- Ver procedimento em [firestore-deployment.md](firestore-deployment.md).

Limpeza final de produção (14/10): conta técnica, documentos de teste e credencial temporária removidos. Verificação independente confirmou somente a conta original da Maria no Firebase Auth e ausência dos documentos de conta/link do teste.
