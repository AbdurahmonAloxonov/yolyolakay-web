/**
 * QULAYLIK AUDITI — bitta o'tishda uch xil ko'rinmas nuqson.
 *
 * 🔴 NEGA YOZILDI (2026-09-04). Egasi «responsivlik va qulaylikni
 * ko'rib chiqaylik» dedi. Kod o'qib ham, ekranga qarab ham
 * TOPILMAYDIGAN uch turdagi xato bor ekan:
 *
 *   1. TOSHISH — element ekran chekkasidan chiqib kesiladi. Uni
 *      qidiruv paneli ko'rsatmaydi, chunki `overflow` yashiringan.
 *   2. MAYDA NISHON — yozuv normal, bosiladigan MAYDON esa 16–34 px.
 *      Odam «tugma ishlamayapti» deydi, aslida qo'shnisi bosilgan.
 *   3. KESILGAN MATN — `text-overflow: ellipsis` toshishni YUTADI.
 *      Ekran to'g'ri ko'rinadi, shunchaki yozuv tugallanmagan
 *      («Hammasini o'qilgan qil…»).
 *   4. KONTRAST — yozuv BOR, lekin zaminidan ajralmaydi. Dizayner
 *      ekranida ko'rinadi, quyoshda yoki arzon matritsada yo'q.
 *      Ilovada aynan shu tarzda o'chiq tugma 1.62:1 chiqqandi
 *      (WCAG AA: oddiy matn 4.5:1, yirik matn 3:1).
 *   5. NOMSIZ TUGMA — faqat ikonka. Ko'z bilan tushunarli, ekran
 *      o'qigich esa «button» deb o'qiydi va odam nima bosayotganini
 *      bilmaydi.
 *   6. NOMSIZ MAYDON — `<input>` ning dasturiy YORLIG'I yo'q. Ko'z
 *      uni tepasidagi yozuv bilan bog'laydi, ekran o'qigich esa
 *      «tahrirlash maydoni» deb o'qiydi va odam nima yozishini
 *      bilmaydi. Placeholder YORLIQ EMAS: yozila boshlanishi bilan
 *      u yo'qoladi.
 *   7. SARLAVHA TARTIBI — sahifada `h1` yo'q yoki daraja sakraydi
 *      (h1 dan h3 ga). Ekran o'qigich sahifani AYNAN sarlavhalar
 *      bo'yicha kezadi; sakrash — bu ro'yxatda bo'sh bo'g'in.
 *
 * ⚠️ KO'R NUQTA: zaminida SURAT yoki GRADIENT bo'lgan element
 * O'LCHANMAYDI (u yerda solishtiriladigan bitta son yo'q). Saytda
 * bunday joylar bor — masalan landing futeri (`ll-dark-panel`, ikat
 * to'qimasi ustida). Ular QO'LDA ko'riladi: aynan o'sha futerdagi
 * pushti logotip 3.17:1 bo'lib turgan edi va audit uni ko'rmagan.
 *
 * 🔑 4-tur uchun rang KO'ZGA KO'RINGANIDEK hisoblanadi: `opacity`
 * ota-onalar bo'ylab ko'paytiriladi va yarim shaffof zaminlar
 * ildizdan pastga qarab ustma-ust qo'yiladi. Aynan shuning uchun
 * `opacity-50` qo'yilgan o'chiq tugma tutiladi — uning O'Z rangi
 * qog'ozda mukammal.
 *
 * Ilovadagi juftliklari: `test/ui_narrow_audit_test.dart`,
 * `test/tap_target_test.dart`, `test/text_not_cut_test.dart`.
 *
 * ISHLATISH:
 *   npx next build && npx next start -p 3111
 *   node scripts/ui-audit.mjs                # mehmon sifatida
 *   node scripts/ui-audit.mjs <token>        # kirgan holda
 *
 * 🔑 Token bilan ishga tushirilsa himoyalangan sahifalar ham
 * tekshiriladi. Tokenni `scripts/backend-probe` dan olish mumkin:
 *   python3 -c "import sys;sys.path.insert(0,'scripts/backend-probe');
 *               import api;print(api.login('+998991234567')[0])"
 * ⚠️ LOGIN FORMASI ORQALI kirish ishlamaydi (`fill` + submit hech
 * qanday so'rov yubormaydi) — token cookie'ga qo'yiladi.
 *
 * ⚠️ Serverni qayta ishga tushirishdan oldin `fuser -k 3111/tcp`:
 * `pkill` eski jarayonni o'ldirmaydi va u eski chunk'larni berib
 * turadi (sahifa «Ilova ishga tushmadi» bo'lib chiqadi).
 */
