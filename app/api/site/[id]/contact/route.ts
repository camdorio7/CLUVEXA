import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid organization'},{status:400});
 let body:Record<string,unknown>;
 try{if(Number(request.headers.get('content-length')||0)>10000)return NextResponse.json({error:'Message too large'},{status:413});const raw=await request.text();if(raw.length>10000)return NextResponse.json({error:'Message too large'},{status:413});body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid payload')}catch{return NextResponse.json({error:'Invalid message'},{status:400})}
 if(typeof body.website==='string'&&body.website.trim())return NextResponse.json({ok:true});
 const name=typeof body.name==='string'?body.name.trim():'';
 const email=typeof body.email==='string'?body.email.trim():'';
 const message=typeof body.message==='string'?body.message.trim():'';
 if(!name||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||!message||message.length>4000)return NextResponse.json({error:'Check the contact fields'},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!secret)return NextResponse.json({error:'Contact service not configured'},{status:503});
 const publicDb=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:site,error:siteError}=await publicDb.from('organization_sites').select('club_id').eq('club_id',id).eq('published',true).maybeSingle();
 if(siteError)return NextResponse.json({error:'Contact service temporarily unavailable'},{status:503});
 if(!site)return NextResponse.json({error:'Website not available'},{status:404});
 const adminDb=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await adminDb.from('organization_site_messages').insert({club_id:id,sender_name:name,sender_email:email,message});
 if(error){if(error.code==='P0001')return NextResponse.json({error:'Too many messages. Please try again later.'},{status:429});return NextResponse.json({error:'Message could not be delivered'},{status:500});}
 return NextResponse.json({ok:true});
}
