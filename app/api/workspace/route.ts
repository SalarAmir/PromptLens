import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { analyzePage, normalizeUrl, containsBrand, citedDomain } from "@/lib/audit";
import { fetchPublic } from "@/lib/crawler";
import type { Audit, Observation } from "@/lib/types";
import { z } from "zod";

export const dynamic="force-dynamic";
const projectSchema=z.object({name:z.string().trim().min(2).max(80),url:z.string().max(1000),description:z.string().trim().min(10).max(1200),audience:z.string().trim().min(2).max(150),competitors:z.array(z.string().trim().min(1).max(80)).max(5),prompts:z.array(z.string().trim().min(10).max(300)).min(1).max(20)});
function db(){if(!env.DB)throw new Error("Workspace storage is unavailable.");return env.DB;}
function response(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
async function ownerProject(id:unknown,owner:string){if(typeof id!=="string")return null;return await db().prepare("SELECT * FROM projects WHERE id=? AND owner_id=?").bind(id,owner).first<Record<string,string>>();}
function jsonField(s:string){try{return JSON.parse(s);}catch{return null;}}
export async function GET(){
  const user=await getChatGPTUser();if(!user)return response({error:"Please sign in."},401);
  try{
    const {results}=await db().prepare("SELECT * FROM projects WHERE owner_id=? ORDER BY created_at DESC").bind(user.userId).all<Record<string,string>>();
    const projects=await Promise.all(results.map(async p=>{
      const [a,o]=await Promise.all([
        db().prepare("SELECT payload FROM audits WHERE project_id=? AND owner_id=? ORDER BY created_at DESC LIMIT 30").bind(p.id,user.userId).all<{payload:string}>(),
        db().prepare("SELECT payload FROM observations WHERE project_id=? AND owner_id=? ORDER BY created_at DESC LIMIT 200").bind(p.id,user.userId).all<{payload:string}>(),
      ]);
      return {id:p.id,name:p.name,url:p.url,description:p.description,audience:p.audience,competitors:jsonField(p.competitors),prompts:jsonField(p.prompts),tasks:jsonField(p.tasks),createdAt:p.created_at,audits:a.results.map(r=>jsonField(r.payload)),observations:o.results.map(r=>jsonField(r.payload))};
    }));
    return response({projects,user:{name:user.displayName,email:user.email},limits:{brands:3,prompts:20},monitoring:"manual",billing:"private-pilot"});
  }catch{return response({error:"Could not load your workspace. Please try again."},503);}
}
export async function POST(req:Request){
  const user=await getChatGPTUser();if(!user)return response({error:"Please sign in."},401);
  const origin=req.headers.get("origin");if(origin&&origin!==new URL(req.url).origin)return response({error:"Request origin was not accepted."},403);
  if(Number(req.headers.get("content-length")??0)>40_000)return response({error:"Request is too large."},413);
  try{
    let raw="",bytes=0;const reader=req.body?.getReader(),decoder=new TextDecoder();
    if(reader)try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>40_000)return response({error:"Request is too large."},413);raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
    const body=JSON.parse(raw);const now=new Date().toISOString();
    if(body.action==="create"){
      const p=projectSchema.parse(body.project),url=normalizeUrl(p.url),id=crypto.randomUUID();
      const result=await db().prepare("INSERT INTO projects (id,owner_id,name,url,description,audience,competitors,prompts,tasks,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM projects WHERE owner_id=?) < 3").bind(id,user.userId,p.name,url,p.description,p.audience,JSON.stringify(p.competitors),JSON.stringify([...new Set(p.prompts)]),"{}",now,user.userId).run();
      if(!result.meta.changes)return response({error:"The private pilot includes up to three brands."},409);
      return response({id},201);
    }
    const p=await ownerProject(body.id,user.userId);if(!p)return response({error:"Brand not found."},404);
    if(body.action==="delete"){
      await db().batch([db().prepare("DELETE FROM observations WHERE project_id=? AND owner_id=?").bind(p.id,user.userId),db().prepare("DELETE FROM audits WHERE project_id=? AND owner_id=?").bind(p.id,user.userId),db().prepare("DELETE FROM projects WHERE id=? AND owner_id=?").bind(p.id,user.userId)]);return response({ok:true});
    }
    if(body.action==="prompts"){
      const prompts=projectSchema.shape.prompts.parse(body.prompts);
      await db().prepare("UPDATE projects SET prompts=? WHERE id=? AND owner_id=?").bind(JSON.stringify([...new Set(prompts)]),p.id,user.userId).run();return response({ok:true});
    }
    if(body.action==="task"){
      const check=z.enum(["reachable","indexable","searchbot","title","heading","content"]).parse(body.check);
      const status=z.enum(["planned","done"]).parse(body.status);
      const tasks=jsonField(p.tasks)??{};tasks[check]=status;
      await db().prepare("UPDATE projects SET tasks=? WHERE id=? AND owner_id=?").bind(JSON.stringify(tasks),p.id,user.userId).run();return response({ok:true});
    }
    if(body.action==="observation"){
      const o=z.object({engine:z.enum(["ChatGPT","Gemini"]),prompt:z.string().trim().min(10).max(300),answer:z.string().trim().min(20).max(20_000),observedAt:z.string().datetime(),locale:z.string().trim().min(2).max(80),citations:z.array(z.string().url().max(2000)).max(30)}).parse(body.observation);
      if(new Date(o.observedAt).getTime()>Date.now()+60_000)return response({error:"Observation date cannot be in the future."},400);
      if(!(jsonField(p.prompts) as string[]).includes(o.prompt))return response({error:"Choose one of this brand's approved questions."},400);
      const citations=[...new Set(o.citations)];if(citations.some(c=>!/^https?:\/\//i.test(c)))return response({error:"Citations must be HTTP or HTTPS links."},400);
      const obs:Observation={...o,id:crypto.randomUUID(),citations,createdAt:now,source:"manual",mentioned:containsBrand(o.answer,p.name,p.url),cited:citedDomain(citations,p.url)};
      const r=await db().prepare("INSERT INTO observations (id,project_id,owner_id,payload,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM observations WHERE project_id=? AND owner_id=?) < 200").bind(obs.id,p.id,user.userId,JSON.stringify(obs),now,p.id,user.userId).run();
      if(!r.meta.changes)return response({error:"This pilot supports 200 observations per brand."},409);return response({ok:true},201);
    }
    if(body.action==="audit"){
      const lock=await db().prepare("UPDATE projects SET last_audit_at=? WHERE id=? AND owner_id=? AND (last_audit_at IS NULL OR last_audit_at<?)").bind(now,p.id,user.userId,new Date(Date.now()-60_000).toISOString()).run();
      if(!lock.meta.changes)return response({error:"Please wait one minute between scans for this brand."},429);
      const quota=await db().prepare("INSERT INTO scan_usage (owner_day,count) VALUES (?,1) ON CONFLICT(owner_day) DO UPDATE SET count=count+1 WHERE count<10 RETURNING count").bind(user.userId+":"+now.slice(0,10)).first<{count:number}>();
      if(!quota)return response({error:"You have used today's 10 scan attempts. The allowance resets at 00:00 UTC."},429);
      const page=await fetchPublic(p.url); let robots:string|null=null;
      try{const r=await fetchPublic(new URL("/robots.txt",page.url).toString(),"text");if(r.status===404||r.status===410)robots="";else if(r.status===200&&!r.contentType.includes("text/html"))robots=r.text;}catch{}
      const result=analyzePage(page.text,robots,page.xRobots,page.url);
      const audit:Audit={...result,id:crypto.randomUUID(),createdAt:now,url:p.url,finalUrl:page.url,version:"readiness-v1",note:"One-page HTML audit. Readiness is our checklist, not an AI ranking or citation prediction. Unknown checks prevent a total score."};
      await db().prepare("INSERT INTO audits (id,project_id,owner_id,payload,created_at) VALUES (?,?,?,?,?)").bind(audit.id,p.id,user.userId,JSON.stringify(audit),now).run();return response({ok:true,audit});
    }
    return response({error:"Unknown workspace action."},400);
  }catch(error){
    if(error instanceof z.ZodError)return response({error:error.issues[0]?.message??"Check the supplied fields."},400);
    if(error instanceof SyntaxError)return response({error:"Invalid request."},400);
    const message=error instanceof Error?error.message:"The action could not be completed.";
    if(/D1|SQLITE|database/i.test(message))return response({error:"The workspace could not save this change. Please try again."},503);
    return response({error:message.slice(0,250)},400);
  }
}
