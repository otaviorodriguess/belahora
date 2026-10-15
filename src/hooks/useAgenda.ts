import { useContext } from 'react';
import { AgendaContext } from '../contexts/AgendaContext';
export function useAgenda() {
  const context = useContext(AgendaContext);
  if (!context) throw new Error('AgendaProvider ausente.');
  return context;
}
