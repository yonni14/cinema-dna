import fs from 'fs';
import * as E from './engine.mjs';
const raw=JSON.parse(fs.readFileSync('db.json','utf8'));
const list=Array.isArray(raw)?raw:(raw.movies||Object.values(raw));
const schema=E.buildSchema(list);const movies=E.processRawMovies(list,schema);
console.log('movies',movies.length,'axes',movies[0].zKeys.length,movies[0].zKeys.join(','));
function rec(t,all,metric){
 const w=t.zKeys.map(k=>E.DEFAULT_WEIGHTS[k]??0);const tv=t.zVector;const sc=[];const ds=[];
 for(const o of all){if(o.id===t.id)continue;let s=0;for(let j=0;j<tv.length;j++){if(w[j]<=0)continue;const d=Math.abs(tv[j]-o.zVector[j]);s+= metric==='l1'? w[j]*d : w[j]*d*d;}
  const dist=metric==='l1'?s:Math.sqrt(s);sc.push({o,dist});if(dist>0)ds.push(dist);}
 ds.sort((a,b)=>a-b);const sf=ds[Math.floor(ds.length*0.4)]||1;
 sc.forEach(x=>{let s=100*Math.exp(-0.45*Math.pow(x.dist/sf,1.3));if(t.director_h&&t.director_h!=='לא ידוע'&&x.o.director_h===t.director_h)s=Math.min(96,s+6);x.score=Math.round(s*10)/10;});
 sc.sort((a,b)=>b.score-a.score);return sc;}
const q=(a,p)=>a[Math.min(a.length-1,Math.floor(p*a.length))];
const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length)};
const res={};
const N=movies.length;
const tops={e:[],l:[]};const all={e:[],l:[]};const top1={e:[],l:[]};const top8mean={e:[],l:[]};const top8sd={e:[],l:[]};const rawd={e:[],l:[]};
let overlap=0,top1same=0;
for(const t of movies){const e=rec(t,movies,'l2'),l=rec(t,movies,'l1');
 for(const [k,r] of [['e',e],['l',l]]){const s=r.map(x=>x.score);for(const v of s)all[k].push(v);top1[k].push(s[0]);const t8=s.slice(0,8);top8mean[k].push(t8.reduce((a,b)=>a+b)/8);top8sd[k].push(sd(t8));tops[k].push(r.slice(0,8).map(x=>x.o.id));}
 const es=new Set(tops.e.at(-1));overlap+=tops.l.at(-1).filter(i=>es.has(i)).length/8;if(tops.e.at(-1)[0]===tops.l.at(-1)[0])top1same++;}
for(const k of ['e','l']){const a=all[k].slice().sort((x,y)=>x-y);
 const f=x=>x.toFixed(1);
 console.log(k==='e'?'EUCLID':'MANHATTAN','| all-pairs score: mean',f(a.reduce((x,y)=>x+y)/a.length),'sd',f(sd(a)),'p5',f(q(a,.05)),'p25',f(q(a,.25)),'p50',f(q(a,.5)),'p75',f(q(a,.75)),'p95',f(q(a,.95)),'| >=80:',(100*a.filter(v=>v>=80).length/a.length).toFixed(2)+'%','>=60:',(100*a.filter(v=>v>=60).length/a.length).toFixed(2)+'%','<20:',(100*a.filter(v=>v<20).length/a.length).toFixed(1)+'%');
 const t1=top1[k].slice().sort((x,y)=>x-y);const m8=top8mean[k].slice().sort((x,y)=>x-y);
 console.log('   top1 score median',f(q(t1,.5)),'p10',f(q(t1,.1)),'p90',f(q(t1,.9)),'| top8 mean median',f(q(m8,.5)),'| within-top8 sd avg',f(top8sd[k].reduce((x,y)=>x+y)/N));}
console.log('top8 overlap avg',(overlap/N*100).toFixed(1)+'%','top1 same',(100*top1same/N).toFixed(1)+'%');
