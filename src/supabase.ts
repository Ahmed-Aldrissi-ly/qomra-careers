import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_KEY} from './config';
export const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:'qomra-recruitment-auth',persistSession:true,autoRefreshToken:true,flowType:'pkce',detectSessionInUrl:true}});

// The SDK exchanges the Google callback code using this browser's PKCE verifier.
// Await it before checking the account; never display raw provider error details.
export const authReady=supabase.auth.initialize().then(({error})=>{
 const url=new URL(window.location.href);
 const incomplete=url.searchParams.has('code');
 if(!error&&!incomplete)return '';
 for(const key of ['code','error','error_code','error_description','flow_id'])url.searchParams.delete(key);
 url.hash='';
 window.history.replaceState(window.history.state,'',url.toString());
 return 'Google sign-in did not finish. Please try again in this browser and choose your Qomra company account.';
});
