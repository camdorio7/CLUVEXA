import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

function supabaseFor(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth=req.headers.get('authorization')||'';
  return createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
export async function POST(req:NextRequest){
 try{
  if(!process.env.RESEND_API_KEY)return NextResponse.json({error:'Email service is not configured.'},{status:503});
  const {token}=await req.json(); if(!token)return NextResponse.json({error:'Missing invitation token.'},{status:400});
  const sb=supabaseFor(req); const {data:{user}}=await sb.auth.getUser(); if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:inv,error}=await sb.from('club_invitations').select('id,club_id,email,full_name,role,status,token,expires_at,clubs(name,logo_url,contact_email)').eq('token',token).single();
  if(error||!inv||inv.status!=='pending')return NextResponse.json({error:'Invitation not found.'},{status:404});
  const club:any=Array.isArray((inv as any).clubs)?(inv as any).clubs[0]:(inv as any).clubs;
  const appUrl=String(process.env.NEXT_PUBLIC_APP_URL||'https://app.nadorio.com').replace(/\/$/,'');
  const joinUrl=`${appUrl}/join?token=${inv.token}`;
  const clubName=club?.name||'Your club'; const person=inv.full_name||'there';
  const html=`<!doctype html><html><body style="margin:0;background:#07101f;font-family:Arial,sans-serif;color:#eef5ff"><div style="max-width:620px;margin:0 auto;padding:36px 20px"><div style="font-weight:800;letter-spacing:3px;font-size:22px;color:#fff">NADORIO</div><div style="background:#101b2e;border:1px solid #22324d;border-radius:18px;padding:32px;margin-top:22px"><h1 style="margin:0 0 12px;font-size:26px">You're invited to ${esc(clubName)}</h1><p style="color:#b9c7dc;line-height:1.6">Hi ${esc(person)}, you've been invited to join ${esc(clubName)} on NADORIO as ${esc(inv.role.replace('_',' '))}.</p><p style="margin:28px 0"><a href="${joinUrl}" style="display:inline-block;background:#168cff;color:white;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">Accept invitation</a></p><p style="color:#8292aa;font-size:13px">This invitation expires ${new Date(inv.expires_at).toLocaleDateString('en-US')}. If you weren't expecting it, you can ignore this email.</p></div><div style="color:#6f809a;font-size:12px;margin-top:18px">Powered by NADORIO · CD7 Technologies</div></div></body></html>`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.NADORIO_EMAIL_FROM||'NADORIO <notifications@nadorio.com>',to:[inv.email],reply_to:club?.contact_email||process.env.NADORIO_REPLY_TO||undefined,subject:`You're invited to ${clubName} on NADORIO`,html})});
  const out=await r.json(); if(!r.ok)return NextResponse.json({error:out?.message||'Resend rejected the email.'},{status:502});
  await sb.from('email_logs').insert({club_id:inv.club_id,recipient:inv.email,email_type:'invitation',subject:`You're invited to ${clubName} on NADORIO`,status:'sent',provider_id:out.id,created_by:user.id});
  return NextResponse.json({ok:true,id:out.id});
 }catch(e:any){return NextResponse.json({error:e?.message||'Unable to send email.'},{status:500})}
}
