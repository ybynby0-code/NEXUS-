import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Activity, Bell, Bot, CalendarDays, Check, ChevronDown, CircleHelp, Command, Compass, FileText, Hash, Headphones, LayoutGrid, MessageCircle, Mic, MoreHorizontal, Paperclip, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Users, Video, X, Upload, UserPlus, FolderOpen } from 'lucide-react';

type Section = 'messages' | 'dms' | 'community' | 'meetings' | 'files';
type ChatMessage = { id:string; name:string; initials:string; color:string; time:string; text:string; author_id?:string };
const initialChannels = ['general', 'announcements', 'development', 'random'];
const initialMessages: ChatMessage[] = [];

function WorkspaceApp() {
  const [section,setSection] = useState<Section>('messages');
  const [activeChannel,setActiveChannel] = useState('general');
  const [channels,setChannels] = useState(initialChannels);
  const [message,setMessage] = useState('');
  const [messages,setMessages] = useState<ChatMessage[]>(initialMessages);
  const [currentUser,setCurrentUser] = useState<{id:string;name:string}|null>(null);
  const [workspaceId,setWorkspaceId] = useState<string|null>(null);
  const [channelIds,setChannelIds] = useState<Record<string,string>>({});
  const [dbReady,setDbReady] = useState(false);
  const [serverApiReady,setServerApiReady] = useState(false);
  const [friendSearch,setFriendSearch] = useState('');
  const [friendResults,setFriendResults] = useState<any[]>([]);
  const [friendRequests,setFriendRequests] = useState<any[]>([]);
  const [friends,setFriends] = useState<any[]>([]);
  const [friendBusy,setFriendBusy] = useState(false);
  const [dmConversations,setDmConversations] = useState<any[]>([]);
  const [activeDm,setActiveDm] = useState<any>(null);
  const [dmMessages,setDmMessages] = useState<any[]>([]);
  const [dmDraft,setDmDraft] = useState('');
  const [notifications,setNotifications] = useState<any[]>([]);
  const [profile,setProfile] = useState({display_name:'',bio:'',avatar_url:'',theme_color:'#7867e8'});
  const [profileBusy,setProfileBusy] = useState(false);
  const [logoutBusy,setLogoutBusy] = useState(false);
  const avatarInput=useRef<HTMLInputElement>(null);
  const [aiPrompt,setAiPrompt] = useState('');
  const [aiAnswer,setAiAnswer] = useState('안녕하세요. NEXUS AI 작업 공간입니다. 현재는 인터페이스 미리보기이며, AI 모델 연결은 다음 개발 단계에서 진행합니다.');
  const [mobilePanel,setMobilePanel] = useState<'none'|'nav'|'ai'>('none');
  const [searchOpen,setSearchOpen] = useState(false);
  const [searchQuery,setSearchQuery] = useState('');
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [notificationsOpen,setNotificationsOpen] = useState(false);
  const [channelDialog,setChannelDialog] = useState(false);
  const [channelDraft,setChannelDraft] = useState('');
  const [members,setMembers] = useState<any[]>([]);
  const [inviteDraft,setInviteDraft] = useState('');
  const [workspaceInvites,setWorkspaceInvites] = useState<any[]>([]);
  const [inviteBusy,setInviteBusy] = useState(false);
  const [meetingCreated,setMeetingCreated] = useState(false);
  const [files,setFiles] = useState<any[]>([]);
  const [filesBusy,setFilesBusy] = useState(false);
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
  useEffect(()=>{
    let alive=true;
    const boot=async()=>{
      if(!supabase)return;
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError||!user)throw userError||new Error('로그인 정보가 없습니다.');
      try {
        const {data:apiHealth,error:apiError}=await supabase.functions.invoke('nexus-api');
        if(apiError)throw apiError;
        if(alive)setServerApiReady(apiHealth?.ok===true);
      } catch(apiError) {
        console.warn('[NEXUS API health check]',apiError);
        if(alive)setServerApiReady(false);
      }
      const displayName=String(user.user_metadata?.display_name||user.email?.split('@')[0]||'NEXUS 사용자');
      if(alive)setCurrentUser({id:user.id,name:displayName});
      const {error:profileError}=await supabase.from('profiles').upsert({id:user.id,display_name:displayName},{onConflict:'id'});
      const {data:profileRow}=await supabase.from('profiles').select('display_name,bio,avatar_url,theme_color').eq('id',user.id).maybeSingle();
      if(profileRow&&alive)setProfile({display_name:profileRow.display_name||displayName,bio:profileRow.bio||'',avatar_url:profileRow.avatar_url||'',theme_color:profileRow.theme_color||'#7867e8'});
      if(profileError)throw profileError;
      const {data:membership,error:memberError}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).limit(1).maybeSingle();
      if(memberError)throw memberError;
      let wid=membership?.workspace_id as string|undefined;
      if(!wid){
        const {data:workspace,error:workspaceError}=await supabase.from('workspaces').insert({name:'NEXUS Workspace',owner_id:user.id}).select('id').single();
        if(workspaceError)throw workspaceError;
        wid=workspace.id;
        const {error:insertMemberError}=await supabase.from('workspace_members').insert({workspace_id:wid,user_id:user.id,role:'owner'});
        if(insertMemberError)throw insertMemberError;
        const defaults=['general','announcements','development','random'].map(name=>({workspace_id:wid!,name,created_by:user.id}));
        const {error:channelsError}=await supabase.from('channels').insert(defaults);
        if(channelsError)throw channelsError;
      }
      if(!alive)return;
      setWorkspaceId(wid!);
      const {data:rows,error:rowsError}=await supabase.from('channels').select('id,name').eq('workspace_id',wid!).order('created_at');
      if(rowsError)throw rowsError;
      const map:Record<string,string>={};(rows||[]).forEach((c:any)=>map[c.name]=c.id);
      setChannelIds(map);setChannels((rows||[]).map((c:any)=>c.name));
      if(rows?.[0])setActiveChannel(rows[0].name);
      setDbReady(true);
    };
    boot().catch(e=>{console.error(e);if(alive)notify('서버 초기화 실패: '+(e?.message||'오류'));});
    return()=>{alive=false};
  },[]);
  useEffect(()=>{
    if(!supabase||!dbReady||!channelIds[activeChannel])return;
    let alive=true;const channelId=channelIds[activeChannel];
    const load=async()=>{
      const {data,error}=await supabase.from('messages').select('id,content,created_at,author_id').eq('channel_id',channelId).order('created_at').limit(100);
      if(error)throw error;
      const ids=[...new Set((data||[]).map((m:any)=>m.author_id))];const {data:profiles}=ids.length?await supabase.from('profiles').select('id,display_name').in('id',ids):{data:[]};const names:Record<string,string>={};(profiles||[]).forEach((p:any)=>names[p.id]=p.display_name);if(alive)setMessages((data||[]).map((m:any)=>({id:m.id,name:m.author_id===currentUser?.id?'나':names[m.author_id]||'사용자',initials:(m.author_id===currentUser?.id?'나':names[m.author_id]||'U').slice(0,1),color:m.author_id===currentUser?.id?'orange':'blue',time:new Date(m.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),text:m.content,author_id:m.author_id})));
    };
    load().catch(e=>notify('메시지 조회 실패: '+e.message));
    const sub=supabase.channel('nexus-'+channelId).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'channel_id=eq.'+channelId},async(payload:any)=>{
      const m=payload.new;const {data:p}=await supabase.from('profiles').select('display_name').eq('id',m.author_id).maybeSingle();
      if(alive)setMessages(prev=>prev.some(x=>x.id===m.id)?prev:[...prev,{id:m.id,name:m.author_id===currentUser?.id?'나':p?.display_name||'사용자',initials:(p?.display_name||'U').slice(0,1),color:m.author_id===currentUser?.id?'orange':'blue',time:new Date(m.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),text:m.content,author_id:m.author_id}]);
    }).subscribe();
    return()=>{alive=false;supabase.removeChannel(sub)};
  },[dbReady,activeChannel,channelIds,currentUser?.id]);

  const loadDmConversations=async()=>{
    if(!supabase||!currentUser)return;
    const {data,error}=await supabase.from('dm_conversations').select('id,member_one,member_two,created_at').or('member_one.eq.'+currentUser.id+',member_two.eq.'+currentUser.id).order('created_at',{ascending:false});
    if(error){notify('DM 목록 조회 실패: '+error.message);return;}
    const rows=data||[];const ids=[...new Set(rows.map((c:any)=>c.member_one===currentUser.id?c.member_two:c.member_one))];
    const {data:people}=ids.length?await supabase.from('profiles').select('id,display_name,avatar_url,bio').in('id',ids):{data:[]};
    const byId:Record<string,any>={};(people||[]).forEach((p:any)=>byId[p.id]=p);
    setDmConversations(rows.map((c:any)=>({...c,person:byId[c.member_one===currentUser.id?c.member_two:c.member_one]})));
  };
  const openDm=async(person:any)=>{
    if(!supabase||!currentUser)return;
    const pair=[currentUser.id,person.id].sort();
    let {data,error}=await supabase.from('dm_conversations').select('*').eq('member_one',pair[0]).eq('member_two',pair[1]).maybeSingle();
    if(error){notify('DM 열기 실패: '+error.message);return;}
    if(!data){const result=await supabase.from('dm_conversations').insert({member_one:pair[0],member_two:pair[1]}).select('*').single();if(result.error){notify('친구 수락 후 DM을 시작할 수 있습니다. '+result.error.message);return;}data=result.data;}
    setActiveDm({...data,person});setSection('dms');setMobilePanel('none');loadDmConversations();
  };
  const sendDm=async()=>{
    const content=dmDraft.trim();if(!content||!supabase||!currentUser||!activeDm)return;
    setDmDraft('');
    const {error}=await supabase.from('dm_messages').insert({conversation_id:activeDm.id,sender_id:currentUser.id,content});
    if(error){setDmDraft(content);notify('DM 전송 실패: '+error.message);}
  };
  const loadNotifications=async()=>{
    if(!supabase||!currentUser)return;
    const {data,error}=await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(30);
    if(error){console.error(error);return;}setNotifications(data||[]);
  };
  const markNotificationRead=async(id:string)=>{
    if(!supabase)return;const at=new Date().toISOString();
    await supabase.from('notifications').update({read_at:at}).eq('id',id);
    setNotifications(v=>v.map(n=>n.id===id?{...n,read_at:at}:n));
  };
  const signOut=async()=>{
    if(!supabase||logoutBusy)return;
    setLogoutBusy(true);
    const {error}=await supabase.auth.signOut();
    setLogoutBusy(false);
    if(error){notify('로그아웃 실패: '+error.message);return;}
    setSettingsOpen(false);
    notify('로그아웃했습니다.');
  };
  const saveProfile=async()=>{
    if(!supabase||!currentUser)return;setProfileBusy(true);
    const {error}=await supabase.from('profiles').upsert({id:currentUser.id,display_name:profile.display_name.trim()||currentUser.name,bio:profile.bio.slice(0,160),avatar_url:profile.avatar_url,theme_color:profile.theme_color},{onConflict:'id'});
    setProfileBusy(false);if(error)notify('프로필 저장 실패: '+error.message);else{notify('프로필을 저장했습니다.');setSettingsOpen(false);}
  };
  const uploadAvatar=async(file?:File)=>{
    if(!file||!supabase||!currentUser)return;
    if(!file.type.startsWith('image/')||file.size>5*1024*1024){notify('이미지 파일(5MB 이하)을 선택해 주세요.');return;}
    const path=currentUser.id+'/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const {error}=await supabase.storage.from('nexus-avatars').upload(path,file,{upsert:true,contentType:file.type});
    if(error){notify('사진 업로드 실패: '+error.message);return;}
    const {data}=supabase.storage.from('nexus-avatars').getPublicUrl(path);
    setProfile(v=>({...v,avatar_url:data.publicUrl}));notify('사진을 선택했습니다. 프로필 저장을 눌러 반영하세요.');
  };
  useEffect(()=>{
    if(!supabase||!currentUser)return;
    loadDmConversations();loadNotifications();
    const sub=supabase.channel('nexus-notifications-'+currentUser.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'recipient_id=eq.'+currentUser.id},(payload:any)=>{
      const n=payload.new;setNotifications(v=>[n,...v]);
      if('Notification' in window&&Notification.permission==='granted')new Notification(n.title,{body:n.body,tag:n.id});else notify(n.title+': '+n.body);
    }).subscribe();
    return()=>{supabase?.removeChannel(sub);};
  },[currentUser?.id]);
  useEffect(()=>{
    if(!supabase||!activeDm)return;let alive=true;
    const markIncomingRead=async(rows:any[])=>{
      const unread=rows.filter(m=>m.sender_id!==currentUser?.id&&!m.read_at).map(m=>m.id);
      if(!unread.length)return;
      const at=new Date().toISOString();
      const {error}=await supabase.from('dm_messages').update({read_at:at}).in('id',unread);
      if(error){console.warn('[NEXUS DM read receipt]',error);return;}
      if(alive)setDmMessages(v=>v.map(m=>unread.includes(m.id)?{...m,read_at:at}:m));
    };
    const load=async()=>{
      const {data,error}=await supabase.from('dm_messages').select('id,sender_id,content,created_at,read_at').eq('conversation_id',activeDm.id).order('created_at').limit(100);
      if(error)throw error;
      if(alive)setDmMessages(data||[]);
      await markIncomingRead(data||[]);
    };
    load().catch(e=>notify('DM 불러오기 실패: '+e.message));
    const sub=supabase.channel('nexus-dm-'+activeDm.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'dm_messages',filter:'conversation_id=eq.'+activeDm.id},async(payload:any)=>{
        if(alive)setDmMessages(v=>v.some(x=>x.id===payload.new.id)?v:[...v,payload.new]);
        if(payload.new.sender_id!==currentUser?.id)await markIncomingRead([payload.new]);
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'dm_messages',filter:'conversation_id=eq.'+activeDm.id},(payload:any)=>{
        if(alive)setDmMessages(v=>v.map(m=>m.id===payload.new.id?{...m,...payload.new}:m));
      }).subscribe();
    return()=>{alive=false;supabase?.removeChannel(sub);};
  },[activeDm?.id,currentUser?.id]);

  const searchPeople=async()=>{
    const q=friendSearch.trim();if(!q||!supabase||!currentUser)return;
    setFriendBusy(true);
    const {data,error}=await supabase.from('profiles').select('id,display_name,bio').ilike('display_name','%'+q+'%').neq('id',currentUser.id).limit(20);
    if(error)notify('사용자 검색 실패: '+error.message);else setFriendResults(data||[]);
    setFriendBusy(false);
  };
  const loadFriendData=async()=>{
    if(!supabase||!currentUser)return;
    const {data,error}=await supabase.from('friend_requests').select('id,sender_id,recipient_id,status,created_at').or('sender_id.eq.'+currentUser.id+',recipient_id.eq.'+currentUser.id).order('created_at',{ascending:false});
    if(error){notify('친구 목록 조회 실패: '+error.message);return;}
    const rows=data||[];const ids=[...new Set(rows.map((r:any)=>r.sender_id===currentUser.id?r.recipient_id:r.sender_id))];
    const {data:profiles}=ids.length?await supabase.from('profiles').select('id,display_name,bio').in('id',ids):{data:[]};
    const byId:Record<string,any>={};(profiles||[]).forEach((p:any)=>byId[p.id]=p);
    const enriched=rows.map((r:any)=>({...r,person:byId[r.sender_id===currentUser.id?r.recipient_id:r.sender_id]}));
    setFriendRequests(enriched.filter((r:any)=>r.status==='pending'&&r.recipient_id===currentUser.id));
    setFriends(enriched.filter((r:any)=>r.status==='accepted').map((r:any)=>r.person).filter(Boolean));
  };
  const sendFriendRequest=async(id:string)=>{
    if(!supabase||!currentUser)return;
    const {error}=await supabase.from('friend_requests').insert({sender_id:currentUser.id,recipient_id:id});
    if(error){notify(error.code==='23505'?'이미 요청을 보냈거나 받은 사용자입니다.':'친구 요청 실패: '+error.message);return;}
    notify('친구 요청을 보냈습니다.');setFriendResults(v=>v.filter(p=>p.id!==id));loadFriendData();
  };
  const respondFriendRequest=async(id:string,status:'accepted'|'rejected')=>{
    if(!supabase)return;
    const {error}=await supabase.from('friend_requests').update({status,updated_at:new Date().toISOString()}).eq('id',id);
    if(error){notify('요청 처리 실패: '+error.message);return;}
    notify(status==='accepted'?'친구 요청을 수락했습니다.':'친구 요청을 거절했습니다.');loadFriendData();
  };
  useEffect(()=>{if(section==='community'&&currentUser)loadFriendData()},[section,currentUser?.id]);
  const filteredMessages=useMemo(()=>messages.filter(m=>!searchQuery.trim()||m.text.toLowerCase().includes(searchQuery.toLowerCase())||m.name.toLowerCase().includes(searchQuery.toLowerCase())),[messages,searchQuery]);

  const sendMessage=async()=>{
    const content=message.trim();if(!content)return;
    const channelId=channelIds[activeChannel];
    if(!supabase||!currentUser||!channelId){notify('서버 연결이 준비되지 않았습니다.');return;}
    setMessage('');
    const {error}=await supabase.from('messages').insert({channel_id:channelId,author_id:currentUser.id,content});
    if(error){setMessage(content);notify('전송 실패: '+error.message);}
  };
  const askAi=()=>{
    const text=aiPrompt.trim();if(!text)return;
    setAiAnswer('요청을 받았습니다: “'+text+'”\n\n현재는 화면 동작 확인용 데모입니다. 실제 답변 생성과 외부 서비스 작업은 AI API 및 권한 연동 후 활성화됩니다.');
    setAiPrompt('');
  };
  const addChannel=async()=>{
    const name=channelDraft.trim().toLowerCase().replace(/[^a-z0-9가-힣_-]/g,'-');
    if(!name){notify('채널 이름을 입력해 주세요.');return}
    if(channels.includes(name)){notify('이미 존재하는 채널입니다.');return}
    if(!supabase||!workspaceId||!currentUser){notify('서버 연결이 준비되지 않았습니다.');return;}
    const {data,error}=await supabase.from('channels').insert({workspace_id:workspaceId,name,created_by:currentUser.id}).select('id,name').single();
    if(error){notify('채널 생성 실패: '+error.message);return;}
    setChannels(v=>[...v,name]);setChannelIds(v=>({...v,[name]:data.id}));setActiveChannel(name);setSection('messages');setChannelDraft('');setChannelDialog(false);notify('#'+name+' 채널을 생성했습니다.');
  };
  const loadWorkspacePeople=async()=>{
    if(!supabase||!workspaceId)return;
    const [memberResult,inviteResult]=await Promise.all([
      supabase.from('workspace_members').select('user_id,role,joined_at').eq('workspace_id',workspaceId),
      supabase.from('workspace_invites').select('id,email,status,expires_at,created_at,workspace_id').order('created_at',{ascending:false}).limit(100)
    ]);
    if(memberResult.error){notify('멤버 조회 실패: '+memberResult.error.message);return;}
    const ids=(memberResult.data||[]).map((m:any)=>m.user_id);
    const {data:profiles}=ids.length?await supabase.from('profiles').select('id,display_name,avatar_url').in('id',ids):{data:[]};
    const byId:Record<string,any>={};(profiles||[]).forEach((p:any)=>byId[p.id]=p);
    setMembers((memberResult.data||[]).map((m:any)=>({...m,person:byId[m.user_id]})));
    if(inviteResult.error){notify('초대 목록 조회 실패: '+inviteResult.error.message);return;}
    setWorkspaceInvites(inviteResult.data||[]);
  };
  useEffect(()=>{if(dbReady&&workspaceId)loadWorkspacePeople()},[dbReady,workspaceId]);
  const addMember=async()=>{
    const email=inviteDraft.trim().toLowerCase();
    if(!email||!/^\S+@\S+\.\S+$/.test(email)){notify('올바른 이메일 주소를 입력해 주세요.');return;}
    if(!supabase||!workspaceId||inviteBusy)return;
    setInviteBusy(true);
    const {data,error}=await supabase.functions.invoke('invite-workspace-member',{body:{workspace_id:workspaceId,email}});
    setInviteBusy(false);
    if(error||!data?.ok){notify('초대 실패: '+(data?.error||error?.message||'서버 오류'));return;}
    setInviteDraft('');
    notify(data.emailSent?'초대 이메일을 발송했습니다.':'초대는 저장됐지만 이메일은 발송되지 않았습니다. 기존 계정은 초대 목록에서 수락할 수 있습니다.');
    await loadWorkspacePeople();
  };
  const acceptWorkspaceInvite=async(inviteId:string)=>{
    if(!supabase)return;
    const {data,error}=await supabase.rpc('accept_workspace_invite',{p_invite_id:inviteId});
    if(error){notify('초대 수락 실패: '+error.message);return;}
    notify('워크스페이스에 참여했습니다.');
    await loadWorkspacePeople();
    if(data?.workspace_id&&!workspaceId){setWorkspaceId(data.workspace_id);}
  };
  const loadWorkspaceFiles=async()=>{
    if(!supabase||!workspaceId)return;
    const {data,error}=await supabase.from('workspace_files').select('id,file_name,mime_type,size_bytes,storage_path,uploaded_by,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100);
    if(error){notify('파일 목록 조회 실패: '+error.message);return;}
    setFiles(data||[]);
  };
  useEffect(()=>{if(dbReady&&workspaceId&&section==='files')loadWorkspaceFiles()},[dbReady,workspaceId,section]);
  const addFiles=async(list:FileList|null)=>{
    if(!list||!supabase||!workspaceId||!currentUser)return;
    const selected=Array.from(list);if(!selected.length)return;
    setFilesBusy(true);
    for(const file of selected){
      if(file.size>25*1024*1024){notify(file.name+': 25MB 제한을 초과했습니다.');continue;}
      const safeName=file.name.replace(/[^a-zA-Z0-9._가-힣-]/g,'_');
      const path=workspaceId+'/'+currentUser.id+'/'+Date.now()+'-'+safeName;
      const uploaded=await supabase.storage.from('nexus-files').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
      if(uploaded.error){notify(file.name+' 업로드 실패: '+uploaded.error.message);continue;}
      const saved=await supabase.from('workspace_files').insert({workspace_id:workspaceId,uploaded_by:currentUser.id,file_name:file.name,storage_path:path,mime_type:file.type||'application/octet-stream',size_bytes:file.size});
      if(saved.error){await supabase.storage.from('nexus-files').remove([path]);notify(file.name+' 정보 저장 실패: '+saved.error.message);}
    }
    await loadWorkspaceFiles();
    setFilesBusy(false);
    if(fileInput.current)fileInput.current.value='';
  };
  const downloadWorkspaceFile=async(file:any)=>{
    if(!supabase)return;
    const {data,error}=await supabase.storage.from('nexus-files').createSignedUrl(file.storage_path,60);
    if(error||!data?.signedUrl){notify('파일 다운로드 링크 생성 실패: '+(error?.message||'오류'));return;}
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  };
  const deleteWorkspaceFile=async(file:any)=>{
    if(!supabase||!window.confirm(file.file_name+' 파일을 삭제하시겠습니까?'))return;
    const removed=await supabase.storage.from('nexus-files').remove([file.storage_path]);
    if(removed.error){notify('파일 삭제 실패: '+removed.error.message);return;}
    const row=await supabase.from('workspace_files').delete().eq('id',file.id);
    if(row.error){notify('파일 정보 삭제 실패: '+row.error.message);return;}
    setFiles(v=>v.filter(x=>x.id!==file.id));notify('파일을 삭제했습니다.');
  };

  return <div className="app-shell">
    <aside className={`nav-rail ${mobilePanel==='nav'?'mobile-open':''}`}>
      <div className="brand-mark">NX<span>•</span></div>
      <button className={`rail-item ${section==='messages'?'active':''}`} aria-label="메시지" onClick={()=>{setSection('messages');setMobilePanel('none')}}><MessageCircle size={20}/></button>
      <button className={`rail-item ${section==='dms'?'active':''}`} aria-label="DM" onClick={()=>{setSection('dms');setMobilePanel('none')}}><MessageCircle size={20}/></button>
      <button className={`rail-item ${section==='community'?'active':''}`} aria-label="커뮤니티" onClick={()=>{setSection('community');setMobilePanel('none')}}><Users size={20}/></button>
      <button className={`rail-item ${section==='meetings'?'active':''}`} aria-label="회의" onClick={()=>{setSection('meetings');setMobilePanel('none')}}><Video size={20}/></button>
      <button className={`rail-item ${section==='files'?'active':''}`} aria-label="파일" onClick={()=>{setSection('files');setMobilePanel('none')}}><FileText size={20}/></button>
      <div className="rail-spacer"/>
      <button className="rail-item" aria-label="도움말" onClick={()=>notify('도움말 센터는 준비 중입니다.')}><CircleHelp size={20}/></button>
      <button className="rail-item" aria-label="설정" onClick={()=>setSettingsOpen(true)}><Settings size={20}/></button>
      <div className="profile-mini">{profile.avatar_url?<img src={profile.avatar_url}/>:((profile.display_name||currentUser?.name||"N").slice(0,1))}</div>
    </aside>

    <aside className={`sidebar ${mobilePanel==='nav'?'mobile-open':''}`}>
      <div className="workspace-switch"><div className="workspace-icon">N</div><div><strong>NEXUS Workspace</strong><small>개인 워크스페이스</small></div><ChevronDown size={16}/></div>
      <button className="sidebar-search" onClick={()=>setSearchOpen(true)}><Search size={15}/><span>빠른 검색</span><kbd>Ctrl K</kbd></button>
      <div className="side-label">WORKSPACE <button aria-label="워크스페이스 추가" onClick={()=>notify('워크스페이스 추가 기능은 준비 중입니다.')}><Plus size={15}/></button></div>
      <button className={`side-link ${section==='messages'?'selected':''}`} onClick={()=>setSection('messages')}><MessageCircle size={17}/>메시지 <span className="count">{messages.length}</span></button>
      <button className={`side-link ${section==='dms'?'selected':''}`} onClick={()=>setSection('dms')}><MessageCircle size={17}/>DM</button>
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
        <div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>{section==='messages'?'#'+activeChannel:section==='dms'?'DM':section==='community'?'커뮤니티':section==='meetings'?'회의 및 통화':'파일 및 문서'}</strong></div>
        <div className="top-actions"><button className="global-search" onClick={()=>setSearchOpen(true)}><Search size={16}/><span>무엇이든 검색하세요</span><kbd>Ctrl K</kbd></button><button className="icon-button" aria-label="알림" onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={18}/></button><button className="icon-button" aria-label="활동" onClick={()=>notify('최근 활동이 없습니다.')}><Activity size={18}/></button><button className="icon-button" aria-label="설정" onClick={()=>setSettingsOpen(true)}><Settings size={18}/></button></div>
      </header>

      {section==='messages'?<div className="content-grid">
        <section className="chat-panel">
          <div className="panel-heading"><div><div className="eyebrow">CHANNEL</div><h1><Hash size={22}/>{activeChannel}</h1><p>팀의 대화와 아이디어를 나누는 공간입니다.</p></div><div className="heading-actions"><button className="icon-button" onClick={()=>setSection('community')} aria-label="멤버"><Users size={17}/></button><button className="icon-button" onClick={()=>setSearchOpen(true)} aria-label="검색"><Search size={17}/></button><button className="icon-button" onClick={()=>notify('채널 메뉴는 준비 중입니다.')} aria-label="더 보기"><MoreHorizontal size={18}/></button></div></div>
          <div className="topic-banner"><Sparkles size={16}/><span><b>NEXUS 프로젝트</b> — 하나의 공간에서 대화, AI, 협업을 연결합니다.</span></div>
          <div className="message-list">
            <div className="date-divider"><span>{dbReady?"실시간 서버 연결됨":"서버 연결 중"}</span></div>
            {messages.map(m=><article className="message-row" key={m.id}><div className={`avatar ${m.color}`}>{m.initials}</div><div className="message-body"><div className="message-meta"><strong>{m.name}</strong><time>{m.time}</time>{m.name==='NEXUS AI'&&<span className="ai-tag">AI</span>}</div><p>{m.text}</p></div></article>)}
          </div>
          <div className="composer-wrap"><div className="composer"><button className="attach-button" aria-label="파일 첨부" onClick={()=>{setSection('files');notify('파일 페이지에서 업로드 버튼을 눌러 파일을 선택해 주세요.')}}><Paperclip size={18}/></button><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendMessage()}} placeholder={`# ${activeChannel}에 메시지 보내기`} aria-label="메시지 입력"/><button className="composer-tool" aria-label="음성 메시지" onClick={()=>notify('음성 메시지는 마이크 권한 및 서버 연결 후 제공됩니다.')}><Mic size={18}/></button><button className="send-button" onClick={sendMessage} aria-label="전송"><Send size={17}/></button></div><div className="composer-hint">Enter로 전송 · 현재 브라우저 내 데모</div></div>
        </section>
        <aside className={`ai-panel ${mobilePanel==='ai'?'mobile-ai-open':''}`}>
          <div className="ai-header"><div className="ai-symbol"><Sparkles size={17}/></div><div><strong>NEXUS AI</strong><small>통합 AI 어시스턴트</small></div><button className="icon-button mobile-close" onClick={()=>setMobilePanel('none')} aria-label="닫기"><X size={17}/></button><span className="beta-pill">PREVIEW</span></div>
          <div className="ai-content"><div className="ai-greeting"><div className="ai-orb"><Bot size={25}/></div><h2>무엇을 도와드릴까요?</h2><p>대화, 일정, 문서와 연결되는<br/>하나의 AI 작업 공간을 준비하고 있습니다.</p></div><div className="suggestion-title">이렇게 시작해 보세요</div><button className="suggestion" onClick={()=>setAiPrompt('오늘 대화 내용을 요약해 줘')}><MessageCircle size={16}/><span>오늘 대화 요약하기</span><span>↗</span></button><button className="suggestion" onClick={()=>setAiPrompt('팀 회의 안건을 작성해 줘')}><CalendarDays size={16}/><span>회의 안건 작성하기</span><span>↗</span></button><button className="suggestion" onClick={()=>setAiPrompt('NEXUS 개발 작업을 정리해 줘')}><ShieldCheck size={16}/><span>프로젝트 작업 정리하기</span><span>↗</span></button><div className="ai-response">{aiAnswer}</div></div>
          <div className="ai-input-wrap"><textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="NEXUS AI에게 요청하기..." rows={2}/><button onClick={askAi} aria-label="AI 요청 전송"><Send size={16}/></button><small>AI API 연결 전 데모 · 실제 답변은 아직 생성되지 않습니다.</small></div>
        </aside>
      </div>:section==='dms'?<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">PRIVATE CONVERSATIONS</div><h1>다이렉트 메시지</h1><p>친구로 등록된 실제 사용자와 대화합니다.</p></div></div>
        <div className="dm-layout">
          <aside className="section-card dm-list"><div className="card-title"><MessageCircle size={18}/>대화 목록</div>
            {dmConversations.map(c=><button className={'dm-person '+(activeDm?.id===c.id?'selected':'')} key={c.id} onClick={()=>setActiveDm(c)}><div className="avatar violet">{c.person?.avatar_url?<img src={c.person.avatar_url}/>:((c.person?.display_name||'U').slice(0,1))}</div><div><strong>{c.person?.display_name||'사용자'}</strong><small>{c.person?.bio||'친구'}</small></div></button>)}
            {!dmConversations.length&&<div className="empty-state">친구를 추가한 뒤 친구 목록에서 DM을 시작하세요.</div>}
          </aside>
          <div className="section-card dm-chat">
            {activeDm?<><div className="dm-chat-head"><div className="avatar violet">{activeDm.person?.avatar_url?<img src={activeDm.person.avatar_url}/>:((activeDm.person?.display_name||'U').slice(0,1))}</div><div><strong>{activeDm.person?.display_name||'친구'}</strong><small>비공개 대화</small></div></div>
              <div className="dm-message-list">{dmMessages.map(m=><div className={'dm-bubble-row '+(m.sender_id===currentUser?.id?'mine':'')} key={m.id}><div className="dm-bubble"><p>{m.content}</p><time>{new Date(m.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time>{m.sender_id===currentUser?.id&&<small className="dm-read-state">{m.read_at?'읽음':'전송됨'}</small>}</div></div>)}{!dmMessages.length&&<div className="empty-state">대화를 시작해 보세요.</div>}</div>
              <div className="dm-composer"><input value={dmDraft} onChange={e=>setDmDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendDm()} placeholder="메시지 입력..."/><button className="primary-action" onClick={sendDm}><Send size={16}/>전송</button></div>
            </>:<div className="empty-state dm-empty">왼쪽에서 대화를 선택하거나 커뮤니티에서 친구에게 DM을 보내세요.</div>}
          </div>
        </div>
      </section>:section==='community'?<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">PEOPLE & COMMUNITY</div><h1>친구</h1><p>사용자를 검색하고 친구 요청을 관리합니다.</p></div></div>
        <div className="section-card">
          <div className="card-title"><Users size={18}/>워크스페이스 멤버 <span>{members.length}명</span></div>
          {members.map(m=><div className="member-row" key={m.user_id}><div className="avatar violet">{(m.person?.display_name||'U').slice(0,1)}</div><div><strong>{m.person?.display_name||'사용자'}</strong><small>{m.role==='owner'?'소유자':m.role==='admin'?'관리자':'멤버'}</small></div></div>)}
        </div>
        <div className="section-card">
          <div className="card-title"><UserPlus size={18}/>이메일로 워크스페이스 초대</div>
          <div className="invite-controls"><input type="email" value={inviteDraft} onChange={e=>setInviteDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMember()} placeholder="name@example.com"/><button className="primary-action" disabled={inviteBusy||!dbReady} onClick={addMember}>{inviteBusy?'초대 중...':'초대 보내기'}</button></div>
          <p className="settings-note">워크스페이스 소유자와 관리자는 이메일로 새 사용자를 초대할 수 있습니다. 기존 계정은 동일한 이메일로 로그인한 뒤 초대를 수락할 수 있습니다.</p>
          {workspaceInvites.filter(i=>i.workspace_id===workspaceId).map(i=><div className="member-row" key={i.id}><div><strong>{i.email}</strong><small>{i.status==='pending'?'대기 중':i.status==='accepted'?'수락됨':i.status==='expired'?'만료됨':'취소됨'} · 만료 {new Date(i.expires_at).toLocaleDateString('ko-KR')}</small></div></div>)}
        </div>
        <div className="section-card">
          <div className="card-title"><UserPlus size={18}/>내게 온 워크스페이스 초대</div>
          {workspaceInvites.filter(i=>i.status==='pending'&&i.email.toLowerCase()===String(currentUser?.email||'').toLowerCase()).map(i=><div className="member-row" key={i.id}><div><strong>워크스페이스 초대</strong><small>7일 이내 수락해 주세요.</small></div><button className="primary-action" onClick={()=>acceptWorkspaceInvite(i.id)}>수락</button></div>)}
          {!workspaceInvites.some(i=>i.status==='pending'&&i.email.toLowerCase()===String(currentUser?.email||'').toLowerCase())&&<div className="empty-state">받은 초대가 없습니다.</div>}
        </div>
        <div className="section-card">
          <div className="card-title"><UserPlus size={18}/>사용자 찾기</div>
          <div className="invite-controls friend-search"><input value={friendSearch} onChange={e=>setFriendSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchPeople()} placeholder="표시 이름으로 검색"/><button className="primary-action" onClick={searchPeople} disabled={friendBusy}>{friendBusy?'검색 중':'검색'}</button></div>
          {friendResults.map(p=><div className="member-row" key={p.id}><div className="avatar violet">{p.display_name.slice(0,1)}</div><div><strong>{p.display_name}</strong><small>{p.bio||'NEXUS 사용자'}</small></div><button className="primary-action" onClick={()=>sendFriendRequest(p.id)}>친구 추가</button></div>)}
          {friendResults.length===0&&<div className="empty-state">검색어를 입력해 NEXUS 사용자를 찾아보세요.</div>}
        </div>
        <div className="section-card"><div className="card-title"><Bell size={18}/>받은 친구 요청 <span>{friendRequests.length}건</span></div>
          {friendRequests.map(r=><div className="member-row" key={r.id}><div className="avatar blue">{(r.person?.display_name||'U').slice(0,1)}</div><div><strong>{r.person?.display_name||'사용자'}</strong><small>친구 요청</small></div><button className="primary-action" onClick={()=>respondFriendRequest(r.id,'accepted')}>수락</button><button className="secondary-action" onClick={()=>respondFriendRequest(r.id,'rejected')}>거절</button></div>)}
          {friendRequests.length===0&&<div className="empty-state">새로운 친구 요청이 없습니다.</div>}
        </div>
        <div className="section-card"><div className="card-title"><Users size={18}/>내 친구 <span>{friends.length}명</span></div>
          {friends.map(p=><div className="member-row" key={p.id}><div className="avatar green">{p.avatar_url?<img src={p.avatar_url}/>:p.display_name.slice(0,1)}</div><div><strong>{p.display_name}</strong><small>{p.bio||'NEXUS 친구'}</small></div><button className="primary-action" onClick={()=>openDm(p)}>DM 보내기</button></div>)}
          {friends.length===0&&<div className="empty-state">아직 친구가 없습니다. 위에서 사용자를 검색해 보세요.</div>}
        </div>
            </section>:section==='meetings'?<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">VOICE & VIDEO</div><h1>회의 및 통화</h1><p>팀 회의와 음성·화상 협업 공간입니다.</p></div><button className="primary-action" onClick={()=>{setMeetingCreated(true);notify('데모 회의방을 생성했습니다.')}}><Video size={16}/> 회의 만들기</button></div>
        {meetingCreated&&<div className="meeting-active"><div className="meeting-pulse"/><div><strong>새 회의방</strong><small>대기 중 · 실제 통화 연결 전</small></div><button onClick={()=>notify('WebRTC 연결은 다음 단계에서 구현합니다.')}>참여하기</button></div>}
        <div className="meeting-grid"><div className="section-card"><div className="feature-icon"><Video/></div><h3>즉시 회의</h3><p>새 회의 공간을 만들고 팀원을 초대합니다.</p><button onClick={()=>{setMeetingCreated(true);notify('즉시 회의 데모를 생성했습니다.')}}>새 회의 시작</button></div><div className="section-card"><div className="feature-icon"><CalendarDays/></div><h3>예약된 회의</h3><p>일정 연동 기능을 준비하고 있습니다.</p><button onClick={()=>notify('일정 연동은 아직 구현되지 않았습니다.')}>일정 기능 보기</button></div><div className="section-card"><div className="feature-icon"><Headphones/></div><h3>음성 채널</h3><p>채널 기반 음성 대화 기능입니다.</p><button onClick={()=>notify('음성 채널은 WebRTC 서버 연결 후 활성화됩니다.')}>음성 채널 열기</button></div></div>
      </section>:<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">FILES & DOCUMENTS</div><h1>파일 및 문서</h1><p>워크스페이스 멤버와 파일을 공유합니다. 파일은 비공개 저장소에 보관됩니다.</p></div><button className="primary-action" disabled={filesBusy||!dbReady} onClick={()=>fileInput.current?.click()}><Upload size={16}/> {filesBusy?'업로드 중...':'파일 업로드'}</button></div>
        <input ref={fileInput} type="file" multiple hidden onChange={e=>addFiles(e.target.files)}/>
        <div className="upload-zone" onClick={()=>!filesBusy&&fileInput.current?.click()}><FolderOpen size={30}/><strong>{filesBusy?'파일을 업로드하고 있습니다':'파일을 선택하거나 여기를 누르세요'}</strong><span>최대 파일 크기 25MB · 로그인한 워크스페이스 멤버만 접근할 수 있습니다.</span></div>
        <div className="section-card"><div className="card-title"><FileText size={18}/>공유 파일 <span>{files.length}개</span></div>{files.length===0?<div className="empty-state">공유된 파일이 없습니다.</div>:files.map(file=><div className="file-row" key={file.id}><div className="file-type"><FileText size={17}/></div><div><strong>{file.file_name}</strong><small>{(file.size_bytes/1024/1024).toFixed(2)} MB · {new Date(file.created_at).toLocaleString('ko-KR')}</small></div><button className="secondary-action" onClick={()=>downloadWorkspaceFile(file)}>다운로드</button>{file.uploaded_by===currentUser?.id&&<button className="secondary-action" onClick={()=>deleteWorkspaceFile(file)}>삭제</button>}</div>)}</div>
      </section>}
      <footer className="status-footer"><span><i/>{serverApiReady?"NEXUS 서버 API 연결됨":dbReady?"DB 연결됨 · API 확인 필요":"서버 연결 확인 중"}</span><span>SUPABASE · SEOUL</span><button onClick={()=>setMobilePanel('ai')}><Sparkles size={14}/> AI 패널 열기</button></footer>
    </main>

    {searchOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false)}}><div className="search-modal"><div className="search-input-row"><Search size={19}/><input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="메시지와 멤버 검색..."/><button onClick={()=>setSearchOpen(false)}><X size={18}/></button></div><div className="search-results"><div className="search-caption">메시지 검색 결과 · {filteredMessages.length}개</div>{filteredMessages.map(m=><button className="search-result" key={m.id} onClick={()=>{setSection('messages');setSearchOpen(false);setSearchQuery('')}}><div className={`avatar ${m.color}`}>{m.initials}</div><div><strong>{m.name}</strong><p>{m.text}</p></div></button>)}{filteredMessages.length===0&&<div className="empty-state">검색 결과가 없습니다.</div>}</div><div className="search-foot">ESC 닫기 · Ctrl K 검색 열기</div></div></div>}
    {settingsOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSettingsOpen(false)}}><div className="settings-modal"><div className="modal-title"><div><div className="eyebrow">PREFERENCES</div><h2>설정</h2></div><button className="icon-button" onClick={()=>setSettingsOpen(false)}><X/></button></div><div className="profile-editor">
          <div className="profile-avatar-edit"><div className="avatar profile-large">{profile.avatar_url?<img src={profile.avatar_url}/>:((profile.display_name||currentUser?.name||'N').slice(0,1))}</div><button className="secondary-action" onClick={()=>avatarInput.current?.click()}><Upload size={14}/> 사진 변경</button><input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e=>uploadAvatar(e.target.files?.[0])}/></div>
          <label>표시 이름<input maxLength={40} value={profile.display_name} onChange={e=>setProfile(v=>({...v,display_name:e.target.value}))}/></label>
          <label>상태 메시지<input maxLength={160} value={profile.bio} onChange={e=>setProfile(v=>({...v,bio:e.target.value}))} placeholder="현재 상태를 알려주세요."/></label>
          <label>프로필 테마 색상<input type="color" value={profile.theme_color} onChange={e=>setProfile(v=>({...v,theme_color:e.target.value}))}/></label>
          <button className="primary-action full-action" disabled={profileBusy} onClick={saveProfile}>{profileBusy?'저장 중...':'프로필 저장'}</button>
          <button className="secondary-action full-action" onClick={async()=>{if(!('Notification' in window)){notify('이 브라우저는 알림을 지원하지 않습니다.');return;}const p=await Notification.requestPermission();notify(p==='granted'?'브라우저 알림이 허용되었습니다.':'알림 권한이 허용되지 않았습니다.')}}><Bell size={14}/> 브라우저 알림 허용</button>
          <div className="settings-note">앱이 열려 있을 때 실시간 알림을 받을 수 있습니다. 앱을 닫은 뒤 푸시 알림을 보내려면 푸시 서버 키 설정이 추가로 필요합니다.</div>
          <button className="secondary-action full-action" disabled={logoutBusy} onClick={signOut}>{logoutBusy?'로그아웃 중...':'로그아웃'}</button>
        </div></div></div>}
    {notificationsOpen&&<div className="notification-pop"><div className="notification-title">알림<button onClick={()=>setNotificationsOpen(false)}><X size={15}/></button></div>{notifications.length?notifications.map(n=><button className={'notification-item '+(!n.read_at?'unread':'')} key={n.id} onClick={()=>{markNotificationRead(n.id);if(n.type==='dm')setSection('dms');if(n.type==='friend_request')setSection('community');setNotificationsOpen(false)}}><strong>{n.title}</strong><span>{n.body}</span><small>{new Date(n.created_at).toLocaleString('ko-KR')}</small></button>):<div className="empty-state">새로운 알림이 없습니다.</div>}</div>}
    {channelDialog&&<div className="modal-backdrop"><div className="small-modal"><div className="modal-title"><h2>채널 만들기</h2><button className="icon-button" onClick={()=>setChannelDialog(false)}><X/></button></div><label>채널 이름</label><input value={channelDraft} onChange={e=>setChannelDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addChannel()} placeholder="예: design-team"/><p>영문, 숫자, 한글, 하이픈을 사용할 수 있습니다.</p><button className="primary-action full-action" onClick={addChannel}><Plus size={16}/> 채널 생성</button></div></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}


