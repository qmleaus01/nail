/* Nails Avenue — shared backend logic.
 * Runs in Node (server.js, shared data for everyone) and in the browser (demo mode, data in localStorage).
 * Zero dependencies. All business rules live here so both modes behave identically. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NABackend = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

/* ---------- utils ---------- */
const clone = o => JSON.parse(JSON.stringify(o));
const r2 = n => Math.round((+n || 0) * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const digits = v => String(v || '').replace(/\D/g, '');
const cryptoObj = () => globalThis.crypto;
function rand(n) { const a = new Uint8Array(n); cryptoObj().getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); }
const uid = p => p + Date.now().toString(36) + rand(3);
const token = () => rand(24);
const err = (status, message) => { const e = new Error(message); e.status = status; throw e; };

const dowOf = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const addDays = (ds, n) => { const [y, m, d] = ds.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const validDate = ds => typeof ds === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ds) && addDays(ds, 0) === ds;
const fmtT = m => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${pad(mm)} ${h >= 12 && h < 24 ? 'PM' : 'AM'}`; };
function nowIn(tz) {
  try {
    const p = {}; new Intl.DateTimeFormat('en-CA', {timeZone:tz, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false}).formatToParts(new Date()).forEach(x => p[x.type] = x.value);
    return {date:`${p.year}-${p.month}-${p.day}`, min:(+p.hour % 24) * 60 + +p.minute};
  } catch (e) { const d = new Date(); return {date:`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, min:d.getHours() * 60 + d.getMinutes()}; }
}

async function hashPw(pw, salt) {
  const c = cryptoObj() && cryptoObj().subtle;
  const enc = new TextEncoder();
  if (c) {
    const key = await c.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await c.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:enc.encode(salt), iterations:120000}, key, 256);
    return 'p2$' + [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261; for (const b of enc.encode(salt + ':' + pw)) { h ^= b; h = Math.imul(h, 16777619); } return 'f$' + (h >>> 0).toString(16);
}

/* ---------- default content ---------- */
const SHAPE_KEYS = ['almond','square','coffin','stiletto','round','oval','squoval'];
const PRESET_KEYS = ['none','french','ombre','glitter','floral','marble','halfmoon','dots','lines'];
const ADDON_KEYS = ['rhinestone','charm','chrome','art'];
const fingerOf = i => i < 5 ? i : 9 - i;
function blankNail() { return {shape:null, base:'#F3D9D5', accent:'#FFFFFF', preset:'none', addons:{}, custom:null}; }
function newDesign() { return {shape:'almond', nails:Array.from({length:10}, blankNail), images:{}}; }
function mk(shape, base, preset, accent, addons, over) {
  const d = newDesign(); d.shape = shape;
  d.nails.forEach((n, i) => { Object.assign(n, {base, preset, accent, addons:Object.assign({}, addons || {})}); const o = (over || {})[fingerOf(i)]; if (o) Object.assign(n, clone(o)); });
  return d;
}

