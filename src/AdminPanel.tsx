import { useEffect, useState } from 'react';
import { Activity, Bell, FileText, LayoutDashboard, RefreshCw, Search, Shield, Users, XCircle } from 'lucide-react';

type Props = { supabase:any; userId:string; role:string; notify:(message:string)=>void; onlineCount?:number };
type Tab = 'overview'|'users'|'workspaces'|'content'|'logs';
export default function AdminPanel({supabase,userId,role,notify,onlineCount=0}:Props) {
  const [tab,setTab]=useState<Tab>('overview');
  const [busy,setBusy]=useState(false);
  const [stats,setStats]=useState<any>({});
  const [users,setUsers]=useState<any[]>([]);
  const [rows,setRows]=useState<any[]>([]);
  const [logs,setLogs]=useState<any[]>([]);
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<any>(null);
  const [announcement,setAnnouncement]=useState({title:'',body:''});
  const [target,setTarget]=useState({user_id:'',title:'',body:''});
  const call=async(action:string,extra:any={})=>{
    const {data,error}=await supabase.functions.invoke('nexus-admin',{body:{action,...extra}});
    if(error)throw new Error(data?.error||error.message);
    if(!data?.ok)throw new Error(data?.error||'관리자 요청 실패');
    return data;
  };
  const refresh=async()=>{
    setBusy(true);
    try {
      if(tab==='overview'){const d=await call('overview');setStats(d.stats||{});}
      if(tab==='users'){const d=await call('users');setUsers(d.users||[]);}
      if(tab==='workspaces'){const d=await call('workspaces');setRows(d.workspaces||[]);}
      if(tab==='content'){const d=await call('channels');const f=await call('files');const i=await call('invites');setRows([{kind:'채널',items:d.channels||[]},{kind:'파일',items:f.files||[]},{kind:'초대',items:i.invites||[]}]);}
      if(tab==='logs'){const d=await call('audit_logs');setLogs(d.logs||[]);}
    }catch(e:any){notify('관리자 센터: '+(e.message||'오류'));}finally{setBusy(false);}
  };
  useEffect(()=>{void refresh();},[tab]);
  const run=async(action:string,extra:any,success:string)=>{
    if(!window.confirm('이 작업을 실행하시겠습니까?'))return;
    setBusy(true);try{await call(action,extra);notify(success);await refresh();}catch(e:any){notify(e.message||'작업 실패');}finally{setBusy(false);}
  };
  const filtered=users.filter(u=>[u.display_name,u.email,u.id].some(v=>String(v||'').toLowerCase().includes(query.toLowerCase())));
  const tabs:[Tab,string,any][]=[['overview','개요',LayoutDashboard],['users','사용자',Users],['workspaces','워크스페이스',Shield],['content','콘텐츠',FileText],['logs','관리 기록',Activity]];
  return <section className="admin-page">
    <div className="admin-heading"><div><div className="eyebrow">NEXUS CONTROL CENTER</div><h1>관리자 센터</h1><p>권한: {role==='nexus_admin'?<span className="nexus-admin-badge">NEXUS ADMIN</span>:role==='developer'?'개발자':role==='admin'?'관리자':'운영자'} · 서버 관리 기능</p></div><button className="secondary-action" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={15}/> 새로고침</button></div>
    <nav className="admin-tabs">{tabs.map(([key,label,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon size={16}/>{label}</button>)}</nav>
    {busy&&<div className="admin-loading">데이터를 불러오는 중입니다…</div>}
    {tab==='overview'&&<><div className="admin-stat-grid">{[['전체 사용자',stats.users],['워크스페이스',stats.workspaces],['메시지 누적',stats.messages],['파일',stats.files],['초대',stats.invites],['현재 접속자',onlineCount],['활성 사용자 · 5분',stats.active_users_now],['활성 사용자 · 24시간',stats.active_users_24h],['앱 이벤트 · 24시간',stats.events_24h],['채널 메시지 · 24시간',stats.messages_24h],['DM · 24시간',stats.dms_24h],['통화 시작 · 24시간',stats.calls_24h],['파일 업로드 · 24시간',stats.uploads_24h]].map(([label,value])=><div className="admin-stat" key={String(label)}><span>{label}</span><strong>{value??'—'}</strong></div>)}</div><div className="admin-info-card"><Shield size={20}/><div><strong>권한이 서버에서 확인됩니다</strong><p>관리자 작업은 Supabase Edge Function에서 역할을 재검증하며, 주요 작업은 감사 기록에 남습니다.</p></div></div><div className="admin-info-card"><Bell size={20}/><div><strong>공지 및 사용자 알림</strong><p>사용자 탭에서 특정 계정을 선택해 정지·해제·역할 변경을 할 수 있고, 공지 알림은 아래 사용자 관리 영역에서 보낼 수 있습니다.</p></div></div></>}
    {tab==='users'&&<><div className="admin-toolbar"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="닉네임, 이메일, 사용자 ID 검색"/></label><span>{filtered.length}명 표시</span></div><div className="admin-user-list">{filtered.map(u=><article className="admin-user" key={u.id}><div className="admin-user-avatar">{String(u.display_name||'U').slice(0,1)}</div><div className="admin-user-main"><strong>{u.display_name||'이름 없음'}</strong><span>{u.email}</span><small>{(u.role==='developer'?'개발자':u.role==='nexus_admin'?'NEXUS ADMIN':u.role==='admin'?'관리자':u.role==='moderator'?'운영자':'일반 사용자')} · 가입 {new Date(u.created_at).toLocaleDateString('ko-KR')}</small></div><div className="admin-user-actions"><button onClick={async()=>{try{const d=await call('user_details',{user_id:u.id});setSelected({...d.user,profile:d.profile,memberships:d.memberships});}catch(e:any){notify(e.message)}}}>상세</button>{u.id!==userId&&role==='developer'&&<><button onClick={()=>void run(u.banned_until?'unsuspend_user':'suspend_user',{user_id:u.id},u.banned_until?'계정을 해제했습니다.':'계정을 정지했습니다.')}>{u.banned_until?'해제':'정지'}</button><select aria-label="역할 변경" value={u.role} onChange={e=>void run('set_role',{user_id:u.id,role:e.target.value},'권한을 변경했습니다.')}><option value="user">일반 사용자</option><option value="moderator">운영자</option><option value="admin">관리자</option><option value="nexus_admin">NEXUS ADMIN</option></select></>}</div></article>)}</div>
      <div className="admin-compose"><h3>전체 공지 등록</h3><input value={announcement.title} onChange={e=>setAnnouncement(v=>({...v,title:e.target.value}))} placeholder="공지 제목"/><textarea value={announcement.body} onChange={e=>setAnnouncement(v=>({...v,body:e.target.value}))} placeholder="공지 내용"/><button className="primary-action" disabled={busy||!announcement.title.trim()||!announcement.body.trim()} onClick={async()=>{try{await call('announcement',announcement);setAnnouncement({title:'',body:''});notify('공지를 등록했습니다.');}catch(e:any){notify(e.message)}}}>공지 등록</button></div>
      <div className="admin-compose"><h3>특정 사용자에게 알림</h3><input value={target.user_id} onChange={e=>setTarget(v=>({...v,user_id:e.target.value}))} placeholder="사용자 ID (상세 정보에서 복사)"/><input value={target.title} onChange={e=>setTarget(v=>({...v,title:e.target.value}))} placeholder="알림 제목"/><textarea value={target.body} onChange={e=>setTarget(v=>({...v,body:e.target.value}))} placeholder="알림 내용"/><button className="primary-action" onClick={async()=>{try{await call('target_notification',target);setTarget({user_id:'',title:'',body:''});notify('사용자 알림을 보냈습니다.')}catch(e:any){notify(e.message)}}}>알림 보내기</button></div>
    </>}
    {tab==='workspaces'&&<div className="admin-table-list">{rows.map(r=><article key={r.id}><strong>{r.name}</strong><small>ID: {r.id} · 소유자: {r.owner_id}</small><time>{new Date(r.created_at).toLocaleString('ko-KR')}</time></article>)}{!rows.length&&<p className="empty-state">워크스페이스가 없습니다.</p>}</div>}
    {tab==='content'&&<div className="admin-content-groups">{rows.map(group=><div className="admin-table-list" key={group.kind}><h3>{group.kind} ({group.items.length})</h3>{group.items.slice(0,30).map((r:any)=><article key={r.id}><strong>{r.name||r.file_name||r.email||'항목'}</strong><small>{r.id} · {r.status||r.workspace_id||''}</small></article>)}</div>)}</div>}
    {tab==='logs'&&<div className="admin-table-list">{logs.map(r=><article key={r.id}><strong>{r.action}</strong><small>대상: {r.target_id||'—'} · 작업자: {r.actor_id}</small><time>{new Date(r.created_at).toLocaleString('ko-KR')}</time></article>)}{!logs.length&&<p className="empty-state">관리 기록이 없습니다.</p>}</div>}
    {selected&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><div className="small-modal admin-detail"><div className="modal-title"><h2>사용자 상세 정보</h2><button className="icon-button" onClick={()=>setSelected(null)}><XCircle/></button></div><p><b>{selected.profile?.display_name||selected.email}</b></p><p>{selected.email}</p><small>UID: {selected.id}</small><p>가입: {new Date(selected.created_at).toLocaleString('ko-KR')}</p><p>워크스페이스 참여: {selected.memberships?.length||0}개</p><button className="secondary-action" onClick={()=>{navigator.clipboard?.writeText(selected.id);notify('사용자 ID를 복사했습니다.')}}>사용자 ID 복사</button></div></div>}
  </section>;
}
