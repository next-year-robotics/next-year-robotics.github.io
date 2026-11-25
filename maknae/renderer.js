// Layouts and calendar state adapted from the original Maknae presentation.
import { setupStory, startVideo } from './web.js';

const loadJSON = async path => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return response.json();
};
const [story, assetUrls] = await Promise.all([loadJSON('./story-data.json'), loadJSON('./media.json')]);
const {
  seedAmount: SEED_WON, seedDate: SEED, chartFrom: AX0, chartTo: AX1,
  balanceRange: MONEY, sections, phases: PHASES, capabilities: CAPS,
  slides: S, mediaLog: REC, nightLog: NIGHT,
} = story;
const INV = (key, home) => `assets/inventory/${home ? 'home' : 'bought'}/${key}.png`;
const dualReplay = S.find(slide => slide.lay === 'dual_sync')?.teleVid;

const day = s => new Date(s+'T00:00:00');
const DAYMS = 864e5;
const until = (arr,d) => {const t=day(d);return arr.reduce((a,[cd,n])=>a+(day(cd)<=t?n:0),0)};
const REC_MAX = REC.reduce((a,c)=>a+c[1],0);
const STATES = [];
(function build(){
  const s = {d:null,bal:0,spent:0,acc:0,income:0,cap:Object.fromEntries(CAPS.map(c=>[c[0],0])),stage:'',img:''};
  S.forEach(b=>{
    if(b.d){
      s.d=b.d;
      (b.tx||[]).forEach(([a,,k])=>{s.bal+=a;if(a<0)s.spent-=a;else if(k==='in'&&b.d!==SEED)s.income+=a;if(k==='acc')s.acc-=a});
      Object.assign(s.cap,b.cap||{});
      if(b.model){s.stage=b.model.name;s.img=b.model.img}
    }
    const lv = CAPS.reduce((a,c)=>a+s.cap[c[0]],0)/CAPS.length;
    STATES.push(JSON.parse(JSON.stringify({...s,level:lv,rec:s.d?until(REC,s.d):0,night:s.d?until(NIGHT,s.d):0})));
  });
})();

/* ═════════ 도우미 ═════════ */
const $ = id => document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs={},parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
const ease = t=>1-Math.pow(1-t,3);
const STATIC = matchMedia('(prefers-reduced-motion: reduce)').matches;
function tween(from,to,ms,fn){if(STATIC){fn(to);return}const t0=performance.now();function f(now){const k=Math.min(1,(now-t0)/ms);fn(from+(to-from)*ease(k));if(k<1)requestAnimationFrame(f)}requestAnimationFrame(f)}
const tweens={};
function countTo(id,to,fmt){const from=tweens[id]??to;tweens[id]=to;tween(from,to,800,v=>{const e=$(id);if(e)e.textContent=fmt(v)})}
const manU = v => (v<0?'−':'')+(Math.abs(v)/1e4).toFixed(1).replace(/\.0$/,'')+'만';
const won = v => Math.abs(Math.round(v)).toLocaleString('ko-KR');
const u = src => assetUrls[src];
const fmtDate = d => {const t=day(d);return `${t.getFullYear()}. ${t.getMonth()+1}. ${t.getDate()}.`};
const isPhoto = src => src.startsWith('photos/');

function monoPath(pts){
  const n=pts.length;if(n<2)return '';
  const x=pts.map(p=>p[0]),y=pts.map(p=>p[1]),dx=[],m=[],t=new Array(n);
  for(let i=0;i<n-1;i++){dx[i]=x[i+1]-x[i];m[i]=(y[i+1]-y[i])/dx[i]}
  t[0]=m[0];t[n-1]=m[n-2];
  for(let i=1;i<n-1;i++)t[i]=m[i-1]*m[i]<=0?0:(m[i-1]+m[i])/2;
  for(let i=0;i<n-1;i++){if(m[i]===0){t[i]=0;t[i+1]=0;continue}
    const a=t[i]/m[i],b=t[i+1]/m[i],h=a*a+b*b;if(h>9){const k=3/Math.sqrt(h);t[i]=k*a*m[i];t[i+1]=k*b*m[i]}}
  let d=`M${x[0]},${y[0]}`;
  for(let i=0;i<n-1;i++){const h=dx[i]/3;d+=`C${x[i]+h},${y[i]+t[i]*h} ${x[i+1]-h},${y[i+1]-t[i+1]*h} ${x[i+1]},${y[i+1]}`}
  return d;
}

/* ═════════ 슬라이드 조각 ═════════ */
function stampHTML(st){
  if(!st)return '';
  const ic=st[2]?`<img loading="lazy" decoding="async" src="${u(`assets/gen/${st[2]}-256.webp`)}" alt="">`:'';
  return `<div class="stamp"><div class="sh">${ic}<b>${st[0]}</b></div><span>${st[1]}</span></div>`;
}

function vidHTML(src, opts = {}) {
  const {once = false, sound = false, manual: userStarts = false} = typeof opts === 'boolean' ? {once: opts} : opts;
  const poster = src.replace(/\.mp4$/i, '.jpg');
  const manual = userStarts || sound || src === dualReplay;
  const label = sound ? '소리와 함께 재생' : '영상 재생';
  return `<div class="vid-wrap web-player"><video data-src="${u(src)}" data-poster="${u(poster)}" playsinline muted preload="none" ${once || manual ? '' : 'loop'} ${manual ? 'data-manual' : ''} ${sound ? 'data-sound="1"' : ''}></video><button type="button" class="aud-btn" data-player-button>${label}</button></div>`;
}

function gridHTML(cfg, stamp){
  const gcls = {'2h':'g-2h','2v':'g-2v','1+2':'g-12','2x2':'g-2x2','top+2':'g-top2','hero':'g-hero','2w':'g-2w'}[cfg.grid] || 'g-2h';
  const cells = cfg.items.map(([src,cap,mode,win])=>{
    const isVid = /\.mp4$/i.test(src);
    const pr = mode==='shot'||mode==='contain'||mode==='dark' ? '' : (isPhoto(src)?'print':'');
    const ct = mode==='contain' ? 'contain' : (mode==='dark' ? 'dark' : '');
    const wAttr = win ? ` data-win="${win}"` : '';
    const body = isVid ? vidHTML(src) : `<img loading="lazy" decoding="async" src="${u(src)}"${wAttr} alt="">`;
    const m = cap && cap.match(/^([①②③④])\s*(.*)$/);
    const capH = cap ? `<figcaption>${m?`<i>${m[1]}</i><span>${m[2]}</span>`:`<span>${cap}</span>`}</figcaption>` : '';
    return `<figure class="mc ${pr} ${ct}"><div class="mf">${body}</div>${capH}</figure>`;
  }).join('');
  return `<div class="mgrid ${gcls}">${cells}${stampHTML(stamp)}</div>`;
}

function mediaHTML(m,stamp,cls=''){
  if(!m)return '';
  if(!Array.isArray(m) && m.grid) return gridHTML(m, stamp);
  const [src,cap,flag]=m;let inner,kind='shot';const st=stampHTML(stamp);
  if(Array.isArray(src)) inner=`<div class="gal">${src.map(([s,a])=>`<img loading="lazy" decoding="async" src="${u(s)}" style="flex:${a}" alt="">`).join('')}</div>`;
  else if(!src) return `<figure class="media empty ${cls}"><div class="box">${cap}${st}</div></figure>`;
  else{
    if(isPhoto(src))kind='print';
    if(/\.mp4$/i.test(src)) inner=vidHTML(src,{sound:flag==='sound',once:flag==='once',manual:flag==='manual'});
    else inner=`<img loading="lazy" decoding="async" src="${u(src)}" alt="">`;
  }
  return `<figure class="media ${kind} ${cls}"><div class="box">${inner}${cap?`<figcaption>${cap}</figcaption>`:''}${st}</div></figure>`;
}

function orderCardHTML(o, stamp){
  const items = o.items.map(([ic,nm,sp,pr])=>`
    <div class="oitem"><img loading="lazy" decoding="async" src="${u(ic)}" alt=""><div class="oi"><div class="on">${nm}</div><div class="os">${sp}</div></div><div class="op">${pr}</div></div>`).join('');
  const extra = o.extra ? `<div class="oextra">${o.extra.map(([k,v])=>`<div><b>${k}</b>${v}</div>`).join('')}</div>` : '';
  const note = o.note ? `<div class="onote"><span>${o.note[0]}</span><span>${o.note[1]}</span></div>` : '';
  return `<div class="ocard ${o.acc?'acc':''}">
    <div class="oh"><div><div class="meta"><span class="tag ${o.acc?'red':''}">${o.badge}</span><span>${o.date}</span></div><div class="shop">${o.shop}</div></div>
      <div class="tot"><small>결제 합계</small><b>${o.total}</b></div></div>
    <div class="oitems">${items}</div>${extra}${note}${stampHTML(stamp)}
  </div>`;
}

