import { useState } from 'react';
import { Activity, Bot, CalendarDays, ChevronDown, CircleHelp, Command, Compass, FileText, Hash, Headphones, LayoutGrid, MessageCircle, Mic, MoreHorizontal, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Users, Video, X } from 'lucide-react';

type Section = 'messages' | 'community' | 'meetings' | 'files';
const channels = ['general', 'announcements', 'development', 'random'];
const initialMessages = [
  { id: 1, name: 'Mina', initials: 'M', color: 'violet', time: '오전 10:42', text: 'NEXUS 첫 화면 구조 확인했어요. 채팅과 AI 작업 공간을 한곳에서 쓰는 방향 좋네요.' },
  { id: 2, name: 'Jun', initials: 'J', color: 'blue', time: '오전 10:45', text: '다음은 실제 로그인과 메시지 저장을 연결하면 되겠습니다.' },
  { id: 3, name: 'NEXUS AI', initials: 'N', color: 'green', time: '오전 10:46', text: '현재 화면은 프론트엔드 프로토타입입니다. 계정·실시간 동기화·AI API는 아직 연결되지 않았습니다.' },
];

export default function App() {
  const [section, setSection] = useState<Section>('messages');
  const [activeChannel, setActiveChannel] = useState('general');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiAnswer, setAiAnswer] = useState('안녕하세요. NEXUS AI 작업 공간입니다. 현재는 인터페이스 미리보기이며, AI 모델 연결은 다음 개발 단계에서 진행합니다.');
  const [mobilePanel, setMobilePanel] = useState<'none'|'nav'|'ai'>('none');

  const sendMessage = () => {
    const text = message.trim();
    if (!text) return;
    setMessages(prev => [...prev, { id: Date.now(), name: '나', initials: '나', color: 'orange', time: '방금', text }]);
    setMessage('');
  };
  const askAi = () => {
    const text = aiPrompt.trim();
    if (!text) return;
    setAiAnswer('요청을 받았습니다: “' + text + '”\n\n현재는 화면 동작 확인용 데모입니다. 실제 답변 생성과 외부 서비스 작업은 AI API 및 권한 연동 후 활성화됩니다.');
    setAiPrompt('');
  };

  return <div className="app-shell">
    <aside className={`nav-rail ${mobilePanel === 'nav' ? 'mobile-open' : ''}`}>
      <div className="brand-mark">N<span>.</span></div>
      <button className="rail-item active" aria-label="홈"><LayoutGrid size={20}/></button>
      <button className="rail-item" aria-label="메시지" onClick={() => setSection('messages')}><MessageCircle size={20}/></button>
      <button className="rail-item" aria-label="커뮤니티" onClick={() => setSection('community')}><Users size={20}/></button>
      <button className="rail-item" aria-label="회의" onClick={() => setSection('meetings')}><Video size={20}/></button>
      <button className="rail-item" aria-label="파일" onClick={() => setSection('files')}><FileText size={20}/></button>
      <div className="rail-spacer"/>
      <button className="rail-item" aria-label="도움말"><CircleHelp size={20}/></button>
      <button className="rail-item" aria-label="설정"><Settings size={20}/></button>
      <div className="profile-mini">Y</div>
    </aside>

    <aside className={`sidebar ${mobilePanel === 'nav' ? 'mobile-open' : ''}`}>
      <div className="workspace-switch"><div className="workspace-icon">N</div><div><strong>NEXUS Workspace</strong><small>개인 워크스페이스</small></div><ChevronDown size={16}/></div>
      <div className="sidebar-search"><Search size={15}/><span>빠른 검색</span><kbd>⌘ K</kbd></div>
      <div className="side-label">WORKSPACE <button aria-label="워크스페이스 추가"><Plus size={15}/></button></div>
      <button className={`side-link ${section === 'messages' ? 'selected' : ''}`} onClick={() => setSection('messages')}><MessageCircle size={17}/>메시지 <span className="count">3</span></button>
      <button className={`side-link ${section === 'community' ? 'selected' : ''}`} onClick={() => setSection('community')}><Compass size={17}/>커뮤니티</button>
      <button className={`side-link ${section === 'meetings' ? 'selected' : ''}`} onClick={() => setSection('meetings')}><Video size={17}/>회의 및 통화</button>
      <button className={`side-link ${section === 'files' ? 'selected' : ''}`} onClick={() => setSection('files')}><FileText size={17}/>파일 및 문서</button>
      <div className="side-label channels-label">채널 <button aria-label="채널 추가"><Plus size={15}/></button></div>
      {channels.map(ch => <button key={ch} className={`channel-link ${activeChannel === ch ? 'channel-active' : ''}`} onClick={() => {setActiveChannel(ch);setSection('messages')}}><Hash size={15}/>{ch}</button>)}
      <div className="side-bottom"><div className="online-dot"/><span>워크스페이스 상태</span><span className="online-text">온라인</span></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobilePanel(mobilePanel === 'nav' ? 'none' : 'nav')} aria-label="메뉴"><Command size={19}/></button>
        <div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>{section === 'messages' ? '#' + activeChannel : section === 'community' ? '커뮤니티' : section === 'meetings' ? '회의 및 통화' : '파일 및 문서'}</strong></div>
        <div className="top-actions"><div className="global-search"><Search size={16}/><span>무엇이든 검색하세요</span><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="활동"><Activity size={18}/></button><button className="icon-button" aria-label="더 보기"><MoreHorizontal size={19}/></button></div>
      </header>

      {section === 'messages' ? <div className="content-grid">
        <section className="chat-panel">
          <div className="panel-heading"><div><div className="eyebrow">CHANNEL</div><h1><Hash size={22}/>{activeChannel}</h1><p>팀의 대화와 아이디어를 나누는 공간입니다.</p></div><div className="heading-actions"><button className="icon-button"><Users size={17}/></button><button className="icon-button"><Search size={17}/></button><button className="icon-button"><MoreHorizontal size={18}/></button></div></div>
          <div className="topic-banner"><Sparkles size={16}/><span><b>NEXUS 프로젝트</b> — 하나의 공간에서 대화, AI, 협업을 연결합니다.</span></div>
          <div className="message-list">
            <div className="date-divider"><span>오늘 · 2026년 11월 9일</span></div>
            {messages.map(m => <article className="message-row" key={m.id}><div className={`avatar ${m.color}`}>{m.initials}</div><div className="message-body"><div className="message-meta"><strong>{m.name}</strong><time>{m.time}</time>{m.name === 'NEXUS AI' && <span className="ai-tag">AI</span>}</div><p>{m.text}</p></div></article>)}
          </div>
          <div className="composer-wrap"><div className="composer"><button className="attach-button" aria-label="첨부"><Plus size={19}/></button><input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => {if(e.key === 'Enter') sendMessage()}} placeholder={`# ${activeChannel}에 메시지 보내기`} aria-label="메시지 입력"/><button className="composer-tool" aria-label="음성 메시지"><Mic size={18}/></button><button className="send-button" onClick={sendMessage} aria-label="전송"><Send size={17}/></button></div><div className="composer-hint">Enter로 전송 · 실제 서버 연결 전 로컬 미리보기</div></div>
        </section>
        <aside className={`ai-panel ${mobilePanel === 'ai' ? 'mobile-ai-open' : ''}`}>
          <div className="ai-header"><div className="ai-symbol"><Sparkles size={17}/></div><div><strong>NEXUS AI</strong><small>통합 AI 어시스턴트</small></div><button className="icon-button mobile-close" onClick={() => setMobilePanel('none')} aria-label="닫기"><X size={17}/></button><span className="beta-pill">PREVIEW</span></div>
          <div className="ai-content"><div className="ai-greeting"><div className="ai-orb"><Bot size={25}/></div><h2>무엇을 도와드릴까요?</h2><p>대화, 일정, 문서와 연결되는<br/>하나의 AI 작업 공간을 준비하고 있습니다.</p></div><div className="suggestion-title">이렇게 시작해 보세요</div><button className="suggestion" onClick={() => setAiPrompt('오늘 대화 내용을 요약해 줘')}><MessageCircle size={16}/><span>오늘 대화 요약하기</span><span>↗</span></button><button className="suggestion" onClick={() => setAiPrompt('팀 회의 안건을 작성해 줘')}><CalendarDays size={16}/><span>회의 안건 작성하기</span><span>↗</span></button><button className="suggestion" onClick={() => setAiPrompt('NEXUS 개발 작업을 정리해 줘')}><ShieldCheck size={16}/><span>프로젝트 작업 정리하기</span><span>↗</span></button><div className="ai-response">{aiAnswer}</div></div>
          <div className="ai-input-wrap"><textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="NEXUS AI에게 요청하기..." rows={2}/><button onClick={askAi} aria-label="AI 요청 전송"><Send size={16}/></button><small>AI 연결 전 데모 · 민감한 정보는 입력하지 마세요</small></div>
        </aside>
      </div> : <section className="placeholder-page"><div className="placeholder-icon">{section === 'community' ? <Users/> : section === 'meetings' ? <Headphones/> : <FileText/>}</div><div className="eyebrow">NEXUS WORKSPACE</div><h1>{section === 'community' ? '커뮤니티' : section === 'meetings' ? '회의 및 통화' : '파일 및 문서'}</h1><p>이 영역은 다음 개발 단계에서 실제 기능으로 구현합니다.</p><div className="coming-card"><Sparkles size={18}/><span>기능 설계 단계 · 아직 연결된 서비스가 없습니다.</span></div></section>}
      <footer className="status-footer"><span><i/>NEXUS 프로토타입</span><span>V0.1 · UI FOUNDATION</span><button onClick={() => setMobilePanel('ai')}><Sparkles size={14}/> AI 패널 열기</button></footer>
    </main>
  </div>;
}
