import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export const runtime = 'nodejs';

type Config = { repo: string; branch?: string; url?: string; tokenEnv?: string };
async function context(id: string) {
  const jar = await cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: () => {} }
  });
  const {data:{user}} = await sb.auth.getUser();
  if (!user) throw new Error('401:Sign in required');
  const [{data:member},{data:profile},{data:module},{data:club}] = await Promise.all([
    sb.from('club_users').select('role,active').eq('club_id',id).eq('user_id',user.id).maybeSingle(),
    sb.from('profiles').select('platform_role').eq('id',user.id).maybeSingle(),
    sb.from('club_modules').select('licensed,club_enabled').eq('club_id',id).eq('module_key','website_management').maybeSingle(),
    sb.from('clubs').select('status').eq('id',id).maybeSingle()
  ]);
  const superAdmin = profile?.platform_role === 'super_admin';
  if (!superAdmin && (!member?.active || !['owner','admin'].includes(member.role) || club?.status !== 'active')) throw new Error('403:Administrator access required');
  if (!superAdmin && (!module?.licensed || !module?.club_enabled)) throw new Error('403:Website Management is not enabled for this organization');
  let configs: Record<string,Config> = {};
  try { configs = JSON.parse(process.env.NADORIO_WEBSITE_CONFIGS || '{}'); } catch { throw new Error('500:Invalid website configuration'); }
  const config = configs[id];
  if (!config || !/^[\w.-]+\/[\w.-]+$/.test(config.repo)) throw new Error('404:Website has not been connected');
  const envName = config.tokenEnv || 'NADORIO_WEBSITE_GITHUB_TOKEN';
  if (!/^NADORIO_WEBSITE_[A-Z0-9_]+$/.test(envName)) throw new Error('500:Invalid token environment variable');
  const token = process.env[envName];
  if (!token) throw new Error('503:Website publishing credentials are not configured');
  return {config, token};
}
function failure(e: unknown) { const m=e instanceof Error?e.message:'Unknown error'; const match=/^(401|403|404|409|500|503):/.exec(m); return NextResponse.json({error:match?m.slice(4):m},{status:match?Number(match[1]):502}); }
async function github(id:string) {
  const {config,token}=await context(id);
  return {config, url:`https://api.github.com/repos/${config.repo}/contents/content/site.json?ref=${encodeURIComponent(config.branch||'main')}`, headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'}};
}
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try { const {id}=await params;const g=await github(id);const res=await fetch(g.url,{headers:g.headers,cache:'no-store'});if(!res.ok)throw new Error(`GitHub read failed (${res.status})`);const data=await res.json();return NextResponse.json({content:JSON.parse(Buffer.from(data.content,'base64').toString('utf8')),sha:data.sha,websiteUrl:g.config.url||null}); }catch(e){return failure(e)}
}
export async function PUT(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try { const {id}=await params;const g=await github(id);const {content,sha}=await req.json();
    if(typeof sha!=='string'||!/^[a-f0-9]{40}$/.test(sha)||!content||typeof content!=='object'||Array.isArray(content))return NextResponse.json({error:'Invalid content or revision'},{status:400});
    const required=['homeHeadline','homeSubtitle','welcomeTitle','welcomeText'];
    if(required.some(k=>typeof content[k]!=='string')||!Array.isArray(content.announcements)||!Array.isArray(content.events)||!Array.isArray(content.membershipRates)||!Array.isArray(content.photoLibrary))return NextResponse.json({error:'Invalid website content'},{status:400});
    const body=JSON.stringify(content,null,2)+'\n';if(body.length>50000)return NextResponse.json({error:'Content too large'},{status:400});
    const url=g.url.split('?')[0];const res=await fetch(url,{method:'PUT',headers:g.headers,body:JSON.stringify({message:'Publish website content via NADORIO',content:Buffer.from(body).toString('base64'),sha,branch:g.config.branch||'main'}),cache:'no-store'});
    const data=await res.json();if(!res.ok)return NextResponse.json({error:res.status===409?'Website changed since you loaded it. Reload before publishing.':data.message||`GitHub ${res.status}`},{status:res.status});
    return NextResponse.json({ok:true,sha:data.content?.sha});
  }catch(e){return failure(e)}
}
