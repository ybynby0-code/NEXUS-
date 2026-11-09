import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bell, Bot, CalendarDays, Check, ChevronDown, CircleHelp, Command, Compass, FileText, Hash, Headphones, LayoutGrid, MessageCircle, Mic, MoreHorizontal, Paperclip, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Users, Video, X, Upload, UserPlus, FolderOpen } from 'lucide-react';

type Section = 'messages' | 'community' | 'meetings' | 'files';
type ChatMessage = { id:number; name:string; initials:string; color:string; time:string; text:string };
const initialChannels = ['general', 'announcements', 'development', 'random'];
const initialMessages: ChatMessage[] = [
  { id:1, name:'Mina', initials:'M', color:'violet', time:'오전 10:42', text:'NEXUS 첫 화면 구조 확인했어요. 채팅과 AI 작업 공간을 한곳에서 쓰는 방향 좋네요.' },
  { id:2, name:'Jun', initials:'J', color:'blue', time:'오전 10:45', text:'다음은 실제 로그인과 메시지 저장을 연결하면 되겠습니다.' },
  { id:3, name:'NEXUS AI', initials:'N', color:'green', time:'오전 10:46', text:'현재 화면은 프론트엔드 프로토타입입니다. 계정·실시간 동기화·AI API는 아직 연결되지 않았습니다.' },
];