function AuthGate() {
  const [session,setSession] = useState<any>(null);
  const [loading,setLoading] = useState(false);
  const [mode,setMode] = useState<'signin'|'signup'>('signin');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [displayName,setDisplayName] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    let settled = false;
    const finishLoading = () => {
      if (active && !settled) {
        settled = true;
        setLoading(false);
      }
    };
    // Do not let a slow or blocked mobile-network request keep the page on
    // the loading screen forever. Auth state can still update afterwards.
    const timeout = window.setTimeout(finishLoading, 4500);
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => {
      if (!active) return;
      setSession(next);
      finishLoading();
    });
    supabase.auth.getSession().then(({data,error}) => {
      if (!active) return;
      if (error) console.error('[NEXUS auth session]', error);
      setSession(data?.session ?? null);
      finishLoading();
    }).catch(error => {
      console.error('[NEXUS auth session]', error);
      if (active) {
        setSession(null);
        finishLoading();
      }
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  },[]);

  const submit = async (event:FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError('');
    try {
      if (mode==='signup') {
        const {data,error:authError} = await supabase.auth.signUp({
          email:email.trim(),
          password,
          options:{data:{display_name:displayName.trim() || email.split('@')[0]}}
        });
        if (authError) throw authError;
        if (data.session) {
          setSession(data.session);
          setError('');
        } else {
          setError('이메일 인증이 아직 켜져 있습니다. Supabase에서 Confirm email을 끄면 가입 즉시 로그인됩니다.');
        }
      } else {
        const {error:authError} = await supabase.auth.signInWithPassword({email:email.trim(),password});
        if (authError) throw authError;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증 중 오류가 발생했습니다.');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="auth-screen"><div className="auth-card">NEXUS 연결 확인 중...</div></div>;
  if (!isSupabaseConfigured || !supabase) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark">NX<span>•</span></div><h1>서버 설정이 필요합니다</h1><p>Supabase 연결 정보를 확인할 수 없습니다.</p></div></div>;
  if (!session) return <div className="auth-screen"><form className="auth-card" onSubmit={submit}>
    <div className="brand-mark">NX<span>•</span></div>
    <div className="eyebrow">YOUR CONNECTED WORKSPACE</div>
    <h1>{mode==='signin'?'NEXUS에 로그인':'NEXUS 계정 만들기'}</h1>
    <p>계정으로 로그인하면 실제 서버 연결 기능을 사용할 수 있습니다.</p>
    {mode==='signup'&&<label>표시 이름<input required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="표시 이름"/></label>}
    <label>이메일<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
    <label>비밀번호<input required type="password" minLength={6} autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="6자 이상"/></label>
    {error&&<div className="auth-error">{error}</div>}
    <button className="primary-action auth-submit" disabled={busy}>{busy?'처리 중...':mode==='signin'?'로그인':'가입하기'}</button>
    <button type="button" className="auth-switch" onClick={()=>{setMode(mode==='signin'?'signup':'signin');setError('')}}>{mode==='signin'?'계정이 없으신가요? 회원가입':'이미 계정이 있으신가요? 로그인'}</button>
    <small>이메일 인증을 끄면 가입 직후 바로 로그인됩니다.</small>
  </form></div>;
  return <WorkspaceApp/>;
}

export default function App() { return <AuthGate/>; }
