// Mock data for the dental clinic management system

export interface Patient {
  id: string;
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  commissionRate: number;
  phone: string;
  email: string;
  active: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  date: string;
  time: string;
  duration: number;
  procedure: string;
  status: 'confirmed' | 'cancelled' | 'attended' | 'missed';
  notes: string;
}

export interface Receivable {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  procedure: string;
  amount: number;
  paymentMethod: string;
  installments: number;
  status: 'open' | 'paid' | 'overdue';
  dueDate: string;
  paidDate?: string;
}

export interface Payable {
  id: string;
  supplier: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  status: 'open' | 'paid' | 'overdue';
  paidDate?: string;
}

export interface ClinicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  date: string;
  description: string;
  attachments: string[];
}

export const mockProfessionals: Professional[] = [
  { id: '1', name: 'Dra. Ana Silva', specialty: 'Ortodontia', commissionRate: 40, phone: '(11) 99999-0001', email: 'ana@clinica.com', active: true },
  { id: '2', name: 'Dr. Carlos Mendes', specialty: 'Implantodontia', commissionRate: 45, phone: '(11) 99999-0002', email: 'carlos@clinica.com', active: true },
  { id: '3', name: 'Dra. Beatriz Rocha', specialty: 'Endodontia', commissionRate: 40, phone: '(11) 99999-0003', email: 'beatriz@clinica.com', active: true },
  { id: '4', name: 'Dr. Fernando Lima', specialty: 'Periodontia', commissionRate: 35, phone: '(11) 99999-0004', email: 'fernando@clinica.com', active: false },
];

export const mockPatients: Patient[] = [
  { id: '1', name: 'Maria Oliveira', cpf: '123.456.789-00', birthDate: '1985-03-15', phone: '(11) 98765-4321', email: 'maria@email.com', address: 'Rua das Flores, 123 - São Paulo/SP', notes: 'Alergia a penicilina', createdAt: '2024-01-10' },
  { id: '2', name: 'João Santos', cpf: '987.654.321-00', birthDate: '1990-07-22', phone: '(11) 91234-5678', email: 'joao@email.com', address: 'Av. Paulista, 456 - São Paulo/SP', notes: '', createdAt: '2024-02-05' },
  { id: '3', name: 'Ana Costa', cpf: '456.789.123-00', birthDate: '1978-11-30', phone: '(11) 94567-8901', email: 'ana.costa@email.com', address: 'Rua Augusta, 789 - São Paulo/SP', notes: 'Paciente ansioso', createdAt: '2024-03-12' },
  { id: '4', name: 'Pedro Almeida', cpf: '321.654.987-00', birthDate: '1995-05-08', phone: '(11) 97890-1234', email: 'pedro@email.com', address: 'Rua Oscar Freire, 321 - São Paulo/SP', notes: '', createdAt: '2024-04-18' },
  { id: '5', name: 'Lucia Ferreira', cpf: '654.321.987-00', birthDate: '1982-09-25', phone: '(11) 93456-7890', email: 'lucia@email.com', address: 'Rua Haddock Lobo, 654 - São Paulo/SP', notes: 'Diabetes tipo 2', createdAt: '2024-05-01' },
  { id: '6', name: 'Roberto Souza', cpf: '789.123.456-00', birthDate: '1970-01-12', phone: '(11) 92345-6789', email: 'roberto@email.com', address: 'Av. Rebouças, 987 - São Paulo/SP', notes: '', createdAt: '2024-06-22' },
];

export const mockAppointments: Appointment[] = [
  { id: '1', patientId: '1', patientName: 'Maria Oliveira', professionalId: '1', professionalName: 'Dra. Ana Silva', date: '2026-03-04', time: '08:00', duration: 60, procedure: 'Manutenção ortodôntica', status: 'confirmed', notes: '' },
  { id: '2', patientId: '2', patientName: 'João Santos', professionalId: '2', professionalName: 'Dr. Carlos Mendes', date: '2026-03-04', time: '09:00', duration: 90, procedure: 'Implante unitário', status: 'confirmed', notes: 'Trazer exames' },
  { id: '3', patientId: '3', patientName: 'Ana Costa', professionalId: '1', professionalName: 'Dra. Ana Silva', date: '2026-03-04', time: '10:00', duration: 30, procedure: 'Consulta avaliação', status: 'attended', notes: '' },
  { id: '4', patientId: '4', patientName: 'Pedro Almeida', professionalId: '3', professionalName: 'Dra. Beatriz Rocha', date: '2026-03-04', time: '11:00', duration: 60, procedure: 'Tratamento de canal', status: 'missed', notes: '' },
  { id: '5', patientId: '5', patientName: 'Lucia Ferreira', professionalId: '2', professionalName: 'Dr. Carlos Mendes', date: '2026-03-04', time: '14:00', duration: 45, procedure: 'Prótese sobre implante', status: 'confirmed', notes: '' },
  { id: '6', patientId: '6', patientName: 'Roberto Souza', professionalId: '1', professionalName: 'Dra. Ana Silva', date: '2026-03-05', time: '08:00', duration: 30, procedure: 'Limpeza', status: 'confirmed', notes: '' },
  { id: '7', patientId: '1', patientName: 'Maria Oliveira', professionalId: '3', professionalName: 'Dra. Beatriz Rocha', date: '2026-03-05', time: '10:00', duration: 60, procedure: 'Restauração', status: 'cancelled', notes: 'Paciente remarcou' },
];

