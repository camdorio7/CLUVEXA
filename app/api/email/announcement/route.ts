import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
function client(req:NextRequest){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:req.headers.get('authorization')||''}},auth:{persistSession:false,autoRefreshToken:false}})}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
export async function POST(req:NextRequest){try{
 if(!process.env.RESEND_API_KEY)return NextResponse.json({error:'Email service is not configured.'},{status:503});
 const {clubId,title,body,audience='all'}=await req.json(); if(!clubId||!title||!body)return NextResponse.json({error:'Missing fields.'},{status:400});
 const sb=client(req);const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {data:club}=await sb.from('clubs').select('name,contact_email').eq('id',clubId).single(); if(!club)return NextResponse.json({error:'Club not found or access denied.'},{status:403});
 let recipients:string[]=[];
 if(audience==='staff'||audience==='all'){const {data}=await sb.from('club_users').select('role,profiles(email)').eq('club_id',clubId).eq('active',true); recipients.push(...(data||[]).filter((x:any)=>audience==='all'||['owner','admin','manager','staff'].includes(x.role)).map((x:any)=>x.profiles?.email).filter(Boolean));}
 if(audience==='members'||audience==='all'){const {data}=await sb.from('members').select('email').eq('club_id',clubId).eq('status','active');recipients.push(...(data||[]).map((x:any)=>x.email).filter(Boolean));}
 recipients=[...new Set(recipients.map(x=>String(x).toLowerCase()))]; if(!recipients.length)return NextResponse.json({error:'No email recipients found for this audience.'},{status:400});
 const html=`<!doctype html><html><body style="margin:0;background:#07101f;font-family:Arial,sans-serif;color:#eef5ff"><div style="max-width:620px;margin:0 auto;padding:36px 20px"><div style="font-weight:800;letter-spacing:3px;font-size:22px">NADORIO</div><div style="background:#101b2e;border:1px solid #22324d;border-radius:18px;padding:32px;margin-top:22px"><div style="color:#8fa5c3;font-size:13px">${esc(club.name)}</div><h1>${esc(title)}</h1><div style="color:#c8d4e6;line-height:1.65;white-space:pre-wrap">${esc(body)}</div></div><div style="color:#6f809a;font-size:12px;margin-top:18px">Sent by ${esc(club.name)} via NADORIO · CD7 Technologies</div></div></body></html>`;
 let sent=0,failed=0; for(let i=0;i<recipients.length;i+=50){const batch=recipients.slice(i,i+50);const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.NADORIO_EMAIL_FROM||'NADORIO <notifications@nadorio.com>',to:batch,reply_to:club.contact_email||process.env.NADORIO_REPLY_TO||undefined,subject:`${club.name}: ${title}`,html})}); if(r.ok)sent+=batch.length;else failed+=batch.length;}
 await sb.from('email_logs').insert({club_id:clubId,recipient:`${recipients.length} recipients`,email_type:'announcement',subject:title,status:failed?'partial':'sent',metadata:{audience,sent,failed},created_by:user.id});
 return NextResponse.json({ok:failed===0,sent,failed});
}catch(e:any){return NextResponse.json({error:e?.message||'Unable to send announcement.'},{status:500})}}