function defaultContent() {
  return {
    shop:{
      name:'Nails Avenue', tagline:'Where Elegance Meets Every Fingertip',
      heroTitle:'Where Elegance Meets', heroAccent:'Every Fingertip',
      heroLead:'Refined manicures, restorative pedicures and artful designs — crafted with care in a calm, beautiful space. Design your set online, then let our artists bring it to life.',
      aboutTitle:'A quiet corner for beautiful hands',
      aboutText:"Nails Avenue was created for people who love the details. We believe a great manicure is more than color — it's the calm of the space, the care in every stroke, and a finish that lasts.\n\nWhether you want a clean classic or a statement set, our artists work with you to make it yours — and our online Design Studio lets you plan it before you arrive.",
      address:'Shop 5/30 Denison St, North Sydney NSW 2060', mapQuery:'Nails Avenue Victoria Cross Metro, 30 Denison St, North Sydney NSW 2060',
      phone:'0425 289 569', email:'hello@nailsavenue.com',
      instagram:'https://www.instagram.com/nailsavenuevictoriacross/', facebook:'',
      currency:'$', timezone:'Australia/Sydney',
      hours:[null,[540,1110],[540,1110],[540,1110],[540,1140],[540,1110],[540,1020]], // Sun..Sat, minutes; null = closed
      bookingWindowDays:60, slotStep:30
    },
    categories:['Manicure','Pedicure','Nail Art','Extensions','Add-ons'],
    services:[
      {id:'s1',cat:'Manicure',name:'Classic Manicure',price:20,dur:30,desc:'Shaping, cuticle care, hand massage and a polish of your choice.',active:true},
      {id:'s2',cat:'Manicure',name:'Gel Manicure',price:35,dur:45,desc:'High-shine gel color that stays flawless for up to three weeks.',active:true},
      {id:'s3',cat:'Manicure',name:'Signature Spa Manicure',price:45,dur:60,desc:'Exfoliating scrub, hydrating mask and warm towel ritual, finished in gel.',active:true},
      {id:'s4',cat:'Pedicure',name:'Classic Pedicure',price:30,dur:45,desc:'Warm soak, nail shaping, callus care and a relaxing foot massage.',active:true},
      {id:'s5',cat:'Pedicure',name:'Gel Pedicure',price:45,dur:60,desc:'Our classic pedicure finished with chip-resistant gel color.',active:true},
      {id:'s6',cat:'Pedicure',name:'Luxury Spa Pedicure',price:60,dur:75,desc:'Sea-salt scrub, paraffin wrap and an extended massage.',active:true},
      {id:'s7',cat:'Nail Art',name:'Minimal Nail Art',price:10,dur:15,desc:'Fine lines, dots or a delicate accent — the understated finishing touch.',active:true},
      {id:'s8',cat:'Nail Art',name:'French Tip',price:12,dur:15,desc:'Timeless classic or modern micro-French in any color.',active:true},
      {id:'s9',cat:'Nail Art',name:'Custom Nail Art',price:25,dur:30,desc:'Hand-painted designs created from your ideas or the Design Studio.',active:true},
      {id:'s10',cat:'Extensions',name:'Acrylic Full Set',price:55,dur:75,desc:'Durable sculpted length in the shape of your choice.',active:true},
      {id:'s11',cat:'Extensions',name:'Gel-X Extensions',price:65,dur:80,desc:'Lightweight soft-gel tips for natural-looking length.',active:true},
      {id:'s12',cat:'Extensions',name:'Dip Powder',price:45,dur:60,desc:'Strong, odor-free color that lasts beautifully.',active:true},
      {id:'s13',cat:'Add-ons',name:'Gel Removal',price:10,dur:15,desc:'Gentle, damage-free removal of existing gel or dip.',active:true},
      {id:'s14',cat:'Add-ons',name:'Chrome Powder',price:12,dur:10,desc:'Mirror-like pearl, rose-gold or silver finish.',active:true},
      {id:'s15',cat:'Add-ons',name:'Rhinestones & Charms',price:8,dur:10,desc:'Crystals, pearls or 3D charms placed by hand.',active:true},
      {id:'s16',cat:'Add-ons',name:'Paraffin Treatment',price:15,dur:15,desc:'Warm paraffin wax to deeply soften hands or feet.',active:true}
    ],
    staff:[
      {id:'st1',name:'Linh',role:'Senior Nail Artist',days:[1,2,3,4,5,6],start:540,end:1140,color:'#F3D9D5',active:true},
      {id:'st2',name:'Mai',role:'Nail Art Specialist',days:[2,3,4,5,6],start:600,end:1140,color:'#EBD9C6',active:true},
      {id:'st3',name:'Anna',role:'Extensions Expert',days:[1,2,4,5,6],start:540,end:1020,color:'#E8CFC4',active:true},
      {id:'st4',name:'Vy',role:'Pedicure & Spa',days:[1,3,4,5,6],start:540,end:1140,color:'#E4E0D4',active:true}
    ],
    galleryCats:['French','Ombre','Glitter','Chrome','3D Art','Floral','Marble','Minimal','Nail Art'],
    gallery:[
      {id:'g1',name:'Classic French',cat:'French',bg:'#F3D9D5',desc:'Soft sheer pink with crisp white tips — timeless and endlessly elegant.',d:mk('almond','#F6E1DB','french','#FFFFFF')},
      {id:'g2',name:'Rosewater Ombré',cat:'Ombre',bg:'#FBF7F2',desc:'A dreamy fade from dusty rose to blush on a sleek coffin shape.',d:mk('coffin','#F3D9D5','ombre','#D9A6A0')},
      {id:'g3',name:'Mocha Fade',cat:'Ombre',bg:'#EBD9C6',desc:'Warm mocha melting into beige — cozy, rich and understated.',d:mk('square','#F5EDE4','ombre','#6E4B3A')},
      {id:'g4',name:'Blush Florals',cat:'Floral',bg:'#F5EDE4',desc:'Hand-painted blossoms on ivory with a shimmering glitter accent.',d:mk('oval','#FBF7F2','floral','#D9A6A0',{},{1:{preset:'glitter',accent:'#C9A96E',base:'#F3D9D5'}})},
      {id:'g5',name:'Champagne Glitter',cat:'Glitter',bg:'#F3D9D5',desc:'Golden champagne sparkle, dense at the tip and fading to the cuticle.',d:mk('almond','#EBD9C6','glitter','#C9A96E')},
      {id:'g6',name:'Pearl Chrome',cat:'Chrome',bg:'#E8CFC4',desc:'Glazed-donut pearl chrome over a milky nude. Glossy perfection.',d:mk('almond','#F3E9E4','none','#FFFFFF',{chrome:true})},
      {id:'g7',name:'Rose Gold Chrome',cat:'Chrome',bg:'#FBF7F2',desc:'Mirror-finish rose chrome on a bold stiletto.',d:mk('stiletto','#D9A6A0','none','#FFFFFF',{chrome:true})},
      {id:'g8',name:'Golden Hearts 3D',cat:'3D Art',bg:'#F3D9D5',desc:'Sculpted gold heart charms and crystals on soft blush.',d:mk('coffin','#F3D9D5','none','#FFFFFF',{},{1:{addons:{charm:true,rhinestone:true}},3:{addons:{rhinestone:true}}})},
      {id:'g9',name:'Crystal Cocoa',cat:'3D Art',bg:'#EBD9C6',desc:'Deep cocoa squoval nails finished with hand-set crystals.',d:mk('squoval','#4A342E','none','#FFFFFF',{rhinestone:true})},
      {id:'g10',name:'Latte Marble',cat:'Marble',bg:'#F5EDE4',desc:'Ivory stone with soft taupe veins — quiet luxury.',d:mk('square','#FBF7F2','marble','#8A7267')},
      {id:'g11',name:'Nude Half Moon',cat:'Minimal',bg:'#FBF7F2',desc:'A modern take on the vintage half-moon manicure.',d:mk('round','#E8CFC4','halfmoon','#FBF7F2')},
      {id:'g12',name:'Fine Line Nude',cat:'Minimal',bg:'#F3D9D5',desc:'Barely-there beige with whisper-thin mocha lines.',d:mk('oval','#F5EDE4','lines','#6E4B3A')},
      {id:'g13',name:'Polka Blush',cat:'Minimal',bg:'#EBD9C6',desc:'Playful ivory dots scattered on dusty pink.',d:mk('squoval','#D9A6A0','dots','#FBF7F2',{},{2:{preset:'none'}})},
      {id:'g14',name:'Mocha Micro French',cat:'French',bg:'#F5EDE4',desc:'Ultra-fine mocha tips on a clean natural base.',d:mk('squoval','#F3E4DC','french','#6E4B3A')},
      {id:'g15',name:'Midnight Stardust',cat:'Glitter',bg:'#E8CFC4',desc:'Dark espresso stiletto with champagne stardust.',d:mk('stiletto','#2E2220','glitter','#E8C9A0')},
      {id:'g16',name:'Love Notes',cat:'Nail Art',bg:'#FBF7F2',desc:'Delicate hand-drawn hearts and leaves on blush — sweet and subtle.',d:mk('almond','#F3D9D5','none','#FFFFFF',{art:true},{0:{addons:{}},2:{addons:{}},4:{addons:{}}})}
    ].map(g => Object.assign(g, {visible:true})),
    features:{studio:true, gallery:true, reviews:true},
    reviews:{
      mapsUrl:'https://www.google.com/maps/place/Nails+Avenue+Victoria+Cross+Metro/@-33.8374849,151.2075537,15z/data=!4m15!1m8!3m7!1s0x6b12af2b4211f723:0x59a3e8bdef4e2ce9!2sNails+Avenue+Victoria+Cross+Metro!8m2!3d-33.8374849!4d151.207574!10e5!16s%2Fg%2F11y7hwwqbc!3m5!1s0x6b12af2b4211f723:0x59a3e8bdef4e2ce9!8m2!3d-33.8374849!4d151.207574!16s%2Fg%2F11y7hwwqbc!18m1!1e1',
      writeUrl:'', placeQuery:'Nails Avenue Victoria Cross Metro, North Sydney', placeId:'', useGoogle:true,
      rating:4.4, count:141, seeded:1, // from Google Maps, 25 Sep 2026
      items:[{"id": "gr1", "author": "Hanna Alejandro", "rating": 5, "text": "I’ve been coming here for over 2 years, and the service has always been amazing. What I love most is that, unlike many other nail salons, they never rush. They really take the time to thoroughly clean and prep your nails before carefully applying the polish, and it truly shows in the final result. I’m always happy with how my nails turn out. shout-out to Cindy, who did my nails today—thank you for another beautiful set! Highly recommend!", "date": "July 2026", "visible": true}, {"id": "gr2", "author": "Tanya", "rating": 5, "text": "Absolutely in love with my nails!\nThe service was amazing from start to finish. The ladies were incredibly friendly and helped me choose the perfect nail shape and colour. Their advice was spot on, and the cat eye design looks absolutely stunning.\nSuch a great experience overall easily one of the best nail services I’ve had in Sydney. I’ll definitely be coming back!", "date": "April 2026", "visible": true}, {"id": "gr3", "author": "Sophia P", "rating": 1, "text": "Visited together with my mum, everything seemed to be extra, the length, the colour, every broken nail… really added up so we changed the design all together for just some regular colour which was $10 extra.. wasn’t even that nice. After a few days, the sparkly blue, changed into a gross yellow like. In 24 hours, two of my mums nails peeled off. We visited them again to repair the nails and the ladies were also surprised at the colour change. How can you use such poor quality nail polishes and charge extra for them. They did repair the nails without extra charge.\nAs for me, I’m currently on day 14, with only three acrylic nails still remaining on my hands. Visiting a different salon today.\nThey were also quite unpleasant, which I’m used to because it seems the norm in most nail studios but the lack of empathy when taking off broken nails was appalling as was the attitude an the obvious gossiping the nail technicians did.", "date": "February 2026", "visible": false}, {"id": "gr4", "author": "Priskila Salim", "rating": 5, "text": "Love my nails so much!!! Julie did an amazing job from start to finish. She was so helpful when helping me choose the colour, and the whole process was done with so much care and attention to detail. The shaping, application, and overall finish were all super clean and polished. So happy with how elegant they turned out 🫶", "date": "May 2026", "visible": true}, {"id": "gr5", "author": "Amber", "rating": 5, "text": "Highly recommend!\nI was traveling in Australia and happened to find this nail salon, so I decided to give it a try. I didn’t have high expectations at first, but it turned out to be a very worthwhile experience.\nThe staff were extremely friendly and helpful, and the service was excellent. I’m really happy with my nails. I will definitely come back next time I visit Australia 💜", "date": "April 2026", "visible": true}, {"id": "gr6", "author": "Luiziane Branta", "rating": 5, "text": "Amazing service. They gave me recommendations about better techniques to keep the nails healthier, new cut styles that would match more with my hands, also time of service was quick with good quality. Loved it 🥰", "date": "May 2026", "visible": true}, {"id": "gr7", "author": "Stephanie Mowad", "rating": 5, "text": "Love coming here, the girls are so kind and always happy to create anything I want.\nSo creative and talented! Cindy did the nails in this image today and whilst they are chic and simple  Cindy has done amazing nail art also for me! Highly Recommend! :)", "date": "July 2026", "visible": true}, {"id": "gr8", "author": "Chloe Nguyen", "rating": 5, "text": "I had my nails done with Cindy today. It was my first time walking in, and I was really impressed. She took the time to explain the techniques and handled my nails with genuine care. I’m usually quite cautious with nail salons because many tend to rush, which can be uncomfortable, but this experience felt completely different.", "date": "May 2026", "visible": true}, {"id": "gr9", "author": "Jill Somerville", "rating": 5, "text": "Honestly 10/10 experience! First time visiting and Cindy did my nails and she was so quick and the design was exactly what I asked for 😊\n\nGot acrylic infills and gel design and was in and out in 45 minutes.\n\nThe salon is really cute too and really clean and everything looks brand new.\n\nWill definitely be back.", "date": "April 2026", "visible": true}, {"id": "gr10", "author": "Alyssa Quinn", "rating": 5, "text": "I had an incredible experience getting my nails done by Julie. She is truly an artist—I’ve never seen my nails look so beautiful! The entire team is welcoming, professional, and friendly. If you're looking for high-quality work and a great atmosphere, I highly recommend this place.", "date": "April 2026", "visible": true}, {"id": "gr11", "author": "Cindy L", "rating": 5, "text": "I wasn’t sure about getting square nails, but she recommended them and I’m so glad I listened. She took the time to understand what I wanted and gave great advice. Love the result!", "date": "March 2026", "visible": true}, {"id": "gr12", "author": "kobi anderson", "rating": 5, "text": "Such an amazing salon. Cindy is incredible and so attentive. I am so pleased and they were so accommodating with figuring out my design.", "date": "May 2026", "visible": true}, {"id": "gr13", "author": "Aarushi Jashank", "rating": 5, "text": "Absolutely love the service, got acrylic infills and pedicure, Cindy and Mai were adorable and took their time with my nails. Will definitely go back! Thank you🫶🏾🫶🏾", "date": "April 2026", "visible": true}, {"id": "gr14", "author": "Arisa", "rating": 1, "text": "I changed my shellac on 2/July after work, 4/10 nails are already chipped and broken.\nThat lady who did to me, she was bossy and rush to be done.\nNever go again don’t recommend.", "date": "July 2026", "visible": false}, {"id": "gr15", "author": "Lisley Bacelar", "rating": 1, "text": "3 days after manicure 🥰 how lovely it looks an? I also said so many times “please cut it short cause I can’t have long nails since I’m a nurse” but someone thought it wasn’t going to look beautiful enough so she didn’t listen to me and thanks you for make my nails so week and breakable 💅🏽 now I have to book an appointment with my long term manicure after the adventure In trying a new one 👏🏽", "date": "March 2026", "visible": false}, {"id": "gr16", "author": "Julie Teng-Williams", "rating": 3, "text": "Lots of colour options but poor and way too fast service. Very basic work. Not like the North Sydney station location with friendly service, great massage and cash discount (needs to be $51 $50). I will not return to this location", "date": "August 2026", "visible": false}, {"id": "gr17", "author": "Ashleigh Yip", "rating": 2, "text": "I had a very disappointing experience at this nail salon. The customer service was rude and unprofessional, and I didn't feel welcomed throughout my appointment.\n\nUnfortunately, the quality of the nails was just as disappointing. They started lifting and chipping in less than 10 days, but cost 85dollars! which is far below what I would expect from a professional salon. When I go back to fix, they behaved quite rude at me and not willing to fix for me. And keep talking in Vietnamese throughout my time there.\n\nWhen you're paying for a service, you expect both good workmanship and respectful customer service. Sadly, this salon delivered neither. I won't be returning and wouldn't recommend it based on my experience.", "date": "August 2026", "visible": false}, {"id": "gr18", "author": "Andrea Dighton", "rating": 5, "text": "This salon is so beautifully presented - I love the colours! The staff are so lovely. I got shellac toes done by Tin and he did such a thorough job my feet feel clean and my nails are really well done. He also put some hardener on my finger nails and that was great too. Thank you to everyone at Nails Avenue Victoria cross!", "date": "2025", "visible": true}, {"id": "gr19", "author": "Francisca weisz", "rating": 1, "text": "They did my nails in 20 minutes but super bad done, and is not cheap for that", "date": "August 2026", "visible": false}, {"id": "gr20", "author": "Jackie de Nooijer", "rating": 5, "text": "Cindy was so lovely and did a great job in a very short time! She removed my old gellac first (without it being painful) shaped my nails and gave them a pretty colour. Would definitely recommend! I’m very happy with my ‘cat eyes’ nails! 😁 thank you so much", "date": "May 2026", "visible": true}, {"id": "gr21", "author": "avie wilson", "rating": 5, "text": "I went on Saturday afternoon and got straight in. They were happy and a lady called nana (hope I spelt that right) did my nails and I’m obsessed. She did such a great job and the shapes is on point. My toes were done by another lady and she made them look normal again 😝\nThanks again and I can’t wait to bring my bestie and mum in next time.", "date": "January 2026", "visible": true}, {"id": "gr22", "author": "Madelina Jean", "rating": 5, "text": "Nana’s design skills are amazing!! She did a cowboy themed set for me! Beyond obsessed !", "date": "March 2026", "visible": false}, {"id": "gr23", "author": "Natasha McDougald", "rating": 5, "text": "Love the Bicotira Cross location, the staff are lovely, and their work is excellent. I love getting the ballerina pink chrome gels", "date": "June 2026", "visible": false}, {"id": "gr24", "author": "Sonya Nobbs", "rating": 5, "text": "Thank you so much Nails Avenue, love the nails and your artistry.\nReally lovely customer service. 👌✨", "date": "July 2026", "visible": false}, {"id": "gr25", "author": "Samantha Schucroft", "rating": 5, "text": "Loved the salon soo pretty Julie was fantastic loved the service ❤️ my ombre nails were done beautifully.\nHighly recommend. They are opened till 6pm and so convenient they are also open on Sunday.\nGod bless you Julie", "date": "July 2026", "visible": false}, {"id": "gr26", "author": "eloise collins", "rating": 5, "text": "Love coming to Nails Avenue, they always do a great job, and reasonable price. Best nail salon in the area.", "date": "May 2026", "visible": false}, {"id": "gr27", "author": "Sarah Vo", "rating": 1, "text": "I do not recommend this salon. I asked for my BIAB to be removed and replaced with ordinary nail polish. Unfortunately, my nails were over filed and the application was poorly performed. The experience left my nails sensitive and extremely weak. I will not be returning.", "date": "December 2025", "visible": false}, {"id": "gr28", "author": "Soo Ah Sarah Kang", "rating": 5, "text": "Always my goto:) got a cat eye nails set🤎🤎 super cuteee and chic!! Thank youuuu", "date": "August 2026", "visible": false}, {"id": "gr29", "author": "Aenny Ha", "rating": 5, "text": "Super happy with the shop, staff is friendly, not pushy at all and they will always give me good recommendation which match my skin colour and occasion. 👍👍👍👍", "date": "August 2026", "visible": false}, {"id": "gr30", "author": "Aanchal Bhutani", "rating": 5, "text": "Julie was amazing! Her attention to detail and recommendations were perfect. I got exactly what I was looking for. Highly recommend!", "date": "June 2026", "visible": false}, {"id": "gr31", "author": "Yee Mon", "rating": 5, "text": "Always love coming here - they do a great job with the designs ❤️", "date": "June 2026", "visible": false}, {"id": "gr32", "author": "Lilia Benefiel", "rating": 3, "text": "I feel very rushed. If you’d rather have a relaxed experience when you want to get your nails done, this salon isn’t the right place.\n\nThe place looks clean and decent, with experienced staff, however, I didn’t appreciate all the rush and honestly, the speed gave me anxiety .", "date": "May 2026", "visible": false}, {"id": "gr33", "author": "Venus Lee", "rating": 5, "text": "Very nice ladies!! I got a mani and pedi for $65 but there was a grand opening discount which was very nice. It’s very cheap, my friend got a full set of acrylics which looked so good *photos below* and it was very fast. They were exactly how she wanted them. the lady also gave me a foot and hand massage too! Highly recommend.", "date": "2024", "visible": false}, {"id": "gr34", "author": "Daniel Packer", "rating": 5, "text": "The team was very friendly and communication beforehand for setting up the appointment was great. They helped with picking the colour and got a little massage with lotion at the end. Lovely service", "date": "July 2026", "visible": false}, {"id": "gr35", "author": "Kathryn Jarvis", "rating": 5, "text": "Fantastic team, always have if fab nails and help me choose the colour!", "date": "May 2026", "visible": false}, {"id": "gr36", "author": "Kathy D", "rating": 5, "text": "My nails look amazingggg\nThis shop salon is under new management\nHighly recommended and I am definitely coming back", "date": "March 2026", "visible": false}, {"id": "gr37", "author": "Emily Randell", "rating": 5, "text": "Love this nail salon!! I usually have a gel mani and pedi, the staff do a fantastic job, are very friendly and affordable too! I don’t trust anyone else with my nails now 💕", "date": "2025", "visible": false}, {"id": "gr38", "author": "Lyn Lyn", "rating": 5, "text": "Amazing experience, Cindy did my nails and it was so professional and quick. I’m so happy with the results and I will be back! I give this place 10/10 :) thank you so much ❤️❤️", "date": "March 2026", "visible": false}, {"id": "gr39", "author": "Chloe A", "rating": 1, "text": "Avoid. Very disappointed with my experience here today.\n\nTo start with, I had to wait 20 minutes past my appointment time before being seen. When someone finally began my nails, they filed them very carelessly, cutting me multiple times and shaping them incorrectly.\n\nAnother lady then took over and told me she was sick, which was quite uncomfortable to hear. Unfortunately, the quality of the work was still poor. My nails are thick and uneven, and I have no confidence they will last long.\n\nOverall a very disappointing experience. I wouldn’t return.", "date": "March 2026", "visible": false}, {"id": "gr40", "author": "rafaella ferrone", "rating": 5, "text": "I love getting my nails done here, Julie is amazing!!!", "date": "May 2026", "visible": false}, {"id": "gr41", "author": "vinita chelwani", "rating": 5, "text": "Julie did an amazing job and she is a very kind person.", "date": "May 2026", "visible": false}, {"id": "gr42", "author": "Lindsey Blanchetti", "rating": 5, "text": "My cat eye shellac manicure turned out great and I was very happy with the results.", "date": "September 2026", "visible": false}, {"id": "gr43", "author": "ross", "rating": 1, "text": "I came in on my lunch break to get some press on nails removed. I explained multiple times that they were regular press-on nails and that only the glue needed to be dissolved. The staff completely cut up my press-on nails and threw them out", "date": "May 2026", "visible": false}, {"id": "gr44", "author": "Karen Loong", "rating": 5, "text": "Great service , lovely girls.  Cindy did a great job with my full set tips & BIAB.  She is skilled.  My nails are delicate looking and beautiful.", "date": "April 2026", "visible": false}, {"id": "gr45", "author": "Isobella Lucic", "rating": 5, "text": "The girls here do a great job every time!", "date": "September 2026", "visible": false}, {"id": "gr46", "author": "Sitara Stephens", "rating": 5, "text": "Nanna was so polite and professional! Her and the staff members around her were so sweet and she’s such a great artist! I’m inlove with my nails 💅🏽", "date": "January 2026", "visible": false}, {"id": "gr47", "author": "Jane Bion", "rating": 5, "text": "Love my gel refills!!! Thank you very much 💕", "date": "July 2026", "visible": false}, {"id": "gr48", "author": "Macey Leech", "rating": 1, "text": "This place is so expensive! They charged me for long nails when they are the normal length i always get. They said it $15 extra for long nails when I have never been charged that much. They also fell off after 6 days. I normally have nails on for 2 and a half weeks to 3 weeks. Do not come here to get nails done. Go to chatswood!", "date": "2025", "visible": false}, {"id": "gr49", "author": "Yao O'Neill", "rating": 5, "text": "Amzing nail job.. made my nail shining and beautiful..highly recommended to come here for the best nail looking", "date": "December 2025", "visible": false}, {"id": "gr50", "author": "Kristy Carapiet", "rating": 5, "text": "Amazing service at Nails Ave Vic X highly recommend!", "date": "July 2026", "visible": false}]
    },
    prices:{
      base:15, customEst:4, designMin:30,
      presets:{none:0,french:2,ombre:2.5,glitter:1.5,floral:4,marble:3,halfmoon:2,dots:1.5,lines:1},
      addons:{rhinestone:1.5,charm:4,chrome:2.5,art:5}
    }
  };
}
function emptyDb() { return {version:2, content:defaultContent(), users:[], sessions:{}, bookings:[], designs:[], transactions:[], messages:[], admin:{hash:null, salt:null}, secrets:{googleApiKey:''}}; }
function migrate(db) {
  const e = emptyDb();
  for (const k in e) if (db[k] == null) db[k] = e[k];
  for (const k in e.content) if (db.content[k] == null) db.content[k] = e.content[k];
  for (const k in e.content.shop) if (db.content.shop[k] == null) db.content.shop[k] = e.content.shop[k];
  for (const k in e.content.features) if (db.content.features[k] == null) db.content.features[k] = e.content.features[k];
  if (!db.content.reviews.seeded) { // one-time: bring in the Google reviews captured for the shop
    const R = db.content.reviews, d = e.content.reviews;
    if (!R.items || !R.items.length) R.items = d.items;
    if (R.rating == null) R.rating = d.rating;
    if (R.count == null) R.count = d.count;
    R.seeded = 1;
  }
  for (const k in e.content.reviews) if (db.content.reviews[k] == null) db.content.reviews[k] = e.content.reviews[k];
  for (const k in e.secrets) if (db.secrets[k] == null) db.secrets[k] = e.secrets[k];
  return db;
}

