import { useEffect, useRef, useState } from 'react';
import { Copy, Mic, MicOff, Phone, PhoneOff, Video, VideoOff, MonitorUp, MonitorX, Users } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Props = {
  supabase: SupabaseClient | null;
  userId: string;
  displayName?: string;
  initialCreateCode?: string;
  initialJoinCode?: string;
  onInitialCreateHandled?: () => void;
  onInitialJoinHandled?: () => void;
  onOutgoingReady?: () => void;
};
type Signal = {
  kind: 'offer' | 'answer' | 'ice' | 'leave';
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  from?: string;
  to?: string;
  displayName?: string;
};
type PeerEntry = {
  pc: RTCPeerConnection;
  pendingIce: RTCIceCandidateInit[];
  name: string;
};

const MAX_PARTICIPANTS = 6;

export default function CallRoom({
  supabase, userId, displayName = 'NEXUS 사용자', initialCreateCode,
  initialJoinCode, onInitialCreateHandled, onInitialJoinHandled, onOutgoingReady,
}: Props) {
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [incomingCallCode, setIncomingCallCode] = useState(initialJoinCode || '');
  const [createCodeDraft, setCreateCodeDraft] = useState('');
  const [status, setStatus] = useState('회의방을 만들거나 초대 코드를 입력하세요.');
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [remotePeers, setRemotePeers] = useState<Array<{ id: string; name: string; stream: MediaStream }>>([]);
  const [error, setError] = useState('');
  const localVideo = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const channelRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const offersStartedRef = useRef<Set<string>>(new Set());
  const namesRef = useRef<Map<string, string>>(new Map());

  const iceServers = (): RTCIceServer[] => {
    const env = (import.meta as any).env || {};
    const servers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    const urls = String(env.VITE_TURN_URLS || env.VITE_TURN_URL || '')
      .split(',').map((value: string) => value.trim()).filter(Boolean);
    if (urls.length && env.VITE_TURN_USERNAME && env.VITE_TURN_CREDENTIAL) {
      servers.push({ urls, username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL });
    }
    return servers;
  };

  const sendSignal = async (signal: Omit<Signal, 'from' | 'to' | 'displayName'>, to: string) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload: { ...signal, from: userId, to, displayName },
    });
  };

  const updateRemoteStream = (peerId: string, stream: MediaStream) => {
    const name = namesRef.current.get(peerId) || '참가자';
    setRemotePeers(current => {
      const existing = current.find(peer => peer.id === peerId);
      if (existing?.stream === stream && existing.name === name) return current;
      return [...current.filter(peer => peer.id !== peerId), { id: peerId, name, stream }];
    });
  };

  const closePeer = (peerId: string) => {
    const entry = peersRef.current.get(peerId);
    if (entry) {
      entry.pc.ontrack = null;
      entry.pc.onicecandidate = null;
      entry.pc.close();
      peersRef.current.delete(peerId);
    }
    offersStartedRef.current.delete(peerId);
    setRemotePeers(current => current.filter(peer => peer.id !== peerId));
  };

  const ensurePeer = (peerId: string, peerName?: string): PeerEntry => {
    const existing = peersRef.current.get(peerId);
    if (existing) {
      if (peerName) {
        existing.name = peerName;
        namesRef.current.set(peerId, peerName);
      }
      return existing;
    }
    const name = peerName || namesRef.current.get(peerId) || '참가자';
    namesRef.current.set(peerId, name);
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const local = streamRef.current;
    if (local) {
      local.getAudioTracks().forEach(track => pc.addTrack(track, local));
      const videoTrack = screenStreamRef.current?.getVideoTracks()[0] || local.getVideoTracks()[0];
      if (videoTrack) pc.addTrack(videoTrack, new MediaStream([videoTrack]));
    }
    const entry: PeerEntry = { pc, pendingIce: [], name };
    peersRef.current.set(peerId, entry);
    pc.ontrack = event => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      updateRemoteStream(peerId, stream);
      setStatus('참가자와 연결되었습니다.');
    };
    pc.onicecandidate = event => {
      if (event.candidate) void sendSignal({ kind: 'ice', candidate: event.candidate.toJSON() }, peerId);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') setStatus('일부 참가자 연결 실패: TURN 서버가 필요한 네트워크일 수 있습니다.');
      if (pc.connectionState === 'disconnected') setStatus('참가자 연결이 일시적으로 끊겼습니다.');
      if (pc.connectionState === 'connected') setStatus('통화 연결됨');
    };
    return entry;
  };

  const flushIce = async (entry: PeerEntry) => {
    const queued = entry.pendingIce.splice(0);
    for (const candidate of queued) {
      try { await entry.pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (cause) { console.warn('[NEXUS ICE candidate]', cause); }
    }
  };

  const createOffer = async (peerId: string) => {
    if (offersStartedRef.current.has(peerId)) return;
    offersStartedRef.current.add(peerId);
    try {
      const entry = ensurePeer(peerId);
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      await sendSignal({ kind: 'offer', description: offer }, peerId);
    } catch (cause: any) {
      offersStartedRef.current.delete(peerId);
      console.error('[NEXUS group offer]', cause);
      setError(cause?.message || '그룹 통화 연결을 시작하지 못했습니다.');
    }
  };

  const syncParticipants = () => {
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState() as Record<string, Array<any>>;
    const people = Object.values(state).flat();
    const liveIds = new Set<string>();
    for (const person of people) {
      const peerId = String(person?.user_id || '');
      if (!peerId || peerId === userId) continue;
      liveIds.add(peerId);
      namesRef.current.set(peerId, String(person?.display_name || '참가자'));
      const current = peersRef.current.get(peerId);
      if (current) current.name = String(person?.display_name || '참가자');
      if (userId.localeCompare(peerId) < 0) void createOffer(peerId);
    }
    for (const peerId of [...peersRef.current.keys()]) {
      if (!liveIds.has(peerId)) closePeer(peerId);
    }
    if (activeRef.current) setStatus('통화 중 · 참가자 ' + Math.min(people.length, MAX_PARTICIPANTS) + '/' + MAX_PARTICIPANTS);
  };

  const connect = async (code: string) => {
    if (!supabase || activeRef.current) return;
    setError('');
    setStatus('마이크와 카메라를 준비하고 있습니다...');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('이 브라우저에서 카메라·마이크 접근을 지원하지 않습니다. HTTPS 연결과 권한을 확인하세요.');
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setCameraOff(false);
      } catch (videoError) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setCameraOff(true);
          setStatus('카메라를 사용할 수 없어 음성 통화로 연결합니다.');
        } catch {
          throw videoError;
        }
      }
      streamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;

      const channel = supabase.channel('nexus-call-' + code, {
        config: { broadcast: { self: false }, presence: { key: userId } },
      });
      channelRef.current = channel;
      channel.on('broadcast', { event: 'signal' }, async ({ payload }: any) => {
        if (!payload || payload.from === userId || payload.to !== userId) return;
        const peerId = String(payload.from || '');
        if (!peerId) return;
        if (payload.kind === 'leave') {
          closePeer(peerId);
          return;
        }
        const entry = ensurePeer(peerId, String(payload.displayName || '참가자'));
        try {
          if (payload.kind === 'offer' && payload.description) {
            await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.description));
            await flushIce(entry);
            const answer = await entry.pc.createAnswer();
            await entry.pc.setLocalDescription(answer);
            await sendSignal({ kind: 'answer', description: answer }, peerId);
          } else if (payload.kind === 'answer' && payload.description) {
            await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.description));
            await flushIce(entry);
          } else if (payload.kind === 'ice' && payload.candidate) {
            if (entry.pc.remoteDescription) await entry.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            else entry.pendingIce.push(payload.candidate);
          }
        } catch (cause: any) {
          console.error('[NEXUS group signal]', cause);
          setError(cause?.message || '통화 연결 신호 처리에 실패했습니다.');
        }
      });
      channel.on('presence', { event: 'sync' }, syncParticipants);

      const joined = await new Promise<boolean>(resolve => {
        const timer = window.setTimeout(() => resolve(false), 15000);
        channel.subscribe((state: string) => {
          if (state === 'SUBSCRIBED') {
            window.clearTimeout(timer);
            resolve(true);
          }
          if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
            window.clearTimeout(timer);
            resolve(false);
          }
        });
      });
      if (!joined) throw new Error('통화 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');

      const presenceBeforeJoin = Object.values(channel.presenceState() as Record<string, any[]>).flat();
      if (presenceBeforeJoin.length >= MAX_PARTICIPANTS) {
        throw new Error('회의방은 최대 ' + MAX_PARTICIPANTS + '명까지 참여할 수 있습니다.');
      }
      const { error: trackError } = await channel.track({ user_id: userId, display_name: displayName });
      if (trackError) throw trackError;

      activeRef.current = true;
      setActive(true);
      setRoomCode(code);
      setRemotePeers([]);
      setStatus('통화방에 참여했습니다. 참가자 연결을 기다리는 중입니다.');
      onOutgoingReady?.();
      window.setTimeout(syncParticipants, 250);
    } catch (cause: any) {
      setError(cause?.message || '통화를 시작하지 못했습니다.');
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (channelRef.current && supabase) await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      for (const peerId of [...peersRef.current.keys()]) closePeer(peerId);
      activeRef.current = false;
      setActive(false);
    }
  };

  useEffect(() => {
    if (localVideo.current) {
      localVideo.current.srcObject = screenStreamRef.current || streamRef.current;
    }
  }, [active, sharingScreen]);

  useEffect(() => {
    if (initialCreateCode && !activeRef.current) {
      void connect(initialCreateCode);
      onInitialCreateHandled?.();
    }
  }, [initialCreateCode]);
  useEffect(() => {
    if (initialJoinCode) setIncomingCallCode(initialJoinCode);
  }, [initialJoinCode]);

  const acceptIncomingCall = () => {
    const code = incomingCallCode;
    setIncomingCallCode('');
    onInitialJoinHandled?.();
    if (code) void connect(code);
  };
  const createRoom = () => {
    const custom = createCodeDraft.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (custom && custom.length < 12) {
      setError('예약 코드는 12자 이상이어야 합니다.');
      return;
    }
    void connect(custom || crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase());
  };
  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 12) {
      setError('초대 코드를 확인해 주세요.');
      return;
    }
    void connect(code);
  };

  const stopScreenShare = async () => {
    const screen = screenStreamRef.current;
    if (!screen) return;
    const cameraTrack = streamRef.current?.getVideoTracks()[0] || null;
    for (const entry of peersRef.current.values()) {
      const sender = entry.pc.getSenders().find(item => item.track?.kind === 'video');
      if (sender) {
        try { await sender.replaceTrack(cameraTrack); }
        catch (cause) { console.warn('[NEXUS screen restore]', cause); }
      }
    }
    screen.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = streamRef.current;
    setSharingScreen(false);
  };

  const toggleScreenShare = async () => {
    if (!active) return;
    if (screenStreamRef.current) {
      await stopScreenShare();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('현재 브라우저는 화면 공유를 지원하지 않습니다. 데스크톱 브라우저에서 시도해 주세요.');
      return;
    }
    if (!streamRef.current?.getVideoTracks().length) {
      setError('화면 공유를 시작하려면 카메라 권한을 허용한 상태로 통화에 참여해 주세요.');
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      const track = screen.getVideoTracks()[0];
      if (!track) throw new Error('공유할 화면을 찾지 못했습니다.');
      screenStreamRef.current = screen;
      for (const entry of peersRef.current.values()) {
        const sender = entry.pc.getSenders().find(item => item.track?.kind === 'video');
        if (sender) await sender.replaceTrack(track);
      }
      if (localVideo.current) localVideo.current.srcObject = screen;
      track.onended = () => { void stopScreenShare(); };
      setSharingScreen(true);
      setError('');
    } catch (cause: any) {
      if (cause?.name !== 'NotAllowedError') setError(cause?.message || '화면 공유를 시작하지 못했습니다.');
    }
  };

  const leave = async () => {
    for (const peerId of peersRef.current.keys()) {
      await sendSignal({ kind: 'leave' }, peerId);
    }
    activeRef.current = false;
    if (channelRef.current) {
      try { await channelRef.current.untrack(); } catch {}
    }
    await stopScreenShare();
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    for (const peerId of [...peersRef.current.keys()]) closePeer(peerId);
    if (channelRef.current && supabase) await supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    setActive(false);
    setRemotePeers([]);
    setStatus('통화가 종료되었습니다.');
    setMuted(false);
    setCameraOff(false);
    setSharingScreen(false);
  };

  const toggleMic = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; });
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOff;
    streamRef.current?.getVideoTracks().forEach(track => { track.enabled = !next; });
    setCameraOff(next);
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setStatus('초대 코드를 복사했습니다.');
    } catch {
      window.prompt('초대 코드를 복사하세요.', roomCode);
    }
  };

  useEffect(() => () => {
    activeRef.current = false;
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current?.getTracks().forEach(track => track.stop());
    for (const entry of peersRef.current.values()) entry.pc.close();
    if (channelRef.current && supabase) void supabase.removeChannel(channelRef.current);
  }, [supabase]);

  return <div className="call-room">
    <div className="call-room-status"><span className={active ? 'call-live-dot' : ''}/>{status}</div>
    {error && <div className="call-error">{error}</div>}
    {!active ? <>
      {incomingCallCode && <div className="incoming-call-card">
        <div><strong>수신 통화</strong><span>초대 코드: {incomingCallCode}</span><small>상대방이 통화를 요청했습니다.</small></div>
        <button className="primary-action" onClick={acceptIncomingCall}><Phone size={15}/> 받기</button>
        <button className="secondary-action" onClick={() => { setIncomingCallCode(''); onInitialJoinHandled?.(); }}>거절</button>
      </div>}
      <div className="call-entry">
        <div className="call-entry-card"><Video size={24}/><h3>그룹 회의 만들기</h3><p>최대 6명이 참여할 수 있는 음성·화상 회의방을 만듭니다.</p><input value={createCodeDraft} onChange={e => setCreateCodeDraft(e.target.value.toUpperCase())} maxLength={16} placeholder="예약 코드 입력 (선택)"/><button className="primary-action" onClick={createRoom} disabled={!supabase}><Phone size={15}/> 회의방 만들기</button></div>
        <div className="call-entry-card"><Phone size={24}/><h3>초대 코드로 참여</h3><p>상대방에게 받은 회의 코드를 입력하세요.</p><input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={16} placeholder="16자리 초대 코드"/><button className="secondary-action" onClick={joinRoom} disabled={!supabase}>참여하기</button></div>
      </div>
    </> : <>
      <div className="call-code"><span>초대 코드 <strong>{roomCode}</strong> · 참가자 {remotePeers.length + 1}/{MAX_PARTICIPANTS}</span><button className="secondary-action" onClick={copyCode}><Copy size={14}/> 코드 복사</button></div>
      <div className="call-videos group-call-grid">
        <div className="call-video-card"><video ref={localVideo} autoPlay playsInline muted/><span>{sharingScreen ? '내 화면 공유 중' : '내 화면'}</span></div>
        {remotePeers.map(peer => <div className="call-video-card" key={peer.id}>
          <video autoPlay playsInline ref={element => { if (element && element.srcObject !== peer.stream) element.srcObject = peer.stream; }}/>
          <span>{peer.name}</span>
        </div>)}
        {!remotePeers.length && <div className="call-video-card call-waiting-card"><div className="call-waiting"><Users size={22}/>다른 참가자를 기다리는 중</div></div>}
      </div>
      <div className="call-controls">
        <button className={muted ? 'off' : ''} onClick={toggleMic}>{muted ? <MicOff size={18}/> : <Mic size={18}/>}<span>{muted ? '마이크 켜기' : '마이크 끄기'}</span></button>
        <button className={cameraOff ? 'off' : ''} onClick={toggleCamera}>{cameraOff ? <VideoOff size={18}/> : <Video size={18}/>}<span>{cameraOff ? '카메라 켜기' : '카메라 끄기'}</span></button>
        <button className={sharingScreen ? 'share-active' : ''} onClick={toggleScreenShare}><MonitorUp size={18}/><span>{sharingScreen ? '화면 공유 중지' : '화면 공유'}</span></button>
        <button className="hangup" onClick={leave}><PhoneOff size={18}/><span>통화 종료</span></button>
      </div>
    </>}
  </div>;
}
