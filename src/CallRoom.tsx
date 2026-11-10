import { useEffect, useRef, useState } from 'react';
import { Copy, Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Props = { supabase: SupabaseClient | null; userId: string };
type Signal = { kind: 'ready'|'offer'|'answer'|'ice'|'leave'; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

export default function CallRoom({supabase,userId}:Props) {
  const [roomCode,setRoomCode]=useState('');
  const [joinCode,setJoinCode]=useState('');
  const [status,setStatus]=useState('회의방을 만들거나 초대 코드를 입력하세요.');
  const [active,setActive]=useState(false);
  const [isCaller,setIsCaller]=useState(false);
  const [muted,setMuted]=useState(false);
  const [cameraOff,setCameraOff]=useState(false);
  const [remoteReady,setRemoteReady]=useState(false);
  const [error,setError]=useState('');
  const localVideo=useRef<HTMLVideoElement>(null);
  const remoteVideo=useRef<HTMLVideoElement>(null);
  const remoteStreamRef=useRef<MediaStream|null>(null);
  const pcRef=useRef<RTCPeerConnection|null>(null);
  const channelRef=useRef<any>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const pendingIce=useRef<RTCIceCandidateInit[]>([]);
  const activeRef=useRef(false);

  useEffect(()=>{if(localVideo.current&&streamRef.current)localVideo.current.srcObject=streamRef.current;},[active]);
  useEffect(()=>{if(remoteReady&&remoteVideo.current&&remoteStreamRef.current)remoteVideo.current.srcObject=remoteStreamRef.current;},[remoteReady]);
  const sendSignal=async(payload:Signal)=>{
    if(channelRef.current)await channelRef.current.send({type:'broadcast',event:'signal',payload:{...payload,from:userId}});
  };
  const flushIce=async(pc:RTCPeerConnection)=>{
    const queued=pendingIce.current.splice(0);
    for(const candidate of queued){try{await pc.addIceCandidate(new RTCIceCandidate(candidate));}catch(e){console.warn('[NEXUS ICE]',e);}}
  };
  const connect=async(code:string,caller:boolean)=>{
    if(!supabase||activeRef.current)return;
    setError('');
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('이 브라우저에서 카메라·마이크 접근을 지원하지 않습니다. 권한과 HTTPS 연결을 확인하세요.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
      streamRef.current=stream;
      if(localVideo.current)localVideo.current.srcObject=stream;
      const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
      pcRef.current=pc;
      stream.getTracks().forEach(track=>pc.addTrack(track,stream));
      pc.ontrack=(event)=>{remoteStreamRef.current=event.streams[0];if(remoteVideo.current)remoteVideo.current.srcObject=event.streams[0];setRemoteReady(true);setStatus('상대방과 연결되었습니다.');};
      pc.onicecandidate=(event)=>{if(event.candidate)void sendSignal({kind:'ice',candidate:event.candidate.toJSON()});};
      pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')setStatus('연결 실패: TURN 서버가 필요한 네트워크일 수 있습니다.');if(pc.connectionState==='disconnected')setStatus('상대방 연결이 끊어졌습니다.');};
      const channel=supabase.channel('nexus-call-'+code,{config:{broadcast:{self:false}}});
      channelRef.current=channel;
      channel.on('broadcast',{event:'signal'},async({payload}:any)=>{
        if(payload?.from===userId)return;
        const signal=payload as Signal;
        try{
          if(signal.kind==='ready'&&caller){
            const offer=await pc.createOffer();await pc.setLocalDescription(offer);await sendSignal({kind:'offer',description:offer});
            setStatus('초대받은 사용자가 접속했습니다. 연결 중...');
          }else if(signal.kind==='offer'&&!caller&&signal.description){
            await pc.setRemoteDescription(new RTCSessionDescription(signal.description));await flushIce(pc);
            const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await sendSignal({kind:'answer',description:answer});
            setStatus('상대방에게 연결 중...');
          }else if(signal.kind==='answer'&&caller&&signal.description){
            await pc.setRemoteDescription(new RTCSessionDescription(signal.description));await flushIce(pc);setStatus('상대방 연결을 기다리는 중...');
          }else if(signal.kind==='ice'&&signal.candidate){
            if(pc.remoteDescription)await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));else pendingIce.current.push(signal.candidate);
          }else if(signal.kind==='leave'){setRemoteReady(false);setStatus('상대방이 통화를 종료했습니다.');}
        }catch(e:any){console.error('[NEXUS call signal]',e);setError(e?.message||'통화 신호 처리에 실패했습니다.');}
      });
      const joined=await new Promise<boolean>(resolve=>{
        const timer=window.setTimeout(()=>resolve(false),12000);
        channel.subscribe((state:string)=>{if(state==='SUBSCRIBED'){window.clearTimeout(timer);resolve(true);}if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){window.clearTimeout(timer);resolve(false);}});
      });
      if(!joined)throw new Error('통화 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
      activeRef.current=true;setActive(true);setIsCaller(caller);setRoomCode(code);setRemoteReady(false);
      setStatus(caller?'회의방을 만들었습니다. 초대 코드를 상대방에게 보내세요.':'회의방에 참여했습니다. 상대방이 연결을 시작할 때까지 기다리세요.');
      if(!caller)await sendSignal({kind:'ready'});
    }catch(e:any){
      setError(e?.message||'통화를 시작하지 못했습니다.');
      streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
      pcRef.current?.close();pcRef.current=null;
      if(channelRef.current){await supabase.removeChannel(channelRef.current);channelRef.current=null;}
      activeRef.current=false;setActive(false);
    }
  };
  const createRoom=()=>connect(crypto.randomUUID().replace(/-/g,'').slice(0,16).toUpperCase(),true);
  const joinRoom=()=>{const code=joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<12){setError('초대 코드를 확인해 주세요.');return;}void connect(code,false);};
  const leave=async()=>{
    await sendSignal({kind:'leave'});
    activeRef.current=false;streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
    pcRef.current?.close();pcRef.current=null;
    if(channelRef.current&&supabase){await supabase.removeChannel(channelRef.current);channelRef.current=null;}
    if(localVideo.current)localVideo.current.srcObject=null;if(remoteVideo.current)remoteVideo.current.srcObject=null;
    remoteStreamRef.current=null;setActive(false);setRemoteReady(false);setStatus('통화가 종료되었습니다.');setMuted(false);setCameraOff(false);
  };
  const toggleMic=()=>{const next=!muted;streamRef.current?.getAudioTracks().forEach(t=>t.enabled=!next);setMuted(next);};
  const toggleCamera=()=>{const next=!cameraOff;streamRef.current?.getVideoTracks().forEach(t=>t.enabled=!next);setCameraOff(next);};
  const copyCode=async()=>{try{await navigator.clipboard.writeText(roomCode);setStatus('초대 코드를 복사했습니다.');}catch{window.prompt('초대 코드를 복사하세요.',roomCode);}};
  useEffect(()=>()=>{activeRef.current=false;streamRef.current?.getTracks().forEach(t=>t.stop());pcRef.current?.close();if(channelRef.current&&supabase)void supabase.removeChannel(channelRef.current);},[supabase]);

  return <div className="call-room">
    <div className="call-room-status"><span className={active?'call-live-dot':''}/>{status}</div>
    {error&&<div className="call-error">{error}</div>}
    {!active?<div className="call-entry">
      <div className="call-entry-card"><Video size={24}/><h3>새 1:1 화상 회의</h3><p>회의방을 만든 뒤 8자리 초대 코드를 상대방에게 전달하세요.</p><button className="primary-action" onClick={createRoom} disabled={!supabase}><Phone size={15}/> 회의방 만들기</button></div>
      <div className="call-entry-card"><Phone size={24}/><h3>초대 코드로 참여</h3><p>상대방에게 받은 회의 코드를 입력하세요.</p><input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={16} placeholder="16자리 초대 코드"/><button className="secondary-action" onClick={joinRoom} disabled={!supabase}>참여하기</button></div>
    </div>:<>
      <div className="call-code"><span>초대 코드 <strong>{roomCode}</strong></span><button className="secondary-action" onClick={copyCode}><Copy size={14}/> 코드 복사</button></div>
      <div className="call-videos"><div className="call-video-card"><video ref={localVideo} autoPlay playsInline muted/><span>내 화면</span></div><div className="call-video-card remote">{remoteReady?<video ref={remoteVideo} autoPlay playsInline/>:<div className="call-waiting">상대방 연결 대기 중</div>}<span>상대방</span></div></div>
      <div className="call-controls"><button className={muted?'off':''} onClick={toggleMic}>{muted?<MicOff size={18}/>:<Mic size={18}/>}<span>{muted?'마이크 켜기':'마이크 끄기'}</span></button><button className={cameraOff?'off':''} onClick={toggleCamera}>{cameraOff?<VideoOff size={18}/>:<Video size={18}/>}<span>{cameraOff?'카메라 켜기':'카메라 끄기'}</span></button><button className="hangup" onClick={leave}><PhoneOff size={18}/><span>통화 종료</span></button></div>
    </>}
  </div>;
}
