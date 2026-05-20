import { useEffect, useRef, useState } from "react";
import { Building2, Upload } from "lucide-react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { db, uploadClinicLogo } from "@/lib/clinicCloud";
import { formatCNPJ } from "@/lib/utils";

type WorkingHour = {
  id?: string;
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
  slotMinutes: number;
};

const weekDays = [
  { day: 1, label: "Segunda" },
  { day: 2, label: "Terca" },
  { day: 3, label: "Quarta" },
  { day: 4, label: "Quinta" },
  { day: 5, label: "Sexta" },
  { day: 6, label: "Sabado" },
  { day: 0, label: "Domingo" },
];

function defaultHours(): WorkingHour[] {
  return weekDays.map(({ day }) => ({
    dayOfWeek: day,
    isOpen: day !== 0,
    startTime: "08:00",
    endTime: day === 6 ? "12:00" : "18:00",
    slotMinutes: 60,
  }));
}

function mapHour(row: any): WorkingHour {
  return {
    id: row.id,
    dayOfWeek: Number(row.day_of_week),
    isOpen: Boolean(row.is_open),
    startTime: String(row.start_time || "08:00").slice(0, 5),
    endTime: String(row.end_time || "18:00").slice(0, 5),
    slotMinutes: Number(row.slot_minutes || 60),
  };
}

