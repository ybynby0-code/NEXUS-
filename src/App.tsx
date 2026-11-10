import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import CallRoom from './CallRoom';
import AdminPanel from './AdminPanel';
import { Activity, Bell, Bot, CalendarDays, Check, ChevronDown, CircleHelp, Command, Compass, Copy, FileText, Hash, Headphones, LayoutGrid, MessageCircle, Mic, MoreHorizontal, Paperclip, Phone, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Users, Video, X, Upload, UserPlus, FolderOpen, Link2 } from 'lucide-react';

type Section = 'home' | 'messages' | 'dms' | 'community' | 'meetings' | 'files' | 'admin';
type ChatReaction = { id:string; emoji:string; user_id:string };
type WorkspaceRole = {id:string;name:string;color:string;permissions:Record<string,boolean>;position:number};
type ChatMessage = { id:string; name:string; initials:string; color:string; time:string; text:string; author_id?:string; parent_message_id?:string|null; pinned_at?:string|null; edited_at?:string|null; reactions?:ChatReaction[] };
const initialChannels = ['general', 'announcements', 'development', 'random'];
const initialMessages: ChatMessage[] = [];

function WorkspaceApp() {
  const [section,setSection] = useState<Section>('home');
  const [activeChannel,setActiveChannel] = useState('general');
  const [channels,setChannels] = useState(initialChannels);
  const [workspaces,setWorkspaces] = useState<any[]>([]);
  const [workspaceMenuOpen,setWorkspaceMenuOpen] = useState(false);
  const [workspaceDraft,setWorkspaceDraft] = useState('');
  const [workspaceBusy,setWorkspaceBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [messages,setMessages] = useState<ChatMessage[]>(initialMessages);
  const [replyTo,setReplyTo] = useState<ChatMessage|null>(null);
  const [editingMessageId,setEditingMessageId] = useState<string|null>(null);
  const [currentUser,setCurrentUser] = useState<{id:string;name:string;email?:string}|null>(null);
  const [adminRole,setAdminRole] = useState<string|null>(null);
  const [workspaceId,setWorkspaceId] = useState<string|null>(null);
  const [channelIds,setChannelIds] = useState<Record<string,string>>({});
  const [dbReady,setDbReady] = useState(false);
  const [serverApiReady,setServerApiReady] = useState(false);
  const [onlineCount,setOnlineCount] = useState(0);
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
  const [profile,setProfile] = useState({display_name:'',bio:'',status_text:'',avatar_url:'',banner_url:'',theme_background_url:'',theme_color:'#7867e8',profile_decoration:'none',theme_mode:'dark'});
  const [themeSettings,setThemeSettings] = useState({glow_a:'#7567e8',glow_b:'#2b91b8',intensity:18,blur:18,brightness:100,animated:false});
  const [profileBusy,setProfileBusy] = useState(false);
  const [logoutBusy,setLogoutBusy] = useState(false);
  const avatarInput=useRef<HTMLInputElement>(null);
  const bannerInput=useRef<HTMLInputElement>(null);
  const themeImageInput=useRef<HTMLInputElement>(null);
  const [aiPrompt,setAiPrompt] = useState('');
  const [aiBusy,setAiBusy] = useState(false);
  const [aiAnswer,setAiAnswer] = useState('NEXUS AI 서버 연결이 준비되어 있습니다. 제공자 키가 등록되면 실제 답변을 생성합니다.');
  const [mobilePanel,setMobilePanel] = useState<'none'|'nav'|'ai'>('none');
  const [searchOpen,setSearchOpen] = useState(false);
  const [searchQuery,setSearchQuery] = useState('');
  const [searchResults,setSearchResults] = useState<any[]>([]);
  const [searchBusy,setSearchBusy] = useState(false);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [notificationsOpen,setNotificationsOpen] = useState(false);
  const [channelDialog,setChannelDialog] = useState(false);
  const [channelDraft,setChannelDraft] = useState('');
  const [members,setMembers] = useState<any[]>([]);
  const [workspaceRoles,setWorkspaceRoles] = useState<WorkspaceRole[]>([]);
  const [roleDraft,setRoleDraft] = useState({name:'',color:'#5865f2',permissions:{manage_channels:false,manage_members:false,manage_messages:false,invite_members:false,manage_roles:false}});
  const [roleBusy,setRoleBusy] = useState(false);
  const [inviteDraft,setInviteDraft] = useState('');
  const [workspaceInvites,setWorkspaceInvites] = useState<any[]>([]);
  const [inviteBusy,setInviteBusy] = useState(false);
  const [joinLink,setJoinLink] = useState('');
  const [joinLinkExpires,setJoinLinkExpires] = useState('');
  const [joinLinkBusy,setJoinLinkBusy] = useState(false);
  const joinTokenHandled=useRef(false);
  const [files,setFiles] = useState<any[]>([]);
  const [filesBusy,setFilesBusy] = useState(false);
  const [attachDialogOpen,setAttachDialogOpen] = useState(false);
  const [attachableFiles,setAttachableFiles] = useState<any[]>([]);
  const [attachBusy,setAttachBusy] = useState(false);
  const [scheduledMeetings,setScheduledMeetings] = useState<any[]>([]);
  const [outgoingCallCode,setOutgoingCallCode] = useState('');
  const [incomingCallCode,setIncomingCallCode] = useState('');
  const [pendingOutgoingCall,setPendingOutgoingCall] = useState<any>(null);
  const [meetingTitle,setMeetingTitle] = useState('팀 회의');
  const [meetingTime,setMeetingTime] = useState('');
  const [meetingBusy,setMeetingBusy] = useState(false);
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
      const isDeveloperAccount=String(user.email||'').toLowerCase()==='ybynby0@gmail.com';
      const displayName=isDeveloperAccount?'레인보우':String(user.user_metadata?.display_name||user.email?.split('@')[0]||'NEXUS 사용자');
      if(alive)setCurrentUser({id:user.id,name:displayName,email:user.email||''});
      const {data:adminAccess}=await supabase.from('app_admins').select('role').eq('user_id',user.id).maybeSingle();
      if(alive)setAdminRole(adminAccess?.role||null);
      const {error:profileError}=await supabase.from('profiles').upsert({id:user.id,display_name:displayName},{onConflict:'id'});
      const {data:profileRow}=await supabase.from('profiles').select('display_name,bio,status_text,avatar_url,theme_color,banner_url,theme_background_url,profile_decoration,theme_mode,theme_settings').eq('id',user.id).maybeSingle();
      if(profileRow&&alive)setProfile({display_name:profileRow.display_name||displayName,bio:profileRow.bio||'',status_text:profileRow.status_text||'',avatar_url:profileRow.avatar_url||'',banner_url:profileRow.banner_url||'',theme_background_url:profileRow.theme_background_url||'',theme_color:profileRow.theme_color||'#7867e8',profile_decoration:profileRow.profile_decoration||'none',theme_mode:profileRow.theme_mode||'dark'});
      if(profileRow?.theme_settings&&alive)setThemeSettings({...{glow_a:'#7567e8',glow_b:'#2b91b8',intensity:18,blur:18,brightness:100,animated:false},...profileRow.theme_settings});
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
      const {data:workspaceRows,error:workspaceListError}=await supabase.from('workspaces').select('id,name,owner_id').order('created_at');
      if(workspaceListError)throw workspaceListError;
      const {data:channelRows,error:channelListError}=await supabase.from('channels').select('workspace_id');
      if(channelListError)throw channelListError;
      const populatedWorkspaceIds=new Set((channelRows||[]).map((row:any)=>row.workspace_id));
      if(!alive)return;
      setWorkspaces((workspaceRows||[]).filter((row:any)=>populatedWorkspaceIds.has(row.id)));
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
      setMessages([]);
      const {data,error}=await supabase.from('messages').select('id,content,created_at,author_id,parent_message_id,pinned_at,edited_at') .eq('channel_id',channelId).order('created_at',{ascending:false}).limit(100);
      if(error)throw error;
      const ids=[...new Set((data||[]).map((m:any)=>m.author_id))];const messageIds=(data||[]).map((m:any)=>m.id);
      const [{data:profiles},{data:reactions}]=await Promise.all([ids.length?supabase.from('profiles').select('id,display_name').in('id',ids):Promise.resolve({data:[]}),messageIds.length?supabase.from('message_reactions').select('id,message_id,emoji,user_id').in('message_id',messageIds):Promise.resolve({data:[]})]);
      const names:Record<string,string>={};(profiles||[]).forEach((p:any)=>names[p.id]=p.display_name);
      if(alive)setMessages([...(data||[])].reverse().map((m:any)=>({id:m.id,name:m.author_id===currentUser?.id?'나':names[m.author_id]||'사용자',initials:(m.author_id===currentUser?.id?'나':names[m.author_id]||'U').slice(0,1),color:m.author_id===currentUser?.id?'orange':'blue',time:new Date(m.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),text:m.content,author_id:m.author_id,parent_message_id:m.parent_message_id,pinned_at:m.pinned_at,edited_at:m.edited_at,reactions:(reactions||[]).filter((x:any)=>x.message_id===m.id)})));
    };
    load().catch(e=>notify('메시지 조회 실패: '+e.message));
    const sub=supabase.channel('nexus-'+channelId)
      .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:'channel_id=eq.'+channelId},async(payload:any)=>{
        if(payload.eventType==='DELETE'){if(alive)setMessages(prev=>prev.filter(x=>x.id!==payload.old.id));return;}
        const m=payload.new;const {data:p}=await supabase.from('profiles').select('display_name').eq('id',m.author_id).maybeSingle();
        if(!alive)return;
        setMessages(prev=>{const item:ChatMessage={id:m.id,name:m.author_id===currentUser?.id?'나':p?.display_name||'사용자',initials:(p?.display_name||'U').slice(0,1),color:m.author_id===currentUser?.id?'orange':'blue',time:new Date(m.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),text:m.content,author_id:m.author_id,parent_message_id:m.parent_message_id,pinned_at:m.pinned_at,edited_at:m.edited_at,reactions:prev.find(x=>x.id===m.id)?.reactions||[]};return prev.some(x=>x.id===m.id)?prev.map(x=>x.id===m.id?item:x):[...prev,item];});
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},async()=>{
        const {data:channelMessages}=await supabase.from('messages').select('id').eq('channel_id',channelId);const ids=(channelMessages||[]).map((x:any)=>x.id);if(!ids.length)return;const {data}=await supabase.from('message_reactions').select('id,message_id,emoji,user_id').in('message_id',ids);if(alive)setMessages(prev=>prev.map(m=>({...m,reactions:(data||[]).filter((x:any)=>x.message_id===m.id)})));
      }).subscribe();
    return()=>{alive=false;supabase.removeChannel(sub)};
  },[dbReady,activeChannel,channelIds,currentUser?.id]);

  useEffect(()=>{
    if(!supabase||!currentUser||!workspaceId)return;
    const presence=supabase.channel('nexus-presence-'+workspaceId,{config:{presence:{key:currentUser.id}}});
    presence.on('presence',{event:'sync'},()=>setOnlineCount(Object.keys(presence.presenceState()).length));
    presence.subscribe(async(status:string)=>{
      if(status==='SUBSCRIBED'){
        await presence.track({user_id:currentUser.id,name:currentUser.name,online_at:new Date().toISOString()});
      }
    });
    return()=>{setOnlineCount(0);void supabase.removeChannel(presence);};
  },[currentUser?.id,workspaceId]);

  useEffect(()=>{
    if(!supabase||!dbReady||!workspaceId)return;
    let alive=true;
    const refreshChannels=async()=>{
      const {data,error}=await supabase.from('channels').select('id,name').eq('workspace_id',workspaceId).order('created_at');
      if(error){console.warn('[NEXUS channels realtime]',error);return;}
      if(!alive)return;
      const map:Record<string,string>={};(data||[]).forEach((c:any)=>map[c.name]=c.id);
      setChannelIds(map);setChannels((data||[]).map((c:any)=>c.name));
      setActiveChannel(current=>(data||[]).some((c:any)=>c.name===current)?current:(data?.[0]?.name||'general'));
    };
    const sub=supabase.channel('nexus-workspace-channels-'+workspaceId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'channels',filter:'workspace_id=eq.'+workspaceId},refreshChannels)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'channels',filter:'workspace_id=eq.'+workspaceId},refreshChannels)
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'channels'},refreshChannels)
      .subscribe();
    return()=>{alive=false;void supabase.removeChannel(sub)};
  },[supabase,dbReady,workspaceId]);

  useEffect(()=>{
    if(!supabase||!dbReady||!currentUser||joinTokenHandled.current)return;
    const token=new URLSearchParams(window.location.search).get('join');
    if(!token)return;
    joinTokenHandled.current=true;
    (async()=>{
      try{
        const {data,error}=await supabase.functions.invoke('workspace-join-link',{body:{action:'accept',token}});
        if(error||!data?.ok)throw new Error(data?.error||error?.message||'초대 링크 수락 실패');
        const [{data:rows,error:channelError},{data:allWorkspaces,error:workspaceError}]=await Promise.all([
          supabase.from('channels').select('id,name').eq('workspace_id',data.workspace_id).order('created_at'),
          supabase.from('workspaces').select('id,name,owner_id').order('created_at')
        ]);
        if(channelError)throw channelError;if(workspaceError)throw workspaceError;
        const map:Record<string,string>={};(rows||[]).forEach((c:any)=>map[c.name]=c.id);
        setWorkspaces(allWorkspaces||[]);setWorkspaceId(data.workspace_id);setChannelIds(map);setChannels((rows||[]).map((c:any)=>c.name));
        if(rows?.[0])setActiveChannel(rows[0].name);
        setSection('messages');setMobilePanel('none');
        window.history.replaceState({},'',window.location.pathname);
        notify(data.workspace_name+' 서버에 참여했습니다. 채널 목록을 불러왔습니다.');
      }catch(e:any){joinTokenHandled.current=false;notify('서버 초대 링크 오류: '+(e?.message||'다시 시도해 주세요.'));}
    })();
  },[supabase,dbReady,currentUser?.id]);

  const loadDmConversations=async()=>{
    if(!supabase||!currentUser)return;
    const {data,error}=await supabase.from('dm_conversations').select('id,member_one,member_two,created_at').or('member_one.eq.'+currentUser.id+',member_two.eq.'+currentUser.id).order('created_at',{ascending:false});
    if(error){notify('DM 목록 조회 실패: '+error.message);return;}
    const rows=data||[];const ids=[...new Set(rows.map((c:any)=>c.member_one===currentUser.id?c.member_two:c.member_one))];
    const {data:people}=ids.length?await supabase.from('profiles').select('id,display_name,avatar_url,bio,banner_url,profile_decoration,theme_color').in('id',ids):{data:[]};
    const byId:Record<string,any>={};(people||[]).forEach((p:any)=>byId[p.id]=p);
    setDmConversations(rows.map((c:any)=>({...c,person:byId[c.member_one===currentUser.id?c.member_two:c.member_one]})));
  };
  useEffect(()=>{if(section==='dms'&&currentUser)loadDmConversations();},[section,currentUser?.id]);
  useEffect(()=>{const params=new URLSearchParams(window.location.search);const call=params.get('call');if(call&&/^[A-Z0-9]{12,16}$/i.test(call)){setIncomingCallCode(call.toUpperCase());setSection('meetings');window.history.replaceState({},'',window.location.pathname);}else if(params.get('section')==='dms')setSection('dms');},[]);
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('conversation');if(!id||!dmConversations.length)return;const match=dmConversations.find(c=>c.id===id);if(match){setActiveDm(match);setSection('dms');window.history.replaceState({},'',window.location.pathname);}},[dmConversations]);

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
    const {data,error}=await supabase.from('dm_messages').insert({conversation_id:activeDm.id,sender_id:currentUser.id,content}).select('id,sender_id,content,created_at,read_at').single();
    if(error){setDmDraft(content);notify('DM 전송 실패: '+error.message);return;}
    if(data){
      setDmMessages(v=>v.some(m=>m.id===data.id)?v:[...v,data]);
      const recipientId=activeDm.member_one===currentUser.id?activeDm.member_two:activeDm.member_one;
      const senderName=profile.display_name||currentUser.name;
      const preview=content.length>180?content.slice(0,177)+'…':content;
      void supabase.functions.invoke('nexus-push',{body:{
        recipient_id:recipientId,
        conversation_id:activeDm.id,
        title:senderName+'님의 새 메시지',
        body:preview,
        tag:'nexus-dm-'+data.id,
        url:'./?section=dms&conversation='+encodeURIComponent(activeDm.id)
      }}).then(({error:pushError})=>{
        if(pushError)console.warn('[NEXUS DM push]',pushError);
      }).catch(error=>console.warn('[NEXUS DM push]',error));
    }
  };
  const loadNotifications=async()=>{
    if(!supabase||!currentUser)return;
    const {data,error}=await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(30);
    if(error){console.error(error);return;}setNotifications(data||[]);
  };
  const markNotificationRead=async(id:string)=>{
    if(!supabase)return;const at=new Date().toISOString();
    const {error}=await supabase.from('notifications').update({read_at:at}).eq('id',id);
    if(error){notify('알림 읽음 처리 실패: '+error.message);return;}
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
    const {error}=await supabase.from('profiles').upsert({id:currentUser.id,display_name:profile.display_name.trim()||currentUser.name,bio:profile.bio.slice(0,160),status_text:profile.status_text.slice(0,80),avatar_url:profile.avatar_url,banner_url:profile.banner_url,theme_background_url:profile.theme_background_url,theme_color:profile.theme_color,profile_decoration:profile.profile_decoration,theme_mode:profile.theme_mode,theme_settings:themeSettings},{onConflict:'id'});
    setProfileBusy(false);if(error)notify('프로필 저장 실패: '+error.message);else{notify('프로필을 저장했습니다.');setSettingsOpen(false);}
  };
  const uploadProfileImage=async(kind:'avatar'|'banner'|'theme',file?:File)=>{
    if(!file||!supabase||!currentUser)return;
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024){notify('PNG, JPG, WebP, GIF 이미지(5MB 이하)를 선택해 주세요.');return;}
    const path=currentUser.id+'/'+kind+'-'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const {error}=await supabase.storage.from('nexus-avatars').upload(path,file,{upsert:false,contentType:file.type});
    if(error){notify('이미지 업로드 실패: '+error.message);return;}
    const {data}=supabase.storage.from('nexus-avatars').getPublicUrl(path);
    const field=kind==='avatar'?'avatar_url':kind==='banner'?'banner_url':'theme_background_url';
    setProfile(v=>({...v,[field]:data.publicUrl}));notify('이미지를 적용했습니다. 프로필 저장을 눌러 반영하세요.');
  };
  const enablePushNotifications=async()=>{
    if(!supabase){notify('서버 연결이 필요합니다.');return;}
    if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){notify('이 브라우저는 웹 푸시를 지원하지 않습니다.');return;}
    try{
      const permission=await Notification.requestPermission();if(permission!=='granted'){notify('시스템 알림 권한을 허용해 주세요.');return;}
      const {data:keyData,error:keyError}=await supabase.functions.invoke('nexus-push',{body:{action:'public_key'}});
      if(keyError||!keyData?.public_key)throw new Error(keyError?.message||'푸시 공개키를 가져오지 못했습니다.');
      const publicKey=keyData.public_key as string;
      const registration=await navigator.serviceWorker.ready;
      const decode=(value:string)=>{const pad='='.repeat((4-value.length%4)%4);const raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
      const existing=await registration.pushManager.getSubscription();
      const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(publicKey)});
      const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('로그인이 필요합니다.');
      const payload=subscription.toJSON();
      if(!payload.keys?.p256dh||!payload.keys?.auth)throw new Error('브라우저가 푸시 암호화 키를 반환하지 않았습니다.');
      const {error}=await supabase.from('push_subscriptions').upsert({
        user_id:user.id,
        endpoint:subscription.endpoint,
        p256dh:payload.keys.p256dh,
        auth:payload.keys.auth
      },{onConflict:'endpoint'});
      if(error)throw error;
      notify('이 기기의 시스템 푸시 알림을 등록했습니다.');
    }catch(e:any){console.error('[NEXUS push registration]',e);notify('푸시 등록 실패: '+(e?.message||String(e)||'오류'));}
  };
  const startDirectCall=()=>{
    if(!supabase||!currentUser||!activeDm?.person?.id)return;
    const code=crypto.randomUUID().replace(/-/g,'').slice(0,16).toUpperCase();
    const caller=profile.display_name||currentUser.name;
    setPendingOutgoingCall({recipient:activeDm.person.id,conversationId:activeDm.id,code,title:'NEXUS 통화 요청',body:caller+'님이 통화를 요청했습니다. 초대 코드: '+code});
    setOutgoingCallCode(code);setSection('meetings');setMobilePanel('none');
    notify('통화 연결을 준비하고 있습니다. 마이크 권한을 허용해 주세요.');
  };
  const handleOutgoingCallReady=async()=>{
    const pending=pendingOutgoingCall;
    if(!supabase||!currentUser||!pending)return;
    setPendingOutgoingCall(null);
    const {error}=await supabase.from('notifications').insert({recipient_id:pending.recipient,actor_id:currentUser.id,type:'call',title:pending.title,body:pending.body,target_id:pending.conversationId});
    if(error){notify('통화방은 열렸지만 초대 알림 전송에 실패했습니다: '+error.message);return;}
    try{const {error:pushError}=await supabase.functions.invoke('nexus-push',{body:{recipient_id:pending.recipient,title:pending.title,body:pending.body,conversation_id:pending.conversationId,url:'./?section=meetings&call='+pending.code}});if(pushError)console.warn('[NEXUS call push]',pushError);}catch(e){console.warn('[NEXUS call push]',e);}
    notify('통화 요청을 보냈습니다. 상대방이 받으면 연결됩니다.');
  };
  const sendPing=async()=>{
    if(!supabase||!currentUser||!activeDm?.person?.id)return;
    const recipient=activeDm.person.id;
    const {error}=await supabase.from('notifications').insert({recipient_id:recipient,actor_id:currentUser.id,type:'ping',title:'NEXUS 핑',body:(profile.display_name||currentUser.name)+'님이 회원님을 호출했습니다.',target_id:activeDm.id});
    if(error){notify('핑 전송 실패: '+error.message);return;}
    try{const {error:pushError}=await supabase.functions.invoke('nexus-push',{body:{recipient_id:recipient,title:'NEXUS 핑',body:(profile.display_name||currentUser.name)+'님이 회원님을 호출했습니다.',conversation_id:activeDm.id,url:'./?section=dms&conversation='+encodeURIComponent(activeDm.id)}});if(pushError)console.warn('[NEXUS push]',pushError);}catch(e){console.warn('[NEXUS push]',e);}
    notify('핑을 보냈습니다. 푸시 알림을 등록한 기기에서는 앱이 백그라운드여도 시스템 알림이 표시됩니다.');
  };
  useEffect(()=>{
    if(!supabase||!currentUser)return;
    loadDmConversations();loadNotifications();
    const sub=supabase.channel('nexus-notifications-'+currentUser.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'recipient_id=eq.'+currentUser.id},(payload:any)=>{
      const n=payload.new;setNotifications(v=>[n,...v]);
      if((n.type==='ping'||n.type==='call')&&'vibrate' in navigator)navigator.vibrate([260,100,260,100,420]);
      const callCode=n.type==='call'?(n.body.match(/초대 코드:\s*([A-Z0-9]{12,16})/i)||[])[1]:null;
      const targetUrl=callCode?'./?section=meetings&call='+callCode:'./?section=dms&conversation='+encodeURIComponent(n.target_id||'');
      if('Notification' in window&&Notification.permission==='granted'){
        navigator.serviceWorker?.ready.then(async reg=>{
          const subscription=await reg.pushManager.getSubscription().catch(()=>null);
          if(!subscription)await reg.showNotification(n.title,{body:n.body,tag:'nexus-notification-'+(n.target_id||n.id),icon:'./icons/nexus.svg',data:{url:targetUrl},vibrate:[260,100,260,100,420]} as NotificationOptions & {vibrate:number[]});
        }).catch(error=>console.warn('[NEXUS foreground notification]',error));
      }else notify(n.title+': '+n.body);
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
      const {data,error}=await supabase.from('dm_messages').select('id,sender_id,content,created_at,read_at').eq('conversation_id',activeDm.id).order('created_at',{ascending:false}).limit(100);
      if(error)throw error;
      if(alive)setDmMessages([...(data||[])].reverse());
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
    const {data:incoming,error:incomingError}=await supabase.from('friend_requests').select('id').eq('sender_id',id).eq('recipient_id',currentUser.id).eq('status','pending').maybeSingle();
    if(incomingError){notify('기존 친구 요청 확인 실패: '+incomingError.message);return;}
    if(incoming){await respondFriendRequest(incoming.id,'accepted');setFriendResults(v=>v.filter(p=>p.id!==id));return;}
    const {data:existing,error:existingError}=await supabase.from('friend_requests').select('id,status').eq('sender_id',currentUser.id).eq('recipient_id',id).maybeSingle();
    if(existingError){notify('친구 요청 확인 실패: '+existingError.message);return;}
    if(existing?.status==='accepted'){notify('이미 친구로 등록된 사용자입니다.');return;}
    if(existing?.status==='pending'){notify('이미 친구 요청을 보냈습니다.');return;}
    if(existing?.status==='rejected'){
      const {error:deleteError}=await supabase.from('friend_requests').delete().eq('id',existing.id);
      if(deleteError){notify('이전 요청 정리 실패: '+deleteError.message);return;}
    }
    const {error}=await supabase.from('friend_requests').insert({sender_id:currentUser.id,recipient_id:id});
    if(error){notify('친구 요청 실패: '+error.message);return;}
    notify('친구 요청을 보냈습니다.');setFriendResults(v=>v.filter(p=>p.id!==id));loadFriendData();
  };
  const respondFriendRequest=async(id:string,status:'accepted'|'rejected')=>{
    if(!supabase||!currentUser)return;
    const request=friendRequests.find((r:any)=>r.id===id);
    const {error}=await supabase.from('friend_requests').update({status,updated_at:new Date().toISOString()}).eq('id',id);
    if(error){notify('요청 처리 실패: '+error.message);return;}
    if(status==='accepted'&&request?.sender_id){
      const {error:reverseError}=await supabase.from('friend_requests').delete().eq('sender_id',currentUser.id).eq('recipient_id',request.sender_id).eq('status','pending');
      if(reverseError)console.warn('[NEXUS reverse friend request]',reverseError);
    }
    notify(status==='accepted'?'친구 요청을 수락했습니다.':'친구 요청을 거절했습니다.');loadFriendData();
  };
  useEffect(()=>{if(section==='community'&&currentUser)loadFriendData()},[section,currentUser?.id]);
  const runGlobalSearch=async(query:string)=>{
    if(!supabase||!workspaceId||!query.trim()){setSearchResults([]);return;}
    setSearchBusy(true);
    try{
      const ids=Object.values(channelIds);
      const [messageResult,dmResult]=await Promise.all([
        ids.length?supabase.from('messages').select('id,content,created_at,author_id,channel_id').in('channel_id',ids).ilike('content','%'+query.trim()+'%').order('created_at',{ascending:false}).limit(40):Promise.resolve({data:[],error:null}),
        dmConversations.length?supabase.from('dm_messages').select('id,content,created_at,sender_id,conversation_id').in('conversation_id',dmConversations.map(c=>c.id)).ilike('content','%'+query.trim()+'%').order('created_at',{ascending:false}).limit(30):Promise.resolve({data:[],error:null})
      ]);
      if(messageResult.error)throw messageResult.error;if(dmResult.error)throw dmResult.error;
      const authorIds=[...new Set([...(messageResult.data||[]).map((m:any)=>m.author_id),...(dmResult.data||[]).map((m:any)=>m.sender_id)])];
      const {data:people,error:peopleError}=authorIds.length?await supabase.from('profiles').select('id,display_name').in('id',authorIds):{data:[],error:null};
      if(peopleError)throw peopleError;
      const names:Record<string,string>={};(people||[]).forEach((p:any)=>names[p.id]=p.display_name);
      const channelNames:Record<string,string>={};Object.entries(channelIds).forEach(([name,id])=>channelNames[id]=name);
      const rows=[...(messageResult.data||[]).map((m:any)=>({...m,kind:'channel',author:names[m.author_id]||'사용자',location:'#'+(channelNames[m.channel_id]||'채널')})),...(dmResult.data||[]).map((m:any)=>({...m,kind:'dm',author:names[m.sender_id]||'사용자',location:'DM · '+(dmConversations.find(c=>c.id===m.conversation_id)?.person?.display_name||'대화')}))];
      rows.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());setSearchResults(rows);
    }catch(e:any){notify('전체 검색 실패: '+(e?.message||'오류'));setSearchResults([]);}finally{setSearchBusy(false);}
  };
  useEffect(()=>{
    if(!searchOpen)return;const q=searchQuery.trim();if(!q){setSearchResults([]);return;}
    const timer=window.setTimeout(()=>runGlobalSearch(q),250);return()=>window.clearTimeout(timer);
  },[searchOpen,searchQuery,workspaceId,channelIds,dmConversations]);
  const switchWorkspace=async(id:string)=>{
    if(!supabase)return;const {data:rows,error}=await supabase.from('channels').select('id,name').eq('workspace_id',id).order('created_at');
    if(error){notify('워크스페이스 전환 실패: '+error.message);return;}
    const map:Record<string,string>={};(rows||[]).forEach((c:any)=>map[c.name]=c.id);
    setWorkspaceId(id);setChannelIds(map);setChannels((rows||[]).map((c:any)=>c.name));if(rows?.[0])setActiveChannel(rows[0].name);
    setSection('messages');setWorkspaceMenuOpen(false);setMobilePanel('none');setActiveDm(null);setDmMessages([]);setMessages([]);
  };
  const createWorkspace=async()=>{
    const name=workspaceDraft.trim();if(!name){notify('워크스페이스 이름을 입력해 주세요.');return;}
    if(!supabase||!currentUser||workspaceBusy)return;setWorkspaceBusy(true);
    try{
      const {data:workspace,error}=await supabase.from('workspaces').insert({name,owner_id:currentUser.id}).select('id,name,owner_id').single();if(error)throw error;
      const {error:memberError}=await supabase.from('workspace_members').insert({workspace_id:workspace.id,user_id:currentUser.id,role:'owner'});if(memberError)throw memberError;
      const defaults=['general','announcements','development','random'].map(channel=>({workspace_id:workspace.id,name:channel,created_by:currentUser.id}));
      const {data:createdChannels,error:channelError}=await supabase.from('channels').insert(defaults).select('id,name');if(channelError)throw channelError;
      setWorkspaces(v=>[...v,workspace]);const map:Record<string,string>={};(createdChannels||[]).forEach((c:any)=>map[c.name]=c.id);
      setWorkspaceId(workspace.id);setChannelIds(map);setChannels((createdChannels||[]).map((c:any)=>c.name));setActiveChannel('general');setSection('messages');setWorkspaceDraft('');setWorkspaceMenuOpen(false);notify('워크스페이스를 만들었습니다.');
    }catch(e:any){notify('워크스페이스 생성 실패: '+(e?.message||'오류'));}finally{setWorkspaceBusy(false);}
  };

  const sendMessage=async()=>{
    const content=message.trim();if(!content)return;
    const channelId=channelIds[activeChannel];
    if(!supabase||!currentUser||!channelId){notify('서버 연결이 준비되지 않았습니다.');return;}
    if(editingMessageId){
      const target=messages.find(m=>m.id===editingMessageId);if(!target||target.author_id!==currentUser.id){notify('본인이 작성한 메시지만 수정할 수 있습니다.');return;}
      const {error}=await supabase.from('messages').update({content,edited_at:new Date().toISOString()}).eq('id',editingMessageId).eq('author_id',currentUser.id);
      if(error){notify('메시지 수정 실패: '+error.message);return;}
      setMessages(v=>v.map(m=>m.id===editingMessageId?{...m,text:content,edited_at:new Date().toISOString()}:m));setEditingMessageId(null);setMessage('');return;
    }
    const {data,error}=await supabase.from('messages').insert({channel_id:channelId,author_id:currentUser.id,content,parent_message_id:replyTo?.id||null}).select('id,content,created_at,author_id,parent_message_id').single();
    if(error){notify('전송 실패: '+error.message);return;}
    setMessage('');setReplyTo(null);
    if(data)setMessages(v=>v.some(m=>m.id===data.id)?v:[...v,{id:data.id,name:'나',initials:'나',color:'orange',time:new Date(data.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),text:data.content,author_id:data.author_id,parent_message_id:data.parent_message_id,reactions:[]}]);
  };
  const toggleMessageReaction=async(m:ChatMessage,emoji:string)=>{
    if(!supabase||!currentUser)return;const existing=(m.reactions||[]).find(x=>x.user_id===currentUser.id&&x.emoji===emoji);
    if(existing){const {error}=await supabase.from('message_reactions').delete().eq('id',existing.id);if(error){notify('반응 취소 실패: '+error.message);return;}setMessages(v=>v.map(x=>x.id===m.id?{...x,reactions:(x.reactions||[]).filter(r=>r.id!==existing.id)}:x));}
    else{const {data,error}=await supabase.from('message_reactions').insert({message_id:m.id,user_id:currentUser.id,emoji}).select('id,emoji,user_id').single();if(error){notify('반응 추가 실패: '+error.message);return;}setMessages(v=>v.map(x=>x.id===m.id?{...x,reactions:[...(x.reactions||[]),data]}:x));}
  };
  const deleteMessage=async(m:ChatMessage)=>{
    if(!supabase||!currentUser||m.author_id!==currentUser.id)return;if(!window.confirm('이 메시지를 삭제하시겠습니까?'))return;
    const {error}=await supabase.from('messages').delete().eq('id',m.id).eq('author_id',currentUser.id);if(error){notify('메시지 삭제 실패: '+error.message);return;}setMessages(v=>v.filter(x=>x.id!==m.id));
  };
  const togglePinMessage=async(m:ChatMessage)=>{
    if(!supabase||!currentUser)return;const pinned=m.pinned_at?null:new Date().toISOString();const {error}=await supabase.from('messages').update({pinned_at:pinned}).eq('id',m.id);if(error){notify('메시지 고정 변경 실패: '+error.message);return;}setMessages(v=>v.map(x=>x.id===m.id?{...x,pinned_at:pinned}:x));
  };
  const askAi=async()=>{
    const prompt=aiPrompt.trim();if(!prompt||!supabase||aiBusy)return;
    setAiBusy(true);
    try{
      const {data,error}=await supabase.functions.invoke('nexus-ai',{body:{prompt}});
      if(error){
        let message=error.message;
        try{const detail=await (error as any).context?.clone?.().json();if(detail?.error)message=detail.error;}catch{}
        throw new Error(message);
      }
      if(!data?.ok)throw new Error(data?.error||'AI 응답을 받지 못했습니다.');
      setAiAnswer(data.text);setAiPrompt('');
    }catch(e:any){
      const message=e?.message||'AI 요청에 실패했습니다.';
      setAiAnswer('AI 연결 오류: '+message);
      notify(message);
    }finally{setAiBusy(false);}
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
    const [memberResult,inviteResult,roleResult,assignmentResult]=await Promise.all([
      supabase.from('workspace_members').select('user_id,role,joined_at').eq('workspace_id',workspaceId),
      supabase.from('workspace_invites').select('id,email,status,expires_at,created_at,workspace_id').order('created_at',{ascending:false}).limit(100),
      supabase.from('workspace_roles').select('id,name,color,permissions,position').eq('workspace_id',workspaceId).order('position',{ascending:false}),
      supabase.from('workspace_member_roles').select('user_id,role_id').eq('workspace_id',workspaceId)
    ]);
    if(memberResult.error){notify('멤버 조회 실패: '+memberResult.error.message);return;}
    if(roleResult.error||assignmentResult.error){notify('역할 조회 실패: '+(roleResult.error?.message||assignmentResult.error?.message));return;}
    const ids=(memberResult.data||[]).map((m:any)=>m.user_id);
    const {data:profiles}=ids.length?await supabase.from('profiles').select('id,display_name,avatar_url').in('id',ids):{data:[]};
    const byId:Record<string,any>={};(profiles||[]).forEach((p:any)=>byId[p.id]=p);
    const assigned:Record<string,string[]>={};(assignmentResult.data||[]).forEach((x:any)=>{(assigned[x.user_id]??=[]).push(x.role_id)});
    setWorkspaceRoles((roleResult.data||[]) as WorkspaceRole[]);
    setMembers((memberResult.data||[]).map((m:any)=>({...m,person:byId[m.user_id],role_ids:assigned[m.user_id]||[]})));
    if(inviteResult.error){notify('초대 목록 조회 실패: '+inviteResult.error.message);return;}
    setWorkspaceInvites(inviteResult.data||[]);
  };
  const createWorkspaceRole=async()=>{
    const name=roleDraft.name.trim();if(!name||!supabase||!workspaceId||roleBusy)return;
    setRoleBusy(true);
    const {error}=await supabase.from('workspace_roles').insert({workspace_id:workspaceId,name,color:roleDraft.color,permissions:roleDraft.permissions,position:workspaceRoles.length,created_by:currentUser?.id});
    setRoleBusy(false);if(error){notify('역할 생성 실패: '+error.message);return;}
    setRoleDraft(v=>({...v,name:''}));notify('새 역할을 만들었습니다.');await loadWorkspacePeople();
  };
  const assignWorkspaceRole=async(userId:string,roleId:string,checked:boolean)=>{
    if(!supabase||!workspaceId||!currentUser)return;
    const result=checked
      ?await supabase.from('workspace_member_roles').insert({workspace_id:workspaceId,user_id:userId,role_id:roleId,assigned_by:currentUser.id})
      :await supabase.from('workspace_member_roles').delete().eq('workspace_id',workspaceId).eq('user_id',userId).eq('role_id',roleId);
    if(result.error){notify('역할 변경 실패: '+result.error.message);return;}
    await loadWorkspacePeople();notify('멤버 역할을 업데이트했습니다.');
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
  const createWorkspaceJoinLink=async()=>{
    if(!supabase||!workspaceId||joinLinkBusy)return;
    setJoinLinkBusy(true);
    try{
      const {data,error}=await supabase.functions.invoke('workspace-join-link',{body:{action:'create',workspace_id:workspaceId}});
      if(error||!data?.ok)throw new Error(data?.error||error?.message||'초대 링크 생성 실패');
      const link=window.location.origin+window.location.pathname+'?join='+data.token;
      setJoinLink(link);setJoinLinkExpires(data.expires_at||'');
      try{await navigator.clipboard.writeText(link);notify('서버 초대 링크를 만들고 복사했습니다.');}
      catch{notify('초대 링크를 만들었습니다. 아래 링크를 길게 눌러 복사해 주세요.');}
    }catch(e:any){notify('초대 링크 생성 실패: '+(e?.message||'오류'));}
    finally{setJoinLinkBusy(false);}
  };
  const copyWorkspaceJoinLink=async()=>{
    if(!joinLink)return;
    try{await navigator.clipboard.writeText(joinLink);notify('초대 링크를 복사했습니다.');}
    catch{window.prompt('서버 초대 링크를 복사하세요.',joinLink);}
  };
  const acceptWorkspaceInvite=async(inviteId:string)=>{
    if(!supabase)return;
    const {data,error}=await supabase.rpc('accept_workspace_invite',{p_invite_id:inviteId});
    if(error){notify('초대 수락 실패: '+error.message);return;}
    notify('워크스페이스에 참여했습니다.');
    if(data?.workspace_id){
      const {data:rows,error:channelError}=await supabase.from('channels').select('id,name').eq('workspace_id',data.workspace_id).order('created_at');
      if(channelError){notify('참여했지만 채널을 불러오지 못했습니다: '+channelError.message);return;}
      const map:Record<string,string>={};(rows||[]).forEach((c:any)=>map[c.name]=c.id);
      const {data:allWorkspaces}=await supabase.from('workspaces').select('id,name,owner_id').order('created_at');
      const {data:allChannels}=await supabase.from('channels').select('workspace_id');
      const populatedIds=new Set((allChannels||[]).map((row:any)=>row.workspace_id));
      setWorkspaces((allWorkspaces||[]).filter((row:any)=>populatedIds.has(row.id)));
      setWorkspaceId(data.workspace_id);
      setChannelIds(map);
      setChannels((rows||[]).map((c:any)=>c.name));
      if(rows?.[0])setActiveChannel(rows[0].name);
      setSection('messages');
      setMobilePanel('none');
    }
  };
  const loadScheduledMeetings=async()=>{
    if(!supabase||!workspaceId)return;
    const {data,error}=await supabase.from('scheduled_meetings').select('id,title,starts_at,meeting_code,created_by,created_at').eq('workspace_id',workspaceId).order('starts_at',{ascending:true}).limit(100);
    if(error){notify('회의 일정 조회 실패: '+error.message);return;}
    setScheduledMeetings(data||[]);
  };
  useEffect(()=>{if(section==='meetings'&&workspaceId)loadScheduledMeetings();},[section,workspaceId]);
  const scheduleMeeting=async()=>{
    const title=meetingTitle.trim();const startsAt=new Date(meetingTime);
    if(!title){notify('회의 제목을 입력해 주세요.');return;}
    if(!meetingTime||Number.isNaN(startsAt.getTime())||startsAt.getTime()<=Date.now()){notify('현재보다 나중인 회의 시간을 선택해 주세요.');return;}
    if(!supabase||!workspaceId||!currentUser||meetingBusy)return;
    setMeetingBusy(true);
    const {data,error}=await supabase.from('scheduled_meetings').insert({workspace_id:workspaceId,created_by:currentUser.id,title,starts_at:startsAt.toISOString()}).select('id,title,starts_at,meeting_code,created_by,created_at').single();
    setMeetingBusy(false);
    if(error){notify('회의 예약 실패: '+error.message);return;}
    setScheduledMeetings(v=>[...v,data].sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime()));
    setMeetingTime('');notify('회의를 예약했습니다.');
  };
  const cancelScheduledMeeting=async(id:string)=>{
    if(!supabase||!window.confirm('이 회의 예약을 취소하시겠습니까?'))return;
    const {error}=await supabase.from('scheduled_meetings').delete().eq('id',id);
    if(error){notify('회의 취소 실패: '+error.message);return;}
    setScheduledMeetings(v=>v.filter(m=>m.id!==id));notify('회의 예약을 취소했습니다.');
  };

  const openAttachDialog=async()=>{
    if(!supabase||!workspaceId)return;
    setAttachBusy(true);setAttachDialogOpen(true);
    const {data,error}=await supabase.from('workspace_files').select('id,file_name,mime_type,size_bytes,storage_path,uploaded_by,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100);
    setAttachBusy(false);
    if(error){notify('첨부할 파일 조회 실패: '+error.message);return;}
    setAttachableFiles(data||[]);
  };
  const attachWorkspaceFile=async(file:any)=>{
    if(!supabase||!currentUser||!channelIds[activeChannel]||attachBusy)return;
    const draft=message.trim();
    const content=[draft,'[NEXUS_FILE:'+file.id+']'].filter(Boolean).join('\\n');
    setAttachBusy(true);
    const {data,error}=await supabase.from('messages').insert({channel_id:channelIds[activeChannel],author_id:currentUser.id,content}).select('id,content,created_at,author_id').single();
    setAttachBusy(false);
    if(error){notify('파일 첨부 실패: '+error.message);return;}
    if(data)setMessages(v=>v.some(m=>m.id===data.id)?v:[...v,{id:data.id,name:'나',initials:'나',color:'orange',time:new Date(data.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),text:data.content,author_id:data.author_id}]);
    setMessage('');setAttachDialogOpen(false);notify('파일을 메시지에 첨부했습니다.');
  };
  const downloadWorkspaceFileById=async(id:string)=>{
    if(!supabase)return;
    const {data:file,error:fileError}=await supabase.from('workspace_files').select('file_name,storage_path').eq('id',id).maybeSingle();
    if(fileError||!file){notify('첨부 파일을 찾을 수 없습니다.');return;}
    const {data,error}=await supabase.storage.from('nexus-files').createSignedUrl(file.storage_path,60);
    if(error||!data?.signedUrl){notify('첨부 파일 다운로드 실패: '+(error?.message||'오류'));return;}
    const link=document.createElement('a');link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';link.download=file.file_name;document.body.appendChild(link);link.click();link.remove();
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

  return <div className={'app-shell theme-'+profile.theme_mode} style={{'--user-accent':profile.theme_color,'--theme-glow-a':themeSettings.glow_a,'--theme-glow-b':themeSettings.glow_b,'--theme-intensity':themeSettings.intensity+'%','--theme-blur':themeSettings.blur+'px','--theme-brightness':themeSettings.brightness+'%', '--theme-animated':themeSettings.animated?'1':'0',backgroundImage:profile.theme_background_url?'linear-gradient(115deg,rgba(8,12,21,.78),rgba(9,14,24,.62)),url("'+profile.theme_background_url+'")':undefined,backgroundSize:'cover',backgroundPosition:'center'} as any}>
    <aside className={`sidebar ${mobilePanel==='nav'?'mobile-open':''}`}>

      <button className="workspace-switch" onClick={()=>setWorkspaceMenuOpen(v=>!v)} aria-expanded={workspaceMenuOpen}><div className="workspace-icon">N<span>•</span></div><div><strong>{workspaces.find(w=>w.id===workspaceId)?.name||'NEXUS'}</strong><small>팀 작업 공간</small></div><ChevronDown size={16}/></button>{workspaceMenuOpen&&<div className="workspace-menu">{workspaces.map(w=><button key={w.id} className={w.id===workspaceId?'active':''} onClick={()=>switchWorkspace(w.id)}>{w.name}{w.id===workspaceId&&<Check size={14}/>}</button>)}<div className="workspace-create"><input value={workspaceDraft} onChange={e=>setWorkspaceDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createWorkspace()} placeholder="새 워크스페이스 이름" maxLength={80}/><button onClick={createWorkspace} disabled={workspaceBusy}><Plus size={14}/></button></div></div>}
      <button className="sidebar-search" onClick={()=>setSearchOpen(true)}><Search size={15}/><span>빠른 검색</span><kbd>Ctrl K</kbd></button>
      <div className="side-label">시작하기</div>
      <button className={`side-link ${section==='home'?'selected':''}`} onClick={()=>{setSection('home');setMobilePanel('none')}}><LayoutGrid size={17}/>홈 <span className="nav-hint">개요</span></button>
      <div className="side-label">소통</div>
      <button className={`side-link ${section==='messages'?'selected':''}`} onClick={()=>{setSection('messages');setMobilePanel('none')}}><MessageCircle size={17}/>채널 메시지</button>
      <button className={`side-link ${section==='dms'?'selected':''}`} onClick={()=>{setSection('dms');setMobilePanel('none')}}><Users size={17}/>개인 메시지</button>
      <button className={`side-link ${section==='community'?'selected':''}`} onClick={()=>{setSection('community');setMobilePanel('none')}}><Compass size={17}/>친구 및 멤버</button>
      <div className="side-label">협업 도구</div>
      <button className={`side-link ${section==='meetings'?'selected':''}`} onClick={()=>{setSection('meetings');setMobilePanel('none')}}><Video size={17}/>음성·영상 통화</button>
      <button className={`side-link ${section==='files'?'selected':''}`} onClick={()=>{setSection('files');setMobilePanel('none')}}><FolderOpen size={17}/>파일 보관함</button>
      <button className="side-link" onClick={()=>{setSettingsOpen(true);setMobilePanel('none')}}><Settings size={17}/>프로필 및 설정</button>
      {adminRole&&<><div className="side-label">관리</div><button className={`side-link admin-nav-link ${section==='admin'?'selected':''}`} onClick={()=>{setSection('admin');setMobilePanel('none')}}><ShieldCheck size={17}/>관리자 센터</button></>}
      <div className="side-label channels-label">채널 <button aria-label="채널 추가" onClick={()=>setChannelDialog(true)}><Plus size={15}/></button></div>
      {channels.map(ch=><button key={ch} className={`channel-link ${activeChannel===ch?'channel-active':''}`} onClick={()=>{setActiveChannel(ch);setSection('messages');setMobilePanel('none')}}><Hash size={15}/>{ch}</button>)}
      <div className="side-bottom"><div className="online-dot"/><span>실시간 접속</span><span className="online-text">{onlineCount}명</span></div>
    </aside>
    <nav className="mobile-bottom-nav" aria-label="주요 메뉴">
      <button className={section==='home'?'active':''} onClick={()=>setSection('home')}><LayoutGrid size={19}/><span>홈</span></button>
      <button className={section==='messages'?'active':''} onClick={()=>setSection('messages')}><MessageCircle size={19}/><span>채팅</span></button>
      <button className={section==='dms'?'active':''} onClick={()=>setSection('dms')}><Users size={19}/><span>DM</span></button>
      <button className={section==='meetings'?'active':''} onClick={()=>setSection('meetings')}><Video size={19}/><span>통화</span></button>
      <button onClick={()=>setMobilePanel(v=>v==='nav'?'none':'nav')} aria-expanded={mobilePanel==='nav'}><MoreHorizontal size={19}/><span>더보기</span></button>
    </nav>
    <button className={`mobile-scrim ${mobilePanel==='nav'?'visible':''}`} aria-label="메뉴 닫기" onClick={()=>setMobilePanel('none')}/>


    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={()=>setMobilePanel(mobilePanel==='nav'?'none':'nav')} aria-label="메뉴"><Command size={19}/></button>
        <div className="breadcrumbs"><span>NEXUS</span><span className="slash">/</span><strong>{section==='home'?'홈':section==='messages'?'#'+activeChannel:section==='dms'?'개인 메시지':section==='community'?'친구 및 멤버':section==='meetings'?'음성·영상 통화':section==='admin'?'관리자 센터':'파일 보관함'}</strong></div>
        <div className="top-actions"><button className="global-search" onClick={()=>setSearchOpen(true)}><Search size={16}/><span>무엇이든 검색하세요</span><kbd>Ctrl K</kbd></button><button className="icon-button" aria-label="알림" onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={18}/></button><button className="icon-button" aria-label="설정" onClick={()=>setSettingsOpen(true)}><Settings size={18}/></button></div>
      </header>

      {section==='home'?<section className="feature-page home-page">
        <div className="home-welcome"><div><div className="eyebrow">NEXUS WORKSPACE</div><h1>안녕하세요, {profile.display_name||currentUser?.name||'사용자'}님</h1><p>오늘 필요한 대화와 협업 도구를 한곳에서 시작하세요.</p></div><div className="home-status"><i/>{dbReady?'모든 서비스 연결됨':'서비스 연결 확인 중'}</div></div>
        <div className="home-metrics"><button onClick={()=>setSection('messages')}><span className="home-metric-icon"><MessageCircle size={18}/></span><strong>{channels.length}</strong><small>채널</small></button><button onClick={()=>setSection('community')}><span className="home-metric-icon"><Users size={18}/></span><strong>{members.length}</strong><small>워크스페이스 멤버</small></button><button onClick={()=>setSection('meetings')}><span className="home-metric-icon"><Activity size={18}/></span><strong>{onlineCount}</strong><small>현재 접속 중</small></button></div>
        <div className="home-section-title"><div><h2>빠른 실행</h2><p>자주 사용하는 기능으로 바로 이동합니다.</p></div></div>
        <div className="home-actions">
          <button className="home-action-card" onClick={()=>setSection('messages')}><span className="home-action-icon purple"><MessageCircle size={21}/></span><strong>채널에서 대화하기</strong><small>팀 채널에서 메시지를 주고받으세요.</small><b>열기 <span>→</span></b></button>
          <button className="home-action-card" onClick={()=>setSection('dms')}><span className="home-action-icon blue"><Users size={21}/></span><strong>개인 메시지</strong><small>친구나 동료와 1:1로 대화하세요.</small><b>열기 <span>→</span></b></button>
          <button className="home-action-card" onClick={()=>setSection('community')}><span className="home-action-icon green"><UserPlus size={21}/></span><strong>사람 초대하기</strong><small>친구를 찾고 워크스페이스에 초대하세요.</small><b>열기 <span>→</span></b></button>
          <button className="home-action-card" onClick={()=>setSection('meetings')}><span className="home-action-icon orange"><Video size={21}/></span><strong>통화 시작하기</strong><small>음성 또는 영상으로 바로 연결하세요.</small><b>열기 <span>→</span></b></button>
          <button className="home-action-card" onClick={()=>setSection('files')}><span className="home-action-icon teal"><FolderOpen size={21}/></span><strong>파일 공유하기</strong><small>자료를 업로드하고 함께 관리하세요.</small><b>열기 <span>→</span></b></button>
          <button className="home-action-card" onClick={()=>{setSettingsOpen(true)}}><span className="home-action-icon pink"><Settings size={21}/></span><strong>내 공간 꾸미기</strong><small>프로필과 테마를 원하는 대로 설정하세요.</small><b>열기 <span>→</span></b></button>
        </div>
        <div className="home-bottom-grid"><div className="section-card"><div className="card-title"><Hash size={18}/>내 채널 <span>{channels.length}개</span></div>{channels.slice(0,6).map(ch=><button className="home-channel-row" key={ch} onClick={()=>{setActiveChannel(ch);setSection('messages')}}><Hash size={15}/><span>{ch}</span><b>열기 →</b></button>)}</div><div className="section-card"><div className="card-title"><CircleHelp size={18}/>처음 사용하시나요?</div><p className="home-help-copy">① 채널을 열어 인사를 남겨보세요.<br/>② 친구 및 멤버 메뉴에서 사람을 찾아보세요.<br/>③ 통화나 파일 공유로 협업을 시작할 수 있습니다.</p><button className="secondary-action" onClick={()=>setSection('community')}>친구 및 멤버 보기</button></div></div>
      </section>:section==='admin'&&adminRole?<AdminPanel supabase={supabase} userId={currentUser?.id||''} role={adminRole} notify={notify}/>:section==='messages'?<div className="content-grid">
        <section className="chat-panel">
          <div className="panel-heading"><div><div className="eyebrow">CHANNEL</div><h1><Hash size={22}/>{activeChannel}</h1><p>팀의 대화와 아이디어를 나누는 공간입니다.</p></div><div className="heading-actions"><button className="icon-button" onClick={()=>setSection('community')} aria-label="멤버"><Users size={17}/></button><button className="icon-button" onClick={()=>setSearchOpen(true)} aria-label="검색"><Search size={17}/></button><button className="icon-button" onClick={()=>setChannelDialog(true)} aria-label="채널 추가"><Plus size={18}/></button></div></div>
          <div className="message-list">
            <div className="date-divider"><span>{dbReady?"실시간 서버 연결됨":"서버 연결 중"}</span></div>
            {messages.map(m=><article className={`message-row ${m.pinned_at?'message-pinned':''}`} key={m.id}><div className={`avatar ${m.color}`}>{m.initials}</div><div className="message-body"><div className="message-meta"><strong>{m.name}</strong><time>{m.time}</time>{m.edited_at&&<small className="message-edited">수정됨</small>}{m.pinned_at&&<span className="message-pin-label">📌 고정됨</span>}{m.name==='NEXUS AI'&&<span className="ai-tag">AI</span>}</div>{m.parent_message_id&&<div className="message-reply-ref">↳ {messages.find(x=>x.id===m.parent_message_id)?.name||'이전 메시지'}에게 답장</div>}{m.text.replace(/\[NEXUS_FILE:[^\]]+\]/g,'').trim()&&<p>{m.text.replace(/\[NEXUS_FILE:[^\]]+\]/g,'').trim()}</p>}{m.text.match(/\[NEXUS_FILE:([^\]]+)\]/)?.[1]&&<button className="message-attachment" onClick={()=>downloadWorkspaceFileById(m.text.match(/\[NEXUS_FILE:([^\]]+)\]/)![1])}><Paperclip size={14}/> 첨부 파일 다운로드</button>}<div className="message-actions"><button onClick={()=>{setReplyTo(m);setEditingMessageId(null);document.querySelector<HTMLInputElement>('.composer input')?.focus();}}>답장</button>{['👍','❤️','😂','🎉'].map(emoji=><button className={(m.reactions||[]).some(x=>x.user_id===currentUser?.id&&x.emoji===emoji)?'reaction-active':''} key={emoji} onClick={()=>toggleMessageReaction(m,emoji)}>{emoji} {(m.reactions||[]).filter(x=>x.emoji===emoji).length||''}</button>)}{m.author_id===currentUser?.id&&<button onClick={()=>togglePinMessage(m)}>{m.pinned_at?'고정 해제':'고정'}</button>}{m.author_id===currentUser?.id&&<><button onClick={()=>{setEditingMessageId(m.id);setReplyTo(null);setMessage(m.text);document.querySelector<HTMLInputElement>('.composer input')?.focus();}}>수정</button><button className="message-delete" onClick={()=>deleteMessage(m)}>삭제</button></>}</div></div></article>)}
          </div>
          <div className="composer-wrap">{(replyTo||editingMessageId)&&<div className="composer-context"><span>{editingMessageId?'메시지 수정 중':`${replyTo?.name||'사용자'}에게 답장 중`}</span><button onClick={()=>{setReplyTo(null);setEditingMessageId(null);setMessage('');}}>취소</button></div>}<div className="composer"><button className="attach-button" aria-label="파일 첨부" onClick={openAttachDialog}><Paperclip size={18}/></button><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendMessage()}} placeholder={`# ${activeChannel}에 메시지 보내기`} aria-label="메시지 입력"/><button className="composer-tool" aria-label="음성 및 화상 통화 열기" onClick={()=>setSection('meetings')}><Mic size={18}/></button><button className="send-button" onClick={sendMessage} aria-label="전송"><Send size={17}/></button></div><div className="composer-hint">Enter로 전송 · 서버 저장 및 실시간 동기화</div></div>
        </section>
        <aside className={`ai-panel ${mobilePanel==='ai'?'mobile-ai-open':''}`}>
          <div className="ai-header"><div className="ai-symbol"><Sparkles size={17}/></div><div><strong>NEXUS AI</strong><small>통합 AI 어시스턴트</small></div><button className="icon-button mobile-close" onClick={()=>setMobilePanel('none')} aria-label="닫기"><X size={17}/></button><span className="beta-pill">BETA</span></div>
          <div className="ai-content"><div className="ai-greeting"><div className="ai-orb"><Bot size={25}/></div><h2>무엇을 도와드릴까요?</h2><p>대화, 일정, 문서와 연결되는<br/>하나의 AI 작업 공간을 준비하고 있습니다.</p></div><div className="suggestion-title">이렇게 시작해 보세요</div><button className="suggestion" onClick={()=>setAiPrompt('오늘 대화 내용을 요약해 줘')}><MessageCircle size={16}/><span>오늘 대화 요약하기</span><span>↗</span></button><button className="suggestion" onClick={()=>setAiPrompt('팀 회의 안건을 작성해 줘')}><CalendarDays size={16}/><span>회의 안건 작성하기</span><span>↗</span></button><button className="suggestion" onClick={()=>setAiPrompt('NEXUS 개발 작업을 정리해 줘')}><ShieldCheck size={16}/><span>프로젝트 작업 정리하기</span><span>↗</span></button><div className="ai-response">{aiAnswer}</div></div>
          <div className="ai-input-wrap"><textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="NEXUS AI에게 요청하기..." rows={2}/><button onClick={askAi} aria-label="AI 요청 전송" disabled={aiBusy||!aiPrompt.trim()}><Send size={16}/></button><small>{aiBusy?'AI 답변 생성 중...':'서버에서 OpenAI 호환 AI API 호출 · 키는 브라우저에 노출되지 않습니다.'}</small></div>
        </aside>
      </div>:section==='dms'?<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">PRIVATE CONVERSATIONS</div><h1>다이렉트 메시지</h1><p>친구로 등록된 실제 사용자와 대화합니다.</p></div></div>
        <div className="dm-layout">
          <aside className="section-card dm-list"><div className="card-title"><MessageCircle size={18}/>대화 목록</div>
            {dmConversations.map(c=><button className={'dm-person '+(activeDm?.id===c.id?'selected':'')} key={c.id} onClick={()=>setActiveDm(c)}><div className={'avatar violet decoration-'+(c.person?.profile_decoration||'none')} style={c.person?.theme_color?{borderColor:c.person.theme_color}:undefined}>{c.person?.avatar_url?<img src={c.person.avatar_url}/>:((c.person?.display_name||'U').slice(0,1))}</div><div><strong>{c.person?.display_name||'사용자'}</strong><small>{c.person?.bio||'친구'}</small></div></button>)}
            {!dmConversations.length&&<div className="empty-state">친구를 추가한 뒤 친구 목록에서 DM을 시작하세요.</div>}
          </aside>
          <div className="section-card dm-chat">
            {activeDm?<><div className="dm-chat-head" style={{backgroundImage:activeDm.person?.banner_url?'linear-gradient(90deg,#101827e8,#101827b8),url("'+activeDm.person.banner_url+'")':undefined,backgroundSize:'cover',backgroundPosition:'center'}}><div className={'avatar violet decoration-'+(activeDm.person?.profile_decoration||'none')} style={activeDm.person?.theme_color?{borderColor:activeDm.person.theme_color}:undefined}>{activeDm.person?.avatar_url?<img src={activeDm.person.avatar_url}/>:((activeDm.person?.display_name||'U').slice(0,1))}</div><div><strong>{activeDm.person?.display_name||'친구'}</strong><small>비공개 대화</small></div><button className="secondary-action dm-ping-button" onClick={sendPing} title="상대방에게 핑 보내기"><Bell size={14}/> 핑</button><button className="primary-action dm-call-button" onClick={startDirectCall} title="상대방에게 통화 걸기"><Phone size={14}/> 통화</button></div>
              <div className="dm-message-list">{dmMessages.map(m=><div className={'dm-bubble-row '+(m.sender_id===currentUser?.id?'mine':'')} key={m.id}><div className="dm-bubble"><p>{m.content}</p><time>{new Date(m.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time>{m.sender_id===currentUser?.id&&<small className="dm-read-state">{m.read_at?'읽음':'전송됨'}</small>}</div></div>)}{!dmMessages.length&&<div className="empty-state">대화를 시작해 보세요.</div>}</div>
              <div className="dm-composer"><input value={dmDraft} onChange={e=>setDmDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendDm()} placeholder="메시지 입력..."/><button className="primary-action" onClick={sendDm}><Send size={16}/>전송</button></div>
            </>:<div className="empty-state dm-empty">왼쪽에서 대화를 선택하거나 커뮤니티에서 친구에게 DM을 보내세요.</div>}
          </div>
        </div>
      </section>:section==='community'?<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">PEOPLE & COMMUNITY</div><h1>친구</h1><p>사용자를 검색하고 친구 요청을 관리합니다.</p></div></div>
        <div className="section-card">
          <div className="card-title"><Users size={18}/>워크스페이스 멤버 <span>{members.length}명</span></div>
          {members.map(m=><div className="member-row role-member-row" key={m.user_id}><div className="avatar violet">{(m.person?.display_name||'U').slice(0,1)}</div><div className="role-member-main"><strong>{m.person?.display_name||'사용자'}</strong><small>{m.role==='owner'?'소유자':m.role==='admin'?'관리자':'멤버'}{(m.role_ids||[]).map((id:string)=>workspaceRoles.find(r=>r.id===id)?.name).filter(Boolean).map((n:string)=><span className="role-chip" key={n}>{n}</span>)}</small></div>{(members.some(x=>x.user_id===currentUser?.id&&['owner','admin'].includes(x.role))||members.some(x=>x.user_id===currentUser?.id&&(x.role_ids||[]).some((id:string)=>!!workspaceRoles.find(r=>r.id===id)?.permissions?.manage_roles)))&&m.role!=='owner'&&<div className="role-assignment">{workspaceRoles.map(role=><label key={role.id}><input type="checkbox" checked={(m.role_ids||[]).includes(role.id)} onChange={e=>assignWorkspaceRole(m.user_id,role.id,e.target.checked)}/><i style={{background:role.color}}/>{role.name}</label>)}</div>}</div>)}
        </div>
        {members.some(x=>x.user_id===currentUser?.id&&['owner','admin'].includes(x.role))&&<div className="section-card">
          <div className="card-title"><ShieldCheck size={18}/>서버 역할 및 권한</div>
          <p className="settings-note">역할을 만들고 멤버에게 여러 역할을 부여할 수 있습니다. 소유자와 관리자는 모든 권한을 가집니다.</p>
          <div className="role-create-form"><input aria-label="역할 이름" maxLength={32} placeholder="예: 모더레이터" value={roleDraft.name} onChange={e=>setRoleDraft(v=>({...v,name:e.target.value}))}/><input aria-label="역할 색상" type="color" value={roleDraft.color} onChange={e=>setRoleDraft(v=>({...v,color:e.target.value}))}/><button className="primary-action" disabled={roleBusy||!roleDraft.name.trim()} onClick={createWorkspaceRole}>{roleBusy?'생성 중...':'역할 만들기'}</button></div>
          <div className="role-permission-grid">{[{key:'manage_channels',label:'채널 관리'},{key:'manage_members',label:'멤버 관리'},{key:'manage_messages',label:'메시지 관리'},{key:'invite_members',label:'멤버 초대'},{key:'manage_roles',label:'역할 관리'}].map(p=><label key={p.key}><input type="checkbox" checked={!!roleDraft.permissions[p.key as keyof typeof roleDraft.permissions]} onChange={e=>setRoleDraft(v=>({...v,permissions:{...v.permissions,[p.key]:e.target.checked}}))}/>{p.label}</label>)}</div>
          <div className="workspace-role-list">{workspaceRoles.map(role=><div key={role.id}><span className="role-color-dot" style={{background:role.color}}/><strong>{role.name}</strong><small>{Object.entries(role.permissions).filter(([,v])=>v).length}개 권한</small><button className="secondary-action" onClick={async()=>{if(!window.confirm(role.name+' 역할을 삭제하시겠습니까?'))return;const {error}=await supabase!.from('workspace_roles').delete().eq('id',role.id);if(error){notify('역할 삭제 실패: '+error.message);return;}await loadWorkspacePeople();}}>삭제</button></div>)}</div>
        </div>}
        <div className="section-card join-link-card">
          <div className="card-title"><Link2 size={18}/>서버 초대 링크</div>
          <p className="settings-note">링크를 받은 사람은 로그인한 뒤 서버에 참여하고 공개 채널을 볼 수 있습니다. 링크는 7일 후 만료됩니다.</p>
          <button className="primary-action join-link-create" onClick={createWorkspaceJoinLink} disabled={joinLinkBusy||!workspaceId}>{joinLinkBusy?'생성 중...':'초대 링크 만들기 및 복사'}</button>
          {joinLink&&<div className="join-link-result"><input aria-label="서버 초대 링크" readOnly value={joinLink} onFocus={e=>e.currentTarget.select()}/><button className="secondary-action" onClick={copyWorkspaceJoinLink}><Copy size={15}/>복사</button><small>만료: {joinLinkExpires?new Date(joinLinkExpires).toLocaleString('ko-KR'):'7일 후'}</small></div>}
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
        <div className="feature-heading"><div><div className="eyebrow">VOICE & VIDEO</div><h1>회의 및 통화</h1><p>초대 코드로 연결하는 실시간 1:1 음성·화상 통화입니다.</p></div></div>
        {currentUser&&<CallRoom supabase={supabase} userId={currentUser.id} initialCreateCode={outgoingCallCode} initialJoinCode={incomingCallCode} onInitialCreateHandled={()=>setOutgoingCallCode('')} onInitialJoinHandled={()=>setIncomingCallCode('')} onOutgoingReady={handleOutgoingCallReady}/>}
        <div className="section-card schedule-card">
          <div className="card-title"><CalendarDays size={18}/>회의 예약</div>
          <div className="schedule-form"><input value={meetingTitle} onChange={e=>setMeetingTitle(e.target.value)} maxLength={120} placeholder="회의 제목"/><input type="datetime-local" value={meetingTime} onChange={e=>setMeetingTime(e.target.value)}/><button className="primary-action" onClick={scheduleMeeting} disabled={meetingBusy||!dbReady}>{meetingBusy?'저장 중...':'일정 추가'}</button></div>
          <div className="scheduled-list">{scheduledMeetings.map(m=><div className="scheduled-row" key={m.id}><div><strong>{m.title}</strong><small>{new Date(m.starts_at).toLocaleString('ko-KR')} · 코드 {m.meeting_code}</small></div><button className="secondary-action" onClick={async()=>{try{await navigator.clipboard.writeText(m.meeting_code);notify('회의 코드를 복사했습니다.')}catch{window.prompt('회의 코드',m.meeting_code)}}}><Copy size={14}/> 코드 복사</button>{m.created_by===currentUser?.id&&<button className="secondary-action" onClick={()=>cancelScheduledMeeting(m.id)}>취소</button>}</div>)}{scheduledMeetings.length===0&&<div className="empty-state">예약된 회의가 없습니다.</div>}</div>
        </div>
            </section>:<section className="feature-page">
        <div className="feature-heading"><div><div className="eyebrow">FILES & DOCUMENTS</div><h1>파일 및 문서</h1><p>워크스페이스 멤버와 파일을 공유합니다. 파일은 비공개 저장소에 보관됩니다.</p></div><button className="primary-action" disabled={filesBusy||!dbReady} onClick={()=>fileInput.current?.click()}><Upload size={16}/> {filesBusy?'업로드 중...':'파일 업로드'}</button></div>
        <input ref={fileInput} type="file" multiple hidden onChange={e=>addFiles(e.target.files)}/>
        <div className="upload-zone" onClick={()=>!filesBusy&&fileInput.current?.click()}><FolderOpen size={30}/><strong>{filesBusy?'파일을 업로드하고 있습니다':'파일을 선택하거나 여기를 누르세요'}</strong><span>최대 파일 크기 25MB · 로그인한 워크스페이스 멤버만 접근할 수 있습니다.</span></div>
        <div className="section-card"><div className="card-title"><FileText size={18}/>공유 파일 <span>{files.length}개</span></div>{files.length===0?<div className="empty-state">공유된 파일이 없습니다.</div>:files.map(file=><div className="file-row" key={file.id}><div className="file-type"><FileText size={17}/></div><div><strong>{file.file_name}</strong><small>{(file.size_bytes/1024/1024).toFixed(2)} MB · {new Date(file.created_at).toLocaleString('ko-KR')}</small></div><button className="secondary-action" onClick={()=>downloadWorkspaceFile(file)}>다운로드</button>{file.uploaded_by===currentUser?.id&&<button className="secondary-action" onClick={()=>deleteWorkspaceFile(file)}>삭제</button>}</div>)}</div>
      </section>}
      <footer className="status-footer"><span><i/>{serverApiReady?"시스템 연결됨":dbReady?"데이터베이스 연결됨":"연결 확인 중"}</span><span>SUPABASE · SEOUL</span><button onClick={()=>setMobilePanel('ai')}><Sparkles size={14}/> AI 패널 열기</button></footer>
    </main>

    {searchOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false)}}><div className="search-modal"><div className="search-input-row"><Search size={19}/><input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="메시지와 멤버 검색..."/><button onClick={()=>setSearchOpen(false)}><X size={18}/></button></div><div className="search-results"><div className="search-caption">전체 메시지 검색 · {searchBusy?'검색 중...':searchResults.length+'개'}</div>{searchResults.map(m=><button className="search-result" key={m.kind+'-'+m.id} onClick={()=>{if(m.kind==='channel'){const target=Object.entries(channelIds).find(([,id])=>id===m.channel_id);if(target){setActiveChannel(target[0]);setSection('messages');}}else{const target=dmConversations.find(c=>c.id===m.conversation_id);if(target){setActiveDm(target);setSection('dms');}}setSearchOpen(false);setSearchQuery('');}}><div className="avatar violet">{(m.author||'U').slice(0,1)}</div><div><strong>{m.author} · {m.location}</strong><p>{m.content}</p></div></button>)}{!searchBusy&&searchResults.length===0&&<div className="empty-state">{searchQuery.trim()?'검색 결과가 없습니다.':'검색어를 입력하세요.'}</div>}</div><div className="search-foot">ESC 닫기 · Ctrl K 검색 열기</div></div></div>}
    {settingsOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSettingsOpen(false)}}><div className="settings-modal"><div className="modal-title"><div><div className="eyebrow">PROFILE & APPEARANCE</div><h2>프로필 및 테마 꾸미기</h2></div><button className="icon-button" onClick={()=>setSettingsOpen(false)}><X/></button></div><div className="profile-editor">
          <div className="profile-custom-preview" style={{backgroundImage:profile.banner_url?`linear-gradient(90deg,#10182788,#10182722),url("${profile.banner_url}")`:undefined,borderColor:profile.theme_color}}><div className={'avatar profile-large decoration-'+profile.profile_decoration}>{profile.avatar_url?<img src={profile.avatar_url}/>:((profile.display_name||currentUser?.name||'N').slice(0,1))}</div><div><strong>{profile.display_name||currentUser?.name||'NEXUS 사용자'}</strong><small>{profile.status_text||profile.bio||'상태 메시지를 입력하세요.'}</small></div></div>
          <div className="profile-upload-grid"><button className="secondary-action" onClick={()=>avatarInput.current?.click()}><Upload size={14}/> 프로필 사진</button><button className="secondary-action" onClick={()=>bannerInput.current?.click()}><Upload size={14}/> 프로필 배너</button></div>
          <input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e=>uploadProfileImage('avatar',e.target.files?.[0])}/><input ref={bannerInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e=>uploadProfileImage('banner',e.target.files?.[0])}/>
          <label>표시 이름<input maxLength={40} value={profile.display_name} onChange={e=>setProfile(v=>({...v,display_name:e.target.value}))}/></label>
          <label>자기소개<textarea maxLength={160} rows={3} value={profile.bio} onChange={e=>setProfile(v=>({...v,bio:e.target.value}))} placeholder="자신을 소개해 보세요."/></label><label>현재 상태 메시지<input maxLength={80} value={profile.status_text} onChange={e=>setProfile(v=>({...v,status_text:e.target.value}))} placeholder="예: 게임 중 · 잠시 자리 비움"/></label>
          <label>프로필 장식<select value={profile.profile_decoration} onChange={e=>setProfile(v=>({...v,profile_decoration:e.target.value}))}><option value="none">기본</option><option value="glow">네온 글로우</option><option value="ring">컬러 링</option><option value="gold">골드</option></select></label>
          <label>테마 모드<select value={profile.theme_mode} onChange={e=>setProfile(v=>({...v,theme_mode:e.target.value}))}><option value="dark">다크</option><option value="light">라이트</option><option value="midnight">미드나이트</option></select></label>
          <label>포인트 색상<input type="color" value={profile.theme_color} onChange={e=>setProfile(v=>({...v,theme_color:e.target.value}))}/></label>
          <div className="theme-customizer"><div className="theme-customizer-title"><strong>배경 스타일 편집</strong><small>변경 사항은 프로필 저장 시 계정에 저장됩니다.</small></div><div className="theme-color-pair"><label>그라데이션 A<input type="color" value={themeSettings.glow_a} onChange={e=>setThemeSettings(v=>({...v,glow_a:e.target.value}))}/></label><label>그라데이션 B<input type="color" value={themeSettings.glow_b} onChange={e=>setThemeSettings(v=>({...v,glow_b:e.target.value}))}/></label></div><label className="theme-range">배경 효과 강도 <output>{themeSettings.intensity}%</output><input type="range" min="0" max="45" value={themeSettings.intensity} onChange={e=>setThemeSettings(v=>({...v,intensity:Number(e.target.value)}))}/></label><label className="theme-range">유리 블러 <output>{themeSettings.blur}px</output><input type="range" min="0" max="30" value={themeSettings.blur} onChange={e=>setThemeSettings(v=>({...v,blur:Number(e.target.value)}))}/></label><label className="theme-range">배경 밝기 <output>{themeSettings.brightness}%</output><input type="range" min="70" max="120" value={themeSettings.brightness} onChange={e=>setThemeSettings(v=>({...v,brightness:Number(e.target.value)}))}/></label><label className="theme-motion-toggle"><input type="checkbox" checked={themeSettings.animated} onChange={e=>setThemeSettings(v=>({...v,animated:e.target.checked}))}/> 은은한 배경 애니메이션</label></div>
          <div className="theme-image-row"><div><strong>내 사진으로 배경 만들기</strong><small>직접 촬영한 사진이나 갤러리 이미지를 테마 배경으로 사용합니다.</small></div><button className="secondary-action" onClick={()=>themeImageInput.current?.click()}><Upload size={14}/> 사진 선택</button></div>
          <input ref={themeImageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" capture="environment" hidden onChange={e=>uploadProfileImage('theme',e.target.files?.[0])}/>
          {profile.theme_background_url&&<button className="secondary-action full-action" onClick={()=>setProfile(v=>({...v,theme_background_url:''}))}>배경 사진 제거</button>}
          <button className="primary-action full-action" disabled={profileBusy} onClick={saveProfile}>{profileBusy?'저장 중...':'프로필 및 테마 저장'}</button>
          <button className="secondary-action full-action" onClick={async()=>{if(!('Notification' in window)){notify('이 브라우저는 알림을 지원하지 않습니다.');return;}const p=await Notification.requestPermission();notify(p==='granted'?'브라우저 알림이 허용되었습니다.':'알림 권한이 허용되지 않았습니다.')}}><Bell size={14}/> 브라우저 알림 허용</button>
          <button className="secondary-action full-action" onClick={enablePushNotifications}><Bell size={14}/> DM·핑·통화 백그라운드 푸시 등록</button>
          <div className="settings-note">브라우저 알림을 허용한 뒤 '백그라운드 시스템 푸시 등록'을 누르세요. 등록된 기기는 앱이 백그라운드에 있어도 DM, 핑, 통화 요청을 시스템 알림으로 받습니다. Android 설정에서 NEXUS 알림과 진동도 허용해야 합니다.</div>
          <button className="secondary-action full-action" disabled={logoutBusy} onClick={signOut}>{logoutBusy?'로그아웃 중...':'로그아웃'}</button>
        </div></div></div>}
    {notificationsOpen&&<div className="notification-pop"><div className="notification-title">알림<button onClick={()=>setNotificationsOpen(false)}><X size={15}/></button></div>{notifications.length?notifications.map(n=><button className={'notification-item '+(!n.read_at?'unread':'')} key={n.id} onClick={()=>{markNotificationRead(n.id);if(n.type==='call'){const code=(n.body.match(/초대 코드:\s*([A-Z0-9]{12,16})/i)||[])[1];if(code)setIncomingCallCode(code.toUpperCase());setSection('meetings');}else if(n.type==='ping'||n.type==='dm'){const conversation=dmConversations.find(c=>c.id===n.target_id);if(conversation)setActiveDm(conversation);setSection('dms');}if(n.type==='friend_request')setSection('community');setNotificationsOpen(false)}}><strong>{n.title}</strong><span>{n.body}</span><small>{new Date(n.created_at).toLocaleString('ko-KR')}</small></button>):<div className="empty-state">새로운 알림이 없습니다.</div>}</div>}
    {attachDialogOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setAttachDialogOpen(false)}}><div className="small-modal"><div className="modal-title"><h2>메시지에 파일 첨부</h2><button className="icon-button" onClick={()=>setAttachDialogOpen(false)}><X/></button></div>{attachBusy?<div className="empty-state">파일을 불러오고 있습니다...</div>:attachableFiles.length?attachableFiles.map(file=><div className="member-row" key={file.id}><div className="file-type"><FileText size={16}/></div><div><strong>{file.file_name}</strong><small>{(file.size_bytes/1024/1024).toFixed(2)} MB</small></div><button className="primary-action" disabled={attachBusy} onClick={()=>attachWorkspaceFile(file)}>첨부 및 전송</button></div>):<div className="empty-state">공유된 파일이 없습니다. 파일 페이지에서 먼저 업로드해 주세요.<button className="secondary-action" onClick={()=>{setAttachDialogOpen(false);setSection('files')}}>파일 페이지 열기</button></div>}</div></div>}{channelDialog&&<div className="modal-backdrop"><div className="small-modal"><div className="modal-title"><h2>채널 만들기</h2><button className="icon-button" onClick={()=>setChannelDialog(false)}><X/></button></div><label>채널 이름</label><input value={channelDraft} onChange={e=>setChannelDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addChannel()} placeholder="예: design-team"/><p>영문, 숫자, 한글, 하이픈을 사용할 수 있습니다.</p><button className="primary-action full-action" onClick={addChannel}><Plus size={16}/> 채널 생성</button></div></div>}
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
