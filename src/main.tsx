import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './redesign.css';

class AppErrorBoundary extends React.Component<{children: React.ReactNode},{error: string}> {
  state = { error: '' };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error: unknown) {
    console.error('[NEXUS render error]', error);
  }
  render() {
    if (this.state.error) {
      return <main style={{minHeight:'100dvh',background:'#090d18',color:'#f2f4ff',display:'grid',placeItems:'center',padding:24,fontFamily:'sans-serif'}}>
        <section style={{maxWidth:520,width:'100%',background:'#151d2e',border:'1px solid #34415b',borderRadius:18,padding:24}}>
          <div style={{fontSize:13,color:'#a99aff',fontWeight:700,letterSpacing:2}}>NEXUS ERROR</div>
          <h1 style={{fontSize:22}}>화면을 불러오지 못했습니다.</h1>
          <p style={{color:'#bac4d6',lineHeight:1.6}}>오류 내용을 확인해 수정할 수 있도록 표시했습니다.</p>
          <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',color:'#ffb6b6',fontSize:12}}>{this.state.error}</pre>
          <button onClick={()=>location.reload()} style={{padding:'12px 18px',border:0,borderRadius:9,background:'#7665e8',color:'#fff'}}>다시 불러오기</button>
        </section>
      </main>;
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => {
      console.error('[NEXUS service worker]', error);
    });
  });
}