export default function App() {
  const [section,setSection] = useState<Section>('messages');
  const [activeChannel,setActiveChannel] = useState('general');
  const [channels,setChannels] = useState(initialChannels);
  const [message,setMessage] = useState('');
  const [messages,setMessages] = useState<ChatMessage[]>(initialMessages);
  const [aiPrompt,setAiPrompt] = useState('');
  const [aiAnswer,setAiAnswer] = useState('안녕하세요. NEXUS AI 작업 공간입니다. 현재는 인터페이스 미리보기이며, AI 모델 연결은 다음 개발 단계에서 진행합니다.');
  const [mobilePanel,setMobilePanel] = useState<'none'|'nav'|'ai'>('none');
  const [searchOpen,setSearchOpen] = useState(false);
  const [searchQuery,setSearchQuery] = useState('');
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [notificationsOpen,setNotificationsOpen] = useState(false);
  const [channelDialog,setChannelDialog] = useState(false);
  const [channelDraft,setChannelDraft] = useState('');
  const [members,setMembers] = useState(['Mina','Jun','Alex','Sora','You']);
  const [inviteDraft,setInviteDraft] = useState('');
  const [meetingCreated,setMeetingCreated] = useState(false);
  const [files,setFiles] = useState<string[]>([]);
  const [toast,setToast] = useState('');
  const fileInput=useRef<HTMLInputElement>(null);

  const notify=(text:string)=>{setToast(text);window.setTimeout(()=>setToast(''),2600)};
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(v=>!v)}
      if(e.key==='Escape'){setSearchOpen(false);setSettingsOpen(false);setNotificationsOpen(false);setChannelDialog(false);setMobilePanel('none')}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);
  const filteredMessages=useMemo(()=>messages.filter(m=>!searchQuery.trim()||m.text.toLowerCase().includes(searchQuery.toLowerCase())||m.name.toLowerCase().includes(searchQuery.toLowerCase())),[messages,searchQuery]);

  const sendMessage=()=>{
    const text=message.trim();if(!text)return;
    setMessages(prev=>[...prev,{id:Date.now(),name:'나',initials:'나',color:'orange',time:'방금',text}]);setMessage('');
  };
  const askAi=()=>{
    const text=aiPrompt.trim();if(!text)return;
    setAiAnswer('요청을 받았습니다: “'+text+'”\n\n현재는 화면 동작 확인용 데모입니다. 실제 답변 생성과 외부 서비스 작업은 AI API 및 권한 연동 후 활성화됩니다.');
    setAiPrompt('');
  };
  const addChannel=()=>{
    const name=channelDraft.trim().toLowerCase().replace(/[^a-z0-9가-힣_-]/g,'-');
    if(!name){notify('채널 이름을 입력해 주세요.');return}
    if(channels.includes(name)){notify('이미 존재하는 채널입니다.');return}
    setChannels(v=>[...v,name]);setActiveChannel(name);setSection('messages');setChannelDraft('');setChannelDialog(false);notify('#'+name+' 채널을 추가했습니다.');
  };
  const addMember=()=>{
    const name=inviteDraft.trim();if(!name)return;
    if(members.includes(name)){notify('이미 멤버 목록에 있습니다.');return}
    setMembers(v=>[...v,name]);setInviteDraft('');notify(name+' 님을 데모 멤버로 추가했습니다.');
  };
  const addFiles=(list:FileList|null)=>{
    if(!list)return;const names=Array.from(list).map(f=>f.name);setFiles(v=>[...v,...names]);if(names.length)notify(names.length+'개 파일을 목록에 추가했습니다.');
  };

  return <div className="app-shell">
    <aside className={`nav-rail ${mobilePanel==='nav'?'mobile-open':''}`}>
      <div className="brand-mark">N<span>.</span></div>
      <button className={`rail-item ${section==='messages'?'active':''}`} aria-label="메시지" onClick={()=>{setSection('messages');setMobilePanel('none')}}><MessageCircle size={20}/></button>
      <button className={`rail-item ${section==='community'?'active':''}`} aria-label="커뮤니티" onClick={()=>{setSection('community');setMobilePanel('none')}}><Users size={20}/></button>
      <button className={`rail-item ${section==='meetings'?'active':''}`} aria-label="회의" onClick={()=>{setSection('meetings');setMobilePanel('none')}}><Video size={20}/></button>
      <button className={`rail-item ${section==='files'?'active':''}`} aria-label="파일" onClick={()=>{setSection('files');setMobilePanel('none')}}><FileText size={20}/></button>
      <div className="rail-spacer"/>
      <button className="rail-item" aria-label="도움말" onClick={()=>notify('도움말 센터는 준비 중입니다.')}><CircleHelp size={20}/></button>
      <button className="rail-item" aria-label="설정" onClick={()=>setSettingsOpen(true)}><Settings size={20}/></button>
      <div className="profile-mini">Y</div>
    </aside>

    <aside className={`sidebar ${mobilePanel==='nav'?'mobile-open':''}`}>
      <div className="workspace-switch"><div className="workspace-icon">N</div><div><strong>NEXUS Workspace</strong><small>개인 워크스페이스</small></div><ChevronDown size={16}/></div>
      <button className="sidebar-search" onClick={()=>setSearchOpen(true)}><Search size={15}/><span>빠른 검색</span><kbd>Ctrl K</kbd></button>
      <div className="side-label">WORKSPACE <button aria-label="워크스페이스 추가" onClick={()=>notify('워크스페이스 추가 기능은 준비 중입니다.')}><Plus size={15}/></button></div>
      <button className={`side-link ${section==='messages'?'selected':''}`} onClick={()=>setSection('messages')}><MessageCircle size={17}/>메시지 <span className="count">{messages.length}</span></button>
      <button className={`side-link ${section==='community'?'selected':''}`} onClick={()=>setSection('community')}><Compass size={17}/>커뮤니티</button>
      <button className={`side-link ${section==='meetings'?'selected':''}`} onClick={()=>setSection('meetings')}><Video size={17}/>회의 및 통화</button>
      <button className={`side-link ${section==='files'?'selected':''}`} onClick={()=>setSection('files')}><FileText size={17}/>파일 및 문서</button>
      <div className="side-label channels-label">채널 <button aria-label="채널 추가" onClick={()=>setChannelDialog(true)}><Plus size={15}/></button></div>
      {channels.map(ch=><button key={ch} className={`channel-link ${activeChannel===ch?'channel-active':''}`} onClick={()=>{setActiveChannel(ch);setSection('messages');setMobilePanel('none')}}><Hash size={15}/>{ch}</button>)}
      <div className="side-bottom"><div className="online-dot"/><span>워크스페이스 상태</span><span className="online-text">온라인</span></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={()=>setMobilePanel(mobilePanel==='nav'?'none':'nav')} aria-label="메뉴"><Command size={19}/></button>
        <div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>{section==='messages'?'#'+activeChannel:section==='community'?'커뮤니티':section==='meetings'?'회의 및 통화':'파일 및 문서'}</strong></div>
        <div className="top-actions"><button className="global-search" onClick={()=>setSearchOpen(true)}><Search size={16}/><span>무엇이든 검색하세요</span><kbd>Ctrl K</kbd></button><button className="icon-button" aria-label="알림" onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={18}/></button><button className="icon-button" aria-label="활동" onClick={()=>notify('최근 활동이 없습니다.')}><Activity size={18}/></button><button className="icon-button" aria-label="설정" onClick={()=>setSettingsOpen(true)}><Settings size={18}/></button></div>
      </header>

      {section==='messages'?<div className="content-grid">
        <section className="chat-panel">
          <div className="panel-heading"><div><div className="eyebrow">CHANNEL</div><h1><Hash size={22}/>{activeChannel}</h1><p>팀의 대화와 아이디어를 나누는 공간입니다.</p></div><div className="heading-actions"><button className="icon-button" onClick={()=>setSection('community')} aria-label="멤버"><Users size={17}/></button><button className="icon-button" onClick={()=>setSearchOpen(true)} aria-label="검색"><Search size={17}/></button><button className="icon-button" onClick={()=>notify('채널 메뉴는 준비 중입니다.')} aria-label="더 보기"><MoreHorizontal size={18}/></button></div></div>
          <div className="topic-banner"><Sparkles size={16}/><span><b>NEXUS 프로젝트</b> — 하나의 공간에서 대화, AI, 협업을 연결합니다.</span></div>
          <div className="message-list">
            <div className="date-divider"><span>오늘 · 2026년 11월 9일</span></div>
            {messages.map(m=><article className="message-row" key={m.id}><div className={`avatar ${m.color}`}>{m.initials}</div><div className="message-body"><div className="message-meta"><strong>{m.name}</strong><time>{m.time}</time>{m.name==='NEXUS AI'&&<span className="ai-tag">AI</span>}</div><p>{m.text}</p></div></article>)}
          </div>
          <div className="composer-wrap"><div className="composer"><button className="attach-button" aria-label="파일 첨부" onClick={()=>{setSection('files');notify('파일 페이지에서 업로드 버튼을 눌러 파일을 선택해 주세요.')}}><Paperclip size={18}/></button><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendMessage()}} placeholder={`# ${activeChannel}에 메시지 보내기`} aria-label="메시지 입력"/><button className="composer-tool" aria-label="음성 메시지" onClick={()=>notify('음성 메시지는 마이크 권한 및 서버 연결 후 제공됩니다.')}><Mic size={18}/></button><button className="send-button" onClick={sendMessage} aria-label="전송"><Send size={17}/></button></div><div className="composer-hint">Enter로 전송 · 현재 브라우저 내 데모</div></div>
        </section>
        <aside className={`ai-panel ${mobilePanel==='ai'?'mobile-ai-open':''}`}>
          <div className="ai-header"><div className="ai-symbol"><Sparkles size={17}/></div><div><strong>NEXUS AI</strong><small>통합 AI 어시스턴트</small></div><button className="icon-button mobile-close" onClick={()=>setMobilePanel('none')} aria-label="닫기"><X size={17}/></button><span className="beta-pill">PREVIEW</span></div>
          <div className="ai-content"><div className="ai-greeting"><div className="ai-orb"><Bot size={25}/></div><h2>무엇을 도와드릴까요?</h2><p>대화, 일정, 문서와 연결되는<br/>하나의 AI 작업 공간을 준비하고 있습니다.</p></div><div className="suggestion-title">이렇게 시작해 보세요</div><button className="suggestion" onClick={()=>setAiPrompt('오늘 대화 내용을 요약해 줘')}><MessageCircle size={16}/><span>오늘 대화 요약하기</span><span>↗</span></button><button className="suggestion" onClick={()=>setAiPrompt('팀 회의 안건을 작성해 줘')}><CalendarDays size={16}/><span>회의 안건 작성하기</span><span>↗</span></button><button className="suggestion" onClick={()=>setAiPrompt('NEXUS 개발 작업을 정리해 줘')}><ShieldCheck size={16}/><span>프로젝트 작업 정리하기</span><span>↗</span></button><div className="ai-response">{aiAnswer}</div></div>
          <div className="ai-input-wrap"><textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="NEXUS AI에게 요청하기..." rows={2}/><button onClick={askAi} aria-label="AI 요청 전송"><Send size={16}/></button><small>AI API 연결 전 데모 · 실제 답변은 아직 생성되지 않습니다.</small></div>
        </aside>
      </div>:section==='community'?<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">PEOPLE & COMMUNITY</div><h1>커뮤니티</h1><p>워크스페이스 멤버와 팀을 관리합니다.</p></div><button className="primary-action" onClick={()=>{const name=window.prompt('추가할 멤버의 표시 이름을 입력하세요.');if(name){setMembers(v=>v.includes(name)?v:[...v,name]);notify('멤버 목록에 추가했습니다.')}}}><UserPlus size={16}/> 멤버 추가</button></div>
        <div className="feature-stats"><div><strong>{members.length}</strong><span>멤버</span></div><div><strong>1</strong><span>워크스페이스</span></div><div><strong>4</strong><span>기본 채널</span></div></div>
        <div className="section-card"><div className="card-title"><Users size={18}/>멤버 목록 <span>{members.length}명</span></div>{members.map((m,i)=><div className="member-row" key={m}><div className={`avatar ${['violet','blue','green','orange'][i%4]}`}>{m.slice(0,1).toUpperCase()}</div><div><strong>{m}</strong><small>{m==='You'?'내 계정 · 소유자':'워크스페이스 멤버'}</small></div><span className="member-status"><i/>온라인</span></div>)}</div>
        <div className="invite-box"><div><strong>팀원을 초대하세요</strong><p>현재는 로컬 데모 목록에만 추가됩니다. 실제 초대 링크는 계정 기능 구현 후 제공됩니다.</p></div><div className="invite-controls"><input value={inviteDraft} onChange={e=>setInviteDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMember()} placeholder="표시 이름 입력"/><button className="primary-action" onClick={addMember}>추가</button></div></div>
      </section>:section==='meetings'?<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">VOICE & VIDEO</div><h1>회의 및 통화</h1><p>팀 회의와 음성·화상 협업 공간입니다.</p></div><button className="primary-action" onClick={()=>{setMeetingCreated(true);notify('데모 회의방을 생성했습니다.')}}><Video size={16}/> 회의 만들기</button></div>
        {meetingCreated&&<div className="meeting-active"><div className="meeting-pulse"/><div><strong>새 회의방</strong><small>대기 중 · 실제 통화 연결 전</small></div><button onClick={()=>notify('WebRTC 연결은 다음 단계에서 구현합니다.')}>참여하기</button></div>}
        <div className="meeting-grid"><div className="section-card"><div className="feature-icon"><Video/></div><h3>즉시 회의</h3><p>새 회의 공간을 만들고 팀원을 초대합니다.</p><button onClick={()=>{setMeetingCreated(true);notify('즉시 회의 데모를 생성했습니다.')}}>새 회의 시작</button></div><div className="section-card"><div className="feature-icon"><CalendarDays/></div><h3>예약된 회의</h3><p>일정 연동 기능을 준비하고 있습니다.</p><button onClick={()=>notify('일정 연동은 아직 구현되지 않았습니다.')}>일정 기능 보기</button></div><div className="section-card"><div className="feature-icon"><Headphones/></div><h3>음성 채널</h3><p>채널 기반 음성 대화 기능입니다.</p><button onClick={()=>notify('음성 채널은 WebRTC 서버 연결 후 활성화됩니다.')}>음성 채널 열기</button></div></div>
      </section>:<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">FILES & DOCUMENTS</div><h1>파일 및 문서</h1><p>이 기기에서 파일을 선택해 현재 화면의 목록에 표시합니다.</p></div><button className="primary-action" onClick={()=>fileInput.current?.click()}><Upload size={16}/> 파일 업로드</button></div>
        <input ref={fileInput} type="file" multiple hidden onChange={e=>addFiles(e.target.files)}/>
        <div className="upload-zone" onClick={()=>fileInput.current?.click()}><FolderOpen size={30}/><strong>파일을 선택하거나 여기를 누르세요</strong><span>선택한 파일은 현재 브라우저 화면에 이름만 표시됩니다. 서버 업로드는 아직 지원하지 않습니다.</span></div>
        <div className="section-card"><div className="card-title"><FileText size={18}/>최근 파일 <span>{files.length}개</span></div>{files.length===0?<div className="empty-state">아직 선택한 파일이 없습니다.</div>:files.map((name,i)=><div className="file-row" key={i}><div className="file-type"><FileText size={17}/></div><div><strong>{name}</strong><small>이 기기에서 선택됨 · 업로드 전</small></div><span className="file-local">로컬</span></div>)}</div>
      </section>}
      <footer className="status-footer"><span><i/>NEXUS 프로토타입</span><span>V0.2 · INTERACTIVE UI</span><button onClick={()=>setMobilePanel('ai')}><Sparkles size={14}/> AI 패널 열기</button></footer>
    </main>

    {searchOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false)}}><div className="search-modal"><div className="search-input-row"><Search size={19}/><input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="메시지와 멤버 검색..."/><button onClick={()=>setSearchOpen(false)}><X size={18}/></button></div><div className="search-results"><div className="search-caption">메시지 검색 결과 · {filteredMessages.length}개</div>{filteredMessages.map(m=><button className="search-result" key={m.id} onClick={()=>{setSection('messages');setSearchOpen(false);setSearchQuery('')}}><div className={`avatar ${m.color}`}>{m.initials}</div><div><strong>{m.name}</strong><p>{m.text}</p></div></button>)}{filteredMessages.length===0&&<div className="empty-state">검색 결과가 없습니다.</div>}</div><div className="search-foot">ESC 닫기 · Ctrl K 검색 열기</div></div></div>}
    {settingsOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSettingsOpen(false)}}><div className="settings-modal"><div className="modal-title"><div><div className="eyebrow">PREFERENCES</div><h2>설정</h2></div><button className="icon-button" onClick={()=>setSettingsOpen(false)}><X/></button></div><div className="setting-row"><div><strong>프로필</strong><small>표시 이름 및 계정 정보</small></div><span>Y · 데모 계정</span></div><div className="setting-row"><div><strong>알림</strong><small>새 메시지 및 활동 알림</small></div><span className="setting-badge">미리보기</span></div><div className="setting-row"><div><strong>개인정보 및 보안</strong><small>실제 계정과 보안 설정은 인증 연결 후 제공</small></div><ShieldCheck size={18}/></div><div className="settings-note">현재 설정은 화면 미리보기입니다. 계정 정보는 저장되거나 서버로 전송되지 않습니다.</div></div></div>}
    {notificationsOpen&&<div className="notification-pop"><div className="notification-title">알림<button onClick={()=>setNotificationsOpen(false)}><X size={15}/></button></div><div className="empty-state">새로운 알림이 없습니다.</div></div>}
    {channelDialog&&<div className="modal-backdrop"><div className="small-modal"><div className="modal-title"><h2>채널 만들기</h2><button className="icon-button" onClick={()=>setChannelDialog(false)}><X/></button></div><label>채널 이름</label><input value={channelDraft} onChange={e=>setChannelDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addChannel()} placeholder="예: design-team"/><p>영문, 숫자, 한글, 하이픈을 사용할 수 있습니다.</p><button className="primary-action full-action" onClick={addChannel}><Plus size={16}/> 채널 생성</button></div></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}
