'use strict';

const APP_VERSION = '2.9';
const COUNTRIES = {
  KW: { name: 'Kuwait', flag: '🇰🇼', currency: 'KWD', decimals: 3 },
  IN: { name: 'India', flag: '🇮🇳', currency: 'INR', decimals: 2 }
};
const DB_NAME = 'rahman-expense-v2-db';
const DB_STORE = 'kv';
const STATE_KEY = 'rahman_expense_state_v2';
const CLOUD_CONFIG_KEY = 'rahman_expense_cloud_config_v2';

// The same category structure is used for Kuwait and India.
// Shopping is intentionally split so personal purchases and home purchases never mix.
// Groceries is a dedicated top-level category for supermarket and household food purchases.
const CATEGORIES = {
  Housing: { icon: '🏠', subs: ['Rent', 'Maintenance', 'Furniture', 'Other'] },
  Groceries: { icon: '🛒', subs: ['Supermarket', 'Vegetables & Fruits', 'Meat & Fish', 'Household Food', 'General', 'Other'] },
  Food: { icon: '🍽️', subs: ['Restaurant', 'Delivery', 'Coffee', 'Snacks', 'Other'] },
  Transport: { icon: '🚕', subs: ['Fuel', 'Taxi', 'Public Transport', 'Parking', 'Other'] },
  Vehicle: { icon: '🚗', subs: ['Maintenance', 'Insurance', 'Registration', 'Other'] },
  'Personal Shopping': { icon: '🛍️', subs: ['Clothing', 'Electronics', 'Accessories', 'Personal Items', 'General', 'Other'] },
  'Home Shopping': { icon: '🛒', subs: ['Furniture', 'Appliances', 'Kitchen', 'Home Supplies', 'Decor', 'General', 'Other'] },
  Utilities: { icon: '💡', subs: ['Electricity', 'Water', 'Gas', 'Other'] },
  Internet: { icon: '🌐', subs: ['Home Internet', 'Other'] },
  Mobile: { icon: '📱', subs: ['Plan', 'Recharge', 'Other'] },
  Health: { icon: '🩺', subs: ['Consultation', 'Pharmacy', 'Tests', 'Injection / IV', 'Other'] },
  Education: { icon: '🎓', subs: ['Fees', 'Transportation', 'Uniforms', 'Books', 'Other'] },
  Family: { icon: '👨‍👩‍👧‍👦', subs: ['Household', 'Children', 'Support', 'Other'] },
  Entertainment: { icon: '🎬', subs: ['Subscriptions', 'Cinema', 'Activities', 'Other'] },
  Travel: { icon: '✈️', subs: ['Flights', 'Hotel', 'Food', 'Transport', 'Other'] },
  Insurance: { icon: '🛡️', subs: ['Medical', 'Vehicle', 'Life', 'Other'] },
  Personal: { icon: '🧴', subs: ['Grooming', 'Beauty', 'Fitness', 'Other'] },
  'Gifts & Charity': { icon: '🎁', subs: ['Gifts', 'Charity', 'Other'] },
  Banking: { icon: '🏦', subs: ['Bank Fee', 'Exchange Fee', 'Other'] },
  Other: { icon: '📦', subs: ['Uncategorized'] }
};

const PALETTE = ['#24685d','#c16b44','#667ac4','#b38b34','#865b9e','#4b8b88','#bf5f68','#728151','#4c6d91','#9b6d55','#7c6f9c','#5d8b63','#a0657b','#7a7f46','#4e8096','#9c6b3e','#6d738f','#7e6c5e'];

const MERCHANT_HINTS = [
  [/lulu|carrefour|sultan|hypermarket|supermarket|coop|co-op|grocery|groceries|reliance fresh|dmart|more supermarket|nesto|grand hyper|on cost/i, ['Groceries','Supermarket']],
  [/kfc|mcdonald|burger|restaurant|cafe|coffee|starbucks|pizza|talabat|deliveroo|swiggy|zomato/i, ['Food','Restaurant']],
  [/ooredoo|zain|stc|jio|airtel|vi |vodafone|mobile|telecom/i, ['Mobile','Plan']],
  [/knpc|fuel|petrol|gas station|shell|indian oil|bharat petroleum|hpcl/i, ['Transport','Fuel']],
  [/boots|pharmacy|chemist|clinic|hospital|medical|laboratory|lab /i, ['Health','Pharmacy']],
  [/school|academy|tuition|university|college/i, ['Education','Fees']],
  [/internet|broadband|fiber|wifi/i, ['Internet','Home Internet']],
  [/electric|electricity|kseb|tneb|bescom|mew|water ministry|utility/i, ['Utilities','Electricity']],
  [/uber|careem|ola|taxi/i, ['Transport','Taxi']],
  [/cinema|netflix|spotify|youtube premium|subscription/i, ['Entertainment','Subscriptions']],
  [/hotel|airways|airline|booking\.com|expedia|indigo|air india/i, ['Travel','Other']],
  [/ikea|home centre|home center|homebox|home box|furniture|appliance|kitchen|hardware/i, ['Home Shopping','General']],
  [/zara|h&m|hm |max fashion|centrepoint|clothing|fashion|shoes|footwear|cosmetic|perfume/i, ['Personal Shopping','General']],
  [/parking|municipal park|pumc/i, ['Transport','Parking']],
  [/station|service station/i, ['Transport','Fuel']]
];

const STATEMENT_TRANSFER_HINT = /minimum due|card payment|credit card payment|settlement|outward instant payment|wamd|transfer(?:red)? to|fund transfer|payment to:/i;
const STATEMENT_INCOME_HINT = /salary|deposit|cash deposit|refund|reversal|cashback|credit received|transfer received|incoming transfer/i;
const GENERIC_STATEMENT_WORDS = /point of sale purchase transaction|pos purchase|purchase transaction|card transaction|outward instant payment|minimum due settlement|credit card|transaction|payment/gi;

const defaultState = () => ({
  version: APP_VERSION,
  transactions: [],
  budgets: {},
  merchantRules: {},
  syncMeta: {
    deletedTransactions: [],
    budgetUpdated: {},
    budgetDeleted: {},
    profileUpdatedAt: '',
    remoteBudgetIds: {},
    remoteMerchantIds: {}
  },
  settings: {
    activeCountry: 'KW',
    openingBalances: { KW: 0, IN: 0 },
    deleteReceiptAfterSave: true,
    warning75: true,
    warning90: true,
    warning100: true
  }
});

let state = defaultState();
let country = 'KW';
let view = 'dashboard';
let month = currentMonth();
let txFilter = { search: '', type: 'all', category: 'all' };
let scanObjectUrl = null;
let pendingReceiptFile = null;
let pendingStatementRows = [];
let pendingStatementFileName = '';
let modalTxId = null;
let cloudClient = null;
let cloudSyncTimer = null;
let realtimeChannel = null;
let realtimeUserId = '';
let realtimeStatus = 'OFF';
let realtimeApplyTimer = null;
let cloudStatus = { configured:false, authenticated:false, email:'', lastSync:'', syncing:false, error:'' };

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastRoot = document.getElementById('toast-root');


