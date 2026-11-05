import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFields,validateFileMeta,validFileSignature,normalizeLink,normalizePhone,csvCell} from '../src/validation.ts';
const minimal={name:'Sam Example',email:'sam@example.com',phone:'+218 91 000 0000',role:'Photographer / Videographer',otherRole:'',portfolio:''};
test('all requested roles and optional work accept a minimal application',()=>{assert.deepEqual(validateFields(minimal),{});});
test('Other requires a custom occupation',()=>{assert.ok(validateFields({...minimal,role:'Other'}).otherRole);assert.deepEqual(validateFields({...minimal,role:'Other',otherRole:'Motion designer'}),{});});
test('contact fields validate and Arabic phone digits normalize',()=>{assert.equal(normalizePhone('+٢١٨ ٩١ ٠٠٠ ٠٠٠٠'),'+218 91 000 0000');const e=validateFields({...minimal,name:'',email:'not-an-email',phone:'abcd'});assert.deepEqual(Object.keys(e),['name','email','phone']);});
test('links allow ordinary portfolio URLs and reject executable schemes',()=>{assert.equal(normalizeLink('behance.net/example'),'https://behance.net/example');assert.throws(()=>normalizeLink('javascript:alert(1)'));assert.throws(()=>normalizeLink('https://user:password@example.com'));assert.equal(normalizeLink(''),'');});
test('file limits and MIME signatures reject bad uploads',()=>{assert.equal(validateFileMeta({name:'cv.pdf',size:100},'resume'),'');assert.ok(validateFileMeta({name:'script.html',size:100},'work'));assert.ok(validateFileMeta({name:'film.mp4',size:11*1024*1024},'work'));assert.ok(validateFileMeta({name:'cv.pdf',size:0},'resume'));assert.equal(validFileSignature('cv.pdf',new TextEncoder().encode('%PDF-1.4')),true);assert.equal(validFileSignature('cv.pdf',new TextEncoder().encode('<script>')),false);});
test('CSV safely quotes commas and guards spreadsheet formula injection',()=>{assert.equal(csvCell('Smith, Sam'),'"Smith, Sam"');assert.equal(csvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');assert.equal(csvCell('+218910000000'),'"\'+218910000000"');});

test('presenter and postproduction roles accept optional work while retired roles are rejected',()=>{for(const role of ['On-camera Presenter','Video Editor','Motion Graphics Designer'])assert.deepEqual(validateFields({...minimal,role}),{});for(const role of ['Videographer','Photographer'])assert.ok(validateFields({...minimal,role}).role);});
test('browser and deployed function use the same submission validation',()=>{assert.equal(readFileSync(new URL('../src/validation.ts',import.meta.url),'utf8'),readFileSync(new URL('../supabase/functions/qomra-job-apply/validation.ts',import.meta.url),'utf8'));});
