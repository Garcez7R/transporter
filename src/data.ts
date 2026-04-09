import type { DemoUser, FleetMember, MessageItem, ProfileSummary, TripRequest } from './types';

export const demoUsers: DemoUser[] = [
  { name: 'Ana Lúcia Pereira', document: '12345678909', role: 'cliente', pin: '0000', mustChangePin: true },
  { name: 'Equipe Atendimento', document: '11111111111', role: 'operador', pin: '0000', mustChangePin: true },
  { name: 'Logística Norte', document: '22222222222', role: 'gerente', pin: '0000', mustChangePin: true },
  { name: 'Carlos Mendes', document: '33333333333', role: 'motorista', pin: '0000', mustChangePin: true },
  { name: 'Admin Central', document: '96820373015', role: 'administrador', pin: '0000', mustChangePin: true }
];

export const profiles: ProfileSummary[] = [
  {
    role: 'cliente',
    label: 'Paciente',
    count: 18,
    highlight: 'Agenda pública',
    description: 'Consulta por CPF + PIN com confirmação e mensagens'
  },
  {
    role: 'operador',
    label: 'Operador',
    count: 7,
    highlight: 'Triagem e protocolo',
    description: 'Cadastro rápido com reaproveitamento de pacientes'
  },
  {
    role: 'gerente',
    label: 'Gerente',
    count: 12,
    highlight: 'Distribuição',
    description: 'Atribuição de motorista, veículo e janela operacional'
  },
  {
    role: 'motorista',
    label: 'Motorista',
    count: 24,
    highlight: 'PWA mobile',
    description: 'Agenda diária, rota, contato e mensagens operacionais'
  },
  {
    role: 'administrador',
    label: 'Administrador',
    count: 3,
    highlight: 'Governança',
    description: 'Acesso total, credenciais e estrutura institucional'
  }
];

const sharedMessages: MessageItem[] = [
  {
    id: 'msg-1',
    author: 'Equipe Transporte',
    role: 'sistema',
    body: 'Agenda publicada e aguardando confirmação do paciente.',
    at: '08/04/2026 05:55',
    internal: false
  },
  {
    id: 'msg-2',
    author: 'Ana Lúcia Pereira',
    role: 'cliente',
    body: 'Confirmei o recebimento, obrigado pelo envio.',
    at: '08/04/2026 06:10',
    internal: false
  }
];

const sharedAudit = [
  { id: 'audit-1', label: 'Solicitação criada pelo operador', at: '08/04/2026 05:42' },
  { id: 'audit-2', label: 'PIN inicial emitido com acesso temporário', at: '08/04/2026 05:43' }
];

export const activeTrips: TripRequest[] = [
  {
    id: '1',
    protocol: 'TRP-2026-00481',
    clientName: 'Ana Lúcia Pereira',
    document: '12345678909',
    phone: '+55 11 99999-1000',
    destination: 'Aeroporto Internacional',
    boardingPoint: 'Av. Paulista, 1000',
    departureAt: '08/04/2026 06:40',
    arrivalEta: '08/04/2026 08:05',
    status: 'agendada',
    driver: 'Carlos Mendes',
    vehicle: 'Sprinter BRG-4A12',
    notes: 'Paciente com mala pequena e embarque rápido.',
    companions: '1 acompanhante',
    phoneVisible: true,
    pinStatus: 'active',
    clientConfirmedAt: '08/04/2026 06:10',
    messages: sharedMessages,
    audit: sharedAudit
  },
  {
    id: '2',
    protocol: 'TRP-2026-00477',
    clientName: 'Marcia Oliveira',
    document: '12345678901',
    phone: '+55 11 98888-2000',
    destination: 'Centro de Distribuição',
    boardingPoint: 'Rua do Porto, 245',
    departureAt: '08/04/2026 14:10',
    arrivalEta: '08/04/2026 15:15',
    status: 'aguardando_distribuicao',
    driver: '',
    vehicle: '',
    notes: 'Retorno agendado após consulta.',
    companions: 'Sem acompanhantes',
    phoneVisible: false,
    pinStatus: 'first_access',
    messages: [
      {
        id: 'msg-3',
        author: 'Equipe Operação',
        role: 'operador',
        body: 'Solicitação registrada e aguardando alocação.',
        at: '08/04/2026 08:25',
        internal: true
      }
    ],
    audit: [{ id: 'audit-3', label: 'Novo protocolo gerado', at: '08/04/2026 08:21' }]
  },
  {
    id: '3',
    protocol: 'TRP-2026-00463',
    clientName: 'João Batista Silva',
    document: '98765432142',
    phone: '+55 11 97777-3000',
    destination: 'Hospital Santa Clara',
    boardingPoint: 'Rua das Flores, 12',
    departureAt: '08/04/2026 19:20',
    arrivalEta: '08/04/2026 20:00',
    status: 'em_atendimento',
    driver: 'Marina Souza',
    vehicle: 'Onix Preto QWE-9D71',
    notes: 'Consulta marcada e retorno no mesmo dia.',
    companions: 'Sem acompanhantes',
    phoneVisible: true,
    pinStatus: 'reset',
    messages: [
      {
        id: 'msg-4',
        author: 'João Batista Silva',
        role: 'cliente',
        body: 'Poderiam confirmar o motorista designado?',
        at: '08/04/2026 09:15',
        internal: false
      }
    ],
    audit: [{ id: 'audit-4', label: 'Status alterado para em_atendimento', at: '08/04/2026 09:02' }]
  }
];

export const fleet: FleetMember[] = [
  { name: 'Carlos Mendes', role: 'Motorista', status: 'disponível', badge: 'PIN ativo' },
  { name: 'Marina Souza', role: 'Motorista', status: 'em_viagem', badge: 'Rota em andamento' },
  { name: 'Sprinter BRG-4A12', role: 'Veículo', status: 'disponível', badge: 'Preferencial' },
  { name: 'Onix Preto QWE-9D71', role: 'Veículo', status: 'manutenção', badge: 'Revisão agendada' }
];

export const flowSteps = [
  'Operador registra a solicitação com protocolo automático.',
  'Gerente distribui motorista, veículo e horários.',
  'Motorista recebe a agenda no celular com navegação e contato.',
  'Paciente acompanha, confirma recebimento e envia mensagens.',
  'Tudo fica auditado com histórico de mudanças e leitura.'
];

export const defaultRequestForm = {
  clientName: '',
  document: '',
  phone: '',
  destination: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  departureAt: '',
  arrivalEta: '',
  companions: '',
  notes: ''
};
