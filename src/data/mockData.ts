// Mock data for the aesthetic clinic management system

export interface Patient {
  id: string;
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  medicalNotes: string;
  insurance: string;
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

export interface Procedure {
  id: string;
  name: string;
  defaultPrice: number;
  averageDuration: number;
}

export interface Supplier {
  id: string;
  name: string;
  externalId?: string;
  legalName: string;
  cnpj: string;
  document: string;
  phone: string;
  mobile: string;
  email: string;
  category: string;
  notes: string;
  bank: string;
  agency: string;
  account: string;
}

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
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
  procedureId?: string;
  procedure: string;
  value?: number;
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
  category?: string;
  amount: number;
  paymentMethod: string;
  installments: number;
  status: 'open' | 'paid' | 'overdue';
  dueDate: string;
  paidDate?: string;
}

export interface Payable {
  id: string;
  supplierId?: string;
  supplier: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  status: 'open' | 'paid' | 'overdue';
  paidDate?: string;
  issueDate?: string;
  firstDueDate?: string;
  installmentsCount?: number;
  companyId?: string;
  companyName?: string;
  sourceNotes?: string;
  installments?: PayableInstallment[];
}

export interface PayableInstallment {
  id: string;
  payableId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidDate?: string;
  paidAmount?: number;
  status: 'open' | 'paid' | 'overdue';
  notes?: string;
}

export const mockProcedures: Procedure[] = [
  { id: '1', name: 'Consulta de Avaliação', defaultPrice: 200, averageDuration: 30 },
  { id: '2', name: 'Limpeza de Pele', defaultPrice: 250, averageDuration: 60 },
  { id: '3', name: 'Botox Facial', defaultPrice: 1200, averageDuration: 45 },
  { id: '4', name: 'Preenchimento Labial', defaultPrice: 1500, averageDuration: 60 },
  { id: '5', name: 'Bioestimulador de Colágeno', defaultPrice: 2200, averageDuration: 60 },
  { id: '6', name: 'Peeling Químico', defaultPrice: 450, averageDuration: 45 },
  { id: '7', name: 'Microagulhamento', defaultPrice: 650, averageDuration: 60 },
  { id: '8', name: 'Depilação a Laser', defaultPrice: 350, averageDuration: 30 },
  { id: '9', name: 'Drenagem Linfática', defaultPrice: 180, averageDuration: 60 },
  { id: '10', name: 'Massagem Modeladora', defaultPrice: 220, averageDuration: 60 },
  { id: '11', name: 'Harmonização Facial', defaultPrice: 3500, averageDuration: 120 },
  { id: '12', name: 'Skinbooster', defaultPrice: 900, averageDuration: 45 },
  { id: '13', name: 'Criofrequência', defaultPrice: 700, averageDuration: 60 },
  { id: '14', name: 'Ultrassom Microfocado', defaultPrice: 1800, averageDuration: 75 },
];

export const mockSuppliers: Supplier[] = [
  { id: '1', name: 'Esthetic Supply Co.', legalName: 'Esthetic Supply Co.', cnpj: '12.345.678/0001-01', document: '12.345.678/0001-01', phone: '(11) 3333-0001', mobile: '', email: 'contato@estheticsupply.com', category: 'Material', notes: 'Fornecedor de dermocosméticos e descartáveis', bank: '', agency: '', account: '' },
  { id: '2', name: 'BioTech Estética', legalName: 'BioTech Estética', cnpj: '12.345.678/0001-02', document: '12.345.678/0001-02', phone: '(11) 3333-0002', mobile: '', email: 'vendas@biotechestetica.com', category: 'Injetáveis', notes: 'Produtos para harmonização facial', bank: '', agency: '', account: '' },
  { id: '3', name: 'LaserPro Equipamentos', legalName: 'LaserPro Equipamentos', cnpj: '12.345.678/0001-03', document: '12.345.678/0001-03', phone: '(11) 3333-0003', mobile: '', email: 'vendas@laserpro.com', category: 'Equipamentos', notes: 'Equipamentos e manutenção técnica', bank: '', agency: '', account: '' },
  { id: '4', name: 'MedClean Esterilização', legalName: 'MedClean Esterilização', cnpj: '12.345.678/0001-04', document: '12.345.678/0001-04', phone: '(11) 3333-0004', mobile: '', email: 'contato@medclean.com', category: 'Serviço', notes: 'Serviço de esterilização terceirizado', bank: '', agency: '', account: '' },
];