/* ---------- pricing & scheduling (shared with the frontend) ---------- */
function priceParts(list, P) {
  let presets = 0, addons = 0, custom = 0;
  list.forEach(n => { presets += num(P.presets[n.preset]); (n.addons || []).forEach(a => addons += num(P.addons[a])); if (n.custom) custom += num(P.customEst); });
  const base = num(P.base);
  return {base, presets:r2(presets), addons:r2(addons), custom:r2(custom), total:r2(base + presets + addons + custom), status:custom ? 'pending_confirmation' : 'fixed'};
}
const recordParts = (rec, P) => priceParts(rec.nails.map(n => ({preset:n.preset_id || 'none', addons:n.addons || [], custom:!!n.custom_image})), P);

function staffFree(C, busy, st, ds, t, dur, ignoreId, skipHours) {
  if (!st || st.active === false) return false;
  if (!skipHours) {
    const dow = dowOf(ds), h = C.shop.hours[dow];
    if (!h || !st.days.includes(dow)) return false;
    if (t < Math.max(h[0], st.start) || t + dur > Math.min(h[1], st.end)) return false;
  }
  return !busy.some(b => b.id !== ignoreId && b.staff_id === st.id && b.date === ds && t < b.start + b.duration && b.start < t + dur);
}
function dateBookable(C, ds, now) { return validDate(ds) && ds >= now.date && ds <= addDays(now.date, C.shop.bookingWindowDays) && !!C.shop.hours[dowOf(ds)]; }
function slotsFor(C, busy, ds, dur, now) {
  if (!dateBookable(C, ds, now)) return [];
  const h = C.shop.hours[dowOf(ds)], step = C.shop.slotStep || 30, out = [];
  for (let t = h[0]; t + dur <= h[1]; t += step) {
    if (ds === now.date && t < now.min + 30) continue;
    const st = C.staff.filter(s => staffFree(C, busy, s, ds, t, dur)).map(s => s.id);
    if (st.length) out.push({t, staff:st});
  }
  return out;
}
const busyList = db => db.bookings.filter(b => b.status !== 'cancelled').map(b => ({id:b.id, staff_id:b.staff_id, date:b.date, start:b.start, duration:b.duration}));

