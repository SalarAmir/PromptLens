import type { Check } from "./types";

export function normalizeUrl(input: string): string {
  const url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Enter a public HTTPS website, without credentials or a custom port.");
  if (!/^[a-z0-9.-]+\.[a-z]{2,63}$/i.test(host) || host.includes("..") || /(^|\.)(localhost|local|internal|test|invalid|example|onion|lan|home|arpa)$/.test(host)) throw new Error("Enter a public website domain, such as example.com.");
  url.hostname = host; url.hash = "";
  return url.toString();
}

export function publicIp(ip: string): boolean {
  if (ip.includes(":")) return /^2[0-9a-f]{3}:/i.test(ip) && !/^2001:(db8|0:|10:|20:)/i.test(ip);
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a,b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,168].includes(b)) || (a === 198 && [18,19,51].includes(b)) || (a === 203 && b === 0));
}

export function robotsAllows(text: string, agent: string, pathname = "/"): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let group: typeof groups[number] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim(); const split = line.indexOf(":"); if (split < 0) continue;
    const key = line.slice(0,split).trim().toLowerCase(), value = line.slice(split+1).trim();
    if (key === "user-agent") { if (!group || group.rules.length) { group = {agents:[],rules:[]}; groups.push(group); } group.agents.push(value.toLowerCase()); }
    else if (group && (key === "allow" || key === "disallow") && value) group.rules.push({allow:key === "allow",path:value});
  }
  const specific = groups.filter(g=>g.agents.includes(agent.toLowerCase()));
  const selected = specific.length ? specific : groups.filter(g=>g.agents.includes("*"));
  const rules = selected.flatMap(g=>g.rules).filter(rule=>{
    const end=rule.path.endsWith("$"); const raw=end?rule.path.slice(0,-1):rule.path;
    const regex=raw.split("*").map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join(".*");
    return new RegExp("^"+regex+(end?"$":"")).test(pathname);
  }).sort((a,b)=>b.path.replace(/\*/g,"").length-a.path.replace(/\*/g,"").length || Number(b.allow)-Number(a.allow));
  return rules[0]?.allow ?? true;
}

export function htmlText(html: string) { return html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi," ").replace(/<[^>]+>/g," ").replace(/&(?:nbsp|amp|quot|lt|gt|#\d+);/g," ").replace(/\s+/g," ").trim(); }
export function attributes(tag: string) { const result: Record<string,string>={}; const re=/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g; for(const m of tag.matchAll(re))result[m[1].toLowerCase()]=m[2]??m[3]??m[4]??""; return result; }

export function analyzePage(html: string, robots: string | null, xRobots: string, url: string) {
  const title=htmlText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??"");
  const words=htmlText(html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]??html).split(/\s+/).filter(Boolean).length;
  const metas=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>attributes(m[0]));
  const directives=metas.filter(m=>["robots","googlebot"].includes(m.name?.toLowerCase())).map(m=>m.content??"").join(",")+","+xRobots;
  const noIndex=/(?:^|[\s,;:])(noindex|none)(?:$|[\s,;])/i.test(directives);
  const h1s=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>htmlText(m[1])).filter(Boolean);
  const pathname=new URL(url).pathname+new URL(url).search;
  const checks: Check[]=[
    {id:"reachable",title:"Page can be fetched",status:"pass",weight:20,evidence:"The HTTPS page returned readable HTML.",fix:"Keep your main page publicly accessible over HTTPS.",effort:"Quick fix",explanation:"Public access is a prerequisite for automated discovery; it does not guarantee indexing."},
    {id:"indexable",title:"Indexing is permitted",status:noIndex?"fail":"pass",weight:20,evidence:noIndex?`An indexing exclusion was detected: ${directives.trim().slice(0,200)}`:"No noindex/none directive detected in robots metadata or X-Robots-Tag.",fix:"Review your SEO plugin and response headers. Remove unintended noindex directives from this public page, then rescan. Keep intentionally private pages excluded.",effort:"Quick fix",explanation:"This checks page directives, not whether a search engine has indexed the page."},
    {id:"searchbot",title:"Search crawlers are allowed",status:robots===null?"unknown":robotsAllows(robots,"OAI-SearchBot",pathname)&&robotsAllows(robots,"Googlebot",pathname)?"pass":"fail",weight:20,evidence:robots===null?"robots.txt could not be verified. No result was assumed.":`robots.txt access for this path: OAI-SearchBot ${robotsAllows(robots,"OAI-SearchBot",pathname)?"allowed":"blocked"}; Googlebot ${robotsAllows(robots,"Googlebot",pathname)?"allowed":"blocked"}.`,fix:"Review robots.txt rules for OAI-SearchBot and Googlebot. Remove accidental blocks for public pages. Search access and model-training access are separate choices.",effort:"Quick fix",explanation:"Rules are checked for this URL. Firewall restrictions and real bot access still require server-log verification."},
    {id:"title",title:"Page has a descriptive title",status:title.length>=10?"pass":"fail",weight:10,evidence:title?`Title: “${title.slice(0,180)}” (${title.length} characters).`:"No readable title element was found.",fix:"Add a specific page title describing your product and audience, using only accurate claims. Example: [Product] — [category] for [audience].",effort:"Quick fix",explanation:"Our basic clarity check requires at least 10 characters. This is our rule, not an AI ranking factor."},
    {id:"heading",title:"Main topic is clearly labelled",status:h1s.length?"pass":"fail",weight:10,evidence:h1s.length?`Main heading: “${h1s[0].slice(0,180)}”.`:"No non-empty H1 was found in the returned HTML.",fix:"Add a visible H1 explaining what this page offers. Keep the wording useful to a visitor, without keyword stuffing.",effort:"Quick fix",explanation:"A visible main heading improves structure. Having one does not guarantee an AI citation."},
    {id:"content",title:"Useful text is present in HTML",status:words>=120?"pass":"fail",weight:20,evidence:`Approximately ${words} words are present in the returned HTML. This check does not execute JavaScript.`,fix:"Make your core product explanation available in the initial HTML. Explain who it is for, what it does, and key limitations. Add genuine details where needed, rather than filler.",effort:"Content update",explanation:"120 words is a lightweight internal screening threshold, not a recommended word count or a test of content quality."},
  ];
  const knownWeight=checks.filter(c=>c.status!=="unknown").reduce((n,c)=>n+c.weight,0);
  const score=knownWeight===100?checks.filter(c=>c.status==="pass").reduce((n,c)=>n+c.weight,0):null;
  return {checks,score,knownWeight,wordCount:words,pageTitle:title};
}

export function mentionsName(answer: string, brand: string) {
  const escaped=brand.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,"iu").test(answer);
}
export function containsBrand(answer: string, brand: string, domain: string) {
  const host=new URL(domain).hostname.replace(/^www\./,"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return mentionsName(answer,brand) || new RegExp(`(?<![a-z0-9.-])(?:www\\.)?${host}(?![a-z0-9.-])`,"i").test(answer);
}

export function citedDomain(citations: string[], website: string) { const domain=new URL(website).hostname.replace(/^www\./,"");return citations.some(c=>{try{const h=new URL(c).hostname.replace(/^www\./,"");return h===domain || h.endsWith("."+domain);}catch{return false;}}); }
