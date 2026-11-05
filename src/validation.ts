export const roles = ['Photographer / Videographer', 'Video Editor', 'Motion Graphics Designer', 'Social Media Manager', 'Content Creator', 'On-camera Presenter', 'Creative Director', 'Graphic Designer', 'Other'] as const;
export const statuses = ['New', 'Reviewing', 'Shortlisted', 'Contacted', 'Archived'] as const;
export type Fields = {name:string;email:string;phone:string;role:string;otherRole:string;portfolio:string};
export const emptyFields:Fields = {name:'',email:'',phone:'',role:'',otherRole:'',portfolio:''};
export function normalizePhone(phone:string) {
  return phone.replace(/[٠-٩۰-۹]/g, x=>String(x.charCodeAt(0)-(x>='۰'?1776:1632))).trim();
}
export function normalizeLink(value:string) {
  const s=value.trim();
  if(!s) return '';
  const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(s)?s:`https://${s}`);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.')) throw new Error('Enter a valid website link.');
  return url.href;
}
export function validateFields(f:Fields, step?:number):Record<string,string> {
  const e:Record<string,string>={};
  if(step===undefined||step===0){
    if(f.name.trim().length<2||f.name.length>120) e.name='Please enter your full name (2–120 characters).';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())||f.email.length>254) e.email='Please enter a valid email address.';
    const phone=normalizePhone(f.phone);
    if(!/^\+?[\d\s().-]+$/.test(phone)||phone.replace(/\D/g,'').length<7||phone.replace(/\D/g,'').length>15) e.phone='Please enter a valid phone number with country code.';
  }
  if(step===undefined||step===1){
    if(!(roles as readonly string[]).includes(f.role)) e.role='Choose the role that best fits you.';
    if(f.role==='Other'&&(f.otherRole.trim().length<2||f.otherRole.length>120)) e.otherRole='Tell us your occupation (2–120 characters).';
  }
  if(step===undefined||step===2){
    if(f.portfolio.length>2000) e.portfolio='This link is too long.';
    else {try {normalizeLink(f.portfolio);}catch {e.portfolio='Enter a valid website link, such as https://yourportfolio.com.';}}
  }
  return e;
}
export function validateFileMeta(file:{name:string;size:number},kind:'resume'|'work') {
  const ext=file.name.split('.').pop()?.toLowerCase()||'';
  const allowed=kind==='resume'?['pdf','doc','docx']:['pdf','jpg','jpeg','png','webp','mp4','mov'];
  if(!allowed.includes(ext)) return kind==='resume'?'Use a PDF, DOC, or DOCX résumé.':'Use a PDF, JPG, PNG, WebP, MP4, or MOV work sample.';
  if(file.size<=0) return 'This file is empty.';
  if(file.size>(kind==='resume'?5:10)*1024*1024) return `${kind==='resume'?'Résumés must be 5':'Work samples must be 10'} MB or smaller.`;
  if(file.name.length>200) return 'Please shorten the file name.';
  return '';
}
export function validFileSignature(name:string,b:Uint8Array){
  const ext=name.split('.').pop()?.toLowerCase();const text=new TextDecoder('latin1').decode(b);
  if(ext==='pdf') return text.startsWith('%PDF-');
  if(ext==='doc') return b[0]===0xd0&&b[1]===0xcf&&b[2]===0x11&&b[3]===0xe0;
  if(ext==='docx') return b[0]===0x50&&b[1]===0x4b&&b[2]===3&&b[3]===4;
  if(ext==='png') return b[0]===137&&text.slice(1,4)==='PNG';
  if(ext==='jpg'||ext==='jpeg') return b[0]===255&&b[1]===216&&b[2]===255;
  if(ext==='webp') return text.startsWith('RIFF')&&text.slice(8,12)==='WEBP';
  if(ext==='mp4'||ext==='mov') return ['ftyp','moov','mdat','wide'].includes(text.slice(4,8));
  return false;
}
export function csvCell(value:unknown){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
