import { existsSync, readFileSync } from 'node:fs';
const required = ['app/api/site/[id]/contact/route.ts','app/site/[id]/page.tsx','app/workspace/[id]/site-builder/page.tsx','app/workspace/[id]/email-center/page.tsx','supabase/migrations/014_nadorio_universal_websites.sql'];
let errors = 0;
for (const path of required) { const ok=existsSync(path); console.log(`${ok?'OK':'MISSING'} ${path}`); if(!ok) errors++; }
const p=JSON.parse(readFileSync('package.json','utf8'));
if (p.version.includes('alpha')) {console.error(`Release blocker: package version is still ${p.version}`);errors++;}
for(const name of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']) {
 console.log(`Vercel required: ${name} (verify in Vercel; not checked locally)`);
}
if(errors){console.error(`${errors} release checks failed`);process.exitCode=1;}else console.log('Repository release checks passed. Live testing is still required.');
