import asyncio, json, sys, pathlib
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
URL='file://'+str(ROOT/'app/src/main/assets/index.html')
SAMPLE=(ROOT/'test/sample.txt').read_text(encoding='utf8')
BRIDGE="""
window.__calls=[];window.__mode=window.__mode||'ok';window.__clip='';
window.Android={
 copy:t=>{window.__clip=t}, paste:()=> 'Pasted line one.\\nPasted line two.', share:t=>{window.__shared=t}, takeIncoming:()=> '', openUrl:u=>{window.__url=u},
 http:(id,method,url,headers,body)=>{window.__calls.push({method,url,headers});
  setTimeout(()=>{
   if(method==='GET') return window.__http(id,200,JSON.stringify({models:[{name:'models/gemini-3.5-flash-lite',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.8-flash-image',supportedGenerationMethods:['generateContent']}]}));
   const n=window.__calls.filter(c=>c.method==='POST').length;
   const items=JSON.parse(JSON.parse(body).contents[0].parts[0].text);
   if(window.__mode==='429first'&&n===1) return window.__http(id,429,JSON.stringify({error:{message:'Quota exceeded per minute',details:[{retryDelay:'1s'}]}}));
   if(window.__mode==='daily') return window.__http(id,429,JSON.stringify({error:{message:'Quota exceeded: GenerateRequestsPerDayPerProject'}}));
   if(window.__mode==='badkey') return window.__http(id,400,JSON.stringify({error:{message:'API key not valid.'}}));
   if(window.__mode==='mismatch') return window.__http(id,200,JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(items.slice(1))}]}}]}));
   if(window.__mode==='offline') return window.__http(id,0,'');
   window.__http(id,200,JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(items.map(s=>'AI<'+s+'>\\nextra'))}]}}]}));
  },5)}};
"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        errs=[]
        async def page_for(scheme='light',mode='ok',bridge=True,ls=None):
            ctx=await b.new_context(viewport={'width':412,'height':915},device_scale_factor=2.625,color_scheme=scheme)
            pg=await ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
            if bridge: await pg.add_init_script("window.__mode=%s;"%json.dumps(mode)+BRIDGE)
            if ls: await pg.add_init_script("try{%s}catch(e){}"%';'.join("localStorage.setItem(%s,%s)"%(json.dumps(k),json.dumps(v)) for k,v in ls.items()))
            await pg.goto(URL); return pg
        # 1. offline flow
        pg=await page_for()
        await pg.screenshot(path=str(ROOT/'test/shot_empty.png'))
        await pg.fill('#inp',SAMPLE); await pg.click('text=Humanize'); await pg.click('#go')
        await pg.wait_for_selector('#out .ln')
        out=await pg.evaluate("document.querySelector('#outLines').textContent+' | '+document.querySelector('#outChanged').textContent+' | rows='+document.querySelectorAll('#out .ln').length")
        print('offline:',out)
        await pg.click('#copy'); clip=await pg.evaluate('window.__clip')
        print('copy lines',len(clip.split('\n')),'src lines',len(SAMPLE.split('\n')), 'bangla kept','আমি বাংলায় লিখছি, এই লাইন বদলাবে না।' in clip.split('\n'))
        before=await pg.evaluate("document.querySelectorAll('#out .ln p')[2].textContent")
        await pg.click('#out .ln:nth-child(3) button'); after=await pg.evaluate("document.querySelectorAll('#out .ln p')[2].textContent")
        print('reroll changed:',before!=after)
        await pg.click('#again'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(ROOT/'test/shot_result.png'))
        ov=await pg.evaluate("document.documentElement.scrollWidth-window.innerWidth"); print('h-overflow px',ov)
        await pg.evaluate("document.querySelector('#outCard').scrollIntoView()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(ROOT/'test/shot_out.png'))
        await pg.click('#paste'); print('paste:',json.dumps(await pg.input_value('#inp')))
        # settings + AI
        await pg.evaluate("window.scrollTo(0,0)"); await pg.click('#engAi'); await pg.wait_for_selector('dialog[open]')
        await pg.fill('#key','TESTKEY'); await pg.click('#testKey'); await pg.wait_for_timeout(200)
        print('key msg:',await pg.text_content('#keyMsg'),'| models:',await pg.evaluate("[...document.querySelectorAll('#model option')].map(o=>o.value).join(',')"))
        await pg.screenshot(path=str(ROOT/'test/shot_settings.png'))
        print('back closes:',await pg.evaluate('window.__back()'),await pg.evaluate('window.__back()'))
        await pg.fill('#inp',SAMPLE); await pg.click('#go'); await pg.wait_for_function("document.querySelector('#go').textContent==='Rephrase'&&document.querySelectorAll('#out .ln').length>0")
        rows=await pg.evaluate("[...document.querySelectorAll('#out .ln p')].map(p=>p.textContent)")
        src=SAMPLE.split('\n'); print('AI rows',len(rows),'src',len(src))
        for i in (0,1,5,7,15,16): print('  ',json.dumps(src[i][:38],ensure_ascii=False),'->',json.dumps(rows[i][:52],ensure_ascii=False))
        hdr=await pg.evaluate("window.__calls[window.__calls.length-1]"); print('  url',hdr['url'],'key header ok','TESTKEY' in hdr['headers'])
        await pg.context.close()
        # failure modes
        for mode in ('429first','daily','badkey','mismatch','offline'):
            pg=await page_for(mode=mode,ls={'pl.key':'K','pl.engine':'ai'})
            await pg.fill('#inp',SAMPLE); await pg.click('#go')
            await pg.wait_for_function("document.querySelector('#go').textContent==='Rephrase'&&document.querySelectorAll('#out .ln').length>0",timeout=30000)
            rows=await pg.evaluate("[...document.querySelectorAll('#out .ln p')].map(p=>p.textContent)")
            print(mode,'| rows',len(rows),'| ai lines',sum('AI<' in r for r in rows),'| note:',await pg.text_content('#note'),'| posts',await pg.evaluate("window.__calls.filter(c=>c.method==='POST').length"))
            await pg.context.close()
        # huge text + long single line through AI + dark + no-bridge
        pg=await page_for(scheme='dark',bridge=False)
        big=('However, it is important to use a big idea to improve the result. '*3+'\n')*4000
        await pg.evaluate("t=>{document.querySelector('#inp').value=t;document.querySelector('#inp').dispatchEvent(new Event('input'))}",big)
        await pg.click('#go'); await pg.wait_for_function("document.querySelector('#go').textContent==='Rephrase'&&document.querySelector('#out pre')",timeout=60000)
        print('huge:',await pg.text_content('#outLines'),await pg.text_content('#outChanged'),await pg.text_content('#inChars'))
        await pg.fill('#inp',SAMPLE); await pg.click('#go'); await pg.wait_for_selector('#out .ln'); await pg.evaluate("document.querySelector('#outCard').scrollIntoView()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(ROOT/'test/shot_dark.png')); await pg.context.close()
        pg=await page_for(ls={'pl.key':'K','pl.engine':'ai'})
        long=('This is a long sentence that we use to test splitting. '*150).strip()
        await pg.fill('#inp','- '+long+'\nshort line'); await pg.click('#go'); await pg.wait_for_selector('#out .ln')
        rows=await pg.evaluate("[...document.querySelectorAll('#out .ln p')].map(p=>p.textContent)")
        print('long line: rows',len(rows),'starts',json.dumps(rows[0][:12]),'pieces',rows[0].count('AI<'),'len',len(long),'->',len(rows[0]),'newline inside',('\n' in rows[0]))
        print('ERRORS:',errs)
        await b.close()
asyncio.run(main())
