import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const config=await readFile(new URL('../src/config.ts',import.meta.url),'utf8');
const url=config.match(/SUPABASE_URL = '([^']+)'/)[1];const key=config.match(/SUPABASE_KEY = '([^']+)'/)[1];
for(const table of ['qomra_job_applications','qomra_job_files','qomra_job_reviewers']){const r=await fetch(url+'/rest/v1/'+table+'?select=*',{headers:{apikey:key}});assert.ok([401,403].includes(r.status),'Anonymous read denied for '+table+': '+r.status);}
const endpoint=url+'/functions/v1/qomra-job-apply';
function form(override={},uploads=false){const d=new FormData();Object.entries({submissionId:crypto.randomUUID(),name:'Qomra Integration QA',email:'recruitment-qa@example.com',phone:'+218910000001',role:'Other',otherRole:'Motion Designer',portfolio:'',...override}).forEach(([k,v])=>d.append(k,v));if(uploads){d.append('resume',new File(['%PDF-1.4\nQomra test fixture\n%%EOF'],'qa-resume.pdf',{type:'application/pdf'}));d.append('work',new File(['%PDF-1.4\nQomra work fixture\n%%EOF'],'qa-work.pdf',{type:'application/pdf'}));}return d;}
const request=(d,headers={})=>fetch(endpoint,{method:'POST',headers:{apikey:key,Origin:'http://127.0.0.1:5181',...headers},body:d});
const invalid=await request(form({otherRole:''}));assert.equal(invalid.status,400,await invalid.clone().text());
assert.equal((await request(form(),{Origin:'https://untrusted.example'})).status,403);
assert.equal((await fetch(endpoint,{method:'POST',body:form()})).status,401);
const bad=form();bad.append('resume',new File(['html not pdf'],'fake.pdf'));assert.equal((await request(bad)).status,400);
const ids=[crypto.randomUUID(),crypto.randomUUID()];
for(let i=0;i<ids.length;i++){const r=await request(form({submissionId:ids[i]},i===1));assert.equal(r.status,201,await r.clone().text());assert.equal((await r.json()).id,ids[i]);}
const repeat=await request(form({submissionId:ids[1]},true));assert.equal(repeat.status,200,await repeat.clone().text());
await mkdir(new URL('../work/',import.meta.url),{recursive:true});await writeFile(new URL('../work/qa-records.json',import.meta.url),JSON.stringify(ids));
console.log('PASS: anonymous data access denied; correct project key required; origin and field validation; invalid file rejected; minimal and file-backed submissions saved; retries deduplicated.');
console.log('QA record IDs:',ids.join(', '));