function validUuid(value=''){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}
function getCloudConfig(){
  const bundled=(window.LEDGERLY_CLOUD||{});
  let local={};
  try{ local=JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY)||'{}')||{}; }catch(e){}
  return {
    url:String(local.url||bundled.url||'').trim().replace(/\/$/,''),
    anonKey:String(local.anonKey||bundled.anonKey||'').trim(),
    email:String(local.email||'').trim()
  };
}
function saveCloudConfig(cfg){
  localStorage.setItem(CLOUD_CONFIG_KEY,JSON.stringify({url:cfg.url||'',anonKey:cfg.anonKey||'',email:cfg.email||''}));
  cloudClient=null;
}
function cloudConfigured(){ const c=getCloudConfig(); return /^https:\/\//i.test(c.url)&&c.anonKey.length>20; }
async function loadSupabaseModule(){
  return import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.16/+esm');
}
async function getCloudClient(){
  if(cloudClient) return cloudClient;
  const cfg=getCloudConfig();
  if(!cloudConfigured()) throw new Error('Cloud sync is not configured.');
  const {createClient}=await loadSupabaseModule();
  cloudClient=createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return cloudClient;
}
function normalizeCategoryName(cat='', sub=''){
  if(cat==='Shopping') return sub==='Home'?'Home Shopping':'Personal Shopping';
  if(cat==='Clothes') return 'Personal Shopping';
  if(cat==='Food' && sub==='Groceries') return 'Groceries';
  return CATEGORIES[cat]?cat:'Other';
}
function normalizeSubcategoryName(cat='', sub=''){
  const nc=normalizeCategoryName(cat,sub);
  if(nc==='Groceries' && (cat==='Food' || sub==='Groceries')) return 'General';
  const allowed=CATEGORIES[nc]?.subs||[];
  return allowed.includes(sub)?sub:(allowed.includes('General')?'General':allowed.includes('Other')?'Other':allowed[0]||'');
}
function countryMeta(c=country){ return COUNTRIES[c]||COUNTRIES.KW; }
function merchantRuleKey(merchant='',c=country){ return `${c}|${String(merchant).trim().toLowerCase()}`; }
function normalizeState(){
  state.version=APP_VERSION;
  state.syncMeta={...defaultState().syncMeta,...(state.syncMeta||{})};
  state.syncMeta.deletedTransactions=Array.isArray(state.syncMeta.deletedTransactions)?state.syncMeta.deletedTransactions:[];
  state.syncMeta.budgetUpdated=state.syncMeta.budgetUpdated||{};
  state.syncMeta.budgetDeleted=state.syncMeta.budgetDeleted||{};
  state.syncMeta.remoteBudgetIds=state.syncMeta.remoteBudgetIds||{};
  state.syncMeta.remoteMerchantIds=state.syncMeta.remoteMerchantIds||{};
  const legacyOpening=n(state.settings?.openingBalance);
  const hadOpeningBalances=!!state.settings?.openingBalances;
  state.settings={...defaultState().settings,...(state.settings||{})};
  if(!hadOpeningBalances){ state.settings.openingBalances={KW:legacyOpening,IN:0}; }
  state.settings.openingBalances={KW:n(state.settings.openingBalances?.KW),IN:n(state.settings.openingBalances?.IN)};
  state.settings.activeCountry=COUNTRIES[state.settings.activeCountry]?state.settings.activeCountry:'KW';
  country=state.settings.activeCountry;

  state.transactions=(state.transactions||[]).map(t=>({
    ...t,
    id:validUuid(t.id)?t.id:uid(),
    country:COUNTRIES[t.country]?t.country:'KW',
    category:t.type==='expense'?normalizeCategoryName(t.category,t.subcategory):'',
    subcategory:t.type==='expense'?normalizeSubcategoryName(t.category,t.subcategory):'',
    createdAt:t.createdAt||new Date().toISOString(),
    updatedAt:t.updatedAt||t.createdAt||new Date().toISOString()
  }));

  // v2.7 and earlier stored budgets by month only. Preserve them as Kuwait budgets.
  const nextBudgets={};
  for(const [key,cats] of Object.entries(state.budgets||{})){
    const target=/^(KW|IN)\|\d{4}-\d{2}$/.test(key)?key:`KW|${key}`;
    nextBudgets[target]=nextBudgets[target]||{};
    for(const [cat,val] of Object.entries(cats||{})){
      const nc=normalizeCategoryName(cat,cat==='Shopping'?'General':'');
      nextBudgets[target][nc]=(nextBudgets[target][nc]||0)+n(val);
    }
  }
  state.budgets=nextBudgets;

  const nextRules={};
  for(const [key,val] of Object.entries(state.merchantRules||{})){
    const pref=/^(KW|IN)\|/.test(key)?key:`KW|${key}`;
    nextRules[pref]={category:normalizeCategoryName(val?.category,val?.subcategory),subcategory:normalizeSubcategoryName(val?.category,val?.subcategory)};
  }
  state.merchantRules=nextRules;

  const remapMeta=(obj={})=>{
    const out={};
    for(const [k,v] of Object.entries(obj||{})) out[/^(KW|IN)\|/.test(k)?k:`KW|${k}`]=v;
    return out;
  };
  state.syncMeta.budgetUpdated=remapMeta(state.syncMeta.budgetUpdated);
  state.syncMeta.budgetDeleted=remapMeta(state.syncMeta.budgetDeleted);
  for(const [id,key] of Object.entries(state.syncMeta.remoteBudgetIds||{})) if(!/^(KW|IN)\|/.test(key)) state.syncMeta.remoteBudgetIds[id]=`KW|${key}`;
  for(const [id,key] of Object.entries(state.syncMeta.remoteMerchantIds||{})) if(!/^(KW|IN)\|/.test(key)) state.syncMeta.remoteMerchantIds[id]=`KW|${key}`;
}
function cloudStateText(){
  if(!cloudStatus.configured) return 'Local only';
  if(cloudStatus.syncing) return 'Syncing…';
  if(cloudStatus.authenticated && realtimeStatus==='SUBSCRIBED') return 'Connected · Live';
  if(cloudStatus.authenticated) return 'Connected';
  return 'Configured · sign in required';
}
function budgetKey(m,cat,c=country){ return `${c}|${m}|${cat}`; }
function splitBudgetKey(key){ const p=String(key).split('|'); return p.length>=3?[p[0],p[1],p.slice(2).join('|')]:['KW',p[0]||'',p.slice(1).join('|')]; }
function remoteTxToLocal(r){
  const rc=COUNTRIES[r.country]?r.country:'KW';
  return {id:r.id,country:rc,type:r.type,amount:n(r.amount),merchant:r.merchant||'',category:r.type==='expense'?normalizeCategoryName(r.category,r.subcategory):'',subcategory:r.type==='expense'?normalizeSubcategoryName(r.category,r.subcategory):'',date:r.txn_date,payment:r.payment_method||'',note:r.note||'',createdAt:r.created_at,updatedAt:r.updated_at};
}
function localTxToRemote(t,userId){
  return {id:t.id,user_id:userId,country:COUNTRIES[t.country]?t.country:'KW',type:t.type,amount:n(t.amount),merchant:t.merchant||null,category:t.category||null,subcategory:t.subcategory||null,txn_date:t.date,payment_method:t.payment||null,note:t.note||null,receipt_retained:false,created_at:t.createdAt||new Date().toISOString(),updated_at:t.updatedAt||new Date().toISOString()};
}

async function stopRealtime(){
  clearTimeout(realtimeApplyTimer);
  realtimeApplyTimer=null;
  if(realtimeChannel){
    try{
      const client=cloudClient || await getCloudClient();
      await client.removeChannel(realtimeChannel);
    }catch(e){}
  }
  realtimeChannel=null;
  realtimeUserId='';
  realtimeStatus='OFF';
}
function scheduleRealtimeSave(){
  clearTimeout(realtimeApplyTimer);
  realtimeApplyTimer=setTimeout(async()=>{
    await saveState();
    cloudStatus.lastSync=new Date().toISOString();
    render();
  },180);
}
function applyRealtimePayload(table,payload,userId){
  const event=payload?.eventType||'';
  const row=payload?.new||{};
  const old=payload?.old||{};
  if(table==='transactions'){
    if(event==='DELETE'){
      if(old.id) state.transactions=state.transactions.filter(t=>t.id!==old.id);
    }else if(row.user_id===userId && row.id){
      const remote=remoteTxToLocal(row);
      const idx=state.transactions.findIndex(t=>t.id===remote.id);
      if(idx<0 || new Date(remote.updatedAt||0)>=new Date(state.transactions[idx].updatedAt||0)){
        if(idx<0) state.transactions.push(remote); else state.transactions[idx]=remote;
      }
    }
  }else if(table==='monthly_budgets'){
    if(event==='DELETE'){
      const key=state.syncMeta.remoteBudgetIds?.[old.id];
      if(key){
        const [c,m,cat]=splitBudgetKey(key);
        const bucketKey=`${c}|${m}`;
        if(state.budgets[bucketKey]){
          delete state.budgets[bucketKey][cat];
          if(!Object.keys(state.budgets[bucketKey]).length) delete state.budgets[bucketKey];
        }
        delete state.syncMeta.budgetUpdated[key];
        delete state.syncMeta.budgetDeleted[key];
        delete state.syncMeta.remoteBudgetIds[old.id];
      }
    }else if(row.user_id===userId && row.id){
      const c=COUNTRIES[row.country]?row.country:'KW', m=String(row.budget_month).slice(0,7), cat=normalizeCategoryName(row.category,''), key=budgetKey(m,cat,c);
      ensureBudgetMonth(m,c)[cat]=n(row.planned_amount);
      state.syncMeta.budgetUpdated[key]=row.updated_at||new Date().toISOString();
      delete state.syncMeta.budgetDeleted[key];
      state.syncMeta.remoteBudgetIds[row.id]=key;
    }
  }else if(table==='merchant_rules'){
    if(event==='DELETE'){
      const merchantKey=state.syncMeta.remoteMerchantIds?.[old.id];
      if(merchantKey){
        delete state.merchantRules[merchantKey];
        delete state.syncMeta.remoteMerchantIds[old.id];
      }
    }else if(row.user_id===userId && row.id){
      const c=COUNTRIES[row.country]?row.country:'KW', localKey=merchantRuleKey(row.merchant_key,c);
      state.merchantRules[localKey]={category:normalizeCategoryName(row.category,row.subcategory),subcategory:row.subcategory||''};
      state.syncMeta.remoteMerchantIds[row.id]=localKey;
    }
  }else if(table==='profiles'){
    if(event!=='DELETE' && row.id===userId){
      state.settings.openingBalances.KW=n(row.opening_balance);
      state.settings.openingBalances.IN=n(row.opening_balance_inr);
      state.syncMeta.profileUpdatedAt=row.updated_at||new Date().toISOString();
    }
  }
  scheduleRealtimeSave();
}
async function startRealtime(){
  await stopRealtime();
  await refreshCloudSession();
  if(!cloudStatus.authenticated || !navigator.onLine) return;
  try{
    const client=await getCloudClient();
    const {data,error}=await client.auth.getUser(); if(error) throw error;
    const userId=data?.user?.id; if(!userId) return;
    realtimeUserId=userId;
    realtimeStatus='CONNECTING';
    realtimeChannel=client
      .channel(`rahman-expense-live-${userId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:`user_id=eq.${userId}`},p=>applyRealtimePayload('transactions',p,userId))
      .on('postgres_changes',{event:'*',schema:'public',table:'monthly_budgets',filter:`user_id=eq.${userId}`},p=>applyRealtimePayload('monthly_budgets',p,userId))
      .on('postgres_changes',{event:'*',schema:'public',table:'merchant_rules',filter:`user_id=eq.${userId}`},p=>applyRealtimePayload('merchant_rules',p,userId))
      .on('postgres_changes',{event:'*',schema:'public',table:'profiles',filter:`id=eq.${userId}`},p=>applyRealtimePayload('profiles',p,userId))
      .subscribe(status=>{
        realtimeStatus=status;
        if(status==='CHANNEL_ERROR' || status==='TIMED_OUT') cloudStatus.error='Live sync connection problem. Use Sync now, then check Supabase Realtime settings.';
        render();
      });
  }catch(err){
    realtimeStatus='ERROR';
    cloudStatus.error=err?.message||'Could not start live sync.';
    render();
  }
}

async function refreshCloudSession(){
  cloudStatus.configured=cloudConfigured(); cloudStatus.error='';
  if(!cloudStatus.configured){ cloudStatus.authenticated=false; cloudStatus.email=''; return; }
  try{
    const client=await getCloudClient();
    const {data,error}=await client.auth.getSession(); if(error) throw error;
    const session=data?.session||null;
    cloudStatus.authenticated=!!session;
    cloudStatus.email=session?.user?.email||getCloudConfig().email||'';
  }catch(err){ cloudStatus.authenticated=false; cloudStatus.error=err?.message||'Cloud connection unavailable.'; }
}
async function saveCloudSetup(){
  const url=document.getElementById('cloud-url')?.value.trim()||'';
  const anonKey=document.getElementById('cloud-key')?.value.trim()||'';
  const email=document.getElementById('cloud-email')?.value.trim()||'';
  if(!/^https:\/\//i.test(url)||anonKey.length<20){ toast('Enter a valid Supabase Project URL and publishable/anon public key.'); return; }
  saveCloudConfig({url,anonKey,email});
  await refreshCloudSession(); render(); toast('Cloud setup saved on this device.');
}
function getCloudCredentials(){
  const email=document.getElementById('cloud-email')?.value.trim()||getCloudConfig().email;
  const password=document.getElementById('cloud-password')?.value||'';
  if(!email||!email.includes('@')) throw new Error('Enter a valid email address.');
  if(password.length<8) throw new Error('Password must be at least 8 characters.');
  const cfg=getCloudConfig(); saveCloudConfig({...cfg,email});
  return {email,password};
}
async function cloudCreateAccount(){
  if(location.protocol==='file:'){ toast('Open Rahman Expense from its HTTPS website before cloud sign-in.'); return; }
  try{
    const {email,password}=getCloudCredentials();
    const client=await getCloudClient();
    const {data,error}=await client.auth.signUp({email,password});
    if(error) throw error;
    await refreshCloudSession();
    if(data?.session){
      await startRealtime();
      await syncCloud(true);
      toast('Account created and signed in. Live sync is starting.');
    }else{
      toast('Account created, but Supabase is waiting for email confirmation. Turn off Confirm email in Supabase Authentication settings for the simple-login setup.');
    }
    render();
  }catch(err){ toast(`Could not create account: ${err?.message||'unknown error'}`); }
}
async function cloudPasswordLogin(){
  if(location.protocol==='file:'){ toast('Open Rahman Expense from its HTTPS website before cloud sign-in.'); return; }
  try{
    const {email,password}=getCloudCredentials();
    const client=await getCloudClient();
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error) throw error;
    await refreshCloudSession();
    await startRealtime();
    await syncCloud(true);
    render();
    toast('Signed in. Live sync is on.');
  }catch(err){ toast(`Could not sign in: ${err?.message||'unknown error'}`); }
}
async function cloudSignOut(){
  await stopRealtime();
  try{ const client=await getCloudClient(); await client.auth.signOut(); }catch(e){}
  cloudStatus.authenticated=false; cloudStatus.email=''; render(); toast('Cloud account signed out on this device.');
}
function markProfileDirty(){ state.syncMeta.profileUpdatedAt=new Date().toISOString(); }
function markBudgetDirty(m,cat,deleted=false){
  const key=budgetKey(m,cat), ts=new Date().toISOString();
  if(deleted){ state.syncMeta.budgetDeleted[key]=ts; delete state.syncMeta.budgetUpdated[key]; }
  else { state.syncMeta.budgetUpdated[key]=ts; delete state.syncMeta.budgetDeleted[key]; }
}
function queueCloudSync(){
  if(!cloudStatus.authenticated||!navigator.onLine) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>syncCloud(true),900);
}
async function syncCloud(silent=false){
  if(cloudStatus.syncing) return;
  await refreshCloudSession();
  if(!cloudStatus.authenticated){ if(!silent) toast('Sign in to cloud sync first.'); return; }
  cloudStatus.syncing=true; cloudStatus.error=''; if(!silent) render();
  try{
    normalizeState();
    const client=await getCloudClient();
    const {data:userData,error:userErr}=await client.auth.getUser(); if(userErr) throw userErr;
    const userId=userData?.user?.id; if(!userId) throw new Error('No signed-in user.');
    const [profileRes,txRes,budgetRes,merchantRes]=await Promise.all([
      client.from('profiles').select('*').eq('id',userId).maybeSingle(),
      client.from('transactions').select('*').eq('user_id',userId),
      client.from('monthly_budgets').select('*').eq('user_id',userId),
      client.from('merchant_rules').select('*').eq('user_id',userId)
    ]);
    for(const r of [profileRes,txRes,budgetRes,merchantRes]) if(r.error) throw r.error;

    const tomb=new Map(state.syncMeta.deletedTransactions.map(x=>[x.id,x.deletedAt]));
    const localMap=new Map(state.transactions.map(t=>[t.id,t]));
    for(const r of (txRes.data||[])){
      const del=tomb.get(r.id);
      if(del && new Date(del)>=new Date(r.updated_at)){ continue; }
      const local=localMap.get(r.id);
      if(!local || new Date(r.updated_at)>new Date(local.updatedAt||0)) localMap.set(r.id,remoteTxToLocal(r));
      if(del && new Date(r.updated_at)>new Date(del)) tomb.delete(r.id);
    }
    state.transactions=[...localMap.values()];
    state.syncMeta.deletedTransactions=[...tomb].map(([id,deletedAt])=>({id,deletedAt}));

    for(const r of (budgetRes.data||[])){
      const c=COUNTRIES[r.country]?r.country:'KW';
      const m=String(r.budget_month).slice(0,7), cat=normalizeCategoryName(r.category,''), key=budgetKey(m,cat,c);
      if(r.id) state.syncMeta.remoteBudgetIds[r.id]=key;
      const localTs=state.syncMeta.budgetUpdated[key]||'';
      const delTs=state.syncMeta.budgetDeleted[key]||'';
      const remoteTs=r.updated_at||'';
      if(delTs && new Date(delTs)>=new Date(remoteTs)) continue;
      const exists=Object.prototype.hasOwnProperty.call(state.budgets[`${c}|${m}`]||{},cat);
      if(!exists || !localTs || new Date(remoteTs)>new Date(localTs)){
        ensureBudgetMonth(m,c)[cat]=n(r.planned_amount);
        state.syncMeta.budgetUpdated[key]=remoteTs;
        delete state.syncMeta.budgetDeleted[key];
      }
    }

    for(const r of (merchantRes.data||[])){
      const c=COUNTRIES[r.country]?r.country:'KW', localKey=merchantRuleKey(r.merchant_key,c);
      if(r.id) state.syncMeta.remoteMerchantIds[r.id]=localKey;
      if(!state.merchantRules[localKey]) state.merchantRules[localKey]={category:normalizeCategoryName(r.category,r.subcategory),subcategory:r.subcategory||''};
    }
    const prof=profileRes.data;
    if(prof){
      const localTs=state.syncMeta.profileUpdatedAt||'';
      if(!localTs || new Date(prof.updated_at)>new Date(localTs)){
        state.settings.openingBalances.KW=n(prof.opening_balance);
        state.settings.openingBalances.IN=n(prof.opening_balance_inr);
        state.syncMeta.profileUpdatedAt=prof.updated_at;
      }
    }

    if(state.transactions.length){
      const {error}=await client.from('transactions').upsert(state.transactions.map(t=>localTxToRemote(t,userId)),{onConflict:'id'}); if(error) throw error;
    }
    if(state.syncMeta.deletedTransactions.length){
      const ids=state.syncMeta.deletedTransactions.map(x=>x.id);
      const {error}=await client.from('transactions').delete().eq('user_id',userId).in('id',ids); if(error) throw error;
      state.syncMeta.deletedTransactions=[];
    }

    const budgetRows=[];
    Object.entries(state.budgets).forEach(([bucket,cats])=>{
      const [c,m]=bucket.split('|'); if(!COUNTRIES[c]||!/^\d{4}-\d{2}$/.test(m)) return;
      Object.entries(cats||{}).forEach(([cat,val])=>budgetRows.push({user_id:userId,country:c,budget_month:`${m}-01`,category:cat,planned_amount:n(val),updated_at:state.syncMeta.budgetUpdated[budgetKey(m,cat,c)]||new Date().toISOString()}));
    });
    if(budgetRows.length){
      const {data:budgetUpsertData,error}=await client.from('monthly_budgets').upsert(budgetRows,{onConflict:'user_id,country,budget_month,category'}).select('id,country,budget_month,category');
      if(error) throw error;
      for(const r of (budgetUpsertData||[])){const c=COUNTRIES[r.country]?r.country:'KW';state.syncMeta.remoteBudgetIds[r.id]=budgetKey(String(r.budget_month).slice(0,7),r.category,c);}
    }
    const deletedBudgetKeys=Object.keys(state.syncMeta.budgetDeleted||{});
    for(const key of deletedBudgetKeys){
      const [c,m,cat]=splitBudgetKey(key);
      const {error}=await client.from('monthly_budgets').delete().eq('user_id',userId).eq('country',c).eq('budget_month',`${m}-01`).eq('category',cat); if(error) throw error;
      delete state.syncMeta.budgetDeleted[key];
    }

    const merchantRows=Object.entries(state.merchantRules||{}).map(([localKey,v])=>{
      const split=localKey.indexOf('|'); const c=split>0?localKey.slice(0,split):'KW'; const merchant_key=split>0?localKey.slice(split+1):localKey;
      return {user_id:userId,country:COUNTRIES[c]?c:'KW',merchant_key,category:v.category,subcategory:v.subcategory||null};
    });
    if(merchantRows.length){
      const {data:merchantUpsertData,error}=await client.from('merchant_rules').upsert(merchantRows,{onConflict:'user_id,country,merchant_key'}).select('id,country,merchant_key');
      if(error) throw error;
      for(const r of (merchantUpsertData||[])){const c=COUNTRIES[r.country]?r.country:'KW';state.syncMeta.remoteMerchantIds[r.id]=merchantRuleKey(r.merchant_key,c);}
    }

    const now=new Date().toISOString();
    const {error:profileError}=await client.from('profiles').upsert({
      id:userId,
      display_name:cloudStatus.email||null,
      currency:'KWD',
      opening_balance:n(state.settings.openingBalances.KW),
      opening_balance_inr:n(state.settings.openingBalances.IN),
      updated_at:state.syncMeta.profileUpdatedAt||now
    },{onConflict:'id'}); if(profileError) throw profileError;

    cloudStatus.lastSync=now;
    await saveState();
    if(!silent) toast('Kuwait and India cloud sync complete.');
  }catch(err){ const raw=err?.message||'Sync failed.'; cloudStatus.error=/country|opening_balance_inr|no unique|on conflict/i.test(raw)?'v2.8 database update required — run the new supabase_schema.sql once in Supabase SQL Editor.':raw; if(!silent) toast(`Sync failed: ${cloudStatus.error}`); }
  finally{ cloudStatus.syncing=false; render(); }
}
async function initCloud(){
  cloudStatus.configured=cloudConfigured();
  if(!cloudStatus.configured) return;
  await refreshCloudSession();
  if(cloudStatus.authenticated && navigator.onLine){ await syncCloud(true); await startRealtime(); }
}

function currentMonth() { return new Date().toISOString().slice(0, 7); }
function today() { return new Date().toISOString().slice(0, 10); }
function uid() { return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function escapeHtml(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function n(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function money(v,c=country){
  const meta=countryMeta(c);
  return `${meta.currency} ${n(v).toLocaleString(undefined,{minimumFractionDigits:meta.decimals,maximumFractionDigits:meta.decimals})}`;
}
function monthLabel(m){
  const [y,mo] = m.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date(Date.UTC(y,mo-1,15)));
}
function shiftMonth(delta){
  const [y,m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y,m-1+delta,15));
  month = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  render();
}
function previousMonth(m=month){
  const [y,mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y,mo-2,15));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}
function countryMonthKey(c=country,m=month){ return `${c}|${m}`; }
function countryTransactions(c=country){ return state.transactions.filter(t=>(COUNTRIES[t.country]?t.country:'KW')===c); }
function monthTransactions(m=month,c=country){ return state.transactions.filter(t => (COUNTRIES[t.country]?t.country:'KW')===c && String(t.date||'').startsWith(m)); }
function sumType(list,type){ return list.filter(t=>t.type===type).reduce((a,t)=>a+n(t.amount),0); }
function categorySpend(list,cat){ return list.filter(t=>t.type==='expense'&&t.category===cat).reduce((a,t)=>a+n(t.amount),0); }
function totalBudget(m=month,c=country){ return Object.values(state.budgets[countryMonthKey(c,m)]||{}).reduce((a,v)=>a+n(v),0); }
function budgetFor(cat,m=month,c=country){ return n(state.budgets[countryMonthKey(c,m)]?.[cat]); }
function ensureBudgetMonth(m=month,c=country){ const k=countryMonthKey(c,m); if(!state.budgets[k]) state.budgets[k] = {}; return state.budgets[k]; }
function openingBalance(c=country){ return n(state.settings.openingBalances?.[c]); }
function safeDate(value){ return /^\d{4}-\d{2}-\d{2}$/.test(value||'') ? value : today(); }
function paymentMethods(c=country){ return c==='IN'?['UPI','Debit Card','Credit Card','Cash','Bank Transfer','Net Banking','Other']:['KNET / Debit','Credit Card','Cash','Bank Transfer','Apple Pay','Other']; }
function countryTabsHtml(){
  return `<div class="country-tabs" role="tablist" aria-label="Expense country">${Object.entries(COUNTRIES).map(([code,meta])=>`<button type="button" class="country-tab ${country===code?'active':''}" data-country="${code}" role="tab" aria-selected="${country===code}"><span>${meta.flag}</span><b>${meta.name}</b><small>${meta.currency}</small></button>`).join('')}</div>`;
}
async function openDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGet(key){
  try{
    const db = await openDB();
    if(!db) return JSON.parse(localStorage.getItem(key)||'null');
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(DB_STORE,'readonly');
      const req=tx.objectStore(DB_STORE).get(key);
      req.onsuccess=()=>resolve(req.result??null); req.onerror=()=>reject(req.error);
    });
  }catch(e){
    try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
  }
}
async function dbSet(key,value){
  try{
    const db=await openDB();
    if(!db){localStorage.setItem(key,JSON.stringify(value));return}
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(DB_STORE,'readwrite');
      tx.objectStore(DB_STORE).put(value,key);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
  }catch(e){ localStorage.setItem(key,JSON.stringify(value)); }
}
async function saveState(){ state.settings.activeCountry=country; await dbSet(STATE_KEY,state); }

function migrateLegacy(legacy){
  if(!legacy || !Array.isArray(legacy.tx)) return null;
  const next=defaultState();
  next.settings.activeCountry='KW';
  next.settings.openingBalances={KW:n(legacy.open),IN:0};
  const catMap={
    'Rent - Housing':['Housing','Rent'],'Home Internet':['Internet','Home Internet'],'Mobile Plans':['Mobile','Plan'],Bills:['Utilities','Other'],
    'Car Fuel':['Transport','Fuel'],'Car Maintenance':['Vehicle','Maintenance'],Transport:['Transport','Other'],
    'Health - Consultation':['Health','Consultation'],'Health - Pharmacy':['Health','Pharmacy'],'Health - IV':['Health','Injection / IV'],
    'Health - Injection':['Health','Injection / IV'],'Health - Tests':['Health','Tests'],'Health - Other':['Health','Other'],
    'School - Fees':['Education','Fees'],'School - Transportation':['Education','Transportation'],'School - Uniforms':['Education','Uniforms'],
    'School - Books':['Education','Books'],'School - Others':['Education','Other'],Shopping:['Personal Shopping','General'],Clothes:['Personal Shopping','Clothing'],
    Food:['Food','Other'],'Personal Misc':['Personal','Other'],Other:['Other','Uncategorized']
  };
  next.transactions=legacy.tx.map(t=>{
    const mapped=catMap[t.cat]||['Other','Uncategorized'];
    return {id:String(t.id||uid()),country:'KW',type:t.type||'expense',amount:n(t.amt),merchant:'',category:mapped[0],subcategory:mapped[1],date:safeDate(t.date),payment:'',note:t.note||'',createdAt:new Date().toISOString()};
  });
  const current = currentMonth();
  next.budgets[`KW|${current}`]={};
  Object.entries(legacy.bud||{}).forEach(([old,val])=>{
    const mapped=catMap[old]||['Other'];
    next.budgets[`KW|${current}`][mapped[0]]=(next.budgets[`KW|${current}`][mapped[0]]||0)+n(val);
  });
  return next;
}

async function loadState(){
  const saved=await dbGet(STATE_KEY);
  if(saved && Array.isArray(saved.transactions)) {
    state={...defaultState(),...saved,settings:{...defaultState().settings,...saved.settings}};
  } else {
    // v2.0+ intentionally uses the clean Rahman Expense storage namespace.
    // Older Ledgerly/Rahman Expense browser data is left untouched and is NOT auto-imported.
    state=defaultState();
    await saveState();
  }
  normalizeState();
}

function navItems(){ return [
  ['dashboard','⌂','Dashboard'],['transactions','↔','Transactions'],['budgets','◎','Budgets'],['reports','▥','Reports'],['settings','⚙','Settings']
]; }
function navHtml(mobile=false){
  return `<${mobile?'div':'nav'} class="${mobile?'mobile-nav':'nav'}">${navItems().map(([k,i,label])=>`<button class="${mobile?'':'nav-btn'} ${view===k?'active':''}" data-nav="${k}"><span class="${mobile?'':'nav-icon'}">${i}</span>${label}</button>`).join('')}</${mobile?'div':'nav'}>`;
}
function shell(content,title,subtitle='',actions=''){
  const meta=countryMeta();
  return `<div class="layout">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">R</div><div><h1>Rahman Expense</h1><p>Personal expenses</p></div></div>
      ${navHtml(false)}
      <div class="sidebar-footer">Private expense tracking<br><b>Kuwait KWD · India INR</b> · v${APP_VERSION}<br><span>Developed by Rahiman</span></div>
    </aside>
    <main class="main">
      <div class="mobile-brandbar" aria-label="Rahman Expense app information">
        <div class="mobile-brandmark">R</div>
        <div class="mobile-brandcopy"><strong>Rahman Expense</strong><span>Kuwait + India · v${APP_VERSION} · Developed by Rahiman</span></div>
      </div>
      <div class="country-tabs-wrap">${countryTabsHtml()}<div class="country-context">${meta.flag} <b>${meta.name}</b> expenses · ${meta.currency}</div></div>
      <div class="topbar"><div><h2>${escapeHtml(title)}</h2>${subtitle?`<div class="subtle">${escapeHtml(subtitle)}</div>`:''}</div><div class="actions">${actions}</div></div>
      ${content}
      <div class="mobile-app-footer">Rahman Expense · Kuwait KWD + India INR · v${APP_VERSION}<br><span>Developed by Rahiman</span></div>
    </main>
    ${navHtml(true)}
  </div>`;
}
function monthSwitchHtml(){ return `<div class="month-switch"><button data-month-shift="-1" aria-label="Previous month">‹</button><div class="month-label">${monthLabel(month)}</div><button data-month-shift="1" aria-label="Next month">›</button></div>`; }

function dashboardView(){
  const tx=monthTransactions();
  const income=sumType(tx,'income');
  const spent=sumType(tx,'expense');
  const transfers=sumType(tx,'transfer');
  const budget=totalBudget();
  const remaining=budget-spent;
  const savings=income-spent-transfers;
  const used=budget?spent/budget*100:0;
  const allCountryTx=countryTransactions();
  const allIncome=sumType(allCountryTx,'income');
  const allExpense=sumType(allCountryTx,'expense');
  const allTransfer=sumType(allCountryTx,'transfer');
  const available=openingBalance()+allIncome-allExpense-allTransfer;
  const catRows=Object.keys(CATEGORIES).map((cat,idx)=>({cat,idx,spent:categorySpend(tx,cat),budget:budgetFor(cat)})).filter(x=>x.spent>0||x.budget>0).sort((a,b)=>b.spent-a.spent);
  const latest=[...tx].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,6);
  const budgetClass=used>=100?'over':used>=90?'warning':'';

  const content=`
    <div class="dashboard-month"><div>${monthSwitchHtml()}</div><div class="status-pill ${budget&&used<90?'good':used>=100?'over':used>=90?'warn':''}">${budget?`${Math.round(used)}% budget used`:'Budget not set'}</div></div>

    <section class="overview-card" aria-label="Monthly overview">
      <div class="overview-main">
        <div class="eyebrow">AVAILABLE BALANCE</div>
        <div class="overview-value">${money(available)}</div>
        <div class="overview-note">${monthLabel(month)} · ${savings>=0?`${money(savings)} saved so far`:`${money(Math.abs(savings))} above monthly income`}</div>
      </div>
      <div class="overview-side">
        <div class="overview-progress-head"><span>Monthly budget</span><strong>${budget?`${Math.round(used)}%`:'—'}</strong></div>
        <div class="overview-progress"><i class="${budgetClass}" style="width:${budget?clamp(used,0,100):0}%"></i></div>
        <div class="overview-progress-note">${budget?`${money(spent)} of ${money(budget)} spent`:'Create a budget for this month'}</div>
      </div>
    </section>

    <div class="summary-grid">
      <button class="summary-card summary-link" type="button" data-summary-link="income" aria-label="Open income transactions"><div class="summary-icon income">↓</div><div><div class="metric-label">Income</div><div class="summary-value positive">${money(income)}</div><div class="summary-note">This month · tap to view</div></div><span class="card-arrow">›</span></button>
      <button class="summary-card summary-link" type="button" data-summary-link="expense" aria-label="Open expense transactions"><div class="summary-icon expense">↑</div><div><div class="metric-label">Expenses</div><div class="summary-value negative">${money(spent)}</div><div class="summary-note">${tx.filter(t=>t.type==='expense').length} transactions · tap to view</div></div><span class="card-arrow">›</span></button>
      <button class="summary-card summary-link" type="button" data-summary-link="budget" aria-label="Open monthly budgets"><div class="summary-icon budget">◎</div><div><div class="metric-label">Budget left</div><div class="summary-value ${remaining<0?'negative':''}">${budget?money(remaining):'—'}</div><div class="summary-note">${budget?`${money(budget)} planned`:'Set monthly budget'} · tap to manage</div></div><span class="card-arrow">›</span></button>
    </div>

    <div class="section grid two dashboard-panels">
      <div class="card">
        <div class="section-head"><h3>Budget by category</h3><button class="text-btn" data-nav="budgets">Manage</button></div>
        ${budget?`<div class="progress"><i class="${budgetClass}" style="width:${clamp(used,0,100)}%"></i></div><div class="subtle compact-note">${money(spent)} spent · ${money(Math.max(0,remaining))} remaining</div>`:'<div class="empty"><b>No budget for this month</b>Set a limit for each category.</div>'}
        ${catRows.slice(0,5).map(x=>{
          const p=x.budget?x.spent/x.budget*100:0;
          return `<div class="progress-row"><div class="name">${CATEGORIES[x.cat].icon} ${escapeHtml(x.cat)}</div><div class="progress"><i class="${p>=100?'over':p>=90?'warning':''}" style="width:${clamp(p,0,100)}%"></i></div><div class="amount">${money(x.spent)}${x.budget?` / ${money(x.budget)}`:''}</div></div>`;
        }).join('')}
      </div>
      <div class="card">
        <div class="section-head"><h3>At a glance</h3><span class="subtle">${monthLabel(month)}</span></div>
        ${quickInsight(tx,budget,spent,savings)}
      </div>
    </div>

    <div class="section card activity-card">
      <div class="section-head"><h3>Recent activity</h3><button class="text-btn" data-nav="transactions">View all</button></div>
      <div class="list">${latest.length?latest.map(txRow).join(''):'<div class="empty"><b>No transactions yet</b>Scan a receipt or add an expense to get started.</div>'}</div>
    </div>`;

  return shell(content,'Dashboard','Simple monthly expense tracking.',`<button class="btn" data-action="add">+ Add</button><button class="btn primary" data-action="scan">📷 Scan receipt</button>`);
}
function quickInsight(tx,budget,spent,savings){
  const expenses=tx.filter(t=>t.type==='expense');
  if(!expenses.length) return `<div class="empty"><b>Nothing to analyze yet</b>Add expenses and Rahman Expense will surface useful patterns.</div>`;
  const byCat=Object.keys(CATEGORIES).map(cat=>({cat,v:categorySpend(tx,cat)})).sort((a,b)=>b.v-a.v);
  const top=byCat[0];
  const topPct=spent?Math.round(top.v/spent*100):0;
  const over=Object.keys(CATEGORIES).map(cat=>({cat,sp:categorySpend(tx,cat),bu:budgetFor(cat)})).filter(x=>x.bu>0&&x.sp>x.bu).sort((a,b)=>(b.sp-b.bu)-(a.sp-a.bu))[0];
  return `<div style="display:grid;gap:14px">
    <div><div class="metric-label">Top spending category</div><div style="font-size:22px;font-weight:800;margin-top:5px">${CATEGORIES[top.cat].icon} ${escapeHtml(top.cat)}</div><div class="subtle">${money(top.v)} · ${topPct}% of monthly expenses</div></div>
    ${over?`<div class="status-pill over">⚠ ${escapeHtml(over.cat)} is over budget by ${money(over.sp-over.bu)}</div>`:(budget?`<div class="status-pill good">✓ All budgeted categories are within plan</div>`:'')}
    <div><div class="metric-label">Savings status</div><div style="font-weight:750;margin-top:5px">${savings>=0?`You have kept ${money(savings)} this month.`:`Spending is ${money(Math.abs(savings))} above income so far.`}</div></div>
  </div>`;
}

function txRow(t){
  const ex=t.type==='expense', inc=t.type==='income';
  const icon=ex?(CATEGORIES[t.category]?.icon||'📦'):inc?'💼':'↗️';
  const title=inc?(t.merchant||'Income'):t.type==='transfer'?(t.merchant||'Transfer'):(t.merchant||t.subcategory||t.category||'Expense');
  const meta=ex?`${t.category}${t.subcategory?` · ${t.subcategory}`:''} · ${t.date}`:`${t.note||t.type} · ${t.date}`;
  return `<div class="tx-row" data-open-tx="${escapeHtml(t.id)}"><div class="tx-icon">${icon}</div><div><div class="tx-title">${escapeHtml(title)}</div><div class="tx-meta">${escapeHtml(meta)}</div></div><div class="tx-amount ${ex?'expense':inc?'income':''}">${ex||t.type==='transfer'?'−':'+'}${money(t.amount)}</div><button class="mini-menu" data-edit-tx="${escapeHtml(t.id)}" aria-label="Edit transaction">⋯</button></div>`;
}

function transactionsView(){
  const list=[...monthTransactions()].filter(t=>{
    const q=txFilter.search.trim().toLowerCase();
    const searchable=`${t.merchant||''} ${t.note||''} ${t.category||''} ${t.subcategory||''}`.toLowerCase();
    return (!q||searchable.includes(q)) && (txFilter.type==='all'||t.type===txFilter.type) && (txFilter.category==='all'||t.category===txFilter.category);
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const content=`
    <div class="section-head"><div>${monthSwitchHtml()}</div><div class="subtle">${list.length} matching transaction${list.length===1?'':'s'}</div></div>
    <div class="card">
      <div class="filters">
        <input class="input" id="tx-search" placeholder="Search merchant, note or category" value="${escapeHtml(txFilter.search)}" />
        <select class="select" id="tx-type"><option value="all">All types</option>${['expense','income','transfer'].map(x=>`<option value="${x}" ${txFilter.type===x?'selected':''}>${x[0].toUpperCase()+x.slice(1)}</option>`).join('')}</select>
        <select class="select" id="tx-cat"><option value="all">All categories</option>${Object.keys(CATEGORIES).map(c=>`<option ${txFilter.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select>
      </div>
      <div class="list">${list.length?list.map(txRow).join(''):'<div class="empty"><b>No transactions found</b>Try another filter or add a transaction.</div>'}</div>
    </div>`;
  return shell(content,'Transactions','Search, review and correct every entry.',`<button class="btn" data-action="statement-import">📄 Import statement</button><button class="btn" data-action="scan">📷 Scan</button><button class="btn primary" data-action="add">+ Add transaction</button>`);
}

function budgetsView(){
  const tx=monthTransactions();
  const bud=ensureBudgetMonth();
  const total=totalBudget();
  const spent=sumType(tx,'expense');
  const remaining=total-spent;
  const rows=Object.keys(CATEGORIES).map(cat=>{
    const b=n(bud[cat]), sp=categorySpend(tx,cat), rem=b-sp, pct=b?sp/b*100:0;
    const status=!b?'Not set':pct>=100?'Over':pct>=90?'Near limit':'On track';
    const cls=!b?'':pct>=100?'over':pct>=90?'warn':'good';
    return `<tr><td data-label="Category"><b>${CATEGORIES[cat].icon} ${escapeHtml(cat)}</b></td><td data-label="Planned"><input class="input budget-input" type="number" min="0" step="0.001" data-budget-cat="${escapeHtml(cat)}" value="${b||''}" placeholder="0" /></td><td data-label="Spent">${money(sp)}</td><td data-label="Remaining" class="${rem<0?'tx-amount expense':''}">${b?money(rem):'—'}</td><td data-label="Status"><span class="status-pill ${cls}">${status}</span></td></tr>`;
  }).join('');
  const content=`
    <div class="section-head"><div>${monthSwitchHtml()}</div><div class="actions"><button class="btn" data-action="copy-budget">Copy previous month</button><button class="btn soft" data-action="clear-budget">Clear month</button></div></div>
    <div class="grid stats">
      <button class="card metric-card-link" type="button" data-metric-link="budget"><div class="metric-label">Planned budget</div><div class="metric">${money(total)}</div><div class="metric-note">Tap to manage</div></button>
      <button class="card metric-card-link" type="button" data-metric-link="expense"><div class="metric-label">Actual spending</div><div class="metric negative">${money(spent)}</div><div class="metric-note">Tap to view expenses</div></button>
      <button class="card metric-card-link" type="button" data-metric-link="budget"><div class="metric-label">Remaining</div><div class="metric ${remaining<0?'negative':'positive'}">${total?money(remaining):'—'}</div><div class="metric-note">Tap to manage</div></button>
      <button class="card metric-card-link" type="button" data-metric-link="budget"><div class="metric-label">Budget used</div><div class="metric">${total?`${Math.round(spent/total*100)}%`:'—'}</div><div class="metric-note">Tap to manage</div></button>
    </div>
    <div class="section card">
      <div class="section-head"><h3>Category budgets</h3><div class="subtle">Changes save automatically</div></div>
      <table class="budget-table"><thead><tr><th>Category</th><th>Planned</th><th>Spent</th><th>Remaining</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  return shell(content,'Monthly Budget','Every month has its own plan and actual spending.');
}

function reportsView(){
  const tx=monthTransactions();
  const expenses=tx.filter(t=>t.type==='expense');
  const spent=sumType(tx,'expense'), income=sumType(tx,'income'), budget=totalBudget();
  const saving=income-spent-sumType(tx,'transfer');
  const byCat=Object.keys(CATEGORIES).map((cat,idx)=>({cat,idx,v:categorySpend(tx,cat)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  let acc=0;
  const gradient=byCat.length?byCat.map(x=>{const s=acc;acc+=spent?x.v/spent*100:0;return `${PALETTE[x.idx%PALETTE.length]} ${s}% ${acc}%`;}).join(','):'#e7ece9 0 100%';
  const merchants={}; expenses.forEach(t=>{const key=t.merchant||'Unspecified';merchants[key]=(merchants[key]||0)+n(t.amount)});
  const topMerchants=Object.entries(merchants).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const trend=[]; for(let i=5;i>=0;i--){
    const [y,mo]=month.split('-').map(Number); const d=new Date(Date.UTC(y,mo-1-i,15));
    const m=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; const l=monthTransactions(m); trend.push({m,v:sumType(l,'expense')});
  }
  const max=Math.max(1,...trend.map(x=>x.v));
  const content=`
    <div class="section-head"><div>${monthSwitchHtml()}</div><div class="actions"><button class="btn" data-action="export-csv">Export CSV</button><button class="btn primary" data-action="print-report">Print / PDF</button></div></div>
    <div class="grid stats">
      <button class="card metric-card-link" type="button" data-metric-link="income"><div class="metric-label">Income</div><div class="metric positive">${money(income)}</div><div class="metric-note">Tap to view income</div></button>
      <button class="card metric-card-link" type="button" data-metric-link="expense"><div class="metric-label">Expenses</div><div class="metric negative">${money(spent)}</div><div class="metric-note">Tap to view expenses</div></button>
      <button class="card metric-card-link" type="button" data-metric-link="transactions"><div class="metric-label">Net savings</div><div class="metric ${saving>=0?'positive':'negative'}">${money(saving)}</div><div class="metric-note">Tap to view transactions</div></button>
      <button class="card metric-card-link" type="button" data-metric-link="budget"><div class="metric-label">Budget variance</div><div class="metric ${budget-spent>=0?'positive':'negative'}">${budget?money(budget-spent):'—'}</div><div class="metric-note">Tap to manage budget</div></button>
    </div>
    <div class="section grid two">
      <div class="card"><h3>Spending by category</h3>${byCat.length?`<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${gradient})"><div class="donut-center"><b>${money(spent)}</b><small>Total spent</small></div></div><div class="legend">${byCat.slice(0,9).map(x=>`<div class="legend-row"><span class="legend-dot" style="background:${PALETTE[x.idx%PALETTE.length]}"></span><span class="legend-name">${escapeHtml(x.cat)}</span><span class="legend-val">${money(x.v)}</span></div>`).join('')}</div></div>`:'<div class="empty">No expense data for this month.</div>'}</div>
      <div class="card"><h3>Top merchants</h3>${topMerchants.length?topMerchants.map(([name,val],i)=>`<div class="progress-row"><div class="name">${i+1}. ${escapeHtml(name)}</div><div class="progress"><i style="width:${clamp(val/(topMerchants[0]?.[1]||1)*100,0,100)}%"></i></div><div class="amount">${money(val)}</div></div>`).join(''):'<div class="empty">Merchant details will appear as you add expenses.</div>'}</div>
    </div>
    <div class="section card"><h3>Six-month expense trend</h3><div class="trend">${trend.map(x=>`<div class="trend-item"><div class="trend-bar-wrap"><div class="trend-bar" style="height:${Math.max(2,x.v/max*120)}px" title="${money(x.v)}"></div></div><div class="trend-val">${x.v?money(x.v):'—'}</div><div>${x.m.slice(5)}</div></div>`).join('')}</div></div>`;
  return shell(content,'Reports','Budget vs actual, category trends and exportable records.');
}

function settingsView(){
  const s=state.settings, cfg=getCloudConfig();
  const syncClass=cloudStatus.authenticated?'good':cloudStatus.configured?'warn':'';
  const lastSync=cloudStatus.lastSync?new Date(cloudStatus.lastSync).toLocaleString():'Not synced yet';
  const content=`
    <div class="settings-grid">
      <div class="card"><h3>General</h3>
        <div class="field"><label>Countries & currencies</label><div class="input" aria-label="Currencies" style="display:flex;align-items:center;background:var(--surface-2, #f7f7f5);font-weight:700">🇰🇼 Kuwait — KWD · 🇮🇳 India — INR</div><div class="subtle" style="margin-top:6px">Kuwait and India transactions, budgets and reports stay completely separate.</div></div>
        <div class="field" style="margin-top:12px"><label>Kuwait opening balance (KWD)</label><input class="input" type="number" id="set-opening-KW" step="0.001" value="${n(s.openingBalances?.KW)||''}" placeholder="0.000" /></div>
        <div class="field" style="margin-top:12px"><label>India opening balance (INR)</label><input class="input" type="number" id="set-opening-IN" step="0.01" value="${n(s.openingBalances?.IN)||''}" placeholder="0.00" /></div>
      </div>
      <div class="card"><h3>Receipt privacy</h3>
        <div class="setting-row"><div><b>Delete photo after save</b><div class="subtle">Receipt image stays only in memory during scanning.</div></div><label class="switch"><input id="set-delete-receipt" type="checkbox" ${s.deleteReceiptAfterSave?'checked':''}><span></span></label></div>
        <div class="subtle" style="margin-top:12px">Receipt photos are never included in cloud sync. Rahman Expense stores only the confirmed transaction details.</div>
      </div>
      <div class="card"><h3>Budget alerts</h3>
        ${[[75,'warning75'],[90,'warning90'],[100,'warning100']].map(([p,key])=>`<div class="setting-row"><div><b>${p}% alert</b><div class="subtle">Flag categories at ${p}% of budget.</div></div><label class="switch"><input data-setting="${key}" type="checkbox" ${s[key]?'checked':''}><span></span></label></div>`).join('')}
      </div>
      <div class="card"><h3>Backup to your files / Google Drive</h3>
        <p class="subtle">Export a private JSON backup. On iPhone, “Share backup” opens the share sheet so you can choose Google Drive if installed.</p>
        <div class="actions"><button class="btn" data-action="backup-export">Export backup</button><button class="btn" data-action="backup-share">Share backup</button><label class="btn soft">Import backup<input type="file" accept="application/json" id="backup-import" hidden /></label></div>
      </div>
      <div class="card"><h3>Bank / credit-card statement import</h3>
        <p class="subtle">Import PDF, CSV or a statement image. Rahman Expense reads transactions one by one, suggests categories, flags repayments/transfers, and checks duplicates before saving.</p>
        <div class="actions"><button class="btn primary" type="button" data-action="statement-import">📄 Import statement</button></div>
        <div class="subtle" style="margin-top:10px">Files are processed temporarily in the browser and are not stored in cloud sync.</div>
      </div>
      <div class="card about-card"><h3>About Rahman Expense</h3>
        <div class="about-line"><span>Application</span><b>Rahman Expense</b></div>
        <div class="about-line"><span>Version</span><b>v${APP_VERSION}</b></div>
        <div class="about-line"><span>Currencies</span><b>KWD + INR</b></div>
        <div class="about-line"><span>Developer</span><b>Rahiman</b></div>
      </div>
    </div>
    <div class="section card sync-card">
      <div class="sync-head"><div><h3>Private real-time cross-device sync</h3><p class="subtle" style="margin:4px 0 0">Use one account on iPhone and laptop. Once Supabase is connected, saved changes can appear automatically on the other open device in real time.</p></div><span class="status-pill ${syncClass}">${escapeHtml(cloudStateText())}</span></div>
      <div class="sync-form">
        <div class="field"><label>Supabase Project URL</label><input class="input" id="cloud-url" value="${escapeHtml(cfg.url)}" placeholder="https://xxxx.supabase.co" /></div>
        <div class="field"><label>Publishable / anon public key</label><input class="input" id="cloud-key" type="password" value="${escapeHtml(cfg.anonKey)}" placeholder="Publishable key only — never secret/service_role" /></div>
        <div class="field"><label>Your login email</label><input class="input" id="cloud-email" type="email" value="${escapeHtml(cloudStatus.email||cfg.email)}" placeholder="you@example.com" autocomplete="username" /></div>
        ${cloudStatus.authenticated?'':`<div class="field"><label>Password</label><input class="input" id="cloud-password" type="password" placeholder="At least 8 characters" autocomplete="current-password" /><div class="subtle" style="margin-top:6px">Password is used only to sign in and is not saved in Rahman Expense.</div></div>`}
      </div>
      <div class="actions" style="margin-top:14px">
        <button class="btn" data-action="cloud-save">Save cloud setup</button>
        ${cloudStatus.authenticated?`<button class="btn primary" data-action="cloud-sync">Sync now</button><button class="btn soft" data-action="cloud-signout">Sign out</button>`:`<button class="btn primary" data-action="cloud-password-login">Sign in</button><button class="btn soft" data-action="cloud-create-account">Create account</button>`}
      </div>
      <div class="sync-meta"><span><b>Account:</b> ${escapeHtml(cloudStatus.email||'Not signed in')}</span><span><b>Last sync:</b> ${escapeHtml(lastSync)}</span><span><b>Live:</b> ${escapeHtml(realtimeStatus==='SUBSCRIBED'?'On':realtimeStatus==='CONNECTING'?'Connecting…':'Off')}</span>${cloudStatus.error?`<span class="negative"><b>Status:</b> ${escapeHtml(cloudStatus.error)}</span>`:''}</div>
      <div class="privacy-note"><b>Privacy:</b> the Supabase <i>publishable key</i> (or legacy anon key) is appropriate for a browser app when Row Level Security is enabled. Never paste a Supabase <i>secret/service_role</i> key into Rahman Expense.</div>
    </div>`;
  return shell(content,'Settings','Kuwait and India, private backup and real-time iPhone ↔ laptop synchronization.');
}

function render(){
  const map={dashboard:dashboardView,transactions:transactionsView,budgets:budgetsView,reports:reportsView,settings:settingsView};
  app.innerHTML=(map[view]||dashboardView)();
  bindView();
}

function bindView(){
  document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>{view=el.dataset.nav;render()}));
  document.querySelectorAll('[data-country]').forEach(el=>el.addEventListener('click',async()=>{const next=el.dataset.country;if(!COUNTRIES[next]||next===country)return;country=next;state.settings.activeCountry=country;txFilter={search:'',type:'all',category:'all'};await saveState();render();}));
  document.querySelectorAll('[data-month-shift]').forEach(el=>el.addEventListener('click',()=>shiftMonth(Number(el.dataset.monthShift))));
  document.querySelectorAll('[data-action="add"]').forEach(el=>el.addEventListener('click',()=>openTransactionModal()));
  document.querySelectorAll('[data-action="scan"]').forEach(el=>el.addEventListener('click',quickScanReceipt));
  document.querySelectorAll('[data-action="statement-import"]').forEach(el=>el.addEventListener('click',chooseStatementFile));
  document.querySelectorAll('[data-edit-tx]').forEach(el=>el.addEventListener('click',ev=>{ev.stopPropagation();openTransactionModal(el.dataset.editTx)}));
  document.querySelectorAll('[data-open-tx]').forEach(el=>el.addEventListener('click',()=>openTransactionModal(el.dataset.openTx)));
  document.querySelectorAll('[data-summary-link]').forEach(el=>el.addEventListener('click',()=>openLinkedSection(el.dataset.summaryLink)));
  document.querySelectorAll('[data-metric-link]').forEach(el=>el.addEventListener('click',()=>openLinkedSection(el.dataset.metricLink)));
  document.querySelectorAll('[data-category-transactions]').forEach(el=>el.addEventListener('click',()=>openLinkedSection('category',el.dataset.categoryTransactions)));

  const search=document.getElementById('tx-search'); if(search) search.addEventListener('input',e=>{txFilter.search=e.target.value;render()});
  const tt=document.getElementById('tx-type'); if(tt) tt.addEventListener('change',e=>{txFilter.type=e.target.value;render()});
  const tc=document.getElementById('tx-cat'); if(tc) tc.addEventListener('change',e=>{txFilter.category=e.target.value;render()});

  document.querySelectorAll('[data-budget-cat]').forEach(input=>input.addEventListener('change',async e=>{
    const bud=ensureBudgetMonth(); const cat=e.target.dataset.budgetCat; const val=Math.max(0,n(e.target.value)); if(val){ bud[cat]=val; markBudgetDirty(month,cat,false); } else { delete bud[cat]; markBudgetDirty(month,cat,true); } await saveState(); queueCloudSync(); render();
  }));
  document.querySelectorAll('[data-action="copy-budget"]').forEach(el=>el.addEventListener('click',copyPreviousBudget));
  document.querySelectorAll('[data-action="clear-budget"]').forEach(el=>el.addEventListener('click',clearBudget));
  document.querySelectorAll('[data-action="export-csv"]').forEach(el=>el.addEventListener('click',exportCsv));
  document.querySelectorAll('[data-action="print-report"]').forEach(el=>el.addEventListener('click',()=>window.print()));
  document.querySelectorAll('[data-action="backup-export"]').forEach(el=>el.addEventListener('click',exportBackup));
  document.querySelectorAll('[data-action="backup-share"]').forEach(el=>el.addEventListener('click',shareBackup));
  document.querySelectorAll('[data-action="cloud-save"]').forEach(el=>el.addEventListener('click',saveCloudSetup));
  document.querySelectorAll('[data-action="cloud-password-login"]').forEach(el=>el.addEventListener('click',cloudPasswordLogin));
  document.querySelectorAll('[data-action="cloud-create-account"]').forEach(el=>el.addEventListener('click',cloudCreateAccount));
  document.querySelectorAll('[data-action="cloud-sync"]').forEach(el=>el.addEventListener('click',()=>syncCloud(false)));
  document.querySelectorAll('[data-action="cloud-signout"]').forEach(el=>el.addEventListener('click',cloudSignOut));

  for(const c of ['KW','IN']){ const opening=document.getElementById(`set-opening-${c}`); if(opening) opening.addEventListener('change',async e=>{state.settings.openingBalances[c]=n(e.target.value);markProfileDirty();await saveState();queueCloudSync();toast(`${COUNTRIES[c].name} opening balance saved.`);}); }
  const delRec=document.getElementById('set-delete-receipt'); if(delRec) delRec.addEventListener('change',async e=>{state.settings.deleteReceiptAfterSave=e.target.checked;await saveState();});
  document.querySelectorAll('[data-setting]').forEach(el=>el.addEventListener('change',async e=>{state.settings[e.target.dataset.setting]=e.target.checked;await saveState();}));
  const imp=document.getElementById('backup-import'); if(imp) imp.addEventListener('change',importBackup);
}

function openLinkedSection(target,category=''){
  if(target==='income' || target==='expense' || target==='transactions'){
    txFilter.search='';
    txFilter.category='all';
    txFilter.type=target==='transactions'?'all':target;
    view='transactions';
  }else if(target==='category'){
    txFilter.search=''; txFilter.type='expense'; txFilter.category=category||'all'; view='transactions';
  }else if(target==='budget'){
    view='budgets';
  }else if(target==='reports'){
    view='reports';
  }else{
    view='dashboard';
  }
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}

function isPhoneLike(){
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints>1 && window.innerWidth<900);
}

function quickScanReceipt(){
  if(!isPhoneLike()) { openTransactionModal(null,true); return; }
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.setAttribute('capture','environment');
  input.setAttribute('aria-label','Take receipt photo');
  input.style.position='fixed'; input.style.left='-9999px'; input.style.width='1px'; input.style.height='1px'; input.style.opacity='0';
  document.body.appendChild(input);
  let finished=false;
  const cleanup=()=>{ if(!finished){ finished=true; input.remove(); } };
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];
    cleanup();
    if(!file) return;
    openTransactionModal(null,true);
    await scanReceipt(file);
  },{once:true});
  try{ input.click(); }
  catch(_){ cleanup(); openTransactionModal(null,true); toast('Camera picker could not open automatically. Tap Take photo inside the scanner.'); }
  setTimeout(()=>{ if(document.body.contains(input) && document.visibilityState==='visible') cleanup(); },120000);
}

function openTransactionModal(id=null,scan=false){
  modalTxId=id;
  const existing=id?state.transactions.find(t=>t.id===id):null;
  const t=existing?{...existing}:{country,type:'expense',amount:'',merchant:'',category:'Groceries',subcategory:'General',date:today(),payment:'',note:''};
  const modalCountry=COUNTRIES[t.country]?t.country:country; const modalMeta=countryMeta(modalCountry);
  modalRoot.innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Transaction editor">
    <div class="modal-head"><div><h3>${existing?'Edit transaction':scan?'Scan receipt':'Add transaction'}</h3><div class="subtle">${modalMeta.flag} ${modalMeta.name} · ${modalMeta.currency} · ${scan?'Photo is used temporarily and not stored.':'Keep every entry clean and report-ready.'}</div></div><button class="btn icon" id="modal-close" aria-label="Close">×</button></div>
    <form id="tx-form">
      <div class="modal-body">
        <div class="segmented" id="type-seg">${['expense','income','transfer'].map(x=>`<button type="button" data-type="${x}" class="${t.type===x?'active':''}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div>
        ${scan&&!existing?receiptScannerHtml():''}
        <div class="form-grid" style="margin-top:16px">
          <div class="field"><label>Amount (${modalMeta.currency})</label><input class="input" id="f-amount" type="number" min="0" step="${modalMeta.decimals===3?'0.001':'0.01'}" required value="${escapeHtml(t.amount)}" placeholder="${modalMeta.decimals===3?'0.000':'0.00'}" /></div>
          <div class="field"><label>Date</label><input class="input" id="f-date" type="date" required value="${escapeHtml(t.date)}" /></div>
          <div class="field span2"><label id="merchant-label">${t.type==='income'?'Income source':t.type==='transfer'?'Transferred to':'Merchant / payee'}</label><input class="input" id="f-merchant" value="${escapeHtml(t.merchant||'')}" placeholder="e.g. Lulu Hypermarket" /></div>
          <div class="field expense-only"><label>Category</label><select class="select" id="f-category">${Object.keys(CATEGORIES).map(c=>`<option ${t.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></div>
          <div class="field expense-only"><label>Subcategory</label><select class="select" id="f-subcategory"></select></div>
          <div class="field"><label>Payment method</label><select class="select" id="f-payment"><option value="">Not specified</option>${paymentMethods(modalCountry).map(x=>`<option ${t.payment===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="field"><label>Note</label><input class="input" id="f-note" value="${escapeHtml(t.note||'')}" placeholder="Optional note" /></div>
        </div>
      </div>
      <div class="modal-foot">${existing?'<button type="button" class="btn danger" id="tx-delete">Delete</button>':''}<button type="button" class="btn" id="modal-cancel">Cancel</button><button class="btn primary" type="submit">${existing?'Save changes':'Save transaction'}</button></div>
    </form>
  </div></div>`;
  const catSel=document.getElementById('f-category');
  const subSel=document.getElementById('f-subcategory');
  function fillSubs(preferred){ if(!catSel||!subSel) return; subSel.innerHTML=(CATEGORIES[catSel.value]?.subs||['Other']).map(s=>`<option ${preferred===s?'selected':''}>${escapeHtml(s)}</option>`).join(''); }
  fillSubs(t.subcategory);
  if(catSel) catSel.addEventListener('change',()=>fillSubs());
  document.querySelectorAll('#type-seg [data-type]').forEach(btn=>btn.addEventListener('click',()=>setModalType(btn.dataset.type)));
  document.getElementById('modal-close').addEventListener('click',closeModal);
  document.getElementById('modal-cancel').addEventListener('click',closeModal);
  document.getElementById('modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop') closeModal();});
  document.getElementById('tx-form').addEventListener('submit',saveTransactionFromModal);
  if(existing) document.getElementById('tx-delete').addEventListener('click',()=>deleteTransaction(existing.id));
  if(scan&&!existing) bindScanner();
}

function receiptScannerHtml(){
  return `<div class="scan-box" style="margin-top:16px">
    <div class="scan-preview"><div id="receipt-image"><div style="width:110px;height:110px;border-radius:12px;background:var(--panel-soft);display:grid;place-items:center;font-size:34px">🧾</div></div><div><strong>Smart receipt scan</strong><div class="scan-status" id="scan-status">Take a photo, choose an image, or upload a PDF invoice. Rahman Expense will read the total, merchant, date and suggest a category.</div><div class="actions" style="margin-top:10px"><button class="btn soft" type="button" id="receipt-camera-btn">📷 Take photo</button><button class="btn" type="button" id="receipt-gallery-btn">Choose image</button><button class="btn" type="button" id="receipt-pdf-btn">📄 Upload PDF</button><input id="receipt-file-camera" type="file" accept="image/*" capture="environment" class="visually-hidden-file" /><input id="receipt-file" type="file" accept="image/*" class="visually-hidden-file" /><input id="receipt-pdf-file" type="file" accept="application/pdf,.pdf" class="visually-hidden-file" /></div></div></div>
  </div>`;
}

function setModalType(type){
  document.querySelectorAll('#type-seg [data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
  document.querySelectorAll('.expense-only').forEach(el=>el.style.display=type==='expense'?'grid':'none');
  const label=document.getElementById('merchant-label'); if(label) label.textContent=type==='income'?'Income source':type==='transfer'?'Transferred to':'Merchant / payee';
}
function modalType(){ return document.querySelector('#type-seg .active')?.dataset.type||'expense'; }

function closeModal(){
  if(scanObjectUrl){ URL.revokeObjectURL(scanObjectUrl); scanObjectUrl=null; }
  pendingReceiptFile=null; modalTxId=null; modalRoot.innerHTML='';
}

async function saveTransactionFromModal(e){
  e.preventDefault();
  const amount=n(document.getElementById('f-amount').value);
  if(amount<=0){ toast('Enter an amount greater than zero.'); return; }
  const type=modalType();
  const merchant=document.getElementById('f-merchant').value.trim();
  const cat=document.getElementById('f-category')?.value||'';
  const sub=document.getElementById('f-subcategory')?.value||'';
  const obj={
    id:modalTxId||uid(), country:modalTxId?(state.transactions.find(t=>t.id===modalTxId)?.country||country):country, type, amount, merchant,
    category:type==='expense'?cat:'', subcategory:type==='expense'?sub:'',
    date:safeDate(document.getElementById('f-date').value),
    payment:document.getElementById('f-payment').value,
    note:document.getElementById('f-note').value.trim(),
    createdAt:modalTxId?(state.transactions.find(t=>t.id===modalTxId)?.createdAt||new Date().toISOString()):new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  if(type==='expense'&&merchant){ state.merchantRules[merchantRuleKey(merchant)]={category:cat,subcategory:sub}; }
  const i=state.transactions.findIndex(t=>t.id===obj.id); if(i>=0) state.transactions[i]=obj; else state.transactions.push(obj);
  await saveState(); queueCloudSync(); month=obj.date.slice(0,7); closeModal(); render();
  toast(`Transaction ${i>=0?'updated':'saved'}${state.settings.deleteReceiptAfterSave&&pendingReceiptFile?' · receipt photo deleted':''}.`);
}

async function deleteTransaction(id){
  if(!confirm('Delete this transaction?')) return;
  state.transactions=state.transactions.filter(t=>t.id!==id); if(validUuid(id)) state.syncMeta.deletedTransactions.push({id,deletedAt:new Date().toISOString()}); await saveState(); queueCloudSync(); closeModal(); render(); toast('Transaction deleted.');
}

function bindScanner(){
  const camera=document.getElementById('receipt-file-camera');
  const gallery=document.getElementById('receipt-file');
  const pdf=document.getElementById('receipt-pdf-file');
  const cameraBtn=document.getElementById('receipt-camera-btn');
  const galleryBtn=document.getElementById('receipt-gallery-btn');
  const pdfBtn=document.getElementById('receipt-pdf-btn');
  if(cameraBtn&&camera) cameraBtn.addEventListener('click',()=>camera.click());
  if(galleryBtn&&gallery) galleryBtn.addEventListener('click',()=>gallery.click());
  if(pdfBtn&&pdf) pdfBtn.addEventListener('click',()=>pdf.click());
  [camera,gallery,pdf].forEach(el=>{
    if(el) el.addEventListener('change',async e=>{
      const f=e.target.files?.[0];
      if(f) await scanReceipt(f);
      e.target.value='';
    });
  });
}

async function loadTesseract(){
  if(window.Tesseract) return window.Tesseract;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload=resolve; s.onerror=()=>reject(new Error('OCR library unavailable'));
    document.head.appendChild(s);
  });
  return window.Tesseract;
}

async function scanReceipt(file){
  pendingReceiptFile=file;
  const status=document.getElementById('scan-status');
  let text='';
  try{
    if(file.type==='application/pdf' || /\.pdf$/i.test(file.name||'')){
      if(scanObjectUrl){ URL.revokeObjectURL(scanObjectUrl); scanObjectUrl=null; }
      document.getElementById('receipt-image').innerHTML=`<div class="pdf-file-preview">📄<small>${escapeHtml(file.name||'PDF invoice')}</small></div>`;
      status.innerHTML='<strong>Reading PDF invoice…</strong> Extracting text locally in your browser.';
      text=await extractPdfText(file,(msg)=>{status.textContent=msg;},6);
    }else{
      if(scanObjectUrl) URL.revokeObjectURL(scanObjectUrl);
      scanObjectUrl=URL.createObjectURL(file);
      document.getElementById('receipt-image').innerHTML=`<img alt="Receipt preview" src="${scanObjectUrl}" />`;
      status.innerHTML='<strong>Reading receipt…</strong> Local OCR is processing the image.';
      const T=await loadTesseract();
      const result=await T.recognize(file,'eng',{logger:m=>{if(m.status==='recognizing text') status.textContent=`Reading receipt… ${Math.round((m.progress||0)*100)}%`;}});
      text=result?.data?.text||'';
    }
    const parsed=parseReceiptText(text);
    if(parsed.amount) document.getElementById('f-amount').value=parsed.amount;
    if(parsed.date) document.getElementById('f-date').value=parsed.date;
    if(parsed.merchant) document.getElementById('f-merchant').value=parsed.merchant;
    const suggestion=suggestCategory(parsed.merchant,text);
    if(suggestion){
      document.getElementById('f-category').value=suggestion[0];
      document.getElementById('f-category').dispatchEvent(new Event('change'));
      const sub=document.getElementById('f-subcategory'); if([...sub.options].some(o=>o.value===suggestion[1])) sub.value=suggestion[1];
    }
    status.innerHTML=parsed.amount?'<strong>Receipt read.</strong> Please verify the amount, date and category before saving.':'<strong>Some text was read, but the total was unclear.</strong> Please enter the amount manually.';
  }catch(err){
    status.innerHTML='<strong>Automatic OCR is unavailable right now.</strong> The photo is still not stored; enter the details manually and save.';
  }
}


async function loadPdfJs(){
  const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
  if(pdfjs?.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
  return pdfjs;
}

function groupPdfTextItems(items=[]){
  const rows=[];
  for(const item of items){
    const str=String(item?.str||'').trim(); if(!str) continue;
    const x=Number(item?.transform?.[4]||0), y=Number(item?.transform?.[5]||0);
    let row=rows.find(r=>Math.abs(r.y-y)<=3.5);
    if(!row){ row={y,items:[]}; rows.push(row); }
    row.items.push({x,str});
  }
  rows.sort((a,b)=>b.y-a.y);
  return rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
}

async function extractPdfText(file,onProgress=()=>{},maxPages=40){
  const pdfjs=await loadPdfJs();
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjs.getDocument({data}).promise;
  const limit=Math.min(pdf.numPages,maxPages);
  const all=[];
  for(let i=1;i<=limit;i++){
    onProgress(`Reading PDF page ${i} of ${limit}…`);
    const page=await pdf.getPage(i);
    const tc=await page.getTextContent();
    all.push(...groupPdfTextItems(tc.items||[]));
  }
  let text=all.join('\n');
  if(text.replace(/\s/g,'').length<80 && pdf.numPages){
    // Scanned-image PDF fallback: OCR a bounded number of pages locally.
    const T=await loadTesseract();
    const ocr=[]; const ocrLimit=Math.min(pdf.numPages,8);
    for(let i=1;i<=ocrLimit;i++){
      onProgress(`Scanned PDF detected · OCR page ${i} of ${ocrLimit}…`);
      const page=await pdf.getPage(i);
      const viewport=page.getViewport({scale:1.35});
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      const result=await T.recognize(canvas,'eng');
      ocr.push(result?.data?.text||'');
      canvas.width=1; canvas.height=1;
    }
    text=ocr.join('\n');
  }
  return text;
}

function chooseStatementFile(){
  const input=document.createElement('input');
  input.type='file';
  input.accept='application/pdf,.pdf,text/csv,.csv,image/*';
  input.style.position='fixed'; input.style.left='-9999px'; input.style.opacity='0';
  document.body.appendChild(input);
  input.addEventListener('change',async()=>{
    const file=input.files?.[0]; input.remove(); if(!file) return;
    await importStatementFile(file);
  },{once:true});
  input.click();
}

function showStatementProcessing(fileName){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal statement-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><h3>Import statement</h3><div class="subtle">${escapeHtml(fileName)}</div></div></div><div class="modal-body"><div class="statement-processing"><div class="processing-spinner"></div><b id="statement-process-title">Reading statement…</b><div class="subtle" id="statement-process-status">Preparing the file.</div></div></div></div></div>`;
}
function setStatementProgress(msg){ const el=document.getElementById('statement-process-status'); if(el) el.textContent=msg; }

async function importStatementFile(file){
  showStatementProcessing(file.name||'Statement');
  try{
    let rows=[];
    const lower=String(file.name||'').toLowerCase();
    if(file.type==='text/csv' || lower.endsWith('.csv')){
      setStatementProgress('Reading CSV rows…');
      rows=parseStatementCsv(await file.text());
    }else if(file.type==='application/pdf' || lower.endsWith('.pdf')){
      const text=await extractPdfText(file,setStatementProgress,50);
      rows=parseStatementText(text);
    }else if((file.type||'').startsWith('image/')){
      setStatementProgress('Running local OCR on the statement image…');
      const T=await loadTesseract();
      const result=await T.recognize(file,'eng',{logger:m=>{if(m.status==='recognizing text') setStatementProgress(`Reading statement image… ${Math.round((m.progress||0)*100)}%`);}});
      rows=parseStatementText(result?.data?.text||'');
    }else throw new Error('Use a PDF, CSV or image statement.');
    rows=rows.filter(r=>r.amount>0 && r.date);
    if(!rows.length) throw new Error('No transaction rows were detected. Try a text-based PDF/CSV or a clearer image.');
    rows=rows.slice(0,500).map((r,i)=>prepareStatementRow(r,i));
    pendingStatementRows=rows; pendingStatementFileName=file.name||'Statement';
    showStatementReview(rows,pendingStatementFileName);
  }catch(err){
    modalRoot.innerHTML='';
    toast(`Statement import: ${err?.message||'Could not read this file.'}`);
  }
}

function parseDateFlexible(raw=''){
  const m=String(raw).trim().match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if(!m){ const y=String(raw).trim().match(/\b(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})\b/); return y?`${y[1]}-${String(y[2]).padStart(2,'0')}-${String(y[3]).padStart(2,'0')}`:''; }
  let y=Number(m[3]); if(y<100) y+=2000;
  return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
}
function parseMoneyValue(raw=''){
  const cleaned=String(raw).replace(/KWD|KD|INR|Rs\.?|د\.ك|₹/gi,'').replace(/,/g,'').replace(/[^0-9.\-]/g,'');
  const v=Number(cleaned); return Number.isFinite(v)?Math.abs(v):0;
}
function normalizeStatementText(s=''){ return String(s).replace(/\s+/g,' ').trim(); }
function cleanStatementNarration(text=''){
  return normalizeStatementText(text)
    .replace(GENERIC_STATEMENT_WORDS,' ')
    .replace(/\b(?:KWD|KD|KW|INR|RS)\b|₹/gi,' ')
    .replace(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g,' ')
    .replace(/\b\d{1,2}:(?:\d{0,2})?(?::\d{2})?-?\b/g,' ')
    .replace(/\s*[,;]+\s*/g,' ')
    .replace(/\s+/g,' ').trim();
}
function deriveStatementMerchant(narration=''){
  const raw=normalizeStatementText(narration);
  if(/minimum due|credit card.*settlement|card payment/i.test(raw)) return 'Credit Card Payment';
  if(/wamd/i.test(raw)) return 'WAMD Payment';
  let clean=cleanStatementNarration(raw)
    .replace(/\b(?:ref(?:erence)?|reference no|transaction id|purpose)[:#]?\s*[A-Z0-9\/-]+/gi,' ')
    .replace(/\b\d{6,}\b/g,' ')
    .replace(/\s+/g,' ').trim();
  const to=clean.match(/(?:to|at)[:\s]+([A-Za-z][A-Za-z0-9 '&.\/-]{2,60})/i);
  if(to) clean=to[1];
  return (clean||raw).slice(0,80);
}
function statementTypeFor(narration='',credit=0,debit=0,rawAmount=''){
  if(STATEMENT_TRANSFER_HINT.test(narration)) return 'transfer';
  if(credit>0 || STATEMENT_INCOME_HINT.test(narration) || /\bCR\b|credit/i.test(rawAmount)) return 'income';
  return 'expense';
}
function simpleHash(input=''){
  let h1=0x811c9dc5;
  for(let i=0;i<input.length;i++){ h1^=input.charCodeAt(i); h1=Math.imul(h1,0x01000193); }
  return (h1>>>0).toString(16).padStart(8,'0');
}
function statementImportId(r){
  return simpleHash([r.country||country,r.date,r.type,n(r.amount).toFixed(3),String(r.reference||'').toLowerCase(),normalizeStatementText(r.narration||r.merchant||'').toLowerCase()].join('|'));
}
function transactionHasImportId(t,id){ return String(t.note||'').includes(`[Import ID: ${id}]`); }
function isStatementDuplicate(r){
  const id=r.importId||statementImportId(r);
  if(state.transactions.some(t=>(COUNTRIES[t.country]?t.country:'KW')===(r.country||country)&&transactionHasImportId(t,id))) return true;
  return state.transactions.some(t=>{
    if((COUNTRIES[t.country]?t.country:'KW')!==(r.country||country)) return false;
    if(t.date!==r.date || t.type!==r.type || Math.abs(n(t.amount)-n(r.amount))>0.0005) return false;
    if(r.reference && String(t.note||'').toLowerCase().includes(String(r.reference).toLowerCase())) return true;
    return normalizeStatementText(t.merchant||'').toLowerCase()===normalizeStatementText(r.merchant||'').toLowerCase();
  });
}
function inferStatementDebitCredit(rows=[]){
  const out=rows.map(r=>({...r,debit:n(r.debit),credit:n(r.credit)}));
  const toleranceFor=(amount)=>Math.max(0.002,Math.min(0.050,n(amount)*0.01));
  for(let i=0;i<out.length;i++){
    const r=out[i];
    if(r.debit>0 || r.credit>0) continue;
    const amount=n(r.amount); if(!(amount>0)) continue;
    const prev=i>0?out[i-1]:null;
    if(prev && n(prev.balance)>0 && n(r.balance)>0){
      const delta=n(r.balance)-n(prev.balance);
      if(Math.abs(Math.abs(delta)-amount)<=toleranceFor(amount)){
        if(delta<0) r.debit=amount; else if(delta>0) r.credit=amount;
      }
    }
    if(!(r.debit>0||r.credit>0)){
      const raw=`${r.rawAmount||''} ${r.narration||''}`;
      if(/\bCR\b|credit received|cashback|refund|reversal|deposit/i.test(raw)) r.credit=amount;
      else if(/\bDR\b|debit|withdrawal/i.test(raw)) r.debit=amount;
    }
    if(!(r.debit>0||r.credit>0)){
      const hinted=statementTypeFor(r.narration,0,0,r.rawAmount);
      if(hinted==='income') r.credit=amount; else r.debit=amount;
    }
  }
  for(const r of out){
    if(STATEMENT_TRANSFER_HINT.test(r.narration||'')) r.type='transfer';
    else if(r.credit>0) r.type='income';
    else r.type='expense';
    r.direction=r.credit>0?'credit':'debit';
  }
  return out;
}

function prepareStatementRow(r,index){
  const type=r.type||statementTypeFor(r.narration,r.credit,r.debit,r.rawAmount);
  const merchant=r.merchant||deriveStatementMerchant(r.narration);
  const suggestion=type==='expense'?suggestCategory(merchant,r.narration):['Banking','Other'];
  const row={...r,index,country,type,merchant,direction:r.direction||(n(r.credit)>0?'credit':'debit'),category:r.category||suggestion[0],subcategory:r.subcategory||suggestion[1],selected:true};
  row.importId=statementImportId(row); row.duplicate=isStatementDuplicate(row); if(row.duplicate) row.selected=false;
  return row;
}

function parseStatementText(text=''){
  const rawLines=String(text).split(/\r?\n/).map(normalizeStatementText).filter(Boolean);
  const chunks=[]; let current=null;
  const dateStart=/^(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|20\d{2}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/;
  for(const line of rawLines){
    const dm=line.match(dateStart);
    if(dm){ if(current) chunks.push(current); current={dateRaw:dm[1],text:line}; }
    else if(current && !/tran date|transaction date|narration|description|reference|withdrawal|deposit|balance|debit|credit/i.test(line)) current.text+=` ${line}`;
  }
  if(current) chunks.push(current);
  const parsed=chunks.map(c=>{
    const date=parseDateFlexible(c.dateRaw); const full=c.text;
    const decimals=[...full.matchAll(/(?:KWD|KD|INR|Rs\.?|₹)?\s*[-+]?\d{1,9}(?:,\d{3})*\.\d{2,3}\b/gi)].map(m=>({raw:m[0],v:parseMoneyValue(m[0]),index:m.index||0})).filter(x=>x.v>=0);
    if(!decimals.length) return null;
    // In bank statements the last decimal is normally running balance; in credit-card statements it is usually the transaction amount.
    const hasBalanceHeader=/\bbalance\b/i.test(text.slice(0,1500));
    const amountToken=hasBalanceHeader && decimals.length>=2 ? decimals[decimals.length-2] : decimals[decimals.length-1];
    const balance=hasBalanceHeader && decimals.length>=2 ? decimals[decimals.length-1].v : 0;
    const beforeAmount=full.slice(0,amountToken.index);
    const refMatches=[...beforeAmount.matchAll(/(?:\b\d{3,}(?:\/\d+)+\b|\b\d{5,}\b)/g)];
    const reference=refMatches.length?refMatches[refMatches.length-1][0]:'';
    let narration=full.replace(c.dateRaw,' ');
    for(const a of decimals) narration=narration.replace(a.raw,' ');
    if(reference) narration=narration.replace(reference,' ');
    narration=normalizeStatementText(narration);
    const rawAmount=amountToken.raw;
    const type=statementTypeFor(narration,0,0,rawAmount);
    return {date,narration,reference,debit:0,credit:0,amount:amountToken.v,type,balance,rawAmount};
  }).filter(Boolean);
  return inferStatementDebitCredit(parsed);
}

function parseDelimitedLine(line,delimiter){
  const out=[]; let cur='',quote=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){ if(quote&&line[i+1]==='"'){cur+='"';i++;} else quote=!quote; }
    else if(ch===delimiter&&!quote){out.push(cur.trim());cur='';} else cur+=ch;
  }
  out.push(cur.trim()); return out;
}
function parseStatementCsv(text=''){
  const lines=String(text).split(/\r?\n/).filter(l=>l.trim()); if(lines.length<2) return [];
  const first=lines[0]; const delimiter=(first.match(/\t/g)||[]).length>(first.match(/,/g)||[]).length?'\t':((first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',');
  const headers=parseDelimitedLine(first,delimiter).map(h=>h.toLowerCase().trim());
  const find=(patterns)=>headers.findIndex(h=>patterns.some(p=>p.test(h)));
  const idx={date:find([/date/]),narr:find([/narration/,/description/,/details/,/merchant/]),ref:find([/reference/,/ref\b/]),debit:find([/withdrawal/,/debit/,/\bdr\b/]),credit:find([/deposit/,/credit/,/\bcr\b/]),amount:find([/^amount$/,/transaction amount/]),balance:find([/balance/])};
  const parsed=lines.slice(1).map(line=>{
    const c=parseDelimitedLine(line,delimiter); const date=parseDateFlexible(c[idx.date]||''); if(!date) return null;
    const narration=normalizeStatementText(c[idx.narr]||''); const reference=idx.ref>=0?(c[idx.ref]||''):'';
    const debit=idx.debit>=0?parseMoneyValue(c[idx.debit]):0, credit=idx.credit>=0?parseMoneyValue(c[idx.credit]):0;
    let amount=debit||credit||(idx.amount>=0?parseMoneyValue(c[idx.amount]):0); if(!amount) return null;
    const rawAmount=idx.amount>=0?(c[idx.amount]||''):''; const type=statementTypeFor(narration,credit,debit,rawAmount);
    return {date,narration,reference,debit,credit,amount,type,balance:idx.balance>=0?parseMoneyValue(c[idx.balance]):0,rawAmount};
  }).filter(Boolean);
  return inferStatementDebitCredit(parsed);
}

function categoryOptions(selected){ return Object.keys(CATEGORIES).map(c=>`<option ${c===selected?'selected':''}>${escapeHtml(c)}</option>`).join(''); }
function showStatementReview(rows,fileName){
  const duplicates=rows.filter(r=>r.duplicate).length;
  const debitCount=rows.filter(r=>n(r.debit)>0).length, creditCount=rows.filter(r=>n(r.credit)>0).length;
  modalRoot.innerHTML=`<div class="modal-backdrop" id="statement-backdrop"><div class="modal statement-modal wide" role="dialog" aria-modal="true" aria-label="Statement import review">
    <div class="modal-head"><div><h3>Review statement import</h3><div class="subtle">${countryMeta().flag} ${countryMeta().name} · ${countryMeta().currency} · ${escapeHtml(fileName)} · ${rows.length} transaction${rows.length===1?'':'s'} · ${debitCount} Dr · ${creditCount} Cr${duplicates?` · ${duplicates} duplicate${duplicates===1?'':'s'} skipped`:''}</div></div><button class="btn icon" id="statement-close" aria-label="Close">×</button></div>
    <div class="modal-body"><div class="statement-note"><b>Review before saving.</b> Rahman Expense reads both Debit (Dr) and Credit (Cr). Debits become expenses unless identified as transfers; credits become income/refunds; card repayments/settlements remain transfers to avoid double-counting.</div>
      <div class="statement-review-list">${rows.map((r,i)=>`<div class="statement-review-row ${r.duplicate?'is-duplicate':''}" data-statement-row="${i}">
        <label class="statement-check"><input type="checkbox" data-statement-select="${i}" ${r.selected?'checked':''} ${r.duplicate?'disabled':''}><span></span></label>
        <div class="statement-main"><div class="statement-title">${escapeHtml(r.merchant||r.narration||'Transaction')}</div><div class="statement-meta"><span class="statement-direction ${r.credit>0?'is-credit':'is-debit'}">${r.credit>0?'CR · Credit':'DR · Debit'}</span> · ${escapeHtml(r.date)}${r.reference?` · Ref ${escapeHtml(r.reference)}`:''}${r.balance?` · Balance ${money(r.balance)}`:''}${r.duplicate?' · Already imported':''}</div><div class="statement-narration">${escapeHtml(r.narration||'')}</div></div>
        <div class="statement-controls"><select class="select compact" data-statement-type="${i}"><option value="expense" ${r.type==='expense'?'selected':''}>Expense</option><option value="income" ${r.type==='income'?'selected':''}>Income</option><option value="transfer" ${r.type==='transfer'?'selected':''}>Transfer</option></select><select class="select compact" data-statement-category="${i}" ${r.type!=='expense'?'disabled':''}>${categoryOptions(r.category)}</select></div>
        <div class="statement-amount ${r.credit>0?'positive':'negative'}"><small>${r.credit>0?'CR':'DR'}</small>${r.credit>0?'+':'−'}${money(r.amount)}</div>
      </div>`).join('')}</div>
    </div>
    <div class="modal-foot"><button class="btn" id="statement-cancel">Cancel</button><button class="btn primary" id="statement-save">Save selected transactions</button></div>
  </div></div>`;
  document.getElementById('statement-close').addEventListener('click',closeStatementImport);
  document.getElementById('statement-cancel').addEventListener('click',closeStatementImport);
  document.getElementById('statement-backdrop').addEventListener('click',e=>{if(e.target.id==='statement-backdrop') closeStatementImport();});
  document.querySelectorAll('[data-statement-select]').forEach(el=>el.addEventListener('change',e=>{pendingStatementRows[Number(e.target.dataset.statementSelect)].selected=e.target.checked;}));
  document.querySelectorAll('[data-statement-type]').forEach(el=>el.addEventListener('change',e=>{
    const i=Number(e.target.dataset.statementType), r=pendingStatementRows[i]; r.type=e.target.value;
    if(r.type==='income'){ r.credit=n(r.amount); r.debit=0; r.direction='credit'; }
    else { r.debit=n(r.amount); r.credit=0; r.direction='debit'; }
    const cat=document.querySelector(`[data-statement-category="${i}"]`); if(cat) cat.disabled=r.type!=='expense';
  }));
  document.querySelectorAll('[data-statement-category]').forEach(el=>el.addEventListener('change',e=>{const i=Number(e.target.dataset.statementCategory),r=pendingStatementRows[i];r.category=e.target.value;r.subcategory=CATEGORIES[r.category]?.subs?.[0]||'Other';}));
  document.getElementById('statement-save').addEventListener('click',saveStatementImport);
}
function closeStatementImport(){ pendingStatementRows=[]; pendingStatementFileName=''; modalRoot.innerHTML=''; }
async function saveStatementImport(){
  const selected=pendingStatementRows.filter(r=>r.selected&&!r.duplicate); if(!selected.length){ toast('No new statement transactions selected.'); return; }
  const now=new Date().toISOString();
  for(const r of selected){
    const cat=r.type==='expense'?(r.category||'Other'):'';
    const sub=r.type==='expense'?(r.subcategory||CATEGORIES[cat]?.subs?.[0]||'Other'):'';
    const noteParts=[`Imported from ${pendingStatementFileName}`, r.credit>0?'Statement Credit (Cr)':'Statement Debit (Dr)'];
    if(r.narration) noteParts.push(r.narration); if(r.reference) noteParts.push(`Ref: ${r.reference}`); noteParts.push(`[Import ID: ${r.importId}]`);
    state.transactions.push({id:uid(),country:r.country||country,type:r.type,amount:n(r.amount),merchant:r.merchant||deriveStatementMerchant(r.narration),category:cat,subcategory:sub,date:r.date,payment:'Bank / Card Statement',note:noteParts.join(' · '),createdAt:now,updatedAt:now});
    if(r.type==='expense'&&r.merchant) state.merchantRules[merchantRuleKey(r.merchant,r.country||country)]={category:cat,subcategory:sub};
  }
  const latest=[...selected].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]; if(latest?.date) month=latest.date.slice(0,7);
  await saveState(); queueCloudSync(); const count=selected.length; closeStatementImport(); view='transactions'; txFilter={search:'',type:'all',category:'all'}; render(); toast(`${count} statement transaction${count===1?'':'s'} saved. Duplicate rows were skipped.`);
}

function parseReceiptText(text){
  const lines=text.split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  let merchant=lines.find(l=>/[A-Za-z]{3}/.test(l) && !/invoice|receipt|tax|date|total/i.test(l))||'';
  merchant=merchant.slice(0,60);
  const amountCandidates=[];
  for(const line of lines){
    if(/grand total|total due|amount due|net total|total/i.test(line)){
      const nums=[...line.matchAll(/(?:KWD|KD|INR|Rs\.?|د\.ك|₹)?\s*(\d{1,9}(?:[,.]\d{1,3})?)/gi)].map(m=>Number(m[1].replace(',','.'))).filter(x=>x>0);
      nums.forEach(v=>amountCandidates.push({v,score:/grand total|amount due|total due/i.test(line)?3:2}));
    }
  }
  if(!amountCandidates.length){
    for(const line of lines.slice(-8)){
      const nums=[...line.matchAll(/(\d{1,6}[,.]\d{2,3})/g)].map(m=>Number(m[1].replace(',','.'))).filter(x=>x>0);
      nums.forEach(v=>amountCandidates.push({v,score:1}));
    }
  }
  amountCandidates.sort((a,b)=>b.score-a.score||b.v-a.v);
  let date='';
  const joined=lines.join(' ');
  const dm=joined.match(/\b(20\d{2})[\-/](\d{1,2})[\-/](\d{1,2})\b/) || joined.match(/\b(\d{1,2})[\-/](\d{1,2})[\-/](20\d{2})\b/);
  if(dm){
    if(dm[1].length===4) date=`${dm[1]}-${String(dm[2]).padStart(2,'0')}-${String(dm[3]).padStart(2,'0')}`;
    else date=`${dm[3]}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}`;
  }
  return {amount:amountCandidates[0]?.v||'',merchant,date};
}

function suggestCategory(merchant,text=''){
  const key=(merchant||'').trim().toLowerCase();
  const localKey=merchantRuleKey(key);
  if(key && state.merchantRules[localKey]) return [state.merchantRules[localKey].category,state.merchantRules[localKey].subcategory];
  const hay=`${merchant||''} ${text}`;
  for(const [re,val] of MERCHANT_HINTS) if(re.test(hay)) return val;
  return ['Other','Uncategorized'];
}

async function copyPreviousBudget(){
  const prev=state.budgets[countryMonthKey(country,previousMonth())];
  if(!prev||!Object.keys(prev).length){ toast(`No budget found for ${monthLabel(previousMonth())}.`); return; }
  state.budgets[countryMonthKey()]={...prev}; Object.keys(prev).forEach(cat=>markBudgetDirty(month,cat,false)); await saveState(); queueCloudSync(); render(); toast(`Copied ${monthLabel(previousMonth())} budget.`);
}
async function clearBudget(){
  if(!confirm(`Clear all category budgets for ${monthLabel(month)}?`)) return;
  Object.keys(state.budgets[countryMonthKey()]||{}).forEach(cat=>markBudgetDirty(month,cat,true)); state.budgets[countryMonthKey()]={}; await saveState(); queueCloudSync(); render(); toast('Monthly budget cleared.');
}

function exportCsv(){
  const rows=[['Date','Type','Merchant','Category','Subcategory','Amount','Currency','Payment Method','Note']];
  monthTransactions().sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(t=>rows.push([t.date,t.type,t.merchant||'',t.category||'',t.subcategory||'',t.amount,countryMeta().currency,t.payment||'',t.note||'']));
  const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`rahman-expense-${country.toLowerCase()}-${month}.csv`); toast('CSV exported.');
}
function exportBackup(){
  downloadBlob(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),`rahman-expense-backup-${today()}.json`); toast('Backup exported.');
}
async function shareBackup(){
  const name=`rahman-expense-backup-${today()}.json`;
  const file=new File([JSON.stringify(state,null,2)],name,{type:'application/json'});
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({title:'Rahman Expense backup',text:'Rahman Expense private expense backup',files:[file]});
      toast('Backup shared. Choose Google Drive from the share sheet if you want it there.');
    }else exportBackup();
  }catch(err){ if(err?.name!=='AbortError') exportBackup(); }
}
async function importBackup(e){
  const file=e.target.files?.[0]; if(!file) return;
  try{
    const data=JSON.parse(await file.text());
    if(!Array.isArray(data.transactions)||typeof data.settings!=='object') throw new Error('Invalid backup');
    if(!confirm('Replace current Rahman Expense data with this backup?')) return;
    state={...defaultState(),...data,settings:{...defaultState().settings,...data.settings}}; normalizeState(); await saveState(); queueCloudSync(); render(); toast('Backup restored.');
  }catch(err){ toast('Could not import that backup file.'); }
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),500);
}
function toast(message){
  toastRoot.innerHTML=`<div class="toast">${escapeHtml(message)}</div>`; setTimeout(()=>{toastRoot.innerHTML='';},3200);
}

async function init(){
  await loadState();
  render();
  await initCloud();
  render();
  window.addEventListener('online',()=>{ if(cloudStatus.authenticated) startRealtime(); });
  window.addEventListener('offline',()=>{ realtimeStatus='OFFLINE'; render(); });
  // v2.6 deliberately runs without a service worker so GitHub Pages updates are immediate.
  // Remove only legacy app caches/service workers; keep IndexedDB/localStorage expense data intact.
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('rahman-expense-')).map(k => caches.delete(k)));
    }
  } catch (_) {}
}
init();