/* ---------- views ---------- */
const publicUser = u => ({id:u.id, name:u.name, email:u.email, phone:u.phone, created_at:u.created_at});
function publicContent(C) {
  const c = clone(C);
  c.services = c.services.filter(s => s.active !== false);
  c.staff = c.staff.filter(s => s.active !== false).map(({id, name, role, days, start, end, color, active}) => ({id, name, role, days, start, end, color, active}));
  c.gallery = c.features.gallery === false ? [] : c.gallery.filter(g => g.visible !== false);
  c.reviews = {mapsUrl:c.reviews.mapsUrl, writeUrl:c.reviews.writeUrl};
  return c;
}
function reviewsView(C) {
  const R = C.reviews, items = (R.items || []).filter(x => x.visible !== false).map(x => ({author:x.author, rating:x.rating, text:x.text, date:x.date, source:'manual'}));
  const avg = items.length ? r2(items.reduce((t, x) => t + x.rating, 0) / items.length) : null;
  return {enabled:C.features.reviews !== false, source:'manual', rating:R.rating != null ? R.rating : avg, count:R.count != null ? R.count : (items.length || null),
    items, mapsUrl:R.mapsUrl || '', writeUrl:R.writeUrl || R.mapsUrl || '', placeQuery:R.placeQuery || C.shop.name};
}
function bookingView(b) { const v = clone(b); delete v.claim; delete v.admin_note; return v; }
function designView(d) { const v = clone(d); delete v.claim; return v; }
const canAccess = (d, user, claim) => !!((user && d.user_id === user.id) || (claim && d.claim && d.claim === claim));

