import { supabase } from "@/integrations/supabase/client";
import {
  mockAppointments,
  mockFinancialCategories,
  mockPatients,
  mockPayables,
  mockProcedures,
  mockProfessionals,
  mockReceivables,
  mockSuppliers,
} from "@/data/mockData";

export const db = supabase as any;

export interface CloudClinic {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
}

function normalizeDate(value?: string) {
  return value || new Date().toISOString().split("T")[0];
}

async function seedClinicDefaults(clinicId: string) {
  const { count } = await db
    .from("procedures")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if ((count || 0) > 0) return;

  const { data: procedures, error: procError } = await db
    .from("procedures")
    .insert(mockProcedures.map((p) => ({
      clinic_id: clinicId,
      name: p.name,
      default_price: p.defaultPrice,
      average_duration: p.averageDuration,
      active: true,
    })))
    .select();
  if (procError) throw procError;

  const { data: professionals, error: profError } = await db
    .from("professionals")
    .insert(mockProfessionals.map((p) => ({
      clinic_id: clinicId,
      name: p.name,
      specialty: p.specialty,
      commission_rate: p.commissionRate,
      phone: p.phone,
      email: p.email,
      active: p.active,
    })))
    .select();
  if (profError) throw profError;

  const { data: patients, error: patientError } = await db
    .from("patients")
    .insert(mockPatients.map((p) => ({
      clinic_id: clinicId,
      name: p.name,
      cpf: p.cpf,
      birth_date: normalizeDate(p.birthDate),
      phone: p.phone,
      email: p.email,
      address: p.address,
      notes: p.notes,
      medical_notes: p.medicalNotes,
      insurance: p.insurance,
      created_at: `${p.createdAt}T12:00:00Z`,
    })))
    .select();
  if (patientError) throw patientError;

  await db.from("suppliers").insert(mockSuppliers.map((s) => ({
    clinic_id: clinicId,
    name: s.name,
    legal_name: s.legalName,
    cnpj: s.cnpj,
    document: s.document || s.cnpj,
    phone: s.phone,
    mobile: s.mobile,
    email: s.email,
    category: s.category,
    notes: s.notes,
    bank: s.bank,
    agency: s.agency,
    account: s.account,
  })));

  await db.from("financial_categories").insert(mockFinancialCategories.map((c) => ({
    clinic_id: clinicId,
    name: c.name,
    type: c.type,
  })));

  const patientMap = new Map(mockPatients.map((p, index) => [p.id, patients?.[index]?.id]));
  const procedureMap = new Map(mockProcedures.map((p, index) => [p.id, procedures?.[index]?.id]));
  const professionalMap = new Map(mockProfessionals.map((p, index) => [p.id, professionals?.[index]?.id]));

  await db.from("appointments").insert(mockAppointments.map((a) => ({
    clinic_id: clinicId,
    patient_id: patientMap.get(a.patientId) || null,
    professional_id: professionalMap.get(a.professionalId) || null,
    procedure_id: a.procedureId ? procedureMap.get(a.procedureId) || null : null,
    patient_name: a.patientName,
    professional_name: a.professionalName,
    procedure_name: a.procedure,
    appointment_date: a.date,
    appointment_time: a.time,
    duration: a.duration,
    value: a.value || 0,
    status: a.status,
    notes: a.notes,
  })));

  await db.from("receivables").insert(mockReceivables.map((r) => ({
    clinic_id: clinicId,
    patient_id: patientMap.get(r.patientId) || null,
    professional_id: professionalMap.get(r.professionalId) || null,
    patient_name: r.patientName,
    professional_name: r.professionalName,
    procedure_name: r.procedure,
    amount: r.amount,
    payment_method: r.paymentMethod,
    installments: r.installments,
    status: r.status,
    due_date: r.dueDate,
    paid_date: r.paidDate || null,
  })));

  await db.from("payables").insert(mockPayables.map((p) => ({
    clinic_id: clinicId,
    supplier: p.supplier,
    description: p.description,
    category: p.category,
    amount: p.amount,
    due_date: p.dueDate,
    status: p.status,
    paid_date: p.paidDate || null,
  })));
}

export async function ensureClinicForUser(user: { id: string; email?: string | null; user_metadata?: Record<string, any> }) {
  await db.from("profiles").upsert({
    user_id: user.id,
    email: user.email || null,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Usuário",
  }, { onConflict: "user_id" });

  const { data: membership, error: memberError } = await db
    .from("clinic_members")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (memberError) throw memberError;

  if (membership?.clinic_id) {
    const { data: clinic, error: clinicError } = await db
      .from("clinics")
      .select("id, name, cnpj, phone, email, address, logo_url")
      .eq("id", membership.clinic_id)
      .single();
    if (clinicError) throw clinicError;
    return clinic as CloudClinic;
  }

  const { data: clinic, error: clinicError } = await db
    .from("clinics")
    .insert({
      name: "EsteticaPro",
      cnpj: "12.345.678/0001-90",
      phone: "(11) 3456-7890",
      email: "contato@esteticapro.com",
      address: "Av. Paulista, 1000, Sala 501 - São Paulo/SP",
      created_by: user.id,
    })
    .select("id, name, cnpj, phone, email, address, logo_url")
    .single();
  if (clinicError) throw clinicError;

  const { error: membershipError } = await db
    .from("clinic_members")
    .insert({ clinic_id: clinic.id, user_id: user.id, role: "admin", active: true });
  if (membershipError) throw membershipError;

  await seedClinicDefaults(clinic.id);
  return clinic as CloudClinic;
}

export async function uploadClinicLogo(clinicId: string, file: File) {
  const extension = file.name.split(".").pop() || "png";
  const safeName = `logo-${Date.now()}.${extension.toLowerCase()}`;
  const path = `${clinicId}/${safeName}`;
  const { error } = await supabase.storage.from("clinic-logos").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("clinic-logos").getPublicUrl(path);
  return data.publicUrl;
}
