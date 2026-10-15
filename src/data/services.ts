import type { Service } from '../types';
// Durações em minutos. Ajuste livremente para a rotina do espaço.
export const services: Service[] = [
  { id: 'limpeza-pele', nome: 'Limpeza de pele', preco: 100, duracao: 60 },
  { id: 'dermaplaning', nome: 'Dermaplaning', preco: 80, duracao: 45 },
  { id: 'lash-lifting', nome: 'Lash lifting', preco: 90, duracao: 60 },
  { id: 'brow-lamination', nome: 'Brow lamination', preco: 90, duracao: 60 },
  { id: 'designer-personalizado', nome: 'Designer personalizado', preco: 25, duracao: 30 },
  { id: 'designer-henna', nome: 'Designer com henna', preco: 40, duracao: 45 },
  {
    id: 'designer-coloracao',
    nome: 'Designer de sobrancelha com coloração',
    preco: 50,
    duracao: 45,
  },
  { id: 'epilacao-buco', nome: 'Epilação do buço', preco: 10, duracao: 15 },
  { id: 'epilacao-rosto', nome: 'Epilação do rosto', preco: 20, duracao: 30 },
  { id: 'epilacao-perna', nome: 'Epilação perna inteira', preco: 60, duracao: 60 },
  { id: 'epilacao-meia-perna', nome: 'Epilação meia perna', preco: 40, duracao: 30 },
  { id: 'epilacao-axila', nome: 'Epilação axila', preco: 25, duracao: 20 },
  { id: 'epilacao-nariz', nome: 'Epilação nariz', preco: 20, duracao: 15 },
  { id: 'micropigmentacao', nome: 'Micropigmentação de sobrancelha', preco: 350, duracao: 120 },
];
export const serviceName = (id: string, ids?: string[], names?: string[]) =>
  (ids?.length ? ids : [id])
    .map((value, index) => names?.[index] ?? services.find((s) => s.id === value)?.nome ?? value)
    .join(' + ');