/* ---------- validation ---------- */
function cleanDesign(b, P) {
  const nails = Array.isArray(b.nails) ? b.nails : [];
  if (nails.length !== 10) err(400, 'Invalid design.');
  const color = v => /^#[0-9a-fA-F]{6}$/.test(v || '') ? v.toUpperCase() : '#F3D9D5';
  const shape = v => SHAPE_KEYS.includes(v) ? v : 'almond';
  const src = b.images && typeof b.images === 'object' ? b.images : {}, images = {};
  const out = {
    nail_shape:shape(b.nail_shape),
    nails:nails.map((n, i) => {
      let ci = null; const im = n.custom_image;
      if (im && typeof src[im.image_id] === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(src[im.image_id])) {
        const id = str(im.image_id, 60); images[id] = src[id];
        ci = {image_id:id, x:r2(num(im.x)), y:r2(num(im.y)), scale:Math.min(5, Math.max(.1, num(im.scale, 1))), rotation:Math.round(num(im.rotation))};
      }
      return {nail_index:i, nail_shape:shape(n.nail_shape), base_color:color(n.base_color), accent_color:color(n.accent_color),
        preset_id:PRESET_KEYS.includes(n.preset_id) && n.preset_id !== 'none' ? n.preset_id : null,
        addons:(Array.isArray(n.addons) ? n.addons : []).filter(a => ADDON_KEYS.includes(a)), custom_image:ci};
    }),
    images,
    name:str(b.name, 80) || 'My Design',
    preview_image_url:typeof b.preview_image_url === 'string' && /^data:image\//.test(b.preview_image_url) ? b.preview_image_url : ''
  };
  const pr = recordParts(out, P); out.estimated_price = pr.total; out.price_status = pr.status;
  return out;
}
function cleanEditorDesign(d) {
  if (!d || !Array.isArray(d.nails) || d.nails.length !== 10) err(400, 'Invalid gallery design.');
  const color = v => /^#[0-9a-fA-F]{6}$/.test(v || '') ? v.toUpperCase() : '#F3D9D5';
  const images = {};
  const nails = d.nails.map(n => {
    let custom = null;
    if (n.custom && d.images && typeof d.images[n.custom.img] === 'string') { images[n.custom.img] = d.images[n.custom.img]; custom = {img:str(n.custom.img, 60), x:num(n.custom.x), y:num(n.custom.y), s:num(n.custom.s, 1), r:num(n.custom.r)}; }
    const addons = {}; ADDON_KEYS.forEach(k => { if (n.addons && n.addons[k]) addons[k] = true; });
    return {shape:SHAPE_KEYS.includes(n.shape) ? n.shape : null, base:color(n.base), accent:color(n.accent), preset:PRESET_KEYS.includes(n.preset) ? n.preset : 'none', addons, custom};
  });
  return {shape:SHAPE_KEYS.includes(d.shape) ? d.shape : 'almond', nails, images};
}
function cleanContent(key, v, C) {
  const minutes = x => Math.min(1440, Math.max(0, Math.round(num(x))));
  switch (key) {
    case 'shop': {
      const s = Object.assign({}, C.shop);
      ['name','tagline','heroTitle','heroAccent','address','mapQuery','phone','email','instagram','facebook','timezone','aboutTitle'].forEach(k => { if (k in v) s[k] = str(v[k], 300); });
      ['heroLead','aboutText'].forEach(k => { if (k in v) s[k] = str(v[k], 3000); });
      if ('currency' in v) s.currency = str(v.currency, 5) || '$';
      if ('bookingWindowDays' in v) s.bookingWindowDays = Math.min(365, Math.max(1, Math.round(num(v.bookingWindowDays, 60))));
      if ('slotStep' in v) s.slotStep = [10,15,20,30,45,60].includes(+v.slotStep) ? +v.slotStep : 30;
      if ('timezone' in v) { try { new Intl.DateTimeFormat('en', {timeZone:s.timezone}); } catch (e) { err(400, 'Unknown time zone.'); } }
      if ('hours' in v) {
        if (!Array.isArray(v.hours) || v.hours.length !== 7) err(400, 'Opening hours must have 7 days.');
        s.hours = v.hours.map(h => { if (!h) return null; const o = minutes(h[0]), c = minutes(h[1]); if (c <= o) err(400, 'Closing time must be after opening time.'); return [o, c]; });
      }
      if (!s.name) err(400, 'Shop name is required.');
      return s;
    }
    case 'categories': case 'galleryCats': {
      if (!Array.isArray(v)) err(400, 'Invalid list.');
      const list = [...new Set(v.map(x => str(x, 40)).filter(Boolean))];
      if (!list.length) err(400, 'Keep at least one category.');
      return list;
    }
    case 'services': {
      if (!Array.isArray(v)) err(400, 'Invalid services.');
      return v.map(s => {
        const o = {id:str(s.id, 40) || uid('s'), cat:str(s.cat, 40), name:str(s.name, 80), price:Math.max(0, r2(num(s.price))), dur:Math.max(5, Math.min(600, Math.round(num(s.dur, 30)))), desc:str(s.desc, 400), active:s.active !== false};
        if (!o.name) err(400, 'Every service needs a name.');
        return o;
      });
    }
    case 'staff': {
      if (!Array.isArray(v)) err(400, 'Invalid staff.');
      return v.map(s => {
        const o = {id:str(s.id, 40) || uid('st'), name:str(s.name, 60), role:str(s.role, 80), days:[...new Set((s.days || []).map(Number).filter(d => d >= 0 && d <= 6))].sort(), start:minutes(s.start), end:minutes(s.end), color:/^#[0-9a-fA-F]{6}$/.test(s.color || '') ? s.color : '#F3D9D5', active:s.active !== false};
        if (!o.name) err(400, 'Every artist needs a name.');
        if (o.end <= o.start) err(400, `${o.name}: end time must be after start time.`);
        return o;
      });
    }
    case 'gallery': {
      if (!Array.isArray(v)) err(400, 'Invalid gallery.');
      return v.map(g => {
        const o = {id:str(g.id, 40) || uid('g'), name:str(g.name, 80), cat:str(g.cat, 40), bg:/^#[0-9a-fA-F]{6}$/.test(g.bg || '') ? g.bg : '#F3D9D5', desc:str(g.desc, 500), visible:g.visible !== false, d:cleanEditorDesign(g.d)};
        if (!o.name) err(400, 'Every gallery design needs a name.');
        return o;
      });
    }
    case 'prices': {
      const p = {base:Math.max(0, r2(num(v.base))), customEst:Math.max(0, r2(num(v.customEst))), designMin:Math.max(0, Math.round(num(v.designMin))), presets:{}, addons:{}};
      PRESET_KEYS.forEach(k => p.presets[k] = k === 'none' ? 0 : Math.max(0, r2(num(v.presets && v.presets[k], C.prices.presets[k]))));
      ADDON_KEYS.forEach(k => p.addons[k] = Math.max(0, r2(num(v.addons && v.addons[k], C.prices.addons[k]))));
      return p;
    }
    case 'features': {
      const f = Object.assign({}, C.features);
      ['studio','gallery','reviews'].forEach(k => { if (k in v) f[k] = !!v[k]; });
      return f;
    }
    case 'reviews': {
      const R = Object.assign({}, C.reviews), url = x => { const u = str(x, 2000); if (u && !/^https:\/\//.test(u)) err(400, 'Links must start with https://'); return u; };
      if ('mapsUrl' in v) R.mapsUrl = url(v.mapsUrl);
      if ('writeUrl' in v) R.writeUrl = url(v.writeUrl);
      if ('placeQuery' in v) R.placeQuery = str(v.placeQuery, 200);
      if ('placeId' in v) R.placeId = str(v.placeId, 200);
      if ('useGoogle' in v) R.useGoogle = !!v.useGoogle;
      if ('rating' in v) R.rating = v.rating === '' || v.rating == null ? null : Math.min(5, Math.max(1, r2(num(v.rating))));
      if ('count' in v) R.count = v.count === '' || v.count == null ? null : Math.max(0, Math.round(num(v.count)));
      if ('items' in v) {
        if (!Array.isArray(v.items)) err(400, 'Invalid reviews.');
        R.items = v.items.map(x => {
          const o = {id:str(x.id, 40) || uid('rv'), author:str(x.author, 80), rating:Math.min(5, Math.max(1, Math.round(num(x.rating, 5)))), text:str(x.text, 3000), date:str(x.date, 40), visible:x.visible !== false};
          if (!o.author || !o.text) err(400, 'Each review needs a name and text.');
          return o;
        });
      }
      return R;
    }
    default: err(400, 'Unknown setting: ' + key);
  }
}

/* ---------- sessions ---------- */
function newSession(db, role, uid) {
  const now = Date.now();
  for (const k in db.sessions) if (db.sessions[k].exp < now) delete db.sessions[k];
  const t = token(); db.sessions[t] = {role, uid:uid || null, exp:now + (role === 'admin' ? 12 : 24 * 30) * 3600e3}; return t;
}
function sessionOf(db, req) { const s = req.token && db.sessions[req.token]; if (!s) return null; if (s.exp < Date.now()) { delete db.sessions[req.token]; return null; } return s; }
function userOf(db, req) { const s = sessionOf(db, req); return s && s.role === 'user' ? db.users.find(u => u.id === s.uid) || null : null; }
function needUser(db, req) { const u = userOf(db, req); if (!u) err(401, 'Please sign in.'); return u; }
function needAdmin(db, req) { const s = sessionOf(db, req); if (!s || s.role !== 'admin') err(401, 'Admin sign-in required.'); }
async function setAdminPassword(db, pw) { db.admin.salt = rand(16); db.admin.hash = await hashPw(pw, db.admin.salt); }

function claimItems(db, u, claims) {
  if (!claims || typeof claims !== 'object') return;
  const ds = claims.designs || {}, bs = claims.bookings || {};
  db.designs.forEach(d => { if (!d.user_id && d.claim && ds[d.id] === d.claim) d.user_id = u.id; });
  db.bookings.forEach(b => { if (!b.user_id && b.claim && bs[b.id] === b.claim) { b.user_id = u.id; db.transactions.forEach(t => { if (t.booking_id === b.id) t.user_id = u.id; }); } });
}

/* ---------- bookings ---------- */
function syncTx(db, b) {
  let t = db.transactions.find(x => x.booking_id === b.id);
  if (!t) { t = {id:uid('t'), booking_id:b.id, date:new Date().toISOString()}; db.transactions.push(t); }
  t.user_id = b.user_id; t.amount = b.final_price != null ? b.final_price : b.total_price;
  t.payment_status = b.payment_status === 'paid' ? 'paid' : b.payment_status === 'refunded' ? 'refunded' : (b.status === 'cancelled' || b.status === 'no_show') ? 'void' : 'unpaid';
  t.updated_at = new Date().toISOString();
}
function createBooking(db, b, user, admin) {
  const C = db.content, now = nowIn(C.shop.timezone);
  const ids = [...new Set((Array.isArray(b.services) ? b.services : []).map(String))];
  const svcs = ids.map(id => C.services.find(s => s.id === id && (admin || s.active !== false))).filter(Boolean);
  let design = null;
  if (b.design_id) {
    design = db.designs.find(d => d.id === b.design_id);
    if (!design) err(400, 'The attached design could not be found.');
    if (!admin && !canAccess(design, user, b.design_claim)) err(403, 'You cannot attach this design.');
  }
  if (!svcs.length && !design) err(400, 'Please choose at least one service.');
  const dur = Math.max(30, svcs.reduce((t, s) => t + s.dur, 0) + (design ? num(C.prices.designMin) : 0));
  const ds = String(b.date || ''), t = Math.round(num(b.start, -1));
  if (!validDate(ds) || t < 0 || t >= 1440) err(400, 'Please choose a date and time.');
  if (!admin) {
    if (!dateBookable(C, ds, now)) err(400, 'That date is not available.');
    if (ds === now.date && t < now.min + 30) err(409, 'That time has already passed.');
  }
  const busy = busyList(db), want = b.staff && b.staff !== 'any' ? String(b.staff) : null;
  const pool = C.staff.filter(s => s.active !== false && (!want || s.id === want));
  const free = pool.filter(s => staffFree(C, busy, s, ds, t, dur, null, admin && b.ignoreHours));
  if (!free.length) err(409, want ? 'That artist is no longer free at this time. Please choose another time or artist.' : 'Sorry — that time was just taken. Please choose another time.');
  free.sort((a, c) => busy.filter(x => x.staff_id === a.id && x.date === ds).length - busy.filter(x => x.staff_id === c.id && x.date === ds).length);
  let contact;
  if (user) contact = {name:user.name, email:user.email, phone:user.phone};
  else {
    const g = b.guest || {};
    contact = {name:str(g.name, 80), email:str(g.email, 120).toLowerCase(), phone:str(g.phone, 30)};
    if (!contact.name) err(400, 'Please add your name.');
    if (!admin && !EMAIL.test(contact.email)) err(400, 'Please add a valid email address.');
    if (!admin && digits(contact.phone).length < 8) err(400, 'Please add a valid phone number.');
  }
  const designPrice = design ? num(design.estimated_price) : 0;
  const bk = {
    id:uid('b'), user_id:user ? user.id : null, contact_name:contact.name, contact_email:contact.email, contact_phone:contact.phone,
    staff_id:free[0].id, services:svcs.map(s => ({id:s.id, name:s.name, price:s.price, dur:s.dur})),
    date:ds, start:t, time:fmtT(t), duration:dur, note:str(b.note, 600),
    status:admin ? 'confirmed' : 'pending', design_id:design ? design.id : null, design_price:designPrice,
    price_status:design && design.price_status !== 'fixed' ? 'pending_confirmation' : 'fixed',
    total_price:r2(svcs.reduce((x, s) => x + s.price, 0) + designPrice), final_price:null, payment_status:'unpaid',
    admin_note:'', source:admin ? 'salon' : 'online', claim:user ? null : token(),
    created_at:new Date().toISOString(), updated_at:new Date().toISOString()
  };
  if (design && user && !design.user_id) design.user_id = user.id;
  db.bookings.push(bk); syncTx(db, bk);
  return bk;
}

/* ---------- router ---------- */
async function route(db, req) {
  const m = req.method, p = (req.path || '/').replace(/\/+$/, '') || '/', q = req.query || {}, b = req.body || {};
  const seg = p.split('/').filter(Boolean), C = db.content;

  if (m === 'GET' && p === '/health') return {ok:true, name:C.shop.name};
  if (m === 'GET' && p === '/content') return publicContent(C);
  if (m === 'GET' && p === '/reviews') return reviewsView(C);
  if (m === 'GET' && p === '/availability') {
    const now = nowIn(C.shop.timezone), from = validDate(q.from) ? q.from : now.date, to = validDate(q.to) ? q.to : addDays(now.date, C.shop.bookingWindowDays);
    return {now, busy:busyList(db).filter(x => x.date >= from && x.date <= to).map(({staff_id, date, start, duration}) => ({staff_id, date, start, duration}))};
  }
  if (m === 'POST' && p === '/messages') {
    const msg = {id:uid('m'), name:str(b.name, 80), email:str(b.email, 120), phone:str(b.phone, 30), message:str(b.message, 3000), read:false, date:new Date().toISOString()};
    if (!msg.name || !EMAIL.test(msg.email) || !msg.message) err(400, 'Please fill in all fields with a valid email.');
    db.messages.push(msg); return {ok:true};
  }

  /* customer auth */
  if (m === 'POST' && p === '/auth/register') {
    const name = str(b.name, 80), phone = str(b.phone, 30), email = str(b.email, 120).toLowerCase(), pw = String(b.password || '');
    if (!name) err(400, 'Please enter your name.');
    if (digits(phone).length < 8) err(400, 'Please enter a valid phone number.');
    if (!EMAIL.test(email)) err(400, 'Please enter a valid email.');
    if (pw.length < 6) err(400, 'Password must be at least 6 characters.');
    if (db.users.some(u => u.email === email)) err(409, 'An account with this email already exists.');
    const salt = rand(16), u = {id:uid('u'), name, email, phone, salt, password_hash:await hashPw(pw, salt), created_at:new Date().toISOString()};
    db.users.push(u); claimItems(db, u, b.claims);
    return {token:newSession(db, 'user', u.id), user:publicUser(u)};
  }
  if (m === 'POST' && p === '/auth/login') {
    const email = str(b.email, 120).toLowerCase(), u = db.users.find(x => x.email === email);
    if (!u || u.password_hash !== await hashPw(String(b.password || ''), u.salt)) err(401, 'Email or password is incorrect.');
    claimItems(db, u, b.claims);
    return {token:newSession(db, 'user', u.id), user:publicUser(u)};
  }
  if (m === 'POST' && p === '/auth/logout') { if (req.token) delete db.sessions[req.token]; return {ok:true}; }
  if (m === 'GET' && p === '/me') {
    const u = needUser(db, req);
    return {user:publicUser(u),
      bookings:db.bookings.filter(x => x.user_id === u.id).map(bookingView),
      transactions:db.transactions.filter(x => x.user_id === u.id),
      designs:db.designs.filter(x => x.user_id === u.id).map(designView)};
  }
  if (m === 'PUT' && p === '/me') {
    const u = needUser(db, req), email = str(b.email, 120).toLowerCase(), name = str(b.name, 80), phone = str(b.phone, 30);
    if (!name || !EMAIL.test(email)) err(400, 'Please check your name and email.');
    if (digits(phone).length < 8) err(400, 'Please enter a valid phone number.');
    if (db.users.some(x => x.email === email && x.id !== u.id)) err(409, 'That email is used by another account.');
    Object.assign(u, {name, email, phone}); return {user:publicUser(u)};
  }
  if (m === 'PUT' && p === '/me/password') {
    const u = needUser(db, req);
    if (u.password_hash !== await hashPw(String(b.current || ''), u.salt)) err(401, 'Current password is incorrect.');
    if (String(b.next || '').length < 6) err(400, 'New password must be at least 6 characters.');
    u.salt = rand(16); u.password_hash = await hashPw(String(b.next), u.salt); return {ok:true};
  }

  /* designs */
  if (seg[0] === 'designs') {
    const user = userOf(db, req);
    if (m === 'POST' && seg.length === 1) {
      if (C.features.studio === false && C.features.gallery === false) err(403, 'Nail designs are currently unavailable.');
      const rec = Object.assign(cleanDesign(b, C.prices), {id:uid('d'), user_id:user ? user.id : null, claim:user ? null : token(), source:str(b.source, 60) || 'studio', created_at:new Date().toISOString(), updated_at:new Date().toISOString()});
      db.designs.push(rec);
      return {design:designView(rec), claim:rec.claim};
    }
    const d = db.designs.find(x => x.id === seg[1]);
    if (!d) err(404, 'Design not found.');
    const claim = q.claim || b.claim;
    if (!canAccess(d, user, claim)) err(403, 'You do not have access to this design.');
    if (m === 'GET') return {design:designView(d)};
    if (m === 'PUT') { Object.assign(d, cleanDesign(b, C.prices), {updated_at:new Date().toISOString()}); return {design:designView(d)}; }
    if (m === 'DELETE') { db.designs = db.designs.filter(x => x !== d); return {ok:true}; }
  }

  /* bookings (customer) */
  if (m === 'POST' && p === '/bookings') {
    const bk = createBooking(db, b, userOf(db, req), false);
    return {booking:bookingView(bk), claim:bk.claim};
  }
  if (m === 'POST' && seg[0] === 'bookings' && seg[2] === 'cancel') {
    const bk = db.bookings.find(x => x.id === seg[1]); if (!bk) err(404, 'Booking not found.');
    const u = userOf(db, req);
    if (!((u && bk.user_id === u.id) || (b.claim && bk.claim === b.claim))) err(403, 'You cannot change this booking.');
    if (!['pending','confirmed'].includes(bk.status)) err(400, 'This booking can no longer be cancelled.');
    const now = nowIn(C.shop.timezone);
    if (bk.date < now.date || (bk.date === now.date && bk.start <= now.min)) err(400, 'Past appointments cannot be cancelled.');
    bk.status = 'cancelled'; bk.cancelled_by = 'customer'; bk.updated_at = new Date().toISOString(); syncTx(db, bk);
    return {booking:bookingView(bk)};
  }

  /* admin */
  if (seg[0] === 'admin') {
    if (m === 'GET' && p === '/admin/status') return {setup:!!db.admin.hash};
    if (m === 'POST' && p === '/admin/setup') {
      if (db.admin.hash) err(403, 'Admin password already set.');
      if (String(b.password || '').length < 8) err(400, 'Use at least 8 characters.');
      await setAdminPassword(db, String(b.password));
      return {token:newSession(db, 'admin')};
    }
    if (m === 'POST' && p === '/admin/login') {
      if (!db.admin.hash) err(400, 'Admin password has not been set up yet.');
      if (db.admin.hash !== await hashPw(String(b.password || ''), db.admin.salt)) err(401, 'Incorrect password.');
      return {token:newSession(db, 'admin')};
    }
    needAdmin(db, req);
    if (m === 'POST' && p === '/admin/logout') { delete db.sessions[req.token]; return {ok:true}; }
    if (m === 'GET' && p === '/admin/data') {
      return {now:nowIn(C.shop.timezone), content:clone(C), bookings:clone(db.bookings).map(x => { delete x.claim; return x; }),
        users:db.users.map(publicUser), designs:db.designs.map(designView), transactions:clone(db.transactions), messages:clone(db.messages),
        google:{keySaved:!!db.secrets.googleApiKey, keyFromEnv:!!(req.env && req.env.googleKey)}};
    }
    if (m === 'PUT' && p === '/admin/secrets') {
      if ('googleApiKey' in b) db.secrets.googleApiKey = str(b.googleApiKey, 200);
      return {keySaved:!!db.secrets.googleApiKey};
    }
    if (m === 'PUT' && p === '/admin/content') {
      const next = Object.assign({}, C);
      for (const k of Object.keys(b)) next[k] = cleanContent(k, b[k], next);
      if ('services' in b || 'categories' in b) next.services.forEach(s => { if (!next.categories.includes(s.cat)) err(400, `Category “${s.cat}” does not exist.`); });
      if ('gallery' in b || 'galleryCats' in b) next.gallery.forEach(g => { if (!next.galleryCats.includes(g.cat)) err(400, `Gallery category “${g.cat}” does not exist.`); });
      db.content = next; return {content:clone(next)};
    }
    if (m === 'POST' && p === '/admin/bookings') {
      const bk = createBooking(db, b, b.user_id ? db.users.find(u => u.id === b.user_id) : null, true);
      if (b.admin_note) bk.admin_note = str(b.admin_note, 1000);
      return {booking:bk};
    }
    if (seg[1] === 'bookings' && seg[2]) {
      const bk = db.bookings.find(x => x.id === seg[2]); if (!bk) err(404, 'Booking not found.');
      if (m === 'DELETE') { db.bookings = db.bookings.filter(x => x !== bk); db.transactions = db.transactions.filter(t => t.booking_id !== bk.id); return {ok:true}; }
      if (m === 'PUT') {
        if ('status' in b) {
          if (!['pending','confirmed','completed','cancelled','no_show'].includes(b.status)) err(400, 'Unknown status.');
          if (b.status === 'cancelled' && bk.status !== 'cancelled') bk.cancelled_by = 'salon';
          bk.status = b.status;
        }
        if ('date' in b || 'start' in b || 'staff_id' in b || 'duration' in b) {
          const nd = 'date' in b ? String(b.date) : bk.date, ns = 'start' in b ? Math.round(num(b.start)) : bk.start;
          const nst = 'staff_id' in b ? String(b.staff_id) : bk.staff_id, ndur = 'duration' in b ? Math.max(5, Math.round(num(b.duration, bk.duration))) : bk.duration;
          if (!validDate(nd) || ns < 0 || ns >= 1440) err(400, 'Invalid date or time.');
          const st = C.staff.find(s => s.id === nst); if (!st) err(400, 'Unknown artist.');
          if (bk.status !== 'cancelled' && !staffFree(C, busyList(db), Object.assign({}, st, {active:true}), nd, ns, ndur, bk.id, true)) err(409, `${st.name} already has an appointment that overlaps this time.`);
          Object.assign(bk, {date:nd, start:ns, time:fmtT(ns), staff_id:nst, duration:ndur});
        }
        if ('design_price' in b && bk.design_id) {
          bk.design_price = Math.max(0, r2(num(b.design_price))); bk.price_status = 'fixed';
          bk.total_price = r2(bk.services.reduce((x, s) => x + s.price, 0) + bk.design_price);
          const d = db.designs.find(x => x.id === bk.design_id); if (d) { d.confirmed_price = bk.design_price; d.price_status = 'fixed'; d.estimated_price = bk.design_price; }
        }
        if ('final_price' in b) bk.final_price = b.final_price === '' || b.final_price == null ? null : Math.max(0, r2(num(b.final_price)));
        if ('payment_status' in b) { if (!['unpaid','paid','refunded'].includes(b.payment_status)) err(400, 'Unknown payment status.'); bk.payment_status = b.payment_status; }
        if ('admin_note' in b) bk.admin_note = str(b.admin_note, 1000);
        if ('note' in b) bk.note = str(b.note, 600);
        bk.updated_at = new Date().toISOString(); syncTx(db, bk);
        return {booking:bk};
      }
    }
    if (seg[1] === 'messages' && seg[2]) {
      const msg = db.messages.find(x => x.id === seg[2]); if (!msg) err(404, 'Message not found.');
      if (m === 'PUT') { msg.read = !!b.read; return {ok:true}; }
      if (m === 'DELETE') { db.messages = db.messages.filter(x => x !== msg); return {ok:true}; }
    }
    if (seg[1] === 'designs' && seg[2] && m === 'DELETE') { db.designs = db.designs.filter(x => x.id !== seg[2]); return {ok:true}; }
    if (m === 'PUT' && p === '/admin/password') {
      if (db.admin.hash !== await hashPw(String(b.current || ''), db.admin.salt)) err(401, 'Current password is incorrect.');
      if (String(b.next || '').length < 8) err(400, 'Use at least 8 characters.');
      await setAdminPassword(db, String(b.next));
      for (const k in db.sessions) if (db.sessions[k].role === 'admin' && k !== req.token) delete db.sessions[k];
      return {ok:true};
    }
    if (m === 'GET' && p === '/admin/export') {
      const x = clone(db); delete x.sessions; delete x.admin; delete x.secrets; return {exported_at:new Date().toISOString(), data:x};
    }
    if (m === 'POST' && p === '/admin/import') {
      const x = b.data;
      if (!x || typeof x !== 'object' || !x.content || !Array.isArray(x.bookings) || !Array.isArray(x.users)) err(400, 'This file is not a Nails Avenue backup.');
      ['content','users','bookings','designs','transactions','messages'].forEach(k => { if (x[k] != null) db[k] = clone(x[k]); });
      migrate(db); return {ok:true};
    }
    if (m === 'POST' && p === '/admin/reset-content') { db.content = defaultContent(); return {content:clone(db.content)}; }
  }
  err(404, 'Not found.');
}

async function handle(db, req) {
  try { migrate(db); return {status:200, body:await route(db, req)}; }
  catch (e) {
    if (e && e.status) return {status:e.status, body:{error:e.message}};
    if (typeof console !== 'undefined') console.error(e);
    return {status:500, body:{error:'Something went wrong. Please try again.'}};
  }
}

return {handle, reviewsView, emptyDb, migrate, defaultContent, setAdminPassword, priceParts, recordParts, slotsFor, staffFree, dateBookable, nowIn, dowOf, addDays, validDate, fmtT, newDesign, blankNail, mk, SHAPE_KEYS, PRESET_KEYS, ADDON_KEYS};
});
