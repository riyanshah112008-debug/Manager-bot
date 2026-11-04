const crypto=require('crypto');
const rateLimit=require('express-rate-limit');
const {GoogleGenAI}=require('@google/genai');
const SupportConversation=require('../models/SupportConversation');

function agentIds(){return [...new Set([...(process.env.SUPPORT_AGENT_IDS||'').split(','),...(process.env.OWNER_ID||'').split(','),...(process.env.OWNER_IDS||'').split(',')].map(x=>x.trim()).filter(Boolean))]}
function isAgent(id,config){return Boolean(id&&((config.BOT_OWNERS||[]).includes(String(id))||agentIds().includes(String(id))))}
function userName(user){return String(user?.globalName||user?.username||'Discord user').slice(0,80)}
function expose(c,withMessages=false){const v=c.toObject?c.toObject():c;const out={conversationId:v.conversationId,userId:v.userId,username:v.username,subject:v.subject,status:v.status,priority:v.priority,assignedAgentId:v.assignedAgentId,assignedAgentName:v.assignedAgentName,escalatedReason:v.escalatedReason,createdAt:v.createdAt,updatedAt:v.updatedAt,closedAt:v.closedAt,messageCount:v.messages?.length||0,lastMessage:v.messages?.at(-1)||null};if(withMessages)out.messages=v.messages||[];return out}
async function aiReply(c){
 const key=(process.env.GEMINI_API_KEY||process.env.GOOGLE_AI_KEY||'').split(',').map(x=>x.trim()).find(Boolean);
 if(!key)return {reply:'AI support is not configured right now, so I’ve moved this conversation to the human support queue. Your message is saved for the support team.',confidence:'low',needsHuman:true,reason:'AI provider is not configured'};
 const history=(c.messages||[]).slice(-12).map(m=>(m.senderType==='ai'?'Starry AI':m.senderType==='agent'?'Human agent':'Customer')+': '+String(m.content||'').slice(0,2500)).join('\n');
 const prompt=['You are Starry Support, the first-line assistant for the Starry Discord bot and website dashboard.','Only give safe, reversible troubleshooting steps supported by the conversation. Never invent features, account/payment/deployment status, or claim to have changed anything.','Never ask for passwords, Discord OAuth codes, bot tokens, API keys, payment card details, or secrets.','If account access, billing investigation, staff-only action, unclear diagnosis, or unverifiable information is needed, set needsHuman=true and confidence=low.','If you can give useful verified steps, use confidence=high. If one detail is missing, ask one question and use confidence=medium.','Return ONLY JSON: {"reply":"...","confidence":"high|medium|low","needsHuman":true|false}.','Conversation:\n'+history,'Write the next reply.'].join('\n');
 try{
  const ai=new GoogleGenAI({apiKey:key});
  const result=await Promise.race([ai.models.generateContent({model:'gemini-2.5-flash',contents:prompt}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('AI timeout')),18000))]);
  const raw=String(result?.text||'').trim(), match=raw.match(/\{[\s\S]*\}/);
  if(!match)throw new Error('Unstructured AI response');
  const parsed=JSON.parse(match[0]),confidence=['high','medium','low'].includes(parsed.confidence)?parsed.confidence:'low',reply=String(parsed.reply||'').trim().slice(0,5000);
  if(!reply)throw new Error('Empty AI response');
  return {reply,confidence,needsHuman:Boolean(parsed.needsHuman)||confidence==='low',reason:parsed.needsHuman?'AI requested human review':null,model:'Gemini 2.5 Flash'};
 }catch(e){console.warn('[Support Desk] AI failed:',e.message);return {reply:'I can’t confidently resolve this right now, so I’ve moved it to the human support queue. Your messages are saved here.',confidence:'low',needsHuman:true,reason:'AI unavailable or uncertain'}}
}
async function notifyAgents(client,c,reason,config){for(const id of [...new Set([...agentIds(),...(config.BOT_OWNERS||[])])]){try{const u=await client.users.fetch(id);await u.send(['**Starry Support needs a human agent**','Conversation: '+c.conversationId,'Customer: '+c.username+' ('+c.userId+')','Subject: '+c.subject,'Reason: '+String(reason||'Human requested').slice(0,250),'Open: https://manager-bot-96c07.web.app/support.html'].join('\n'))}catch(e){console.warn('[Support Desk] Agent DM failed:',e.message)}}}

