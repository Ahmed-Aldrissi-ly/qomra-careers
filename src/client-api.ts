import {supabase} from './supabase';
import {csvCell} from './validation';
import {sitePath} from './paths';
export type Application={id:string;name:string;email:string;phone:string;role:string;other_role:string;portfolio:string;status:string;notes:string;created_at:number};
export type Attachment={id:string;kind:string;name:string;size:number;object_key:string};
export type Data={applications:Application[];total:number;summary:{status:string;count:number}[];byRole:{role:string;count:number}[]};
function convert(row:Record<string,unknown>){return {...row,created_at:Date.parse(String(row.created_at))} as Application;}
export async function listApplications(search:string,role:string,status:string,page:number):Promise<Data>{
 let query=supabase.from('qomra_job_applications').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range((page-1)*25,page*25-1);
 const safe=search.replace(/[^\p{L}\p{N}@ ._+\-]/gu,' ').trim().slice(0,150);
 if(safe)query=query.or(['name','email','phone','other_role'].map(k=>`${k}.ilike.%${safe}%`).join(','));
 if(role)query=query.eq('role',role);if(status)query=query.eq('status',status);
 const [rows,summary]=await Promise.all([query,supabase.rpc('qomra_job_summary')]);if(rows.error)throw rows.error;if(summary.error)throw summary.error;
 return {applications:(rows.data||[]).map(convert),total:rows.count||0,summary:summary.data.summary,byRole:summary.data.byRole};
}
export async function getApplication(id:string){const [app,files]=await Promise.all([supabase.from('qomra_job_applications').select('*').eq('id',id).single(),supabase.from('qomra_job_files').select('*').eq('application_id',id)]);if(app.error)throw app.error;if(files.error)throw files.error;return {application:convert(app.data),files:files.data as Attachment[]};}
export async function saveApplication(id:string,status:string,notes:string){const r=await supabase.from('qomra_job_applications').update({status,notes}).eq('id',id).select('id').single();if(r.error)throw r.error;}
function saveBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export async function downloadFile(file:Attachment){const r=await supabase.storage.from('qomra-job-files').download(file.object_key);if(r.error)throw r.error;saveBlob(r.data,file.name);}
export async function exportApplications(){
 const lines=[['Name','Email','Phone','Occupation','Portfolio','Status','Submitted (UTC)','Notes','Application'].map(csvCell).join(',')];let offset=0;
 while(true){const r=await supabase.from('qomra_job_applications').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+249);if(r.error)throw r.error;
 for(const a of r.data){const link=new URL(sitePath('team/'),location.origin);link.searchParams.set('application',a.id);lines.push([a.name,a.email,a.phone,a.role==='Other'?a.other_role:a.role,a.portfolio,a.status,a.created_at,a.notes,link.href].map(csvCell).join(','));}
 if(r.data.length<250)break;offset+=250;
 }saveBlob(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),'qomra-applications.csv');
}
