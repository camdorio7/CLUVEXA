import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

/** Authorize email actions using the requester's JWT and organization membership. */
export async function authorizeOrganizationEmail(req: NextRequest, clubId: string, allowedRoles: readonly string[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = req.headers.get('authorization') || '';
  if (!url || !anon) return { ok: false as const, status: 503, error: 'Authentication is not configured.' };
  if (!/^Bearer\s+\S+$/i.test(authorization)) return { ok: false as const, status: 401, error: 'Sign in required.' };
  const sb = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) return { ok: false as const, status: 401, error: 'Session expired. Sign in again.' };
  const { data: platformAdmin, error: platformError } = await sb.rpc('is_super_admin');
  if (platformError) return { ok: false as const, status: 503, error: 'Unable to verify platform permissions.' };
  if (platformAdmin === true) return { ok: true as const, sb, user };
  const { data: membership, error: membershipError } = await sb.from('club_users').select('role,active').eq('club_id', clubId).eq('user_id', user.id).maybeSingle();
  if (membershipError) return { ok: false as const, status: 503, error: 'Unable to verify organization permissions.' };
  if (!membership?.active || !allowedRoles.includes(membership.role)) return { ok: false as const, status: 403, error: 'Organization administrator permission required.' };
  return { ok: true as const, sb, user };
}
