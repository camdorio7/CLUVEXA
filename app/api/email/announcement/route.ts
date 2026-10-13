import {NextRequest,NextResponse} from 'next/server';
import {authorizeOrganizationEmail} from '../../../../lib/organization-email-access';
function esc(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
export async function POST(req:NextRequest){try{
 if(!process.env.RESEND_API_KEY)return NextResponse.json({error:'Email service is not configured.'},{status:503});
 const {clubId,title,body,audience='all'}=await req.json(); if(typeof clubId!=='string'||!clubId||typeof title!=='string'||!title.trim()||title.length>180||typeof body!=='string'||!body.trim()||body.length>12000||!['all','staff','members'].includes(audience))return NextResponse.json({error:'Invalid announcement fields or audience.'},{status:400});
 const access=await authorizeOrganizationEmail(req,clubId,['owner','admin','manager']);if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});const {sb,user}=access;
 const {data:club}=await sb.from('clubs').select('name,contact_email').eq('id',clubId).single(); if(!club)return NextResponse.json({error:'Club not found or access denied.'},{status:403});
 let recipients:string[]=[];
 if(audience==='staff'||audience==='all'){const {data}=await sb.from('club_users').select('role,profiles(email)').eq('club_id',clubId).eq('active',true); recipients.push(...(data||[]).filter((x:any)=>audience==='all'||['owner','admin','manager','staff'].includes(x.role)).map((x:any)=>x.profiles?.email).filter(Boolean));}
 if(audience==='members'||audience==='all'){const {data}=await sb.from('members').select('email').eq('club_id',clubId).eq('status','active');recipients.push(...(data||[]).map((x:any)=>x.email).filter(Boolean));}
 recipients=[...new Set(recipients.map(x=>String(x).trim().toLowerCase()).filter(x=>/^\S+@\S+\.\S+$/.test(x)))]; if(!recipients.length)return NextResponse.json({error:'No email recipients found for this audience.'},{status:400});
 const html=`<!doctype html><html><body style="margin:0;background:#07101f;font-family:Arial,sans-serif;color:#eef5ff"><div style="max-width:620px;margin:0 auto;padding:36px 20px"><div style="font-weight:800;letter-spacing:3px;font-size:22px">NADORIO</div><div style="background:#101b2e;border:1px solid #22324d;border-radius:18px;padding:32px;margin-top:22px"><div style="color:#8fa5c3;font-size:13px">${esc(club.name)}</div><h1>${esc(title)}</h1><div style="color:#c8d4e6;line-height:1.65;white-space:pre-wrap">${esc(body)}</div></div><div style="color:#6f809a;font-size:12px;margin-top:18px">Sent by ${esc(club.name)} via NADORIO · CD7 Technologies</div></div></body></html>`;
 // Resend batch API sends one distinct message per recipient. Never put an audience
 // in a single email's `to` field: that exposes other members' addresses.
 let sent=0,failed=0;
 for(let i=0;i<recipients.length;i+=100){
  const batch=recipients.slice(i,i+100);
  const messages=batch.map(email=>({from:process.env.NADORIO_EMAIL_FROM||'NADORIO <notifications@nadorio.com>',to:[email],reply_to:club.contact_email||process.env.NADORIO_REPLY_TO||undefined,subject:`${club.name}: ${title}`,html}));
  try {
   const r=await fetch('https://api.resend.com/emails/batch',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(messages),cache:'no-store'});
   if(!r.ok){failed+=batch.length;continue;}
   const result=await r.json();
   // Resend may report a partial batch with an array of accepted messages.
   const accepted=Array.isArray(result?.data)?result.data.filter((entry:any)=>entry?.id).length:0;
   sent+=accepted;failed+=batch.length-accepted;
  }catch{failed+=batch.length;}
 }

 await sb.from('email_logs').insert({club_id:clubId,recipient:`${recipients.length} recipients`,email_type:'announcement',subject:title,status:failed?'partial':'sent',metadata:{audience,sent,failed},created_by:user.id});
 return NextResponse.json({ok:failed===0,sent,failed},{status:failed?502:200});
}catch(e:any){return NextResponse.json({error:e?.message||'Unable to send announcement.'},{status:500})}}