export const mockFinancialCategories: FinancialCategory[] = [
  { id: '1', name: 'Material', type: 'expense' },
  { id: '2', name: 'Fixo', type: 'expense' },
  { id: '3', name: 'Utilidades', type: 'expense' },
  { id: '4', name: 'Equipamentos', type: 'expense' },
  { id: '5', name: 'Marketing', type: 'expense' },
  { id: '6', name: 'Outros', type: 'expense' },
  { id: '7', name: 'Consulta', type: 'income' },
  { id: '8', name: 'Procedimento', type: 'income' },
];

export const mockProfessionals: Professional[] = [
  { id: '1', name: 'Dra. Ana Silva', specialty: 'Biomedicina Estética', commissionRate: 0, phone: '(11) 99999-0001', email: 'ana@clinica.com', active: true },
  { id: '2', name: 'Dra. Carla Mendes', specialty: 'Dermatologia', commissionRate: 0, phone: '(11) 99999-0002', email: 'carla@clinica.com', active: true },
  { id: '3', name: 'Beatriz Rocha', specialty: 'Esteticista', commissionRate: 0, phone: '(11) 99999-0003', email: 'beatriz@clinica.com', active: true },
  { id: '4', name: 'Fernando Lima', specialty: 'Massoterapeuta', commissionRate: 0, phone: '(11) 99999-0004', email: 'fernando@clinica.com', active: false },
];

export const mockPatients: Patient[] = [
  { id: '1', name: 'Maria Oliveira', cpf: '123.456.789-00', birthDate: '1985-03-15', phone: '(11) 98765-4321', email: 'maria@email.com', address: 'Rua das Flores, 123 - São Paulo/SP', notes: 'Alergia a penicilina', medicalNotes: 'Hipertensão controlada. Usa losartana 50mg.', insurance: 'Particular', createdAt: '2024-01-10' },
  { id: '2', name: 'João Santos', cpf: '987.654.321-00', birthDate: '1990-07-22', phone: '(11) 91234-5678', email: 'joao@email.com', address: 'Av. Paulista, 456 - São Paulo/SP', notes: '', medicalNotes: '', insurance: 'Particular', createdAt: '2024-02-05' },
  { id: '3', name: 'Ana Costa', cpf: '456.789.123-00', birthDate: '1978-11-30', phone: '(11) 94567-8901', email: 'ana.costa@email.com', address: 'Rua Augusta, 789 - São Paulo/SP', notes: 'Cliente ansioso', medicalNotes: 'Ansiedade. Indicar sedação consciente se necessário.', insurance: 'SulAmérica', createdAt: '2024-03-12' },
  { id: '4', name: 'Pedro Almeida', cpf: '321.654.987-00', birthDate: '1995-05-08', phone: '(11) 97890-1234', email: 'pedro@email.com', address: 'Rua Oscar Freire, 321 - São Paulo/SP', notes: '', medicalNotes: '', insurance: 'Particular', createdAt: '2024-04-18' },
  { id: '5', name: 'Lucia Ferreira', cpf: '654.321.987-00', birthDate: '1982-09-25', phone: '(11) 93456-7890', email: 'lucia@email.com', address: 'Rua Haddock Lobo, 654 - São Paulo/SP', notes: 'Diabetes tipo 2', medicalNotes: 'Diabetes tipo 2. Controle glicêmico adequado. Metformina 850mg.', insurance: 'Particular', createdAt: '2024-05-01' },
  { id: '6', name: 'Roberto Souza', cpf: '789.123.456-00', birthDate: '1970-01-12', phone: '(11) 92345-6789', email: 'roberto@email.com', address: 'Av. Rebouças, 987 - São Paulo/SP', notes: '', medicalNotes: '', insurance: 'Particular', createdAt: '2024-06-22' },
];

