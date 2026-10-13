'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {createClient} from '../../../../lib/supabase/client';

type Round = {id:string; played_on:string; course_name:string; course_rating:number; slope_rating:number; holes:number[]; gross_score:number; differential:number};
const emptyHoles = () => Array.from({length:18},()=> '');
export default function ScorecardPage(){
 const {id}=useParams<{id:string}>(); const [userId,setUserId]=useState('');const [allowed,setAllowed]=useState(false);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [rounds,setRounds]=useState<Round[]>([]);const [course,setCourse]=useState('');const [date,setDate]=useState(new Date().toISOString().slice(0,10));
 const [rating,setRating]=useState('72');const [slope,setSlope]=useState('113');const [holes,setHoles]=useState<string[]>(emptyHoles());
 useEffect(()=>{let active=true;(async()=>{const sb=createClient();const {data:{user}}=await sb.auth.getUser();if(!user){if(active){setError('Sign in to access your scores.');setLoading(false)}return;}
 const [{data:cu},{data:mod},{data:superUser},{data:records,error:queryError}]=await Promise.all([
 sb.from('club_users').select('role,active').eq('club_id',id).eq('user_id',user.id).maybeSingle(),
 sb.from('club_modules').select('licensed,club_enabled,member_visible').eq('club_id',id).eq('module_key','golf').maybeSingle(),
 sb.rpc('is_super_admin'),
 sb.from('golf_scorecards').select('id,played_on,course_name,course_rating,slope_rating,holes,gross_score,differential').eq('club_id',id).eq('user_id',user.id).order('played_on',{ascending:false}).limit(40)
 ]);
 const permitted=!!mod?.licensed&&!!mod?.club_enabled&&(superUser===true||(cu?.active===true&&(cu.role!=='member'||mod.member_visible===true)));
 if(active){setUserId(user.id);setAllowed(permitted);setRounds((records||[]) as Round[]);setError(queryError?.message||(!permitted?'Golf scoring is not enabled for your membership.':''));setLoading(false)}
 })();return()=>{active=false}},[id]);
 async function save(){setError('');if(!allowed||!userId)return;const values=holes.map(Number);const cr=Number(rating),sl=Number(slope);
 if(!course.trim()||course.length>120||!date||holes.some(h=>!h.trim())||values.some(n=>!Number.isInteger(n)||n<1||n>20)||!Number.isFinite(cr)||cr<45||cr>85||!Number.isInteger(sl)||sl<55||sl>155){setError('Enter a course, date, all 18 hole scores (1–20), course rating (45–85), and slope (55–155).');return;}
 setBusy(true);const gross=values.reduce((a,b)=>a+b,0);const differential=Math.round(((gross-cr)*113/sl)*10)/10;
 const sb=createClient();const {data,error:saveError}=await sb.from('golf_scorecards').insert({club_id:id,user_id:userId,played_on:date,course_name:course.trim(),course_rating:cr,slope_rating:sl,holes:values,gross_score:gross,differential}).select('id,played_on,course_name,course_rating,slope_rating,holes,gross_score,differential').single();
 if(saveError)setError(saveError.message);else if(data){setRounds(prev=>[data as Round,...prev].sort((a,b)=>b.played_on.localeCompare(a.played_on)).slice(0,40));setHoles(emptyHoles());setCourse('');setError('Round saved.');}setBusy(false);
 }
 if(loading)return <div className="n10GolfPanel" role="status">Loading your golf scorecard…</div>;
 if(!allowed)return <div className="n10GolfPanel"><h2>Golf scorecard unavailable</h2><p>{error||'Ask your organization administrator to enable Golf for members.'}</p></div>;
 return <div><div className="portalSectionTitle"><div><span>GOLF & SCORING</span><h2>My Scorecard</h2><p>Record an 18-hole round for your club account.</p></div></div>
 <section className="n10GolfPanel"><h2>New round</h2><div className="n10GolfForm"><label>Course name<input maxLength={120} value={course} onChange={e=>setCourse(e.target.value)} placeholder="Course name"/></label><label>Date played<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Course rating<input type="number" min="45" max="85" step="0.1" value={rating} onChange={e=>setRating(e.target.value)}/></label><label>Slope rating<input type="number" min="55" max="155" step="1" value={slope} onChange={e=>setSlope(e.target.value)}/></label></div>
 <h3 style={{marginTop:22}}>Hole-by-hole strokes</h3><div className="n10GolfGrid">{holes.map((v,i)=><label className="n10GolfHole" key={i}><span>Hole {i+1}</span><input aria-label={`Hole ${i+1} strokes`} type="number" inputMode="numeric" min="1" max="20" value={v} onChange={e=>setHoles(old=>old.map((x,j)=>j===i?e.target.value:x))}/></label>)}</div>
 <p>Gross score: <strong>{holes.every(x=>x.trim()!==''&&Number(x)>=1)?holes.reduce((s,x)=>s+Number(x),0):'—'}</strong></p>
 <button type="button" disabled={busy} onClick={save}>{busy?'Saving…':'Save round'}</button>{error&&<p role="status" className="n10GolfMessage">{error}</p>}</section>
 <section className="n10GolfPanel"><h2>Recent rounds</h2><div className="n10GolfHistory">{rounds.map(r=><div key={r.id}><span><b>{r.course_name}</b><br/><small>{r.played_on}</small></span><span>Gross <b>{r.gross_score}</b> · Differential <b>{Number(r.differential).toFixed(1)}</b></span></div>)}{rounds.length===0&&<p>No rounds recorded yet.</p>}</div><p><Link href={`/workspace/${id}/golf-index`}>View your scoring index →</Link></p></section></div>;
}