const ptsHTML = (pts,cls='') => pts?`<dl class="pts ${cls}">${pts.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`:'';
const head = s => `<h3 class="t">${s.t}</h3>${s.b?`<p class="lead">${s.b}</p>`:''}`;
const tableHTML = (s,cls='') => `<table class="cmp ${cls}"><thead><tr>${s.head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${s.rows.map(r=>`<tr>${r.map(c=>`<td>${/\.(png|webp|jpg|svg)$/i.test(c)?`<img loading="lazy" decoding="async" src="${u(c)}" alt="">`:c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

/* ═════════ 기술 아키텍처 인라인 SVG 4종 (방향 B: 종이·먹·주홍) ═════════ */
function svgRosGraph(){
  return `<svg class="arch-svg" viewBox="0 0 1680 650" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard, sans-serif">
    <defs>
      <marker id="arr-k" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#1F1C19"/></marker>
      <marker id="arr-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#D93A24"/></marker>
    </defs>
    <!-- 영역 박스 -->
    <rect x="14" y="14" width="320" height="430" fill="#F3EEE3" stroke="#1F1C19" stroke-width="1.5" stroke-dasharray="6 4"/>
    <text x="28" y="38" font-size="14" font-weight="800" fill="#D93A24" font-family="Paperlogy">1. SENSORS &amp; PERCEPTION</text>

    <rect x="366" y="14" width="440" height="430" fill="#F3EEE3" stroke="#1F1C19" stroke-width="1.5" stroke-dasharray="6 4"/>
    <text x="380" y="38" font-size="14" font-weight="800" fill="#D93A24" font-family="Paperlogy">2. BEHAVIOR &amp; SAFETY ARBITRATION</text>

    <rect x="838" y="14" width="415" height="430" fill="#F3EEE3" stroke="#1F1C19" stroke-width="1.5" stroke-dasharray="6 4"/>
    <text x="852" y="38" font-size="14" font-weight="800" fill="#D93A24" font-family="Paperlogy">3. BASE &amp; SENSOR FUSION (EKF)</text>

    <rect x="1285" y="14" width="380" height="430" fill="#fff5f3" stroke="#D93A24" stroke-width="2"/>
    <text x="1300" y="38" font-size="14" font-weight="800" fill="#D93A24" font-family="Paperlogy">4. STM32F446RE (micro-ROS UART)</text>

    <rect x="14" y="470" width="1651" height="166" fill="#F3EEE3" stroke="#1F1C19" stroke-width="1.5"/>
    <text x="30" y="495" font-size="14" font-weight="800" fill="#1F1C19" font-family="Paperlogy">5. MISSION · CARE SERVICES · BOOTH BRIDGE (ROS 2 ↔ App / Cloud / Avatar)</text>

    <!-- 노드: 1. Sensors -->
    <g fill="#FBF8F1" stroke="#1F1C19" stroke-width="2">
      <rect x="30" y="56" width="290" height="66" rx="3"/>
      <rect x="30" y="152" width="290" height="66" rx="3"/>
      <rect x="30" y="248" width="290" height="66" rx="3"/>
      <rect x="30" y="346" width="290" height="66" rx="3"/>
    </g>
    <text x="44" y="82" font-size="17" font-weight="800" fill="#1F1C19">usb_cam (C920)</text>
    <text x="44" y="106" font-size="12" fill="#58524a" font-family="monospace">/camera/image_raw (720p30 SHM)</text>
    <text x="44" y="178" font-size="16.5" font-weight="800" fill="#1F1C19">aruco_tracker → marker_track</text>
    <text x="44" y="202" font-size="12" fill="#58524a" font-family="monospace">/aruco_detections → /marker_track</text>
    <text x="44" y="274" font-size="17" font-weight="800" fill="#1F1C19">sllidar_node (RPLIDAR C1)</text>
    <text x="44" y="298" font-size="12" fill="#58524a" font-family="monospace">/scan (360°, 12 m, laser_link)</text>
    <text x="44" y="372" font-size="16.5" font-weight="800" fill="#1F1C19">joy_linux → teleop_twist_joy</text>
    <text x="44" y="396" font-size="12" fill="#58524a" font-family="monospace">Xbox 패드 수동 (prio 100 · LB/RB)</text>

    <!-- 노드: 2. Arbitration -->
    <g fill="#FBF8F1" stroke="#1F1C19" stroke-width="2">
      <rect x="382" y="54" width="204" height="58" rx="3" stroke="#D93A24" stroke-width="2.5" fill="#fff5f3"/>
      <rect x="382" y="130" width="204" height="58" rx="3"/>
      <rect x="382" y="206" width="204" height="64" rx="3" stroke="#D93A24" stroke-width="2"/>
      <rect x="382" y="288" width="204" height="58" rx="3"/>
      <rect x="382" y="364" width="204" height="58" rx="3"/>
    </g>
    <text x="396" y="79" font-size="16" font-weight="800" fill="#D93A24">/safety/lock (E-Stop)</text>
    <text x="396" y="100" font-size="12" fill="#D93A24" font-family="monospace">prio 255 · 최우선 잠금</text>
    <text x="396" y="155" font-size="16" font-weight="800">align / errand_nav</text>
    <text x="396" y="176" font-size="12" fill="#58524a" font-family="monospace">prio 60 · 마커 정렬·복귀</text>
    <text x="396" y="232" font-size="16" font-weight="800" fill="#D93A24">Nav2 (A* · RPP · CM)</text>
    <text x="396" y="253" font-size="11.5" fill="#58524a" font-family="monospace">prio 55 · /cmd_vel_nav</text>
    <text x="396" y="313" font-size="16" font-weight="800">follow_node</text>
    <text x="396" y="334" font-size="11.5" fill="#58524a" font-family="monospace">prio 50 · /cmd_vel_follow</text>
    <text x="396" y="389" font-size="16" font-weight="800">slam_toolbox</text>
    <text x="396" y="410" font-size="12" fill="#58524a" font-family="monospace">/map · TF map → odom</text>

    <!-- twist_mux 핵심 박스 -->
    <rect x="624" y="90" width="168" height="278" rx="4" fill="#1F1C19" stroke="#D93A24" stroke-width="3"/>
    <text x="708" y="124" text-anchor="middle" font-size="21" font-weight="800" fill="#FBF8F1" font-family="Paperlogy">twist_mux</text>
    <text x="708" y="146" text-anchor="middle" font-size="12.5" fill="#FFD6CE" font-family="monospace">use_stamped: true</text>
    <line x1="638" y1="162" x2="778" y2="162" stroke="#58524a" stroke-dasharray="3 3"/>
    <text x="640" y="190" font-size="13.5" font-weight="700" fill="#FF8C7A">255  E-Stop Lock</text>
    <text x="640" y="218" font-size="13.5" font-weight="700" fill="#FBF8F1">100  Xbox Teleop</text>
    <text x="640" y="246" font-size="13.5" fill="#d8cfbf"> 60  Align / Marker</text>
    <text x="640" y="274" font-size="13.5" font-weight="700" fill="#FF9C8A"> 55  Nav2 (A*·RPP)</text>
    <text x="640" y="302" font-size="13.5" fill="#d8cfbf"> 50  ArUco Follow</text>
    <text x="708" y="346" text-anchor="middle" font-size="12" fill="#9a9286">timeout 0.3~0.5 s → 정지</text>

    <!-- 노드: 3. Base & EKF -->
    <g fill="#FBF8F1" stroke="#1F1C19" stroke-width="2">
      <rect x="856" y="60" width="380" height="72" rx="3" stroke="#D93A24" stroke-width="2.5"/>
      <rect x="856" y="164" width="182" height="76" rx="3"/>
      <rect x="1054" y="164" width="182" height="76" rx="3"/>
      <rect x="856" y="278" width="380" height="74" rx="3" fill="#1F1C19"/>
      <rect x="856" y="372" width="380" height="52" rx="3"/>
    </g>
    <text x="872" y="88" font-size="17.5" font-weight="800" fill="#D93A24">micro_ros_agent (UART0)</text>
    <text x="872" y="114" font-size="12.5" fill="#58524a" font-family="monospace">/dev/ttyAMA0 · 921,600 bps · RTT 2.54 ms</text>
    <text x="870" y="192" font-size="16" font-weight="800">mr_base (odom)</text>
    <text x="870" y="214" font-size="12" fill="#58524a" font-family="monospace">50 Hz · /odom (vx)</text>
    <text x="870" y="230" font-size="11.5" fill="#8d8579">r=49.8mm, L=309.1mm</text>
    <text x="1068" y="192" font-size="16" font-weight="800">mr_imu</text>
    <text x="1068" y="214" font-size="12" fill="#58524a" font-family="monospace">100 Hz · /imu/data</text>
    <text x="1068" y="230" font-size="11.5" fill="#8d8579">공분산 6e-8 (vyaw)</text>
    <text x="872" y="308" font-size="17.5" font-weight="800" fill="#FBF8F1">ekf_filter_node (robot_localization)</text>
    <text x="872" y="334" font-size="12" fill="#FFD6CE" font-family="monospace">30 Hz /odometry/filtered · odom→base_footprint</text>
    <text x="872" y="396" font-size="15" font-weight="800" fill="#1F1C19">robot_state_publisher</text>
    <text x="872" y="414" font-size="11.5" fill="#58524a" font-family="monospace">URDF TF: base_link → cam / imu / laser</text>

    <!-- 노드: 4. STM32 -->
    <g fill="#FBF8F1" stroke="#1F1C19" stroke-width="2">
      <rect x="1310" y="64" width="330" height="76" rx="3" stroke="#D93A24" stroke-width="2.5"/>
      <rect x="1310" y="168" width="330" height="70" rx="3"/>
      <rect x="1310" y="264" width="330" height="64" rx="3"/>
      <rect x="1310" y="352" width="330" height="70" rx="3"/>
    </g>
    <text x="1326" y="92" font-size="18" font-weight="800" fill="#D93A24">ControlTask (100 Hz · TIM6)</text>
    <text x="1326" y="118" font-size="13.5" fill="#58524a">PI+FF (오차 0.137%) → TIM1 18 kHz PWM</text>
    <text x="1326" y="196" font-size="17" font-weight="800">TIM2/3 ×4 Encoders (IC1F=4)</text>
    <text x="1326" y="220" font-size="13" fill="#58524a" font-family="monospace">→ /joint_states (50 Hz)</text>
    <text x="1326" y="290" font-size="17" font-weight="800">ICM-42688-P (SPI2 + EXTI0)</text>
    <text x="1326" y="313" font-size="13" fill="#58524a" font-family="monospace">→ /imu/data_raw (100 Hz)</text>
    <text x="1326" y="378" font-size="17" font-weight="800">ADC1+VREFINT · IWDG</text>
    <text x="1326" y="402" font-size="13" fill="#58524a" font-family="monospace">→ /battery_voltage · 200ms cmd WD</text>

    <!-- 노드: 5. Mission / Care / Booth -->
    <g fill="#FBF8F1" stroke="#1F1C19" stroke-width="2">
      <rect x="38" y="514" width="340" height="102" rx="3"/>
      <rect x="438" y="514" width="370" height="102" rx="3"/>
      <rect x="868" y="514" width="360" height="102" rx="3"/>
      <rect x="1288" y="514" width="352" height="102" rx="3" stroke="#D93A24" stroke-width="2.5"/>
    </g>
    <text x="56" y="544" font-size="18" font-weight="800">mr_phone_bridge (WS :8765)</text>
    <text x="56" y="570" font-size="14" fill="#58524a">Android 앱 ↔ phone-bridge/1 JSON</text>
    <text x="56" y="594" font-size="13" fill="#D93A24" font-family="monospace">/cmd_vel 발행 금지 (명령만 전달)</text>

    <text x="456" y="544" font-size="18" font-weight="800">mr_mission (Trip · SafetyMonitor)</text>
    <text x="456" y="570" font-size="14" fill="#58524a">외출 상태머신 · 마커 10초 유실 → SOS</text>
    <text x="456" y="594" font-size="13" fill="#58524a" font-family="monospace">/follow/enable · /care/sos_request</text>

    <text x="886" y="544" font-size="18" font-weight="800">mr_care_telemetry (Outbox)</text>
    <text x="886" y="570" font-size="14" fill="#58524a">오프라인 SQLite 큐 → Firebase RTDB</text>
    <text x="886" y="594" font-size="13" fill="#58524a" font-family="monospace">보호자 PWA 실시간 상태 · 웹 푸시</text>

    <text x="1306" y="544" font-size="18" font-weight="800" fill="#D93A24">booth bridge (노트북 · DDS)</text>
    <text x="1306" y="570" font-size="14" fill="#58524a">BEST_EFFORT 구독 → 3D 트윈 · 아바타</text>
    <text x="1306" y="594" font-size="13" fill="#58524a" font-family="monospace">ElevenLabs 도구 → errand_nav + SO-101</text>

    <!-- 화살표들 (교차 없이 깔끔한 라우팅) -->
    <g fill="none" stroke="#1F1C19" stroke-width="2.2" marker-end="url(#arr-k)">
      <path d="M175,122 L175,148"/>
      <path d="M320,185 L378,178"/>
      <path d="M320,185 L350,185 L350,316 L378,316"/>
      <path d="M320,281 L344,281 L344,392 L378,392"/>
      <path d="M320,281 L362,281 L362,238 L378,238"/>
      <path d="M320,382 L354,382 L354,432 L708,432 L708,372"/>
      <path d="M586,159 L606,159 L606,242 L620,242"/>
      <path d="M586,238 L602,238 L602,270 L620,270"/>
      <path d="M586,316 L608,316 L608,298 L620,298"/>
      <path d="M947,132 L947,160"/>
      <path d="M1145,132 L1145,160"/>
      <path d="M947,240 L947,274"/>
      <path d="M1145,240 L1145,274"/>
      <path d="M378,565 L434,565"/>
      <path d="M808,565 L864,565"/>
      <path d="M1228,565 L1284,565"/>
    </g>
    <!-- 주홍 핵심 제어 화살표 -->
    <g fill="none" stroke="#D93A24" stroke-width="3" marker-end="url(#arr-r)">
      <path d="M586,88 L608,88 L608,204 L620,204"/>
      <path d="M790,192 L820,192 L820,96 L852,96"/>
      <path d="M1236,96 L1306,96"/>
    </g>
    <text x="803" y="88" font-size="12.5" font-weight="700" fill="#D93A24" font-family="monospace">/cmd_vel</text>
    <text x="1246" y="86" font-size="12.5" font-weight="700" fill="#D93A24" font-family="monospace">UART0</text>
  </svg>`;
}

function svgMcuRtos(){
  return `<svg class="arch-svg" viewBox="0 0 820 620" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard, sans-serif">
    <defs>
      <marker id="mk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#1F1C19"/></marker>
      <marker id="mr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#D93A24"/></marker>
    </defs>
    <!-- 헤더 배너 -->
    <rect x="8" y="8" width="804" height="44" fill="#1F1C19"/>
    <text x="24" y="36" font-size="17" font-weight="800" fill="#FBF8F1" font-family="Paperlogy">STATIC FREERTOS (configSUPPORT_DYNAMIC_ALLOCATION = 0 · heap_4 제거)</text>

    <!-- 왼쪽: 하드웨어 ISR / 주변장치 -->
    <text x="14" y="80" font-size="14" font-weight="800" fill="#D93A24" font-family="Paperlogy">HW PERIPHERALS / ISR</text>
    <g fill="#F3EEE3" stroke="#1F1C19" stroke-width="1.8">
      <rect x="12" y="94" width="215" height="92" rx="3"/>
      <rect x="12" y="216" width="215" height="84" rx="3"/>
      <rect x="12" y="330" width="215" height="92" rx="3"/>
      <rect x="12" y="452" width="215" height="92" rx="3" stroke="#D93A24" stroke-width="2.2"/>
    </g>
    <text x="24" y="120" font-size="16" font-weight="800" fill="#D93A24">TIM6 100 Hz ISR</text>
    <text x="24" y="143" font-size="13" fill="#58524a">10.0 ms 하드웨어 틱</text>
    <text x="24" y="164" font-size="12.5" fill="#1F1C19" font-family="monospace">xTaskNotifyFromISR()</text>
    <text x="24" y="180" font-size="12" fill="#8d8579">기동 지연 14~18.5 µs</text>

    <text x="24" y="242" font-size="16" font-weight="800">SPI2 + EXTI0 DRDY</text>
    <text x="24" y="264" font-size="13" fill="#58524a">ICM-42688-P (2.625 MHz)</text>
    <text x="24" y="286" font-size="12.5" fill="#1F1C19" font-family="monospace">DWT 타임스탬프 −12.9 ms</text>

    <text x="24" y="356" font-size="16" font-weight="800">USART1 Circular DMA</text>
    <text x="24" y="378" font-size="13" fill="#58524a">RPi5 GPIO UART0 직결</text>
    <text x="24" y="402" font-size="12.5" fill="#1F1C19" font-family="monospace">921,600 bps · 0 errors</text>

    <text x="24" y="478" font-size="16" font-weight="800" fill="#D93A24">ADC1 + IWDG (LSI)</text>
    <text x="24" y="500" font-size="13" fill="#58524a">PA4 분압 6.02 + VREFINT</text>
    <text x="24" y="524" font-size="12.5" fill="#D93A24" font-family="monospace">Prescaler 32 · Reload 250</text>

    <!-- 중앙: 4 Static Tasks -->
    <text x="284" y="80" font-size="14" font-weight="800" fill="#D93A24" font-family="Paperlogy">4 STATIC TASKS (우선순위별)</text>
    <rect x="282" y="94" width="290" height="106" rx="4" fill="#1F1C19" stroke="#D93A24" stroke-width="2.5"/>
    <text x="298" y="122" font-size="18" font-weight="800" fill="#FBF8F1">ControlTask <tspan fill="#FF8C7A" font-size="14">P5 (최고)</tspan></text>
    <text x="298" y="146" font-size="13.5" fill="#d8cfbf">TIM2/3 ×4 엔코더 읽기 → PI + FF</text>
    <text x="298" y="168" font-size="13.5" fill="#FFD6CE">WCET 46.7 µs (주기의 0.47%)</text>
    <text x="298" y="188" font-size="12.5" fill="#9a9286">21분 연속 loop_overruns = 0</text>

    <rect x="282" y="216" width="290" height="84" rx="4" fill="#FBF8F1" stroke="#1F1C19" stroke-width="2"/>
    <text x="298" y="243" font-size="17" font-weight="800">ImuTask <tspan fill="#D93A24" font-size="13.5">P4</tspan></text>
    <text x="298" y="266" font-size="13.5" fill="#58524a">100 Hz 6축 수집 · 정지 바이어스 제거</text>
    <text x="298" y="287" font-size="12.5" fill="#8d8579" font-family="monospace">→ len-1 overwrite mailbox</text>

    <rect x="282" y="330" width="290" height="92" rx="4" fill="#FBF8F1" stroke="#1F1C19" stroke-width="2"/>
    <text x="298" y="356" font-size="17" font-weight="800">MicroRosTask <tspan fill="#58524a" font-size="13.5">P3</tspan></text>
    <text x="298" y="378" font-size="13.5" fill="#58524a">전용 8 KiB static_pool · 세션 재연결</text>
    <text x="298" y="400" font-size="12.5" fill="#1F1C19" font-family="monospace">/cmd_vel ↔ /joint_states · /imu</text>

    <rect x="282" y="452" width="290" height="92" rx="4" fill="#fff5f3" stroke="#D93A24" stroke-width="2"/>
    <text x="298" y="478" font-size="17" font-weight="800" fill="#D93A24">HealthTask <tspan font-size="13.5">P4 (50 ms)</tspan></text>
    <text x="298" y="500" font-size="13.5" fill="#58524a">Control heartbeat 감시 · 스택 워터마크</text>
    <text x="298" y="524" font-size="13" fill="#D93A24" font-weight="700">스톨 시 MOE OFF + 300.2 ms IWDG 리셋</text>

    <!-- 오른쪽: 출력 & 진단 -->
    <text x="614" y="80" font-size="14" font-weight="800" fill="#D93A24" font-family="Paperlogy">ACTUATION &amp; SAFETY</text>
    <g fill="#F3EEE3" stroke="#1F1C19" stroke-width="1.8">
      <rect x="612" y="94" width="196" height="106" rx="3" stroke="#D93A24" stroke-width="2.2"/>
      <rect x="612" y="232" width="196" height="106" rx="3"/>
      <rect x="612" y="370" width="196" height="174" rx="3"/>
    </g>
    <text x="626" y="122" font-size="16" font-weight="800" fill="#D93A24">TIM1 18 kHz PWM</text>
    <text x="626" y="145" font-size="13" fill="#58524a">4,667 스텝 고해상도</text>
    <text x="626" y="166" font-size="13" fill="#58524a">→ Cytron MDD3A</text>
    <text x="626" y="186" font-size="12.5" fill="#D93A24" font-weight="700">BDTR.MOE 즉시 차단</text>

    <text x="626" y="260" font-size="16" font-weight="800">길이-1 Mailbox</text>
    <text x="626" y="284" font-size="13" fill="#58524a">속도 명령 덮어쓰기</text>
    <text x="626" y="304" font-size="13" fill="#58524a">상태 스냅샷 전송</text>
    <text x="626" y="324" font-size="13" fill="#58524a">IMU 큐 (lock-free)</text>

    <text x="626" y="398" font-size="16" font-weight="800">비침습 진단</text>
    <text x="626" y="422" font-size="13" fill="#58524a">• SWD 핫플러그 RAM</text>
    <text x="626" y="444" font-size="13" fill="#58524a">  실시간 메트릭 덤프</text>
    <text x="626" y="468" font-size="13" fill="#58524a">• USART2 230,400</text>
    <text x="626" y="490" font-size="13" fill="#58524a">  독립 디버그 콘솔</text>
    <text x="626" y="514" font-size="13" fill="#1F1C19" font-weight="700">• HSE 3초 대기 부팅</text>

    <!-- 화살표 -->
    <g fill="none" stroke="#1F1C19" stroke-width="2" marker-end="url(#mk)">
      <path d="M227,258 L278,258"/>
      <path d="M227,376 L278,376"/>
      <path d="M427,300 L427,326"/>
      <path d="M572,258 L608,274"/>
      <path d="M572,376 L608,308"/>
    </g>
    <g fill="none" stroke="#D93A24" stroke-width="2.6" marker-end="url(#mr)">
      <path d="M227,140 L278,140"/>
      <path d="M572,146 L608,146"/>
      <path d="M227,498 L278,498"/>
      <path d="M427,452 L427,432 L252,432 L252,175 L278,175"/>
    </g>

    <!-- 하단 요약 -->
    <rect x="8" y="564" width="804" height="48" fill="#F3EEE3" stroke="#1F1C19" stroke-width="1.5"/>
    <text x="26" y="594" font-size="15.5" fill="#1F1C19"><tspan font-weight="800" fill="#D93A24">핵심 실측:</tspan>  PI+FF 속도 오차 <tspan font-weight="800">0.137%</tspan>  ·  배터리 ADC 오차 <tspan font-weight="800">+0.3%</tspan>  ·  UART 유실 <tspan font-weight="800">0건</tspan>  ·  런타임 malloc <tspan font-weight="800">0 byte</tspan></text>
  </svg>`;
}

function svgCommArch(){
  return `<svg class="arch-svg" viewBox="0 0 1680 650" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard, sans-serif">
    <defs>
      <marker id="ck" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#1F1C19"/></marker>
      <marker id="cr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#D93A24"/></marker>
    </defs>

    <!-- 중앙 허브: RPi5 -->
    <rect x="570" y="150" width="430" height="330" rx="6" fill="#1F1C19" stroke="#D93A24" stroke-width="3.5"/>
    <text x="785" y="192" text-anchor="middle" font-size="24" font-weight="800" fill="#FBF8F1" font-family="Paperlogy">Raspberry Pi 5 (로봇 허브)</text>
    <text x="785" y="218" text-anchor="middle" font-size="12.5" fill="#FFD6CE" font-family="monospace">Ubuntu 24.04 · ROS 2 Jazzy · 부팅 자동 서비스</text>
    <g fill="#2d2925" stroke="#58524a" stroke-width="1.2">
      <rect x="596" y="240" width="378" height="48" rx="3"/>
      <rect x="596" y="298" width="378" height="48" rx="3"/>
      <rect x="596" y="356" width="378" height="48" rx="3"/>
      <rect x="596" y="414" width="378" height="48" rx="3"/>
    </g>
    <text x="612" y="270" font-size="15.5" fill="#FBF8F1"><tspan font-weight="800" fill="#FF8C7A">mr_phone_bridge</tspan>  WS 서버 :8765 · mDNS NSD</text>
    <text x="612" y="328" font-size="15.5" fill="#FBF8F1"><tspan font-weight="800" fill="#FF8C7A">mr_mission</tspan>  외출·SOS 상태머신 · 안전 정지 소유</text>
    <text x="612" y="386" font-size="15.5" fill="#FBF8F1"><tspan font-weight="800" fill="#FF8C7A">mr_care_telemetry</tspan>  SQLite 오프라인 Outbox</text>
    <text x="612" y="444" font-size="15.5" fill="#FBF8F1"><tspan font-weight="800" fill="#FF8C7A">twist_mux · EKF · SLAM · Nav2</tspan>  A* 경로 · 충돌 정지</text>

    <!-- 좌상: 어르신 Android 앱 -->
    <rect x="26" y="42" width="350" height="224" rx="5" fill="#FBF8F1" stroke="#1F1C19" stroke-width="2.2"/>
    <rect x="26" y="42" width="350" height="40" fill="#1F1C19"/>
    <text x="42" y="68" font-size="17" font-weight="800" fill="#FBF8F1" font-family="Paperlogy">① 어르신 Android 앱 (S26 Ultra)</text>
    <text x="42" y="110" font-size="15.5" font-weight="700">역할: 외출 출발/멈춤 · 폰 GPS 제공 · SOS</text>
    <text x="42" y="138" font-size="14" fill="#58524a">• 개인 핫스팟 사설 IP 리터럴만 평문 ws:// 허용</text>
    <text x="42" y="162" font-size="14" fill="#58524a">• JSON Schema + 28개 fixture 양쪽 CI 동기화</text>
    <text x="42" y="186" font-size="14" fill="#58524a">• ROS 라이브러리 비노출 · /cmd_vel 발행 금지</text>
    <text x="42" y="216" font-size="13.5" font-weight="800" fill="#D93A24">실측: SOS ACK 8.3~16.5 ms · 캐시 위치 10~19 ms</text>
    <text x="42" y="244" font-size="13.5" fill="#8d8579" font-family="monospace">프로토콜 규격: phone-bridge/1</text>

    <!-- 좌하: STM32 MCU -->
    <rect x="26" y="346" width="350" height="224" rx="5" fill="#fff5f3" stroke="#D93A24" stroke-width="2.5"/>
    <rect x="26" y="346" width="350" height="40" fill="#D93A24"/>
    <text x="42" y="372" font-size="17" font-weight="800" fill="#FBF8F1" font-family="Paperlogy">② STM32F446RE 실시간 제어기</text>
    <text x="42" y="414" font-size="15.5" font-weight="700">역할: 100 Hz 바퀴 제어 · IMU · 배터리 · IWDG</text>
    <text x="42" y="442" font-size="14" fill="#58524a">• GPIO UART0 3선 직결 (USB 허브 변수 제거)</text>
    <text x="42" y="466" font-size="14" fill="#58524a">• 상위 브리지·Wi-Fi가 죽어도 200 ms 워치독 정지</text>
    <text x="42" y="490" font-size="14" fill="#58524a">• TIM1 BDTR.MOE 하드웨어 출력 차단</text>
    <text x="42" y="520" font-size="15" font-weight="800" fill="#D93A24">실측: 921,600 bps 600초 유실 0 · RTT 2.54 ms</text>
    <text x="42" y="548" font-size="13.5" fill="#8d8579" font-family="monospace">XRCE-DDS over USART1 Circular DMA</text>

    <!-- 우상: 보호자 PWA + Firebase -->
    <rect x="1224" y="42" width="430" height="224" rx="5" fill="#FBF8F1" stroke="#1F1C19" stroke-width="2.2"/>
    <rect x="1224" y="42" width="430" height="40" fill="#1F1C19"/>
    <text x="1240" y="68" font-size="17" font-weight="800" fill="#FBF8F1" font-family="Paperlogy">③ 보호자 웹 대시보드 / PWA</text>
    <text x="1240" y="110" font-size="15.5" font-weight="700">역할: 안부 타임라인 · 외출/SOS 웹 푸시 · 지도</text>
    <text x="1240" y="138" font-size="14" fill="#58524a">• Firebase RTDB (Spark) + 규칙 기반 접근 제어</text>
    <text x="1240" y="162" font-size="14" fill="#58524a">• <tspan font-weight="800" fill="#1F1C19">읽기 전용</tspan>: 웹에서 로봇 원격 제어 원천 차단</text>
    <text x="1240" y="186" font-size="14" fill="#58524a">• 온라인 판정 15 s 창 · 단절 시 Outbox 재전송</text>
    <text x="1240" y="216" font-size="15" font-weight="800" fill="#D93A24">프라이버시: 좌표는 활성 /sos/{id}만 · 해제 즉시 삭제</text>
    <text x="1240" y="244" font-size="13.5" fill="#8d8579" font-family="monospace">프로토콜 규격: care-telemetry/1 (React 19)</text>

    <!-- 우하: 노트북 부스 · 아바타 · SO-101 -->
    <rect x="1224" y="346" width="430" height="224" rx="5" fill="#FBF8F1" stroke="#1F1C19" stroke-width="2.2"/>
    <rect x="1224" y="346" width="430" height="40" fill="#1F1C19"/>
    <text x="1240" y="372" font-size="17" font-weight="800" fill="#FBF8F1" font-family="Paperlogy">④ 노트북 (3D 아바타 · VLM · SO-101 팔)</text>
    <text x="1240" y="414" font-size="15.5" font-weight="700">역할: 음성 대화 · 디지털 트윈 · 제로샷 심부름</text>
    <text x="1240" y="442" font-size="14" fill="#58524a">• ROS 2 DDS BEST_EFFORT 구독 → Pi 부하 최소화</text>
    <text x="1240" y="466" font-size="14" fill="#58524a">• 브라우저 WebSocket → Three.js / three-vrm 30 fps</text>
    <text x="1240" y="490" font-size="14" fill="#58524a">• ElevenLabs Agents 도구 호출 → errand_nav + 팔</text>
    <text x="1240" y="520" font-size="15" font-weight="800" fill="#D93A24">Gemini 4 API + C270 탑뷰 + USB 서보(12 V PD 벅)</text>
    <text x="1240" y="548" font-size="13.5" fill="#8d8579" font-family="monospace">아바타 · 디지털 트윈 · 팔 제어 통합 브리지</text>

    <!-- 연결 화살표 + 라벨 -->
    <g fill="none" stroke-width="3">
      <path d="M376,160 L564,256" stroke="#1F1C19" marker-start="url(#ck)" marker-end="url(#ck)"/>
      <path d="M376,454 L564,380" stroke="#D93A24" marker-start="url(#cr)" marker-end="url(#cr)"/>
      <path d="M1006,280 L1218,160" stroke="#1F1C19" marker-end="url(#ck)"/>
      <path d="M1006,390 L1218,454" stroke="#1F1C19" marker-start="url(#ck)" marker-end="url(#ck)"/>
    </g>
    <!-- 링크 배지 -->
    <g font-size="13" font-weight="700" text-anchor="middle">
      <rect x="400" y="176" width="150" height="44" rx="3" fill="#FBF8F1" stroke="#1F1C19" stroke-width="1.5"/>
      <text x="475" y="195" fill="#1F1C19">Hotspot WS</text>
      <text x="475" y="212" fill="#D93A24" font-family="monospace">phone-bridge/1</text>

      <rect x="396" y="410" width="158" height="44" rx="3" fill="#fff5f3" stroke="#D93A24" stroke-width="1.5"/>
      <text x="475" y="429" fill="#D93A24">유선 UART0 직결</text>
      <text x="475" y="446" fill="#1F1C19" font-family="monospace">921,600 bps</text>

      <rect x="1032" y="176" width="164" height="44" rx="3" fill="#FBF8F1" stroke="#1F1C19" stroke-width="1.5"/>
      <text x="1114" y="195" fill="#1F1C19">HTTPS / RTDB</text>
      <text x="1114" y="212" fill="#D93A24" font-family="monospace">단방향 · 읽기 전용</text>

      <rect x="1032" y="410" width="164" height="44" rx="3" fill="#FBF8F1" stroke="#1F1C19" stroke-width="1.5"/>
      <text x="1114" y="429" fill="#1F1C19">Wi-Fi ROS 2 DDS</text>
      <text x="1114" y="446" fill="#58524a" font-family="monospace">BEST_EFFORT</text>
    </g>

    <!-- 하단 원칙 바 -->
    <rect x="26" y="594" width="1628" height="44" fill="#F3EEE3" stroke="#1F1C19" stroke-width="1.5"/>
    <text x="44" y="622" font-size="16" fill="#1F1C19"><tspan font-weight="800" fill="#D93A24">설계 원칙:</tspan>  ① 계약 단일 정본(mobile-robot) + CI 드리프트 검증   ·   ② 앱·웹에서 직접 <tspan font-family="monospace">/cmd_vel</tspan> 차단   ·   ③ 최종 정지 권한은 로봇·MCU가 소유</text>
  </svg>`;
}

function svgMissionFsm(){
  return `<svg viewBox="0 0 760 470" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard, sans-serif">
    <defs>
      <marker id="fk1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#1F1C19"/></marker>
      <marker id="fr1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#D93A24"/></marker>
    </defs>
    <!-- 주행 상태 노드 -->
    <g stroke="#1F1C19" stroke-width="2">
      <rect x="24" y="34" width="128" height="58" rx="6" fill="#F3EEE3"/>
      <rect x="218" y="34" width="150" height="58" rx="6" fill="#F3EEE3"/>
      <rect x="444" y="34" width="156" height="58" rx="6" fill="#1F1C19"/>
      <rect x="444" y="176" width="156" height="62" rx="6" fill="#F3EEE3"/>
      <rect x="218" y="176" width="150" height="62" rx="6" fill="#F3EEE3"/>
      <rect x="24" y="176" width="128" height="62" rx="6" fill="#fff5f3" stroke="#D93A24" stroke-width="2.5"/>
    </g>
    <text x="88" y="69" text-anchor="middle" font-size="19" font-weight="800">idle</text>
    <text x="293" y="69" text-anchor="middle" font-size="19" font-weight="800">starting</text>
    <text x="522" y="69" text-anchor="middle" font-size="19" font-weight="800" fill="#FBF8F1">active</text>
    <text x="522" y="204" text-anchor="middle" font-size="18" font-weight="800">cancelling</text>
    <text x="522" y="225" text-anchor="middle" font-size="12.5" fill="#58524a">follow disable</text>
    <text x="293" y="204" text-anchor="middle" font-size="18" font-weight="800">cancelled</text>
    <text x="293" y="225" text-anchor="middle" font-size="12.5" fill="#58524a">정지 확인 후 3 s</text>
    <text x="88" y="204" text-anchor="middle" font-size="18" font-weight="800" fill="#D93A24">error</text>
    <text x="88" y="225" text-anchor="middle" font-size="12.5" fill="#D93A24">자동 재개 없음</text>

    <!-- 전이 화살표 -->
    <g fill="none" stroke="#1F1C19" stroke-width="2" marker-end="url(#fk1)">
      <path d="M152,63 L214,63"/>
      <path d="M368,63 L440,63"/>
      <path d="M522,92 L522,172"/>
      <path d="M444,207 L372,207"/>
      <path d="M250,176 L112,96"/>
    </g>
    <g fill="none" stroke="#D93A24" stroke-width="2.2" stroke-dasharray="5 3" marker-end="url(#fr1)">
      <path d="M293,92 L293,134 L88,134 L88,172"/>
      <path d="M444,224 L406,258 L116,258 L100,240"/>
    </g>
    <text x="183" y="53" text-anchor="middle" font-size="12.5" font-weight="700">출발</text>
    <text x="404" y="53" text-anchor="middle" font-size="12.5" font-weight="700">enable OK</text>
    <text x="534" y="138" font-size="12.5" font-weight="700">멈춤 / abort</text>
    <text x="408" y="198" text-anchor="middle" font-size="11.5">|v|&lt;0.02 0.3s</text>
    <text x="180" y="126" font-size="11.5" fill="#D93A24">3 s 타임아웃</text>
    <text x="275" y="274" text-anchor="middle" font-size="12" fill="#D93A24" font-weight="700">안전 정지(abort) · 정지 미확인(5 s)</text>

    <!-- 하단: SOS SafetyMonitor 병렬 계층 -->
    <rect x="24" y="298" width="712" height="156" rx="5" fill="#fff5f3" stroke="#D93A24" stroke-width="2"/>
    <text x="42" y="324" font-size="15" font-weight="800" fill="#D93A24" font-family="Paperlogy">병렬 안전 감시 — SafetyMonitor (D1~D7) + LinkWatch</text>

    <rect x="42" y="344" width="160" height="86" rx="4" fill="#FBF8F1" stroke="#1F1C19" stroke-width="1.8"/>
    <text x="122" y="374" text-anchor="middle" font-size="16" font-weight="800">ARMED</text>
    <text x="122" y="396" text-anchor="middle" font-size="12.5" fill="#58524a">마커 1회 이상 획득</text>
    <text x="122" y="414" text-anchor="middle" font-size="12" fill="#8d8579">searching 중 미발동</text>

    <rect x="292" y="344" width="196" height="86" rx="4" fill="#D93A24"/>
    <text x="390" y="372" text-anchor="middle" font-size="17" font-weight="800" fill="#FBF8F1">SOS OPEN</text>
    <text x="390" y="394" text-anchor="middle" font-size="12.5" fill="#FFD6CE">폰 GPS 즉시 요청 + 푸시</text>
    <text x="390" y="414" text-anchor="middle" font-size="12" fill="#FBF8F1">manual 버튼은 주행 외 허용</text>

    <rect x="560" y="344" width="158" height="86" rx="4" fill="#1F1C19"/>
    <text x="639" y="374" text-anchor="middle" font-size="16" font-weight="800" fill="#FF8C7A">SAFETY STOP</text>
    <text x="639" y="396" text-anchor="middle" font-size="12.5" fill="#FBF8F1">폰 무응답(D4)</text>
    <text x="639" y="414" text-anchor="middle" font-size="12" fill="#d8cfbf">링크 30 s 단절(D6)</text>

    <path d="M202,374 L288,374" fill="none" stroke="#D93A24" stroke-width="2.2" marker-end="url(#fr1)"/>
    <text x="245" y="366" text-anchor="middle" font-size="11.5" font-weight="700" fill="#D93A24">LOST 10 s</text>
    <path d="M292,406 L206,406" fill="none" stroke="#1F1C19" stroke-width="1.8" marker-end="url(#fk1)"/>
    <text x="245" y="424" text-anchor="middle" font-size="11.5" fill="#1F1C19">회복 5 s / 취소</text>
    <path d="M488,387 L556,387" fill="none" stroke="#D93A24" stroke-width="2.2" marker-end="url(#fr1)"/>
    <text x="522" y="378" text-anchor="middle" font-size="11.5" font-weight="700" fill="#D93A24">No ACK</text>
  </svg>`;
}

function svgErrandFsm(){
  return `<svg viewBox="0 0 760 470" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard, sans-serif">
    <defs>
      <marker id="fk2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#1F1C19"/></marker>
      <marker id="fr2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#D93A24"/></marker>
    </defs>

    <!-- 메인 파이프라인 5단계 -->
    <g stroke="#1F1C19" stroke-width="2">
      <rect x="26" y="34" width="114" height="66" rx="6" fill="#F3EEE3"/>
      <rect x="196" y="34" width="166" height="66" rx="6" fill="#F3EEE3"/>
      <rect x="420" y="34" width="174" height="66" rx="6" fill="#1F1C19"/>
      <rect x="420" y="170" width="174" height="72" rx="6" fill="#D93A24" stroke="#D93A24"/>
      <rect x="196" y="170" width="166" height="72" rx="6" fill="#F3EEE3"/>
    </g>
    <text x="83" y="64" text-anchor="middle" font-size="19" font-weight="800">IDLE</text>
    <text x="83" y="86" text-anchor="middle" font-size="12" fill="#58524a">1초마다 작업대 측정</text>

    <text x="279" y="62" text-anchor="middle" font-size="18" font-weight="800">LOOKING</text>
    <text x="279" y="84" text-anchor="middle" font-size="12" fill="#58524a">ArUco PnP + Gemini 4</text>

    <text x="507" y="62" text-anchor="middle" font-size="18" font-weight="800" fill="#FBF8F1">PICKING</text>
    <text x="507" y="84" text-anchor="middle" font-size="12" fill="#FFD6CE">GrabCut · 6-DOF IK · 자중 보정</text>

    <text x="507" y="200" text-anchor="middle" font-size="18" font-weight="800" fill="#FBF8F1">HOLDING</text>
    <text x="507" y="222" text-anchor="middle" font-size="12" fill="#FFD6CE">전류·벌림 낙하 상시 감시</text>

    <text x="279" y="200" text-anchor="middle" font-size="18" font-weight="800">RELEASING</text>
    <text x="279" y="222" text-anchor="middle" font-size="12" fill="#58524a">give() / throw() 전용</text>

    <!-- 전이 -->
    <g fill="none" stroke="#1F1C19" stroke-width="2" marker-end="url(#fk2)">
      <path d="M140,67 L192,67"/>
      <path d="M362,67 L416,67"/>
      <path d="M507,100 L507,166"/>
      <path d="M196,206 L83,206 L83,104"/>
    </g>
    <path d="M420,206 L366,206" fill="none" stroke="#D93A24" stroke-width="2.6" marker-end="url(#fr2)"/>
    <!-- 재시도 루프 -->
    <path d="M594,54 L668,54 L668,94 L598,94" fill="none" stroke="#D93A24" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#fr2)"/>
    <text x="676" y="70" font-size="12" font-weight="700" fill="#D93A24">빈손 감지</text>
    <text x="676" y="87" font-size="12" fill="#D93A24">3 mm 더 깊게</text>

    <text x="166" y="57" text-anchor="middle" font-size="12" font-weight="700">fetch()</text>
    <text x="389" y="57" text-anchor="middle" font-size="12" font-weight="700">좌표 OK</text>
    <text x="520" y="140" font-size="12" font-weight="700">파지 확인 (≥120 mA / 벌림)</text>
    <text x="393" y="194" text-anchor="middle" font-size="12" font-weight="800" fill="#D93A24">“줘”</text>
    <text x="140" y="196" text-anchor="middle" font-size="12">복귀 완료</text>

    <!-- 하단: 모델 vs 하네스 경계표 -->
    <rect x="26" y="274" width="708" height="180" rx="5" fill="#F3EEE3" stroke="#1F1C19" stroke-width="1.8"/>
    <text x="44" y="302" font-size="15" font-weight="800" fill="#D93A24" font-family="Paperlogy">VLM과 코드 하네스의 권한 경계 (Refused 거절 규칙)</text>

    <rect x="44" y="318" width="320" height="120" rx="4" fill="#FBF8F1" stroke="#1F1C19" stroke-width="1.5"/>
    <text x="60" y="344" font-size="15.5" font-weight="800">Gemini 4 / ElevenLabs가 하는 일</text>
    <text x="60" y="369" font-size="13.5" fill="#58524a">• 사용자 자연어 의도 → 도구 이름 호출</text>
    <text x="60" y="391" font-size="13.5" fill="#58524a">• 탑뷰 사진 속 물체 픽셀 [y, x] · 높이</text>
    <text x="60" y="413" font-size="13.5" fill="#58524a">• grasp_clear (사람 손 겹침 여부)</text>

    <rect x="388" y="318" width="328" height="120" rx="4" fill="#fff5f3" stroke="#D93A24" stroke-width="1.8"/>
    <text x="404" y="344" font-size="15.5" font-weight="800" fill="#D93A24">결정론적 코드 하네스가 강제하는 일</text>
    <text x="404" y="369" font-size="13.5" fill="#1F1C19">• 도달 범위 밖·관절 한계 즉시 Refused</text>
    <text x="404" y="391" font-size="13.5" fill="#1F1C19">• 자중 처짐 5~9 mm 엔코더 실측 재보정</text>
    <text x="404" y="413" font-size="13.5" fill="#D93A24" font-weight="700">• 상태 순서 건너뛰기 · 무단 열기 원천 차단</text>
  </svg>`;
}

const LAY = {
  cover: s => `<div class="cover"><div class="cv-l"><div class="cv-brand"><i></i>NEXT YEAR ROBOTICS</div><h1 class="cv-t">${s.t}</h1><p class="cv-s">${s.sub}</p>
    <div class="cv-by"><span>${s.by[0]}</span><span>${s.by[1]}</span></div></div><figure class="cv-img"><img fetchpriority="high" src="${u(s.img)}" alt=""></figure></div>`,

  toc: s => `<h3 class="t">${s.t}</h3><ol class="toc">${s.items.map(([n,b,d,sub])=>`<li><span class="n">${n}</span><b><a href="#${sections[Number(n)].id}">${b}</a></b><span class="d">${d}${sub?`<span class="sub">${sub}</span>`:''}</span></li>`).join('')}</ol>`,

  story: s => `<div class="two story-grid"><div class="col"><h3 class="t">${s.t}</h3><p class="lead">${s.b}</p><p class="lead">${s.b2}</p>
    <p class="src">${s.src}</p><blockquote>${s.q}</blockquote></div>
    <ol class="bf-strip">${s.frames.map(f=>`<li class="bf-card"><div class="bf-cap"><span class="step">${f.step}</span><span>${f.cap}</span></div></li>`).join('')}</ol></div>`,

  stats: s => `<h3 class="t">${s.t}</h3><div class="stats">${s.stats.map(([im,k,n,un,lb,p,so])=>`<div class="st"><img loading="lazy" decoding="async" src="${u(im)}" alt=""><div class="k">${k}</div><div class="num">${n}<small>${un}</small></div><div class="lb">${lb}</div><p>${p}</p><div class="so">${so}</div></div>`).join('')}</div><p class="sofar">${s.so}</p>`,

  rebut: s => `${head(s)}<div class="row"><figure class="dia"><img loading="lazy" decoding="async" src="${u(s.img)}" alt=""></figure><div class="col rb">
    <div class="colh">${s.L[0]}</div><ol class="np">${s.L[1].map(([b,t])=>`<li><b>${b}</b><span>${t}</span></li>`).join('')}</ol>
    <div class="colh g">${s.R[0]}</div><ul class="plain">${s.R[1].map(x=>`<li>${x}</li>`).join('')}</ul></div></div>`,

  probdef: s => `${head(s)}<div class="pdef">
    <div class="pdef-top">
      <div class="pbox"><h3><i>STEP 1</i>현장에서 확인한 세 가지 빈틈</h3><ul class="plist">${s.gaps.map(([k,v])=>`<li><b>${k}</b><span>${v}</span></li>`).join('')}</ul></div>
      <div class="pdef-arr">→</div>
      <div class="pbox wall"><h3><i>STEP 2</i>기존 대안이 풀지 못한 벽</h3><ul class="plist">${s.walls.map(([k,v])=>`<li><b>${k}</b><span>${v}</span></li>`).join('')}</ul></div>
    </div>
    <div class="pdef-core"><div class="ck">PROBLEM DEFINITION → 5 DESIGN PILLARS</div><p>${s.core}</p>
      <div class="ppill-row">${s.pillars.map(([b,t])=>`<div class="ppill"><b>${b}</b>${t}</div>`).join('')}</div></div>
  </div>`,

  reveal: s => `${head(s)}<div class="reveal-stage"><div class="reveal-frame">${vidHTML(s.vid,true)}</div></div>`,

  mods: s => `<div class="two w"><div class="col"><h3 class="t">${s.t}</h3><p class="lead">${s.b}</p>
    <ol class="mods">${s.mods.map(([b,t],j)=>`<li><span class="n">${j+1}</span><b>${b}</b><span>${t}</span></li>`).join('')}</ol>${s.note?`<p class="note">${s.note}</p>`:''}</div>
    <div class="dual-hero">
      <figure class="dh-card cut"><div class="dh-f"><img loading="lazy" decoding="async" src="${u(s.cutout)}" alt=""></div><figcaption><b>완성 실물</b><span>REAL</span></figcaption></figure>
      <figure class="dh-card hall"><div class="dh-f"><img loading="lazy" decoding="async" src="${u(s.hall)}" alt=""></div><figcaption><b>3D 설계 모델</b><span>3D CAD</span></figcaption></figure>
    </div></div>`,

  showcase: s => `${head(s)}<div class="sc-wrap">
    <div class="sc-stage"><div class="sc-frame">${vidHTML(s.vid,{sound:!!s.sound})}<div class="sc-prog"><i data-prog></i></div></div></div>
    <aside class="sc-side">
      <div class="sc-head"><span class="sc-no">${s.no}</span><span class="sc-cat">${s.cat}</span></div>
      <dl class="sc-pts">${s.pts.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${s.tags?`<div class="sc-tags">${s.tags.map(([t,c])=>`<span class="${c||''}">${t}</span>`).join('')}</div>`:''}
    </aside></div>`,

  dual_sync: s => `${head(s)}<div class="ds-wrap" data-dual-sync>
    <div class="ds-vids">
      <div class="ds-vcard active" data-ds-card="auto">
        <div class="ds-vh"><span>① 핵심 파지·전달 — 100% 자율 실증</span><span class="ds-b">AUTONOMOUS</span></div>
        <div class="ds-vf">${vidHTML(s.autoVid,{manual:true})}<div class="sc-prog"><i data-ds-prog="auto"></i></div></div>
      </div>
      <div class="ds-vcard" data-ds-card="tele">
        <div class="ds-vh"><span>② 가정 동선 전체 시나리오 — 실물 기체 재현</span><span class="ds-b">SCENARIO REPLAY</span></div>
        <div class="ds-vf">${vidHTML(s.teleVid,{sound:false})}<div class="sc-prog"><i data-ds-prog="tele"></i></div></div>
      </div>
    </div>
    <section class="ds-panel">
      <div class="ds-phead">
        <div class="ds-tabs">
          <button type="button" class="ds-tab on auto" data-ds-tab="auto">● 자율 파지 백엔드 추적</button>
          <button type="button" class="ds-tab" data-ds-tab="tele">○ 전체 동선 재현</button>
        </div>
        <div class="ds-clock"><span class="live-dot"></span><span data-ds-time>00:15.0 / 00:33.6</span><span class="st-pill" data-ds-pill>PICKING · 파지</span></div>
      </div>
      <div class="ds-flow" data-ds-flow></div>
      <div class="ds-detail" data-ds-detail></div>
      <div class="ds-scope">
        <div class="ds-sc auto"><b>100% 자율 실증</b>음성→Gemini 4→IK 파지·‘줘’ 전달(위) + 부스 추종·복귀·SOS(다음 장)</div>
        <div class="ds-sc tele"><b>전체 동선 재현</b>냉장고에서 두유를 가져오는 사용 상황을 실물 기체로 재현. 주행과 파지의 연속 자율 연동은 개발 중.</div>
      </div>
    </section>
  </div>`,

  roadmap: s => {const x=d=>((day(d)-day(AX0))/(day(AX1)-day(AX0))*100).toFixed(2)+'%';
    const ax=[6,7,8,9,10,11].map(m=>`<span style="left:${x(`2026-${String(m).padStart(2,'0')}-01`)}">${m}월</span>`).join('');
    return `${head(s)}<div class="gantt"><div class="gax"><span></span><div class="tr">${ax}</div></div>${s.acts.map(([a,d0,d1,p,f],idx)=>{
      const late=parseFloat(x(d0))>55;
      return `<div class="gr"><div class="nm">STAGE 0${idx+1}<b>${PHASES[a]}</b></div><div class="tr"><div class="bar" style="left:${x(d0)};width:calc(${x(d1)} - ${x(d0)})"></div>
        <div class="ln" style="${late?`right:calc(100% - ${x(d1)})`:`left:${x(d0)}`}">${p} → <b>${f}</b></div></div></div>`}).join('')}</div>`},

  beat: s => `${head(s)}<div class="row">${mediaHTML(s.m,s.stamp,s.pts?'':'full')}${ptsHTML(s.pts)}</div>`,

  order: s => `${head(s)}<div class="order-wrap ${s.order.items.length>=5?'wide':''}">${orderCardHTML(s.order, s.stamp)}<div class="oside">${
    s.sideMedia ? mediaHTML(s.sideMedia, null) : ''}${ptsHTML(s.pts)}</div></div>`,

  table: s => `${head(s)}${tableHTML(s)}`,

  verdict: s => `${head(s)}<div class="verdict-wrap">
    <div class="vgrid">
      <div class="vcard"><div class="vh"><i>PROVED</i><b>PoC에서 증명한 것</b></div>
        <ul class="vlist">${s.proved.map(([t,d])=>`<li><span class="vt">${t}</span><span class="vd">${d}</span></li>`).join('')}</ul></div>
      <div class="vcard next"><div class="vh"><i>NEXT</i><b>본체로 넘길 두 가지 벽</b></div>
        <ul class="vlist">${s.limits.map(([t,d])=>`<li><span class="vt">${t}</span><span class="vd">${d}</span></li>`).join('')}</ul></div>
    </div>
    <div class="vbar"><span class="vk">PHASE GATE</span><span class="vm">${s.bar}</span></div>
  </div>`,

  mcu_cmp: s => `${head(s)}<div class="mcu-cmp">
    <div class="mcu-kpis">${s.kpis.map(([v,d])=>`<div class="mkpi"><b>${v}</b><span>${d}</span></div>`).join('')}</div>
    <div class="mcu-rows">${s.rows.map(([k,b,n,sub,r])=>`<div class="mrow">
      <div class="mk">${k}</div><div class="mb">${b}</div><div class="ma">→</div>
      <div class="mn">${n}<small>${sub}</small></div><div class="mr">${r}</div></div>`).join('')}</div>
  </div>`,

  flow: s => `${head(s)}<div class="row">${mediaHTML(s.m,s.stamp)}<ol class="steps"><div class="say"><small>어르신</small>“${s.say}”</div>${s.steps.map(([k,v],j)=>`<li><span class="n">${j+1}</span><div><b>${k}</b><p>${v}</p></div></li>`).join('')}</ol></div>`,

  caster: s => `${head(s)}<div class="row"><div class="unders">${s.unders.map(([im,b,c],j)=>(j?'<span class="arr">→</span>':'')+
      `<figure><img loading="lazy" decoding="async" src="${u(im)}" alt=""><figcaption><b>${b}</b>${c}</figcaption></figure>`).join('')}</div>${ptsHTML(s.pts,'n')}</div>`,

  tech_stack: s => `${head(s)}<div class="tstack">${s.layers.map(l=>`<div class="tlayer ${l.hi?'hi':''}">
    <div><div class="tl-k">${l.k}</div><div class="tl-n">${l.n}</div></div>
    <div class="tl-tags">${l.chips.map(([t,c])=>`<span class="chip ${c}">${t}</span>`).join('')}</div>
    <div class="tl-r">${l.role}</div></div>`).join('')}</div>`,

  ros_graph: s => `${head(s)}<div class="arch-card">${svgRosGraph()}
    <div class="arch-foot"><span><b>TF 트리:</b> map → odom (slam_toolbox) → base_footprint (EKF 30 Hz) → base_link → cam / imu / laser</span><span><em>E-Stop·패드가 언제나 자율 주행을 선점</em></span></div></div>`,

  mcu_arch: s => `${head(s)}<div class="mcu-grid">
    <div class="mcu-left">
      <figure class="mc contain"><div class="mf"><img loading="lazy" decoding="async" src="${u(s.cubemx.src)}"${s.cubemx.win?` data-win="${s.cubemx.win}"`:''} alt=""></div><figcaption><i>MCU</i><span>${s.cubemx.cap}</span></figcaption></figure>
      <table class="pin-tbl"><thead><tr><th>IP</th><th>핀</th><th>역할 및 실측</th></tr></thead><tbody>${s.pins.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="arch-card">${svgMcuRtos()}</div>
  </div>`,

  cubemx_cfg: s => `${head(s)}<div class="cmx-grid">${s.rows.map(r=>`<div class="cmx-col">
    <div class="cmxh"><b>${r.title}</b><span>${r.tag}</span></div>
    <div class="cmxf"><img loading="lazy" decoding="async" src="${u(r.img)}" alt=""></div>
    <div class="cmxb"><ul>${r.pts.map(p=>`<li>${p}</li>`).join('')}</ul></div>
  </div>`).join('')}</div>`,

  comm_arch: s => `${head(s)}<div class="arch-card">${svgCommArch()}</div>`,

  state_machines: s => `${head(s)}<div class="fsm-grid">
    <div class="fsm-box"><div class="fsm-head"><b>외출 · SOS 안전 상태머신</b><code>외출 · 안전 감시 계층</code></div>${svgMissionFsm()}
      <div class="fsm-inv"><b>안전 불변식:</b> 어떤 상태에서도 멈춤(cancel)을 거절하지 않으며, 안전 정지(abort) 후에는 마커가 다시 보여도 자동 재개하지 않는다.</div></div>
    <div class="fsm-box"><div class="fsm-head"><b>VLM 심부름 팔 상태머신</b><code>심부름 · 파지 제어 계층</code></div>${svgErrandFsm()}
      <div class="fsm-inv"><b>안전 불변식:</b> 모델이 무엇을 말하든 상태 순서를 건너뛰지 못하며, 그리퍼는 명시적 <b>give() / throw()</b> 호출 외에는 절대 열지 않는다.</div></div>
  </div>`,

  hw_cad_showcase: s => `${head(s)}<div class="hw3">${s.cards.map(c=>`<div class="hwcard">
    <div class="hwh"><b>${c.title}</b><span>${c.sub}</span></div>
    <div class="hwf"><img loading="lazy" decoding="async" src="${u(c.src)}"${c.win?` data-win="${c.win}"`:''} alt=""></div>
    <div class="hwb">${c.desc}</div></div>`).join('')}</div>`,

  demo: s => `${head(s)}<div class="row">${mediaHTML(s.m,null,'full')}</div>`,

  nums: s => `${head(s)}<div class="nums">${s.nums.map(([v,un,l,d])=>`<div><div class="v">${v}<small>${un}</small></div><div class="l">${l}</div><div class="d">${d}</div></div>`).join('')}</div>`,

  ledger: s => {const mx=Math.max(...s.rows.map(r=>Math.abs(r[3])));
    const spent=s.rows.filter(r=>r[3]>0).reduce((a,r)=>a+r[3],0),inc=-s.rows.filter(r=>r[3]<0).reduce((a,r)=>a+r[3],0),bal=SEED_WON-spent+inc;
    return `${head(s)}<table class="led"><thead><tr><th>날짜</th><th>어디서</th><th></th><th>무엇</th><th style="text-align:right">금액(원)</th><th></th></tr></thead><tbody>${s.rows.map(([d,w,x,a,k,its])=>
      `<tr class="${k||''}"><td class="d">${d}</td><td class="w">${w}</td><td class="i">${(its||[]).map(it=>`<img loading="lazy" decoding="async" src="${u(INV(it,k==='home'))}" alt="">`).join('')}</td><td class="x">${x}</td>
       <td class="a">${a===0?'0':(a<0?'+':'−')+won(a)}</td><td class="b"><div class="bar" style="width:${Math.abs(a)/mx*100}%"></div></td></tr>`).join('')}</tbody></table>
      <div class="sum"><div>종잣돈<b>${won(SEED_WON)}</b></div><span class="op">−</span><div>영수증<b>${won(spent)}</b></div><span class="op">+</span><div>장학금<b>${won(inc)}</b></div><span class="op">=</span><div class="neg">잔고<b>−${won(-bal)}</b></div></div>`},

  next: s => `${head(s)}${tableHTML(s,'obj')}<p class="tail">${s.tail}</p>`,
  end: s => `<div class="end"><div><div class="brand">NEXT YEAR ROBOTICS</div><h3>${s.t}</h3><p>${s.b}</p></div><img loading="lazy" decoding="async" src="${u(s.img)}" alt=""></div>`,
};

/* ═════════ 일력: 누적 그래프 ═════════ */
const CH={w:328,h:78,x0:2,x1:326,yt:6,yb:60};
const cx = d => CH.x0 + (day(d)-day(AX0))/(day(AX1)-day(AX0))*(CH.x1-CH.x0);
const yBal = v => CH.yb - (v-MONEY.min)/(1050000-MONEY.min)*(CH.yb-CH.yt);
const yRec = v => CH.yb - v/REC_MAX*(CH.yb-CH.yt);
const yLv  = v => CH.yb - v*(CH.yb-CH.yt);
function seriesPts(f){
  const map=new Map([[AX0,f(null)]]);S.forEach((b,i)=>{if(b.d)map.set(b.d,f(STATES[i]))});
  map.set(AX1,f(STATES[STATES.length-1]));
  return [...map].sort((a,b)=>day(a[0])-day(b[0])).map(([d,v])=>[cx(d),v]);
}
let chartRefs;
const COL={bal:'#1F1C19',lv:'#D93A24',rec:'#9a9286'};
function buildChart(){
  const svg=$('chart'),defs=el('defs',{},svg);
  const cp=el('clipPath',{id:'rev'},defs);
  const clip=el('rect',{x:0,y:0,width:0,height:CH.h,class:'clip'},cp);
  const pat=el('pattern',{id:'hatch',width:5,height:5,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'},defs);
  el('line',{x1:0,y1:0,x2:0,y2:5,stroke:'#D93A24','stroke-width':1.2,'stroke-opacity':.35},pat);
  for(let m=6;m<=11;m++){const x=cx(`2026-${String(m).padStart(2,'0')}-01`);
    el('line',{x1:x,x2:x,y1:CH.yt-4,y2:CH.yb,stroke:'#e6dece'},svg);
    el('text',{x:x+2,y:CH.yb+14},svg).textContent=m+'월';}
  el('rect',{x:CH.x0,y:yBal(0),width:CH.x1-CH.x0,height:CH.yb-yBal(0),fill:'url(#hatch)'},svg);
  el('line',{x1:CH.x0,x2:CH.x1,y1:yBal(0),y2:yBal(0),stroke:'#D93A24','stroke-dasharray':'2 3'},svg);
  el('text',{x:CH.x1,y:yBal(0)-3,'text-anchor':'end',style:'fill:#D93A24'},svg).textContent='0원';
  const g=el('g',{'clip-path':'url(#rev)'},svg);
  el('path',{d:monoPath(seriesPts(s=>s?s.rec:0).map(([x,v])=>[x,yRec(v)])),fill:'none',stroke:COL.rec,'stroke-width':1.3,'stroke-dasharray':'3 2'},g);
  el('path',{d:monoPath(seriesPts(s=>s?s.bal:0).map(([x,v])=>[x,yBal(v)])),fill:'none',stroke:COL.bal,'stroke-width':2.2},g);
  el('path',{d:monoPath(seriesPts(s=>s?s.level:0).map(([x,v])=>[x,yLv(v)])),fill:'none',stroke:COL.lv,'stroke-width':2.6,'stroke-linecap':'round'},g);
  S.forEach((b,i)=>{if(!b.d||b.d===SEED)return;(b.tx||[]).forEach(([a,,k])=>{if(k!=='acc'&&k!=='in')return;
    el('circle',{cx:cx(b.d),cy:yBal(STATES[i].bal),r:3.2,fill:'#FBF8F1',stroke:k==='acc'?'#D93A24':'#1F1C19','stroke-width':1.6},g)})});
  const mk=c=>{const m=el('g',{class:'mk'},svg);el('circle',{r:3.6,fill:c,stroke:'#FBF8F1','stroke-width':1.5},m);return m};
  chartRefs={clip,bal:mk(COL.bal),rec:mk(COL.rec),lv:mk(COL.lv)};
}
function renderChart(i){
  const s=STATES[i];if(!s.d)return;const x=cx(s.d);
  chartRefs.clip.setAttribute('width',x+1);
  chartRefs.bal.style.transform=`translate(${x}px,${yBal(s.bal)}px)`;
  chartRefs.rec.style.transform=`translate(${x}px,${yRec(s.rec)}px)`;
  chartRefs.lv.style.transform=`translate(${x}px,${yLv(s.level)}px)`;
  $('chLg').innerHTML=`<span><i style="background:${COL.bal}"></i>잔고</span><span><i style="background:${COL.lv}"></i>완성도 <b>${Math.round(s.level*100)}%</b></span><span><i style="background:${COL.rec}"></i>기록 <b>${s.rec}</b>건</span>`;
}

/* ═════════ 일력: 조립 상태 (Blender 렌더) ═════════ */
let imgFlip=false, imgKey=null;
function showRender(key){
  const ph=$('isoPh');
  if(!key){['isoA','isoB'].forEach(id=>$(id).classList.remove('on'));imgKey=null;ph.textContent='아직 아무것도 없음';return}
  if(key===imgKey)return; imgKey=key;
  const next=$(imgFlip?'isoA':'isoB'),cur=$(imgFlip?'isoB':'isoA');imgFlip=!imgFlip;
  next.onload=()=>{next.classList.add('on');cur.classList.remove('on');ph.textContent=''};
  next.onerror=()=>{ph.textContent='렌더 없음: stage_'+key};
  next.src=u(`renders/print/stage_${key}.png`);
}

/* ═════════ 일력 그리기 ═════════ */
const mx = v => (v-MONEY.min)/(MONEY.max-MONEY.min)*100;
let prevRail=-1;
function buildRail(){
  buildChart();
  $('caps').innerHTML=CAPS.map(([k,n])=>`<span>${n}</span><span class="dots" id="cp-${k}"></span>`).join('');
  $('m0').style.left=mx(0)+'%';
  $('gl').innerHTML=`<span style="left:0">−60만</span><span style="left:${mx(0)}%;transform:translateX(-50%)">0</span><span style="left:${mx(SEED_WON)}%;transform:translateX(-50%)">종잣돈</span>`;
  $('rbot').innerHTML=`<span>사진·영상<b id="n-rec"></b>건</span><span>새벽<b id="n-nt"></b>건</span><span class="acc">사고<b id="n-acc"></b></span>`;
}
function renderRail(i){
  const s=STATES[i],b=S[i];if(!s.d)return;
  const ps=prevRail>=0?STATES[prevRail]:null,fwd=!!ps&&i>prevRail&&!STATIC;
  const dt=day(s.d);
  $('calTop').textContent=`${dt.getFullYear()} · ${dt.getMonth()+1}월`;
  $('calDay').textContent=dt.getDate();$('calDay').classList.toggle('sun',dt.getDay()===0);
  $('rDn').textContent='D+'+Math.round((dt-day(SEED))/DAYMS);
  const pg=$('page');pg.classList.remove('flip');void pg.offsetWidth;if(ps&&ps.d!==s.d&&!STATIC)pg.classList.add('flip');
  const z=mx(0),v=mx(s.bal),f=$('mfill');
  f.style.left=Math.min(z,v)+'%';f.style.width=Math.abs(v-z)+'%';f.style.background=s.bal>=0?'var(--ink)':'var(--red)';
  const gh=$('mgh');gh.className='gh';
  if(fwd&&ps.bal!==s.bal){const a=mx(ps.bal);gh.style.left=Math.min(a,v)+'%';gh.style.width=Math.abs(a-v)+'%';void gh.offsetWidth;gh.className='gh '+(s.bal<ps.bal?'sp':'in')}
  countTo('rBal',s.bal,v=>manU(v)+' 원');$('rBal').style.color=s.bal<0?'var(--red)':'var(--ink)';
  $('tx').innerHTML=(b.tx||[]).map(([a,it,k],j)=>`<div style="animation-delay:${j*120}ms">`+(a>0
    ?`<span class="p">+${won(a)}</span> ${it}`
    :`<span class="m">−${won(a)}</span> ${it}${k==='acc'?' · 사고':''} · 종잣돈의 ${Math.max(1,Math.round(-a/SEED_WON*100))}%`)+'</div>').join('');
  renderChart(i);
  CAPS.forEach(([k])=>{const n=Math.round(s.cap[k]*10);$('cp-'+k).innerHTML=`<b>${'●'.repeat(n)}</b>${'●'.repeat(10-n)}`});
  showRender(s.img);
  $('stName').textContent=s.stage||'';
  const chg=(b.model&&b.model.chg)||[];
  $('stChg').textContent=chg.map(c=>c[1]).join('  ');
  countTo('n-rec',s.rec,v=>Math.round(v));countTo('n-nt',s.night,v=>Math.round(v));countTo('n-acc',s.acc,v=>v?manU(v):'0원');
  prevRail=i;
}

/* ═════════ 진행 ═════════ */
function initDualSync(root, s){
  const wrap = root.querySelector('[data-dual-sync]');
  if(!wrap) return;
  let mode = 'auto';
  const flowEl = wrap.querySelector('[data-ds-flow]');
  const detEl = wrap.querySelector('[data-ds-detail]');
  const timeEl = wrap.querySelector('[data-ds-time]');
  const pillEl = wrap.querySelector('[data-ds-pill]');
  const cards = {auto: wrap.querySelector('[data-ds-card="auto"]'), tele: wrap.querySelector('[data-ds-card="tele"]')};
  const tabs = {auto: wrap.querySelector('[data-ds-tab="auto"]'), tele: wrap.querySelector('[data-ds-tab="tele"]')};
  const vids = {auto: cards.auto.querySelector('video'), tele: cards.tele.querySelector('video')};
  const progs = {auto: wrap.querySelector('[data-ds-prog="auto"]'), tele: wrap.querySelector('[data-ds-prog="tele"]')};
  const fmtT = sec => {const m=Math.floor(sec/60),r=(sec%60).toFixed(1).padStart(4,'0');return `${String(m).padStart(2,'0')}:${r}`};
  const getSteps = () => mode==='auto' ? s.autoSteps : s.teleSteps;

  function renderNodes(){
    const steps = getSteps();
    flowEl.className = 'ds-flow' + (steps.length===4 ? ' four' : '');
    flowEl.innerHTML = steps.map((st,i)=>`<button type="button" class="ds-node" data-ds-idx="${i}">
      <div class="ds-ntop"><span class="ds-nstep">${st.code}</span><span class="ds-ntime">${st.t0.toFixed(0)}–${Math.min(33,st.t1).toFixed(0)}s</span></div>
      <div class="ds-ntitle">${st.title}</div>
      <span class="ds-nsub">${st.sub}</span>
    </button>`).join('');
    flowEl.querySelectorAll('[data-ds-idx]').forEach(el=>{
      el.addEventListener('click',e=>{
        e.stopPropagation();
        const idx = +el.dataset.dsIdx;
        const st = getSteps()[idx];
        const v = vids[mode];
        if(v) startVideo(v, { at: st.t0 + 0.25 });
        updateStep(st.t0 + 0.25);
      });
    });
  }

  let lastIdx = -1, lastMode = '';
  function updateStep(t){
    const steps = getSteps();
    let activeIdx = steps.findIndex(st => t >= st.t0 && t < st.t1);
    if(activeIdx < 0) activeIdx = steps.length - 1;
    const v = vids[mode];
    const dur = (v && v.duration > 0) ? v.duration : 33.6;
    timeEl.textContent = `${fmtT(t)} / ${fmtT(dur)}`;
    const st = steps[activeIdx];
    pillEl.textContent = st.st;
    if(activeIdx !== lastIdx || mode !== lastMode){
      lastIdx = activeIdx; lastMode = mode;
      flowEl.querySelectorAll('.ds-node').forEach((n,i)=>{
        n.classList.toggle('active', i===activeIdx);
        n.classList.toggle('done', i<activeIdx);
      });
      detEl.innerHTML = `<div class="ds-dhead"><b>${st.code} · ${st.title}</b><code>${st.fn}</code></div>
        <div class="ds-dgrid">
          <div class="ds-dbox"><small>INPUT / OUTPUT</small><div>${st.io}</div></div>
          <div class="ds-dbox"><small>BACKEND PROCESS</small><div>${st.proc}</div></div>
          <div class="ds-dbox guard"><small>SAFETY / VERIFICATION</small><div>${st.guard}</div></div>
        </div>`;
    }
  }

  function setMode(m){
    mode = m; lastIdx = -1;
    vids[m === 'auto' ? 'tele' : 'auto']?.pause();
    cards.auto.classList.toggle('active', m==='auto');
    cards.tele.classList.toggle('active', m==='tele');
    tabs.auto.className = 'ds-tab' + (m==='auto' ? ' on auto' : '');
    tabs.tele.className = 'ds-tab' + (m==='tele' ? ' on' : '');
    tabs.auto.textContent = (m==='auto' ? '● ' : '○ ') + '자율 파지 백엔드 추적';
    tabs.tele.textContent = (m==='tele' ? '● ' : '○ ') + '전체 동선 재현';
    renderNodes();
    const v = vids[mode];
    updateStep(v ? v.currentTime : 0);
  }

  ['auto','tele'].forEach(k=>{
    tabs[k].addEventListener('click',e=>{e.stopPropagation();setMode(k)});
    cards[k].querySelector('.ds-vh').addEventListener('click',e=>{e.stopPropagation();setMode(k)});
    if(vids[k]){
      vids[k].addEventListener('timeupdate',()=>{
        const v = vids[k];
        if(progs[k] && v.duration > 0) progs[k].style.width = (v.currentTime/v.duration*100).toFixed(1)+'%';
        if(mode === k) updateStep(v.currentTime);
      });
    }
  });

  setMode('auto');
}


setupStory({ sections, slides: S, states: STATES, layouts: LAY, phases: PHASES, formatDate: fmtDate, initCalendar: buildRail, updateCalendar: renderRail, initDualSync });
