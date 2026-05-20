import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AppRole = 'admin' | 'reception' | 'dentist' | 'finance';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function requireAdmin(admin: any, userId: string, clinicId: string) {
  const { data, error } = await admin
    .from('clinic_members')
    .select('role, active')
    .eq('clinic_id', clinicId)
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  if (data?.role !== 'admin') throw new Error('not_allowed');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const payload = await req.json();
    const action = String(payload.action || '');

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === 'request-password-setup') {
      const email = String(payload.email || '').trim().toLowerCase();
      const redirectTo = String(payload.redirectTo || '');
      if (!email || !redirectTo) return json({ error: 'missing_required_fields' }, 400);

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('password_setup_required')
        .eq('email', email)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.password_setup_required) return json({ error: 'first_access_only' }, 403);

      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const recovery = await anon.auth.resetPasswordForEmail(email, { redirectTo });
      if (recovery.error) throw recovery.error;
      return json({ ok: true });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const clinicId = String(payload.clinicId || '');
    if (!clinicId) return json({ error: 'clinic_required' }, 400);

    await requireAdmin(admin, userData.user.id, clinicId);

    if (action === 'create-user') {
      const email = String(payload.email || '').trim().toLowerCase();
      const fullName = String(payload.fullName || '').trim();
      const role = String(payload.role || 'reception') as AppRole;
      const password = String(payload.password || '');
      const passwordSetupRequired = password.length === 0;

      if (!email || !fullName) return json({ error: 'missing_required_fields' }, 400);
      if (!['admin', 'reception', 'dentist', 'finance'].includes(role)) return json({ error: 'invalid_role' }, 400);
      if (password && password.length < 6) return json({ error: 'password_too_short' }, 400);

      const created = await admin.auth.admin.createUser({
        email,
        password: password || randomPassword(),
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          job_title: role,
          password_setup_required: passwordSetupRequired,
        },
      });
      if (created.error) {
        const exists = created.error.message.toLowerCase().includes('already');
        if (!exists) throw created.error;
      }

      let targetUser = created.data.user;
      if (!targetUser) {
        const listed = await admin.auth.admin.listUsers();
        if (listed.error) throw listed.error;
        targetUser = listed.data.users.find((item) => item.email?.toLowerCase() === email);
      }
      if (!targetUser) return json({ error: 'user_not_found' }, 404);

      const { error: profileError } = await admin.from('profiles').upsert({
        user_id: targetUser.id,
        email,
        full_name: fullName,
        job_title: role,
        password_setup_required: passwordSetupRequired,
      }, { onConflict: 'user_id' });
      if (profileError) throw profileError;

      const { error: memberError } = await admin.from('clinic_members').upsert({
        clinic_id: clinicId,
        user_id: targetUser.id,
        role,
        active: true,
      }, { onConflict: 'clinic_id,user_id' });
      if (memberError) throw memberError;

      return json({ ok: true, userId: targetUser.id, passwordSetupRequired });
    }

    if (action === 'change-password') {
      const targetUserId = String(payload.userId || '');
      const newPassword = String(payload.newPassword || '');
      const confirmPassword = String(payload.confirmPassword || '');
      const adminPassword = String(payload.adminPassword || '');
      const adminEmail = userData.user.email;

      if (!targetUserId || !newPassword || !confirmPassword || !adminPassword) return json({ error: 'missing_required_fields' }, 400);
      if (newPassword !== confirmPassword) return json({ error: 'password_mismatch' }, 400);
      if (newPassword.length < 6) return json({ error: 'password_too_short' }, 400);
      if (!adminEmail) return json({ error: 'admin_email_required' }, 400);

      const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const verified = await verifier.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
      if (verified.error) return json({ error: 'invalid_admin_password' }, 403);

      const { data: targetMembership, error: targetError } = await admin
        .from('clinic_members')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('user_id', targetUserId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!targetMembership) return json({ error: 'target_not_in_clinic' }, 404);

      const updated = await admin.auth.admin.updateUserById(targetUserId, { password: newPassword });
      if (updated.error) throw updated.error;

      await admin.from('profiles').update({ password_setup_required: false }).eq('user_id', targetUserId);
      return json({ ok: true });
    }

    return json({ error: 'invalid_action' }, 400);
  } catch (e) {
    console.error('manage users error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
