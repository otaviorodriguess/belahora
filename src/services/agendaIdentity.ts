export type AgendaScope = { kind: 'legacy' } | { kind: 'account'; projectId: string; uid: string };
export function agendaKey(scope: AgendaScope): string {
  if (scope.kind === 'legacy') return 'current';
  if (!scope.projectId || !scope.uid) throw new Error('Conta inválida para abrir a agenda.');
  return JSON.stringify(['account', scope.projectId, scope.uid]);
}