export const mockReceivables: Receivable[] = [
  { id: '1', patientId: '1', patientName: 'Maria Oliveira', professionalId: '1', professionalName: 'Dra. Ana Silva', procedure: 'Manutenção ortodôntica', amount: 350, paymentMethod: 'Cartão Crédito', installments: 1, status: 'paid', dueDate: '2026-02-15', paidDate: '2026-02-15' },
  { id: '2', patientId: '2', patientName: 'João Santos', professionalId: '2', professionalName: 'Dr. Carlos Mendes', procedure: 'Implante unitário', amount: 4500, paymentMethod: 'Cartão Crédito', installments: 6, status: 'open', dueDate: '2026-03-10' },
  { id: '3', patientId: '3', patientName: 'Ana Costa', professionalId: '1', professionalName: 'Dra. Ana Silva', procedure: 'Consulta avaliação', amount: 200, paymentMethod: 'Pix', installments: 1, status: 'paid', dueDate: '2026-03-04', paidDate: '2026-03-04' },
  { id: '4', patientId: '5', patientName: 'Lucia Ferreira', professionalId: '2', professionalName: 'Dr. Carlos Mendes', procedure: 'Prótese sobre implante', amount: 3200, paymentMethod: 'Boleto', installments: 4, status: 'overdue', dueDate: '2026-02-28' },
  { id: '5', patientId: '4', patientName: 'Pedro Almeida', professionalId: '3', professionalName: 'Dra. Beatriz Rocha', procedure: 'Tratamento de canal', amount: 1800, paymentMethod: 'Dinheiro', installments: 1, status: 'open', dueDate: '2026-03-15' },
  { id: '6', patientId: '6', patientName: 'Roberto Souza', professionalId: '1', professionalName: 'Dra. Ana Silva', procedure: 'Limpeza', amount: 250, paymentMethod: 'Pix', installments: 1, status: 'paid', dueDate: '2026-03-01', paidDate: '2026-03-01' },
];

export const mockPayables: Payable[] = [
  { id: '1', supplier: 'Dental Supply Co.', description: 'Material de implante', category: 'Material', amount: 2500, dueDate: '2026-03-10', status: 'open' },
  { id: '2', supplier: 'Aluguel Comercial', description: 'Aluguel março', category: 'Fixo', amount: 5000, dueDate: '2026-03-05', status: 'paid', paidDate: '2026-03-04' },
  { id: '3', supplier: 'Enel', description: 'Conta de energia', category: 'Utilidades', amount: 680, dueDate: '2026-03-15', status: 'open' },
  { id: '4', supplier: 'Laboratório ProDent', description: 'Próteses mês fev', category: 'Laboratório', amount: 3200, dueDate: '2026-02-28', status: 'overdue' },
];

export const mockClinicalRecords: ClinicalRecord[] = [
  { id: '1', patientId: '1', patientName: 'Maria Oliveira', professionalId: '1', professionalName: 'Dra. Ana Silva', date: '2026-02-15', description: 'Ajuste no aparelho superior. Troca do arco para NiTi 0.016. Paciente sem queixas.', attachments: [] },
  { id: '2', patientId: '2', patientName: 'João Santos', professionalId: '2', professionalName: 'Dr. Carlos Mendes', date: '2026-02-20', description: 'Primeira fase do implante no dente 36. Cirurgia sem intercorrências. Prescrito: Amoxicilina 500mg 8/8h por 7 dias, Nimesulida 100mg 12/12h por 3 dias.', attachments: ['radiografia_pre_op.jpg'] },
  { id: '3', patientId: '3', patientName: 'Ana Costa', professionalId: '1', professionalName: 'Dra. Ana Silva', date: '2026-03-04', description: 'Consulta inicial. Paciente com queixa de dor no dente 46. Realizado exame clínico e radiográfico. Indicado tratamento endodôntico. Encaminhada para Dra. Beatriz.', attachments: ['radiografia_46.jpg'] },
];

// Dashboard stats
export const dashboardStats = {
  monthlyRevenue: 28450,
  totalReceived: 18200,
  totalOpen: 10250,
  estimatedProfit: 14800,
  newPatients: 12,
  appointmentsToday: 5,
  monthlyData: [
    { month: 'Out', revenue: 22000, expenses: 12000 },
    { month: 'Nov', revenue: 25000, expenses: 13500 },
    { month: 'Dez', revenue: 30000, expenses: 14000 },
    { month: 'Jan', revenue: 24000, expenses: 12800 },
    { month: 'Fev', revenue: 27000, expenses: 13200 },
    { month: 'Mar', revenue: 28450, expenses: 13800 },
  ],
  commissions: [
    { professional: 'Dra. Ana Silva', total: 4200, rate: 40 },
    { professional: 'Dr. Carlos Mendes', total: 5850, rate: 45 },
    { professional: 'Dra. Beatriz Rocha', total: 2160, rate: 40 },
  ],
};