export default function SettingsPage() {
  const { clinic, setClinic, refreshClinic } = useClinic();
  const [clinicName, setClinicName] = useState(clinic.name);
  const [clinicCnpj, setClinicCnpj] = useState(formatCNPJ(clinic.cnpj));
  const [clinicPhone, setClinicPhone] = useState(clinic.phone);
  const [clinicEmail, setClinicEmail] = useState(clinic.email);
  const [clinicAddress, setClinicAddress] = useState(clinic.address);
  const [logoPreview, setLogoPreview] = useState<string | null>(clinic.logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [savingClinic, setSavingClinic] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>(defaultHours());
  const [savingHours, setSavingHours] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClinicName(clinic.name);
    setClinicCnpj(formatCNPJ(clinic.cnpj));
    setClinicPhone(clinic.phone);
    setClinicEmail(clinic.email);
    setClinicAddress(clinic.address);
    setLogoPreview(clinic.logoUrl);
  }, [clinic]);

  useEffect(() => {
    if (!clinic.id) return;
    void loadHours();
  }, [clinic.id]);

  const loadHours = async () => {
    if (!clinic.id) return;
    const { data, error } = await db.from("clinic_working_hours").select("*").eq("clinic_id", clinic.id).order("day_of_week");
    if (error) return toast.error("Nao foi possivel carregar os horarios.");
    if (data?.length) {
      const loaded = data.map(mapHour);
      setWorkingHours(defaultHours().map((fallback) => loaded.find((item) => item.dayOfWeek === fallback.dayOfWeek) || fallback));
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSaveClinic = async () => {
    if (!clinic.id) return toast.error("Clinica nao vinculada.");
    setSavingClinic(true);
    let logoUrl = clinic.logoUrl;
    try {
      if (logoFile) logoUrl = await uploadClinicLogo(clinic.id, logoFile);
      const { error } = await db.from("clinics").update({
        name: clinicName,
        cnpj: clinicCnpj,
        phone: clinicPhone,
        email: clinicEmail,
        address: clinicAddress,
        logo_url: logoUrl,
      }).eq("id", clinic.id);
      setSavingClinic(false);
      if (error) return toast.error("Nao foi possivel salvar os dados da clinica.");
      setClinic({ name: clinicName, cnpj: clinicCnpj, phone: clinicPhone, email: clinicEmail, address: clinicAddress, logoUrl });
      setLogoFile(null);
      await refreshClinic();
      toast.success("Dados da clinica salvos.");
    } catch {
      setSavingClinic(false);
      toast.error("Nao foi possivel enviar a logo.");
    }
  };

  const updateHour = (dayOfWeek: number, changes: Partial<WorkingHour>) => {
    setWorkingHours((prev) => prev.map((hour) => hour.dayOfWeek === dayOfWeek ? { ...hour, ...changes } : hour));
  };

  const saveHours = async () => {
    if (!clinic.id) return toast.error("Clinica nao vinculada.");
    setSavingHours(true);
    const payload = workingHours.map((hour) => ({
      clinic_id: clinic.id,
      day_of_week: hour.dayOfWeek,
      is_open: hour.isOpen,
      start_time: hour.startTime,
      end_time: hour.endTime,
      slot_minutes: hour.slotMinutes,
    }));
    const { error } = await db.from("clinic_working_hours").upsert(payload, { onConflict: "clinic_id,day_of_week" });
    setSavingHours(false);
    if (error) return toast.error("Nao foi possivel salvar os horarios.");
    toast.success("Horarios salvos.");
    await loadHours();
  };

  return (
    <ClinicLayout title="Configuracoes" subtitle="Dados e horarios da clinica">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="clinic">
          <TabsList className="flex-wrap">
            <TabsTrigger value="clinic">Dados da Clinica</TabsTrigger>
            <TabsTrigger value="schedule">Horarios</TabsTrigger>
          </TabsList>

          <TabsContent value="clinic">
            <Card className="p-6 max-w-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => fileRef.current?.click()}>
                  {logoPreview ? <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" onError={() => setLogoPreview(null)} /> : <Building2 className="h-7 w-7 text-primary" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">Dados da Clinica</h3>
                  <p className="text-xs text-muted-foreground">Informacoes principais da empresa.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-1" />Logo</Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
              <div className="space-y-4">
                <div><Label>Nome da Clinica</Label><Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>CNPJ</Label><Input inputMode="numeric" value={clinicCnpj} onChange={(e) => setClinicCnpj(formatCNPJ(e.target.value))} /></div>
                  <div><Label>Telefone</Label><Input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} /></div>
                </div>
                <div><Label>Email</Label><Input value={clinicEmail} onChange={(e) => setClinicEmail(e.target.value)} /></div>
                <div><Label>Endereco</Label><Textarea value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} rows={2} /></div>
                <Button onClick={handleSaveClinic} className="w-full" disabled={savingClinic}>{savingClinic ? "Salvando..." : "Salvar Alteracoes"}</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card className="p-5 max-w-3xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Horarios de Atendimento</h3>
                  <p className="text-xs text-muted-foreground">Esses horarios alimentam os horarios disponiveis da agenda.</p>
                </div>
                <Button onClick={saveHours} disabled={savingHours}>{savingHours ? "Salvando..." : "Salvar Horarios"}</Button>
              </div>
              <div className="space-y-3">
                {weekDays.map(({ day, label }) => {
                  const hour = workingHours.find((item) => item.dayOfWeek === day) || defaultHours().find((item) => item.dayOfWeek === day)!;
                  return (
                    <div key={day} className="grid grid-cols-1 md:grid-cols-[120px_80px_1fr_1fr_120px] gap-3 items-center p-3 rounded-md bg-muted/30">
                      <span className="text-sm font-medium">{label}</span>
                      <div className="flex items-center gap-2"><Switch checked={hour.isOpen} onCheckedChange={(isOpen) => updateHour(day, { isOpen })} /><span className="text-xs text-muted-foreground">{hour.isOpen ? "Aberto" : "Fechado"}</span></div>
                      <div><Label className="text-xs">Inicio</Label><Input type="time" value={hour.startTime} disabled={!hour.isOpen} onChange={(e) => updateHour(day, { startTime: e.target.value })} /></div>
                      <div><Label className="text-xs">Fim</Label><Input type="time" value={hour.endTime} disabled={!hour.isOpen} onChange={(e) => updateHour(day, { endTime: e.target.value })} /></div>
                      <div><Label className="text-xs">Intervalo</Label><Select value={String(hour.slotMinutes)} onValueChange={(slot) => updateHour(day, { slotMinutes: Number(slot) })} disabled={!hour.isOpen}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[15, 30, 45, 60, 90, 120].map((slot) => <SelectItem key={slot} value={String(slot)}>{slot} min</SelectItem>)}</SelectContent></Select></div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ClinicLayout>
  );
}
