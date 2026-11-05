import { normalizeUrl, publicIp } from "./audit";

async function validateDns(host: string) {
  const responses=await Promise.all(["A","AAAA"].map(async type=>{
    const r=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,{headers:{accept:"application/dns-json"},signal:AbortSignal.timeout(5000)});
    if(!r.ok) throw new Error("Could not verify the website address. Please try again.");
    const d=await r.json() as {Answer?:{type:number;data:string}[]};
    return (d.Answer??[]).filter(a=>a.type===1||a.type===28).map(a=>a.data);
  }));
  const ips=responses.flat();
  if(!ips.length||ips.some(ip=>!publicIp(ip)))throw new Error("Only publicly accessible websites can be scanned.");
}
export async function fetchPublic(input: string, kind:"html"|"text"="html") {
  let url=normalizeUrl(input);
  for(let redirect=0;redirect<=3;redirect++){
    await validateDns(new URL(url).hostname);
    const r=await fetch(url,{redirect:"manual",headers:{"User-Agent":"PromptLensAudit/0.1 (+website-readiness-check)",Accept:kind==="html"?"text/html":"text/plain"},signal:AbortSignal.timeout(8000)});
    if([301,302,303,307,308].includes(r.status)){
      const to=r.headers.get("location"); await r.body?.cancel();
      if(!to||redirect===3)throw new Error("The website redirected too many times.");
      url=normalizeUrl(new URL(to,url).toString());continue;
    }
    if(kind==="html" && (!r.ok || !r.headers.get("content-type")?.toLowerCase().includes("text/html"))) { await r.body?.cancel();throw new Error(`The page did not return usable HTML (HTTP ${r.status}). Try a public page on this website.`); }
    const limit=kind==="html"?600_000:100_000;
    if(Number(r.headers.get("content-length")??0)>limit){await r.body?.cancel();throw new Error("This page is too large for the lightweight audit.");}
    let text="",bytes=0; const reader=r.body?.getReader(),decoder=new TextDecoder();
    if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>limit)throw new Error("This page is too large for the lightweight audit.");text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
    return {text,status:r.status,url,xRobots:r.headers.get("x-robots-tag")??"",contentType:r.headers.get("content-type")??""};
  }
  throw new Error("Unable to fetch the page.");
}
