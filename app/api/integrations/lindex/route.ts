import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  try{
    const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    const clubId=req.nextUrl.searchParams.get('clubId');
    if(!token||!clubId) return NextResponse.json({error:'Unauthorized'},{status:401});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url||!key) return NextResponse.json({error:'NADORIO server configuration is incomplete.'},{status:503});
    const sb=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
    const {data:user,error:userError}=await sb.auth.getUser(token);
    if(userError||!user.user) return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:platform,error:platformError}=await sb.from('connected_platforms').select('platform_key,status').eq('club_id',clubId).eq('platform_key','lindex').maybeSingle();
    if(platformError||!platform) return NextResponse.json({error:'LINDEX is not connected to this organization.'},{status:403});
    const endpoint=process.env.LINDEX_INTEGRATION_URL || 'https://linderhofmembers.com/api/cluvexa-metrics';
    const secret=process.env.LINDEX_INTEGRATION_SECRET;
    if(!secret) return NextResponse.json({connected:false,error:'LINDEX integration secret has not been configured in NADORIO.'},{status:503});
    const upstream=await fetch(endpoint,{headers:{'x-cluvexa-integration-key':secret,'accept':'application/json'},cache:'no-store'});
    const body=await upstream.json().catch(()=>({error:'Invalid response from LINDEX'}));
    if(!upstream.ok) return NextResponse.json({connected:false,error:body.error||'LINDEX did not return metrics.'},{status:502});
    return NextResponse.json({connected:true,...body},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error:any){return NextResponse.json({connected:false,error:error?.message||'Could not connect to LINDEX.'},{status:500});}
}