export const mockAppointments: Appointment[] = [
  { id: '1', patientId: '1', patientName: 'Maria Oliveira', professionalId: '1', professionalName: 'Dra. Ana Silva', date: '2026-03-04', time: '08:00', duration: 60, procedureId: '10', procedure: 'Massagem modeladora', value: 220, status: 'confirmed', notes: '' },
  { id: '2', patientId: '2', patientName: 'João Santos', professionalId: '2', professionalName: 'Dra. Carla Mendes', date: '2026-03-04', time: '09:00', duration: 60, procedureId: '11', procedure: 'Harmonização facial', value: 3500, status: 'confirmed', notes: 'Trazer avaliação prévia' },
  { id: '3', patientId: '3', patientName: 'Ana Costa', professionalId: '1', professionalName: 'Dra. Ana Silva', date: '2026-03-04', time: '10:00', duration: 30, procedureId: '1', procedure: 'Consulta avaliação', value: 200, status: 'attended', notes: '' },
  { id: '4', patientId: '4', patientName: 'Pedro Almeida', professionalId: '3', professionalName: 'Beatriz Rocha', date: '2026-03-04', time: '11:00', duration: 60, procedureId: '7', procedure: 'Microagulhamento', value: 650, status: 'missed', notes: '' },
  { id: '5', patientId: '5', patientName: 'Lucia Ferreira', professionalId: '2', professionalName: 'Dra. Carla Mendes', date: '2026-03-04', time: '14:00', duration: 45, procedureId: '3', procedure: 'Botox facial', value: 1200, status: 'confirmed', notes: '' },
  { id: '6', patientId: '6', patientName: 'Roberto Souza', professionalId: '1', professionalName: 'Dra. Ana Silva', date: '2026-03-05', time: '08:00', duration: 60, procedureId: '2', procedure: 'Limpeza de pele', value: 250, status: 'confirmed', notes: '' },
  { id: '7', patientId: '1', patientName: 'Maria Oliveira', professionalId: '3', professionalName: 'Beatriz Rocha', date: '2026-03-05', time: '10:00', duration: 60, procedureId: '9', procedure: 'Drenagem linfática', value: 180, status: 'cancelled', notes: 'Cliente remarcou' },
  { id: '8', patientId: '3', patientName: 'Ana Costa', professionalId: '1', professionalName: 'Dra. Ana Silva', date: '2026-03-03', time: '09:00', duration: 30, procedureId: '1', procedure: 'Consulta avaliação', value: 200, status: 'attended', notes: '' },
  { id: '9', patientId: '5', patientName: 'Lucia Ferreira', professionalId: '2', professionalName: 'Dra. Carla Mendes', date: '2026-03-06', time: '10:00', duration: 45, procedureId: '12', procedure: 'Skinbooster', value: 900, status: 'confirmed', notes: '' },
];

export const mockReceivables: Receivable[] = [
  { id: '1', patientId: '1', patientName: 'Maria Oliveira', professionalId: '1', professionalName: 'Dra. Ana Silva', procedure: 'Massagem modeladora', amount: 220, paymentMethod: 'Cartão Crédito', installments: 1, status: 'paid', dueDate: '2026-02-15', paidDate: '2026-02-15' },
  { id: '2', patientId: '2', patientName: 'João Santos', professionalId: '2', professionalName: 'Dra. Carla Mendes', procedure: 'Harmonização facial', amount: 3500, paymentMethod: 'Cartão Crédito', installments: 6, status: 'open', dueDate: '2026-03-10' },
  { id: '3', patientId: '3', patientName: 'Ana Costa', professionalId: '1', professionalName: 'Dra. Ana Silva', procedure: 'Consulta avaliação', amount: 200, paymentMethod: 'Pix', installments: 1, status: 'paid', dueDate: '2026-03-04', paidDate: '2026-03-04' },
  { id: '4', patientId: '5', patientName: 'Lucia Ferreira', professionalId: '2', professionalName: 'Dra. Carla Mendes', procedure: 'Botox facial', amount: 1200, paymentMethod: 'Boleto', installments: 4, status: 'overdue', dueDate: '2026-02-28' },
  { id: '5', patientId: '4', patientName: 'Pedro Almeida', professionalId: '3', professionalName: 'Beatriz Rocha', procedure: 'Microagulhamento', amount: 650, paymentMethod: 'Dinheiro', installments: 1, status: 'open', dueDate: '2026-03-15' },
  { id: '6', patientId: '6', patientName: 'Roberto Souza', professionalId: '1', professionalName: 'Dra. Ana Silva', procedure: 'Limpeza de pele', amount: 250, paymentMethod: 'Pix', installments: 1, status: 'paid', dueDate: '2026-03-01', paidDate: '2026-03-01' },
];

export const mockPayables: Payable[] = [
  { id: '1', supplier: 'Esthetic Supply Co.', description: 'Dermocosméticos e descartáveis', category: 'Material', amount: 2500, dueDate: '2026-03-10', status: 'open' },
  { id: '2', supplier: 'Aluguel Comercial', description: 'Aluguel março', category: 'Fixo', amount: 5000, dueDate: '2026-03-05', status: 'paid', paidDate: '2026-03-04' },
  { id: '3', supplier: 'Enel', description: 'Conta de energia', category: 'Utilidades', amount: 680, dueDate: '2026-03-15', status: 'open' },
  { id: '4', supplier: 'LaserPro Equipamentos', description: 'Manutenção de equipamento', category: 'Equipamentos', amount: 3200, dueDate: '2026-02-28', status: 'overdue' },
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
};
