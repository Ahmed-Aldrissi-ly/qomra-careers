import {createClient} from '@supabase/supabase-js';
import {validateFields,normalizePhone,normalizeLink,validateFileMeta,validFileSignature,emptyFields} from './validation.ts';
const origins=new Set(['https://qomra-careers.qomra-ca.chatgpt.site','https://ahmed-aldrissi-ly.github.io','http://127.0.0.1:5181','http://localhost:5181']);
const bucketName='qomra-job-files';
function keys(name:string):Record<string,string>{try{return JSON.parse(Deno.env.get(name)||'{}');}catch{return {};}}
const secret=keys('SUPABASE_SECRET_KEYS').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
let bucketReady:Promise<void>|undefined;
async function prepareBucket(){if(!bucketReady)bucketReady=(async()=>{const {data,error}=await db.storage.getBucket(bucketName);if(data){if(data.public)throw new Error('Bucket must remain private');return;}const created=await db.storage.createBucket(bucketName,{public:false,fileSizeLimit:10485760,allowedMimeTypes:['application/octet-stream']});if(created.error){const check=await db.storage.getBucket(bucketName);if(!check.data||check.data.public)throw created.error;}})().catch(e=>{bucketReady=undefined;throw e;});return bucketReady;}
async function boundedForm(req:Request){const limit=36*1024*1024;if(Number(req.headers.get('content-length')||0)>limit)throw new Error('TOO_LARGE');if(!req.body)throw new Error('EMPTY');const reader=req.body.getReader();const chunks:Uint8Array[]=[];let size=0;while(true){const c=await reader.read();if(c.done)break;size+=c.value.length;if(size>limit){await reader.cancel();throw new Error('TOO_LARGE');}chunks.push(c.value);}return new Response(new Blob(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';const cors={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://qomra-careers.qomra-ca.chatgpt.site','Access-Control-Allow-Headers':'apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
 if(origin&&!origins.has(origin))return json({error:'Request origin not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 // This public submission endpoint checks the project publishable key itself.
 // Applicant authentication is deliberately unnecessary. No read operations are exposed.
 const apiKey=req.headers.get('apikey')||'';
 if(!Object.values(keys('SUPABASE_PUBLISHABLE_KEYS')).includes(apiKey)&&apiKey!==Deno.env.get('SUPABASE_ANON_KEY'))return json({error:'Invalid project key.'},401);
 const uploaded:string[]=[];
 try{
  const address=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
  const raw=address+':'+Math.floor(Date.now()/1800000);const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const attempt=await db.rpc('qomra_job_attempt',{bucket_key:digest});if(attempt.error)throw attempt.error;if(attempt.data>30)return json({error:'Too many attempts. Please try again in 30 minutes.'},429);
  const data=await boundedForm(req);if(data.get('website'))return json({error:'Unable to submit this application.'},400);
  const id=String(data.get('submissionId')||'');if(!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id))return json({error:'Please reload and try again.'},400);
  const existing=await db.from('qomra_job_applications').select('id').eq('id',id).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return json({id});
  const fields={...emptyFields};for(const key of Object.keys(fields) as (keyof typeof fields)[])fields[key]=String(data.get(key)||'').trim();
  const errors=validateFields(fields);if(Object.keys(errors).length)return json({error:'Please check your application.',fields:errors},400);
  const resume=data.getAll('resume').filter((v):v is File=>typeof v!=='string'&&v.size>0);const work=data.getAll('work').filter((v):v is File=>typeof v!=='string'&&v.size>0);
  if(resume.length>1||work.length>3)return json({error:'Add one résumé and up to three work samples.'},400);
  const attachments=[...resume.map(file=>({file,kind:'resume' as const})),...work.map(file=>({file,kind:'work' as const}))];
  for(const {file,kind} of attachments){const error=validateFileMeta(file,kind);if(error)return json({error},400);if(!validFileSignature(file.name,new Uint8Array(await file.slice(0,16).arrayBuffer())))return json({error:`${file.name} does not match its file type. Choose another file.`},400);}
  const metadata=[];if(attachments.length)await prepareBucket();
  for(const {file,kind} of attachments){const fileId=crypto.randomUUID();const objectKey=`${id}/${fileId}`;const upload=await db.storage.from(bucketName).upload(objectKey,await file.arrayBuffer(),{contentType:'application/octet-stream',upsert:false});if(upload.error)throw upload.error;uploaded.push(objectKey);metadata.push({id:fileId,kind,object_key:objectKey,name:file.name,size:file.size});}
  const result=await db.rpc('qomra_job_submit',{application:{id,name:fields.name,email:fields.email.toLowerCase(),phone:normalizePhone(fields.phone),role:fields.role,other_role:fields.role==='Other'?fields.otherRole:'',portfolio:normalizeLink(fields.portfolio)},attachments:metadata});
  if(result.error){if(uploaded.length){await db.storage.from(bucketName).remove(uploaded);uploaded.length=0;}const repeated=await db.from('qomra_job_applications').select('id').eq('id',id).maybeSingle();if(repeated.data)return json({id});throw result.error;}
  return json({id},201);
 }catch(error){if(uploaded.length)await db.storage.from(bucketName).remove(uploaded);if(error instanceof Error&&error.message==='TOO_LARGE')return json({error:'Your attachments are too large. Use a portfolio link for large videos.'},413);console.error('Submission failed',error instanceof Error?error.message:JSON.stringify(error));return json({error:'We couldn’t save your application. Your details are still here—please try again.'},500);}
});