function setupSupportDeskRoutes(app,{requireAuth,client,config}){
 const limiter=rateLimit({windowMs:60000,max:12,standardHeaders:true,legacyHeaders:false,message:{success:false,error:'Please wait before sending another support message.'}});
 app.get('/api/support/conversations',requireAuth,async(req,res)=>{try{
  const agent=isAgent(req.session.user?.id,config),view=String(req.query.view||'mine');
  if(view==='inbox'&&!agent)return res.status(403).json({success:false,error:'Support agent access is required.'});
  const rows=await SupportConversation.find(view==='inbox'?{status:{$ne:'closed'}}:{userId:String(req.session.user.id)}).sort({updatedAt:-1}).limit(100).lean();
  res.set('Cache-Control','no-store, private');res.json({success:true,isAgent:agent,conversations:rows.map(x=>expose(x))});
 }catch(e){console.error('[Support Desk] list:',e);res.status(500).json({success:false,error:'Could not load support conversations.'})}});
 app.post('/api/support/conversations',requireAuth,limiter,async(req,res)=>{try{
  const content=String(req.body.content||'').trim(),subject=String(req.body.subject||'Starry support request').trim().slice(0,120)||'Starry support request';
  if(content.length<5||content.length>4000)return res.status(400).json({success:false,error:'Your first message must be between 5 and 4,000 characters.'});
  const u=req.session.user||{},c=await SupportConversation.create({conversationId:'ST-'+crypto.randomBytes(5).toString('hex').toUpperCase(),userId:String(u.id),username:userName(u),subject,status:'ai_active',messages:[{senderType:'customer',senderId:String(u.id),senderName:userName(u),content}]});
  const human=/\b(human|real person|support agent|staff member|talk to someone|live agent)\b/i.test(content),answer=human?{reply:'Of course. I’ve moved this conversation to the human support queue.',needsHuman:true,reason:'Customer requested a human agent'}:await aiReply(c);
  c.messages.push({senderType:'ai',senderName:'Starry AI',content:answer.reply,aiModel:answer.model||'Gemini 2.5 Flash'});
  if(answer.needsHuman){c.status='waiting_agent';c.priority='high';c.escalatedReason=answer.reason||'AI could not confidently resolve the issue'}
  await c.save();if(answer.needsHuman)await notifyAgents(client,c,c.escalatedReason,config);
  res.status(201).json({success:true,conversation:expose(c,true),escalated:Boolean(answer.needsHuman)});
 }catch(e){console.error('[Support Desk] create:',e);res.status(500).json({success:false,error:'Could not create the support conversation.'})}});
 app.get('/api/support/conversations/:conversationId',requireAuth,async(req,res)=>{try{
  const c=await SupportConversation.findOne({conversationId:String(req.params.conversationId)});if(!c)return res.status(404).json({success:false,error:'Support conversation not found.'});
  const agent=isAgent(req.session.user?.id,config);if(!agent&&c.userId!==String(req.session.user.id))return res.status(403).json({success:false,error:'You cannot access this conversation.'});
  res.set('Cache-Control','no-store, private');res.json({success:true,isAgent:agent,conversation:expose(c,true)});
 }catch(e){console.error('[Support Desk] detail:',e);res.status(500).json({success:false,error:'Could not load this conversation.'})}});
 app.post('/api/support/conversations/:conversationId/messages',requireAuth,limiter,async(req,res)=>{try{
  const c=await SupportConversation.findOne({conversationId:String(req.params.conversationId)});if(!c)return res.status(404).json({success:false,error:'Support conversation not found.'});
  const id=String(req.session.user.id),agent=isAgent(id,config),asAgent=Boolean(req.body.asAgent);
  if(!agent&&c.userId!==id)return res.status(403).json({success:false,error:'You cannot reply to this conversation.'});
  if(asAgent&&!agent)return res.status(403).json({success:false,error:'Support agent access is required.'});
  const content=String(req.body.content||'').trim();if(!content||content.length>4000)return res.status(400).json({success:false,error:'Messages must be between 1 and 4,000 characters.'});
  if(asAgent){
   c.messages.push({senderType:'agent',senderId:id,senderName:userName(req.session.user),content});c.status='agent_active';c.assignedAgentId=id;c.assignedAgentName=userName(req.session.user);c.escalatedReason=null;c.closedAt=null;await c.save();
  }else{
   const human=Boolean(req.body.requestHuman)||/\b(human|real person|support agent|staff member|talk to someone|live agent)\b/i.test(content);
   c.messages.push({senderType:'customer',senderId:id,senderName:userName(req.session.user),content});
   if(c.status==='closed'){c.status='ai_active';c.closedAt=null;c.assignedAgentId=null;c.assignedAgentName=null}
   if(human){c.status='waiting_agent';c.priority='high';c.escalatedReason='Customer requested a human agent';c.messages.push({senderType:'system',senderName:'Starry Support',content:'Your conversation has been moved to the human support queue.'});await c.save();await notifyAgents(client,c,c.escalatedReason,config)}
   else if(c.status==='ai_active'){await c.save();const answer=await aiReply(c);c.messages.push({senderType:'ai',senderName:'Starry AI',content:answer.reply,aiModel:answer.model||'Gemini 2.5 Flash'});if(answer.needsHuman){c.status='waiting_agent';c.priority='high';c.escalatedReason=answer.reason||'AI could not confidently resolve the issue'}await c.save();if(answer.needsHuman)await notifyAgents(client,c,c.escalatedReason,config)}
   else await c.save();
  }
  res.json({success:true,conversation:expose(c,true)});
 }catch(e){console.error('[Support Desk] message:',e);res.status(500).json({success:false,error:'Could not send the support message.'})}});
 app.patch('/api/support/conversations/:conversationId',requireAuth,async(req,res)=>{try{
  const id=String(req.session.user.id);if(!isAgent(id,config))return res.status(403).json({success:false,error:'Support agent access is required.'});
  const c=await SupportConversation.findOne({conversationId:String(req.params.conversationId)});if(!c)return res.status(404).json({success:false,error:'Support conversation not found.'});
  const action=String(req.body.action||'');
  if(action==='assign'){c.assignedAgentId=id;c.assignedAgentName=userName(req.session.user);if(c.status==='waiting_agent')c.status='agent_active'}
  else if(action==='close'){c.status='closed';c.closedAt=new Date()}
  else if(action==='reopen'){c.status='waiting_agent';c.closedAt=null;c.escalatedReason='Reopened by support agent'}
  else return res.status(400).json({success:false,error:'Unsupported support action.'});
  await c.save();res.json({success:true,conversation:expose(c,true)});
 }catch(e){console.error('[Support Desk] update:',e);res.status(500).json({success:false,error:'Could not update this conversation.'})}});
}
module.exports={setupSupportDeskRoutes};
