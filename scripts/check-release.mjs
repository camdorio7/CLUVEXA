import { existsSync, readFileSync } from 'node:fs';
const required = ['app/api/site/[id]/contact/route.ts','app/site/[id]/page.tsx','app/workspace/[id]/site-builder/page.tsx','app/workspace/[id]/email-center/page.tsx','supabase/migrations/014_nadorio_universal_websites.sql','supabase/migrations/015_nadorio_website_pages.sql','app/site/[id]/[slug]/page.tsx','supabase/migrations/016_nadorio_contact_protection.sql'];
let errors = 0;
for (const path of required) { const ok=existsSync(path); console.log(`${ok?'OK':'MISSING'} ${path}`); if(!ok) errors++; }
const announcement = readFileSync('app/api/email/announcement/route.ts','utf8');
if (!announcement.includes('api.resend.com/emails/batch') || !announcement.includes('to:[email]')) { console.error('Release blocker: announcements must send separate recipient messages.'); errors++; }
const lindex = readFileSync('app/api/integrations/lindex/route.ts','utf8');
if (!lindex.includes('LINDEX_INTEGRATION_CLUB_ID') || !lindex.includes("eq('user_id', user.id)") || !lindex.includes("platform.status !== 'connected'")) { console.error('Release blocker: LINDEX metrics require tenant authorization and integration ownership.'); errors++; }
const p=JSON.parse(readFileSync('package.json','utf8'));
if (p.version.includes('alpha')) {console.error(`Release blocker: package version is still ${p.version}`);errors++;}
for(const name of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']) {
 console.log(`Vercel required: ${name} (verify in Vercel; not checked locally)`);
}
if(errors){console.error(`${errors} release checks failed`);process.exitCode=1;}else console.log('Repository release checks passed. Live testing is still required.');
