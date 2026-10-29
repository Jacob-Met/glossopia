import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
export const publicAssets=[
  'index.html','style.css','app.mjs','src/language-core.mjs','src/starter-language.mjs','src/mission-core.mjs','src/project.mjs','src/practice-impact.mjs','src/word-order.mjs','src/language-creation.mjs','src/project-archive.mjs','src/browser-recovery.mjs'
];
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
export function createServer(){
  return http.createServer(async(req,res)=>{
    const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
    let url;try{url=new URL(req.url,'http://localhost');}catch{res.writeHead(400,headers);res.end('Invalid URL');return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,headers);res.end('Method not allowed');return;}
    if(url.pathname==='/favicon.ico'){res.writeHead(204,headers);res.end();return;}
    if(url.pathname==='/health'){res.writeHead(200,{...headers,'Content-Type':'application/json'});res.end(req.method==='HEAD'?undefined:JSON.stringify({status:'ok',app:'GLOSSOPIA',version:'0.5.1',providerVerified:false}));return;}
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!publicAssets.includes(name)){res.writeHead(404,headers);res.end('Not found');return;}
    try{const data=await readFile(path.join(root,name));res.writeHead(200,{...headers,'Content-Type':types[path.extname(name)]});res.end(req.method==='HEAD'?undefined:data);}
    catch{res.writeHead(500,headers);res.end('Application asset unavailable');}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT??4183),host='127.0.0.1';
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be 0–65535');
  const server=createServer();
  server.listen(port,host,()=>console.log('GLOSSOPIA http://'+host+':'+server.address().port));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
