import { FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';
type User={id:string;email:string;displayName?:string};
type Dashboard={tasks:any[];reminders:any[];documents:any[];memories:any[];assets:any[];expenseSummary:any};

async function api(path:string, options:RequestInit={}){
  const token=localStorage.getItem('lifeos_token');
  const headers=new Headers(options.headers); if(options.body) headers.set('Content-Type','application/json'); if(token) headers.set('Authorization',`Bearer ${token}`);
  const r=await fetch(`${API}${path}`,{...options,headers}); const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error??'Request failed'); return data;
}

function Auth({onLogin}:{onLogin:(u:User,t:string)=>void}){
  const [register,setRegister]=useState(false); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [name,setName]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const data=await api(register?'/auth/register':'/auth/login',{method:'POST',body:JSON.stringify(register?{email,password,displayName:name}:{email,password})});onLogin(data.user,data.token)}catch(err){setError((err as Error).message)}finally{setBusy(false)}}
  return <div className="auth"><div className="auth-card"><div className="logo">L</div><p className="eyebrow">YOUR PERSONAL OPERATING SYSTEM</p><h1>{register?'Create your LIFEOS':'Welcome back'}</h1><p className="muted">Everything about your life. One intelligent place.</p><form onSubmit={submit}>{register&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required/>}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" required/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" minLength={8} required/>{error&&<div className="error">{error}</div>}<button disabled={busy}>{busy?'Please wait…':register?'Create account':'Sign in'}</button></form><button className="ghost" onClick={()=>setRegister(!register)}>{register?'Already have an account? Sign in':'New to LIFEOS? Create an account'}</button></div></div>
}

function App(){
 const [user,setUser]=useState<User|null>(null); const [dash,setDash]=useState<Dashboard|null>(null); const [query,setQuery]=useState(''); const [answer,setAnswer]=useState<any>(null); const [task,setTask]=useState('');
 useEffect(()=>{const token=localStorage.getItem('lifeos_token');if(token) api('/auth/me').then(setUser).catch(()=>localStorage.removeItem('lifeos_token'))},[]);
 useEffect(()=>{if(user) api('/dashboard').then(setDash).catch(console.error)},[user]);
 if(!user)return <Auth onLogin={(u,t)=>{localStorage.setItem('lifeos_token',t);setUser(u)}}/>;
 async function ask(e:FormEvent){e.preventDefault();if(!query.trim())return;setAnswer(null);try{setAnswer(await api('/assistant/chat',{method:'POST',body:JSON.stringify({message:query})}))}catch(err){setAnswer({error:(err as Error).message})}}
 async function addTask(e:FormEvent){e.preventDefault();if(!task.trim())return;await api('/tasks',{method:'POST',body:JSON.stringify({title:task})});setTask('');setDash(await api('/dashboard'))}
 async function complete(id:string){await api(`/tasks/${id}/complete`,{method:'POST'});setDash(await api('/dashboard'))}
 const greeting=user.displayName||user.email.split('@')[0];
 return <div className="app"><aside><div className="brand"><span>L</span> LIFEOS</div><nav>{['Home','Ask AI','Search','Documents','Memories','Tasks','Assets','Activity','Settings'].map((x,i)=><button className={i===0?'active':''} key={x}>{x}</button>)}</nav><div className="profile"><div className="avatar">{greeting[0].toUpperCase()}</div><div><b>{greeting}</b><small>{user.email}</small></div><button onClick={()=>{localStorage.removeItem('lifeos_token');setUser(null)}}>↪</button></div></aside><main><header><div><p className="eyebrow">PERSONAL COMMAND CENTER</p><h1>Good morning, {greeting}.</h1></div><div className="date">LIFEOS is ready</div></header><section className="ask-card"><p>ASK YOUR LIFE</p><form onSubmit={ask}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a document, remember something, check a task…"/><button>Ask →</button></form>{answer&&<div className="answer">{answer.error?<span className="error">{answer.error}</span>:<><b>{answer.message?.content??answer.message}</b><small>Sources: {(answer.sources?.documents?.length??0)} documents · {(answer.sources?.memories?.length??0)} memories · {(answer.sources?.tasks?.length??0)} tasks · {(answer.sources?.assets?.length??0)} assets</small></>}</div>}</section><div className="stats"><div><span>Open tasks</span><strong>{dash?.tasks.length??0}</strong></div><div><span>Memories</span><strong>{dash?.memories.length??0}</strong></div><div><span>Documents</span><strong>{dash?.documents.length??0}</strong></div><div><span>Assets</span><strong>{dash?.assets.length??0}</strong></div></div><section className="content-grid"><div className="panel"><div className="panel-head"><h2>Today</h2><span>Tasks</span></div><form className="quick" onSubmit={addTask}><input value={task} onChange={e=>setTask(e.target.value)} placeholder="Add a task…"/><button>+</button></form>{dash?.tasks.length?dash.tasks.map(t=><div className="row" key={t.id}><button className="check" onClick={()=>complete(t.id)}>✓</button><div><b>{t.title}</b><small>{t.dueAt?new Date(t.dueAt).toLocaleString():'No due date'} · {t.priority}</small></div></div>):<div className="empty">Nothing urgent. Add a task when something comes to mind.</div>}</div><div className="panel"><div className="panel-head"><h2>Recent knowledge</h2><span>{dash?.documents.length??0} documents</span></div>{dash?.documents.slice(0,5).map(d=><div className="row" key={d.id}><div className="icon">▤</div><div><b>{d.title}</b><small>{d.documentType} · {d.status}</small></div></div>)}{!dash?.documents.length&&<div className="empty">Upload your first document to start building your life knowledge base.</div>}</div></section></main></div>
}
createRoot(document.getElementById('root')!).render(<App/>);