import { chromium } from '@playwright/test';

const BASE = process.env.AUDIT_BASE || 'http://localhost:3111';
const access = process.argv[2] || '';
const PAGES=[
 ['landing','/uz'],['login','/uz/login'],['map','/uz/map'],['search','/uz/search'],['tariffs','/uz/tariffs'],
 ['profile','/uz/profile'],['parcels','/uz/parcels'],['history','/uz/history'],
 ['notifications','/uz/notifications'],['chats','/uz/chats'],['status','/uz/status'],
 ['dashboard','/uz/dashboard'],['earnings','/uz/driver/earnings'],['create-trip','/uz/driver/create-trip'],
 ['onboarding','/uz/driver/onboarding'],['payment','/uz/payment'],['privacy','/uz/privacy'],
 ['terms','/uz/terms'],['acct-del','/uz/account-delete'],['404','/uz/qwerty'],
 ['landing-ru','/ru'],['map-ru','/ru/map'],['search-ru','/ru/search'],['profile-ru','/ru/profile'],['tariffs-ru','/ru/tariffs'],
];
const b=await chromium.launch();
let problems=0;
for (const [w,label] of [[320,'320'],[390,'390']]) {
  for (const dark of [false,true]) {
    const ctx=await b.newContext({viewport:{width:w,height:844},deviceScaleFactor:1,colorScheme:dark?'dark':'light'});
    if (access) {
      await ctx.addCookies([{name:'access_token',value:access,url:BASE},{name:'refresh_token',value:access,url:BASE}]);
      await ctx.addInitScript((a)=>{localStorage.setItem('access_token',a);localStorage.setItem('refresh_token',a);},access);
    }
    const p=await ctx.newPage();
    /*
     * 🔴 ANIMATSIYA O'RTASIDA O'LCHAMAYMIZ (2026-09-04). Landingdagi
     * bloklar `.ll-reveal` bilan suzib chiqadi: `opacity` 0 dan 1 ga
     * boradi. Audit o'sha yo'lning O'RTASIDA qarasa, matn yarim
     * shaffof bo'ladi va kontrast YOLG'ON past chiqadi — jonli
     * saytda bitta o'tishda «2.70:1», keyingisida «4.02:1»
     * ko'rsatgandi. Bir xil son chiqishi uchun harakat butunlay
     * o'chiriladi va yakuniy holat majburlanadi.
     */
    await p.addInitScript(() => {
      const put = () => {
        const css = document.createElement('style');
        css.textContent =
          '*,*::before,*::after{animation:none!important;transition:none!important}' +
          '.ll-reveal,.ll-enter{opacity:1!important;transform:none!important}';
        (document.head || document.documentElement).appendChild(css);
      };
      if (document.head) put();
      else document.addEventListener('DOMContentLoaded', put);
    });
    for (const [n,path] of PAGES) {
      /*
       * 🔴 O'TISH XATOSI JIMGINA YUTILMASIN (10.09.2026).
       *
       * Ilgari bu yerda `.catch(()=>{})` turardi. Sahifa ochilmasa
       * audit avvalgi (yoki bo'sh) sahifani o'lchashda davom etardi va
       * natijada HAR BIR sahifa uchun «h1 YO'Q» deb yozardi — ya'ni
       * sof texnik uzilish 92 ta «qulaylik nuqsoni» bo'lib
       * ko'rinardi. Bir o'tishda aynan shunday bo'ldi: 390·tun
       * o'tishida hamma sahifa «h1 YO'Q» chiqdi, holbuki `h1`
       * ikkala rejimda ham JOYIDA edi (qo'lda tekshirildi).
       *
       * Endi uzilish O'ZINI aytadi va o'sha sahifa o'lchovdan
       * chetlatiladi — yolg'on nuqson yasamaydi.
       */
      let navOk = true;
      try {
        const resp = await p.goto(BASE+path,{waitUntil:'networkidle'});
        /*
         * ⚠️ FAQAT 5xx — 4xx EMAS. Ro'yxatda `404` sahifasi ATAYIN bor
         * va u, tabiiyki, 404 holat kodi bilan keladi. Lekin u to'liq
         * chiziladigan sahifa va aynan uni ham o'lchashimiz kerak
         * (birinchi urinishda `!resp.ok()` yozib, o'zim to'rtta yolg'on
         * nuqson yasadim).
         */
        if (resp && resp.status() >= 500) {
          console.log(`${label}${dark?'·tun':'    '} ${n.padEnd(14)} OCHILMADI: HTTP ${resp.status()}`);
          problems++; navOk = false;
        }
      } catch (e) {
        console.log(`${label}${dark?'·tun':'    '} ${n.padEnd(14)} OCHILMADI: ${String(e).split('\n')[0].slice(0,80)}`);
        problems++; navOk = false;
      }
      if (!navOk) continue;
      await p.waitForTimeout(1400);
      const r = await p.evaluate(()=>{
        const W=document.documentElement.clientWidth;
        const ovf=[], small=[];
        for(const el of document.querySelectorAll('body *')){
          const c=el.getBoundingClientRect();
          if(!c.width||!c.height) continue;
          const st=getComputedStyle(el);
          if(st.position==='fixed') continue;
          /*
           * YONBOSHGA SURILADIGAN tasma ichidagi element toshgan
           * HISOBLANMAYDI: u atayin ekrandan uzun va odam uni surib
           * ko'radi (bosh sahifadagi «mashhur yo'nalishlar» chiplari
           * 879 px gacha cho'ziladi — bu XATO EMAS).
           *
           * ⚠️ Faqat elementning O'ZINI tekshirish YETMAYDI — bolalari
           * ham surish maydonida yotadi.
           */
          let scroller = false;
          for (let a = el; a && a !== document.body; a = a.parentElement) {
            const as = getComputedStyle(a);
            if (as.overflowX === 'auto' || as.overflowX === 'scroll') { scroller = true; break; }
          }
          if (scroller) continue;
          /*
           * BEZAK toshishi mumkin, MAZMUN yo'q.
           *
           * ⚠️ Landingda ataylab keng chiziladigan narsalar bor:
           *   • `.ll-unroll` — ravoq ichida kesiladigan tasma (`w-[130%]`);
           *   • `aria-hidden` / `pointer-events-none` SVG dog'lari
           *     (`-right-20 -top-24`) — ular `overflow-hidden` ostida.
           * Ular hech qanday ma'lumot tashimaydi va gorizontal surish
           * ham yasamaydi (u alohida tekshiriladi). Mazmunli element
           * esa kesilsa — bu XATO va u shu ro'yxatga tushadi.
           */
          if(el.closest('.ll-unroll')) continue;
          if(el.closest('[aria-hidden="true"]')) continue;
          if(st.pointerEvents==='none') continue;
          /*
           * XARITA ICHI — toshish emas, XARITANING O'ZI (17.09.2026).
           *
           * Leaflet plitkalari va belgilari ATAYIN konteynerdan kattaroq
           * bo'ladi: xarita shunday ishlaydi, chetdagi plitka yarmi
           * ko'rinadi. Ular `.leaflet-container` ostida KESILADI va
           * gorizontal surish ham yasamaydi (u alohida tekshiriladi) —
           * ya'ni bu yolg'on ogohlantirish edi. Xarita sahifasi
           * qo'shilgach audit har o'tishda 4 ta shunday «nuqson»
           * chiqarardi va haqiqiylari shovqin ostida qolardi.
           */
          if(el.closest('.leaflet-container')) continue;
          if(c.right>W+1||c.left<-1) ovf.push(((el.textContent||el.tagName).trim().slice(0,24))+'@'+Math.round(c.right));
        }
        for(const el of document.querySelectorAll('button,a[href],input,select,textarea,[role=button]')){
          const c=el.getBoundingClientRect();
          if(!c.width||!c.height) continue;
          const st2=getComputedStyle(el);
          if(st2.visibility==='hidden'||st2.opacity==='0'||el.hidden) continue;
          if(el.tagName==='INPUT'&&el.type==='file') continue; // yashirin avatar tanlagich
          if(el.classList.contains('sr-only')) continue;        // ekran o'qigich uchun (ko'rinadigan juftligi bor)
          if(c.height<36) small.push(((el.textContent||el.getAttribute('aria-label')||el.tagName).trim().slice(0,22))+' h='+Math.round(c.height));
        }
        // KESILGAN MATN: `text-overflow: ellipsis` qo'yilgan element
        // ichidagi matn sig'maganda `scrollWidth > clientWidth`.
        const cut=[];
        for(const el of document.querySelectorAll('*')){
          const st=getComputedStyle(el);
          if(st.textOverflow!=='ellipsis') continue;
          if(el.scrollWidth - el.clientWidth < 2) continue;
          // `data-user-text` — foydalanuvchi MA'LUMOTI (manzil, ism,
          // qurilma satri). Uning kesilishi TABIIY: uzunligi oldindan
          // noma'lum. Yorliqlar esa biz yozgan matn — ular sig'ishi shart.
          if (el.closest('[data-user-text]')) continue;
          const t=(el.textContent||'').trim();
          if(t) cut.push(t.slice(0,34)+' '+el.clientWidth+'/'+el.scrollWidth);
        }
        /* ── KONTRAST ─────────────────────────────────────────────
         * Rangni «hujjatda yozilgani» emas, KO'ZGA KO'RINGANI bo'yicha
         * hisoblaymiz: `opacity` ota-onalar bo'ylab ko'payadi, yarim
         * shaffof zaminlar esa ildizdan pastga ustma-ust qo'yiladi.
         * Zaminida SURAT yoki GRADIENT bo'lsa — o'lchamaymiz (bitta
         * son yo'q; naqsh, atlas, ganch relyefi shu yerga tushadi).
         */
        /* ⚠️ Tailwind v4 ranglarni `oklab(...)` ko'rinishida beradi
         * (`bg-white/90` → `oklab(0.99 0.00004 0.00002 / 0.9)`). Uni
         * `rgb` deb o'qish rangni QORAGA aylantiradi va audit oq
         * sarlavhani «1.25:1» deb yolg'on qizil beradi. Shuning uchun
         * oklab/oklch ni haqiqiy sRGB ga o'giramiz. */
        const rgb=(s)=>{
          if(!s) return null;
          const num=(s.match(/-?[\d.]+%?/g)||[]).map(v=>v.endsWith('%')?parseFloat(v)/100:parseFloat(v));
          if(s.startsWith('rgb')) return {r:num[0],g:num[1],b:num[2],a:num[3]===undefined?1:num[3]};
          if(s.startsWith('oklab')||s.startsWith('oklch')){
            let [L,x,y,a]=num;
            if(s.startsWith('oklch')){const h=y*Math.PI/180; const C=x; x=C*Math.cos(h); y=C*Math.sin(h);}
            const l_=L+0.3963377774*x+0.2158037573*y, m_=L-0.1055613458*x-0.0638541728*y, s_=L-0.0894841775*x-1.2914855480*y;
            const l=l_**3, m=m_**3, q=s_**3;
            const g=(v)=>{v=v<=0.0031308?12.92*v:1.055*Math.pow(Math.max(v,0),1/2.4)-0.055;return Math.min(255,Math.max(0,v*255));};
            return {r:g(4.0767416621*l-3.3077115913*m+0.2309699292*q),
                    g:g(-1.2684380046*l+2.6097574011*m-0.3413193965*q),
                    b:g(-0.0041960863*l-0.7034186147*m+1.7076147010*q),
                    a:a===undefined?1:a};
          }
          if(s.startsWith('lab(')||s.startsWith('lch(')){
            /* CSS `lab()` — CIE Lab, oq nuqtasi D50 (oklab EMAS). Brauzer
             * uni `color-mix` va Tailwind ranglaridan qaytaradi; `rgb` deb
             * o'qilsa L=97 (deyarli oq) qora bo'lib ko'rinib, audit
             * yolg'on «1.00:1» beradi. */
            let [Lr,x,y,al]=num;
            const L=/%/.test(s.split(/[\s,\/]/)[0]+s)&&Lr<=1?Lr*100:Lr;
            if(s.startsWith('lch(')){const h=y*Math.PI/180, C=x; x=C*Math.cos(h); y=C*Math.sin(h);}
            const fy=(L+16)/116, fx=fy+x/500, fz=fy-y/200;
            const e=216/24389, k=24389/27, c3=(v)=>v*v*v;
            const xr=c3(fx)>e?c3(fx):(116*fx-16)/k;
            const yr=L>k*e?c3((L+16)/116):L/k;
            const zr=c3(fz)>e?c3(fz):(116*fz-16)/k;
            const X=xr*0.9642956764295677, Y=yr, Z=zr*0.8251046025104602;
            const g=(v)=>{v=v<=0.0031308?12.92*v:1.055*Math.pow(Math.max(v,0),1/2.4)-0.055;return Math.min(255,Math.max(0,v*255));};
            return {r:g(3.1341359569958987*X-1.6173863321612538*Y-0.4906619460083532*Z),
                    g:g(-0.978795502912089*X+1.916254567259524*Y+0.03344287339036*Z),
                    b:g(0.07195537988411677*X-0.2289768264158322*Y+1.405386058324125*Z),
                    a:al===undefined?1:al};
          }
          if(s.startsWith('color(')) return {r:num[0]*255,g:num[1]*255,b:num[2]*255,a:num[3]===undefined?1:num[3]};
          return {r:num[0],g:num[1],b:num[2],a:num[3]===undefined?1:num[3]};
        };
        const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
        const lum=(c)=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
        const ratio=(x,y)=>{const a=lum(x),b=lum(y);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);};
        const dim=[];
        for(const el of document.querySelectorAll('body *')){
          let own='';for(const n of el.childNodes) if(n.nodeType===3) own+=n.nodeValue;
          own=own.trim(); if(!own) continue;                    // matnni O'ZI chizadigan element
          const c=el.getBoundingClientRect(); if(!c.width||!c.height) continue;
          if(el.closest('[aria-hidden="true"]')) continue;
          if(el.classList.contains('sr-only')) continue;
          const st=getComputedStyle(el);
          if(st.visibility==='hidden') continue;
          const chain=[]; let opaqueMissing=true, skip=false;
          for(let a=el; a; a=a.parentElement){
            const as=getComputedStyle(a);
            if(as.backgroundImage!=='none'||as.mixBlendMode!=='normal'){skip=true;break;}
            const bg=rgb(as.backgroundColor)||{r:0,g:0,b:0,a:0};
            chain.push({bg,op:parseFloat(as.opacity)||0});
            if(a===document.documentElement) opaqueMissing=false;
          }
          if(skip) continue;
          if(st.textShadow!=='none') continue;                  // soya matnni ushlab turadi
          /*
           * ⚠️ SURAT USTIDAGI YOZUV o'lchanmaydi. Naqsh yoki gradient
           * `background-image` bo'lsa yuqorida to'xtatildi, lekin eng
           * ko'p uchraydigan holat boshqacha: yozuv `absolute` bo'lib
           * AKA-UKA `<img>` ustida yotadi (mashhur yo'nalish
           * kartochkalari). Zanjirda hech qanday rang yo'q, ya'ni
           * audit uni sahifa zamini ustida deb hisoblab, oq yozuvni
           * «1.09:1» deb yolg'on qizil bergandi. Bunday joyda
           * solishtiriladigan bitta rang YO'Q — u KO'Z bilan
           * ko'riladi (`scripts/page-shot.mjs`).
           */
          let overImage=false;
          for(let a=el; a && a!==document.body; a=a.parentElement){
            if(getComputedStyle(a).position!=='absolute') continue;
            const host=a.parentElement;
            if(!host) break;
            for(const media of host.querySelectorAll('img,video,canvas,picture')){
              const m=media.getBoundingClientRect();
              if(m.width && m.height && m.left<c.right && m.right>c.left && m.top<c.bottom && m.bottom>c.top){
                overImage=true; break;
              }
            }
            if(overImage) break;
          }
          if(overImage) continue;
          const prod=(i)=>{let o=1;for(let k=i;k<chain.length;k++) o*=chain[k].op;return o;};
          let acc={r:255,g:255,b:255,a:1};
          for(let i=chain.length-1;i>=0;i--){
            const a=chain[i].bg.a*prod(i);
            if(a>0.004) acc=over({...chain[i].bg,a},acc);
          }
          /* ⚠️ HALI KO'RINMAGAN element o'lchanmaydi. Landingda
           * suzib chiqadigan bloklar (`.ll-reveal`) ko'rinmaguncha
           * `opacity: 0` da turadi — u holda matn zamin bilan AYNAN
           * bir xil chiqadi va audit «1.00:1» deb sakkizta yolg'on
           * xato berardi. Bu kontrast masalasi emas: element hali
           * yo'q. */
          if(prod(0) < 0.05) continue;
          const fg0=rgb(st.color)||{r:0,g:0,b:0,a:1};
          const fg=over({...fg0,a:fg0.a*prod(0)},acc);
          const px=parseFloat(st.fontSize)||16, wt=parseInt(st.fontWeight)||400;
          const big = px>=24 || (px>=18.66 && wt>=700);
          const need = big?3:4.5;
          const r2=ratio(fg,acc);
          if(r2 < need-0.05){
            const off=el.closest('[disabled],[aria-disabled="true"]')?'·o‘chiq':'';
            dim.push(own.slice(0,22)+' '+r2.toFixed(2)+':1'+off);
          }
        }
        /* ── NOMSIZ TUGMA ─────────────────────────────────────────
         * Ekran o'qigich uchun nom: matn → `aria-label` →
         * `aria-labelledby` → `title` → ichidagi `img[alt]` →
         * `<svg><title>`. Bittasi ham bo'lmasa — odam «button» eshitadi.
         */
        const noname=[];
        for(const el of document.querySelectorAll('button,a[href],[role=button],input[type=button],input[type=submit]')){
          const c=el.getBoundingClientRect(); if(!c.width||!c.height) continue;
          const st=getComputedStyle(el);
          if(st.visibility==='hidden'||st.opacity==='0'||el.hidden) continue;
          if(el.closest('[aria-hidden="true"]')) continue;
          let name=(el.textContent||'').trim();
          if(!name) name=(el.getAttribute('aria-label')||'').trim();
          if(!name){const lb=el.getAttribute('aria-labelledby');
            if(lb) name=lb.split(/\s+/).map(id=>(document.getElementById(id)||{}).textContent||'').join(' ').trim();}
          if(!name) name=(el.getAttribute('title')||'').trim();
          if(!name){const im=el.querySelector('img[alt]'); if(im) name=(im.getAttribute('alt')||'').trim();}
          if(!name){const t=el.querySelector('svg title'); if(t) name=(t.textContent||'').trim();}
          if(!name) noname.push('<'+el.tagName.toLowerCase()+'> '+Math.round(c.x)+','+Math.round(c.y)+' '+Math.round(c.width)+'×'+Math.round(c.height));
        }
        /* ── NOMSIZ MAYDON ────────────────────────────────────────
         * Ekran o'qigich uchun nom: `<label for>` → o'rovchi
         * `<label>` → `aria-label` → `aria-labelledby` → `title`.
         * Placeholder ATAYIN sanalmaydi — u yozila boshlanishi bilan
         * yo'qoladi va yorliq vazifasini bajara olmaydi.
         */
        const nofield=[];
        for(const el of document.querySelectorAll('input,select,textarea')){
          if(el.type==='hidden') continue;
          const c=el.getBoundingClientRect(); if(!c.width||!c.height) continue;
          const st=getComputedStyle(el);
          if(st.visibility==='hidden'||el.hidden) continue;
          if(el.closest('[aria-hidden="true"]')) continue;
          let name='';
          if(el.id){const lb=document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if(lb) name=(lb.textContent||'').trim();}
          if(!name){const wrap=el.closest('label'); if(wrap) name=(wrap.textContent||'').trim();}
          if(!name) name=(el.getAttribute('aria-label')||'').trim();
          if(!name){const lb=el.getAttribute('aria-labelledby');
            if(lb) name=lb.split(/\s+/).map(id=>(document.getElementById(id)||{}).textContent||'').join(' ').trim();}
          if(!name) name=(el.getAttribute('title')||'').trim();
          if(!name) nofield.push('<'+el.tagName.toLowerCase()+(el.type?' '+el.type:'')+'> '+
            (el.getAttribute('placeholder')||el.name||'?').slice(0,24));
        }
        /* ── SARLAVHA TARTIBI ─────────────────────────────────────
         * Bitta `h1` bo'lsin va darajalar sakramasin. `sr-only`
         * sarlavha ham hisoblanadi — u ekran o'qigich uchun bor.
         */
        const heads=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
          .filter(h=>{const st=getComputedStyle(h);
            return st.display!=='none' && st.visibility!=='hidden' && !h.closest('[aria-hidden="true"]');})
          .map(h=>({lvl:+h.tagName[1], t:(h.textContent||'').trim().slice(0,20)}));
        const headBad=[];
        if(!heads.some(h=>h.lvl===1)) headBad.push('h1 YO\'Q');
        for(let i=1;i<heads.length;i++){
          if(heads[i].lvl - heads[i-1].lvl > 1)
            headBad.push(`h${heads[i-1].lvl}→h${heads[i].lvl} «${heads[i].t}»`);
        }
        /* ── ALTSIZ RASM ──────────────────────────────────────────
         * `alt=""` — TO'G'RI (bezak, ekran o'qigich o'tkazib yuboradi).
         * Atributning O'ZI yo'qligi esa xato: u holda o'qigich fayl
         * nomini o'qiy boshlaydi.
         */
        const noalt=[];
        for(const el of document.querySelectorAll('img')){
          if(el.hasAttribute('alt')) continue;
          if(el.closest('[aria-hidden="true"]')) continue;
          const c=el.getBoundingClientRect(); if(!c.width||!c.height) continue;
          noalt.push((el.getAttribute('src')||'?').split('/').pop().slice(0,28));
        }
        return {W, sw:document.documentElement.scrollWidth,
          nofield:[...new Set(nofield)].slice(0,4), headBad:headBad.slice(0,3), noalt:[...new Set(noalt)].slice(0,3), ovf:ovf.slice(0,3), small:[...new Set(small)].slice(0,3), cut:[...new Set(cut)].slice(0,4), dim:[...new Set(dim)].slice(0,8), noname:[...new Set(noname)].slice(0,3)};
      });
      if (r.ovf.length || r.small.length || r.cut.length || r.dim.length || r.noname.length ||
          r.nofield.length || r.headBad.length || r.noalt.length || r.sw>r.W) {
        problems++;
        console.log(`${label}${dark?'·tun':'    '} ${n.padEnd(14)} ${r.sw>r.W?'SURISH ':''}${r.ovf.length?'TOSH:'+JSON.stringify(r.ovf):''} ${r.small.length?'MAYDA:'+JSON.stringify(r.small):''} ${r.cut.length?'KESILDI:'+JSON.stringify(r.cut):''} ${r.dim.length?'KONTRAST:'+JSON.stringify(r.dim):''} ${r.noname.length?'NOMSIZ:'+JSON.stringify(r.noname):''} ${r.nofield.length?'MAYDON:'+JSON.stringify(r.nofield):''} ${r.headBad.length?'SARLAVHA:'+JSON.stringify(r.headBad):''} ${r.noalt.length?'ALTSIZ:'+JSON.stringify(r.noalt):''}`);
      }
    }
    await ctx.close();
  }
}
console.log(problems ? `\n${problems} ta muammo` : '\nHammasi toza');
await b.close();
process.exit(problems ? 1 : 0);
