const E=require('../app/src/main/assets/engine.js');const fs=require('fs');
const src=fs.readFileSync(__dirname+'/corpus.txt','utf8')+'\n'+fs.readFileSync(__dirname+'/sample.txt','utf8');
const L=src.split('\n');const bad={};let n=0;
const add=(k,a,b)=>{(bad[k]=bad[k]||new Map()).set(b,a)};
for(const mode of ['standard','humanize','formal','simple','creative','shorten'])for(let st=1;st<=3;st++)for(let seed=0;seed<60;seed++){
 const out=E.paraphrase(src,{mode,strength:st,seed});const O=out.split('\n');n++;
 if(O.length!==L.length){add('LINES',mode,seed);continue}
 O.forEach((o,i)=>{const a=L[i];
  if(/[-]/.test(o))add('PUA',a,o);
  if(a.match(E.PREFIX)[0]!==o.match(E.PREFIX)[0])add('PREFIX',a,o);
  if(!/[A-Za-z]{2}/.test(a)&&a!==o)add('NONLATIN',a,o);
  for(const m of a.match(/https?:\S+|\S+@\S+|"[^"]+"|\d+%?|\b[A-Z][a-z]+ [A-Z][a-z]+\b/g)||[])if(!o.includes(m)&&!/^(In|It|The|This|An?|We|He|She|I|If|Do|Our|Each|Please|Then|There|What|Start|Parents|They|Many|How) /.test(m)&&!/^Title/.test(a))add('PROTECT '+m,a,o);
  const body=o.trim();
  if(/\ba [aeio]\w/i.test(o)&&!/\ba (one|once)/i.test(o))add('A/AN',a,o);
  if(/\ban [bcdfgjklmnpqrstvwxyz]\w/i.test(o))add('A/AN',a,o);
  if(/\S {2,}\S/.test(body)&&!/\S {2,}\S/.test(a.trim()))add('SPACES',a,o);
  if(/\s[,.;!?]/.test(body)&&!/\s[,.;!?]/.test(a))add('PUNCT',a,o);
  if(/,,|\.\.(?!\.)|, \./.test(o))add('PUNCT2',a,o);
  if(/\b(\w+) \1\b/i.test(o)&&!/\b(\w+) \1\b/i.test(a))add('DUP',a,o);
  if(/(^|[.!?] )[a-z]/.test(body.replace(E.PREFIX,''))&&!/(^|[.!?] )[a-z]/.test(a.trim().replace(E.PREFIX,'')))add('CAPS',a,o);
 });}
console.log('runs',n);for(const k in bad){console.log('##',k,bad[k].size);[...bad[k].keys()].slice(0,4).forEach(x=>console.log('   ',x))}
process.exit(Object.keys(bad).length ? 1 : 0);
