'use strict';
const { PermissionsBitField, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const EPHEMERAL = MessageFlags.Ephemeral ?? 64;
const emojiKey = e => e.id ? `custom:${e.id}` : `unicode:${e.name}`;

function parseMappings(raw, guild) {
  const lines = String(raw || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length || lines.length > 20) throw new Error('Provide between 1 and 20 emoji = @Role mappings.');
  const used = new Set();
  return lines.map((line, i) => {
    const m = line.match(/^(.+?)\s*(?:=|\|)\s*(?:<@&)?(\d{17,20})(?:>)?$/);
    if (!m) throw new Error(`Line ${i+1}: use 😀 = @Role.`);
    const emoji = m[1].trim(), custom = emoji.match(/^<a?:[\w]+:(\d+)>$/);
    const key = custom ? `custom:${custom[1]}` : `unicode:${emoji}`;
    const role = guild.roles.cache.get(m[2]);
    if (!emoji || emoji.length > 32 || !role || role.id === guild.id || role.managed || used.has(key))
      throw new Error(`Line ${i+1}: invalid/duplicate emoji or role.`);
    used.add(key);
    return { emoji, emojiKey:key, roleId:role.id, roleName:role.name };
  });
}

async function createPanel(i) {
  const channel=i.options.getChannel('channel'), title=i.options.getString('title');
  const description=i.options.getString('description'), raw=i.options.getString('roles');
  const mode=i.options.getString('mode') || 'multiple';
  if (!channel?.isTextBased() || !channel.send || !title || !description || !raw)
    return i.reply({content:'For Create, provide channel, title, description and role mappings.',flags:EPHEMERAL});
  if(title.length>256 || description.length>2500) return i.reply({content:'Title max 256 characters; description max 2,500.',flags:EPHEMERAL});
  const me=i.guild.members.me || await i.guild.members.fetchMe();
  const needed=[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.EmbedLinks,PermissionsBitField.Flags.AddReactions,PermissionsBitField.Flags.ReadMessageHistory];
  if(!channel.permissionsFor(me)?.has(needed)) return i.reply({content:'I need View Channel, Send Messages, Embed Links, Add Reactions and Read Message History.',flags:EPHEMERAL});
  let mappings;
  try { mappings=parseMappings(raw,i.guild); } catch(e) { return i.reply({content:`❌ ${e.message}`,flags:EPHEMERAL}); }
  const invalid=mappings.find(x=>{const r=i.guild.roles.cache.get(x.roleId);return !r || r.position>=me.roles.highest.position;});
  if(invalid) return i.reply({content:`Move my highest role above <@&${invalid.roleId}> first.`,flags:EPHEMERAL});
  const roleText=mappings.map(x=>`${x.emoji}  <@&${x.roleId}>`).join('\n');
  const embed=new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(`${description}\n\n${roleText}`)
    .setFooter({text:mode==='single'?'Choose one role • React again to switch':'React to add a role • Remove reaction to remove it'}).setTimestamp();
  await i.deferReply({flags:EPHEMERAL});
  let message;
  try {
    message=await channel.send({embeds:[embed],allowedMentions:{parse:[]}});
    for(const x of mappings) await message.react(x.emoji);
    db.setReactionRolePanel(i.guild.id,message.id,{channelId:channel.id,mode,mappings,createdBy:i.user.id});
    return i.editReply(`✅ Panel created in <#${channel.id}>. Message ID: \`${message.id}\` • ${mappings.length} roles • ${mode} selection.`);
  } catch(e) {
    if(message) await message.delete().catch(()=>{});
    console.error('[ReactionRoles] Create failed:',e);
    return i.editReply('❌ Panel creation failed. Check channel permissions and emoji access.');
  }
}

async function handleReaction(reaction,user,adding) {
  if(user.bot) return;
  if(reaction.partial) reaction=await reaction.fetch().catch(()=>null);
  if(!reaction?.message?.guild) return;
  if(reaction.message.partial) await reaction.message.fetch().catch(()=>null);
  const guild=reaction.message.guild;
  const panel=db.getReactionRolePanels(guild.id)[reaction.message.id];
  if(!panel) return;
  const mapping=panel.mappings.find(x=>x.emojiKey===emojiKey(reaction.emoji));
  if(!mapping) return;
  const member=await guild.members.fetch(user.id).catch(()=>null);
  if(!member || member.user.bot) return;
  const me=guild.members.me || await guild.members.fetchMe().catch(()=>null);
  const role=guild.roles.cache.get(mapping.roleId);
  if(!role || role.managed || !me || role.position>=me.roles.highest.position) return;
  try {
    if(adding) {
      if(panel.mode==='single') {
        const remove=panel.mappings.filter(x=>x.roleId!==role.id).map(x=>x.roleId).filter(id=>member.roles.cache.has(id));
        if(remove.length) await member.roles.remove(remove,'Single-select reaction role');
      }
      if(!member.roles.cache.has(role.id)) await member.roles.add(role,'Reaction role selection');
    } else if(member.roles.cache.has(role.id)) await member.roles.remove(role,'Reaction role deselection');
  } catch(e) { console.warn('[ReactionRoles] Role update failed:',e.message); }
}

module.exports = client => {
  client.on('interactionCreate',async i=>{
    if(!i.isChatInputCommand() || i.commandName!=='reactionroles') return;
    if(!i.guild) return i.reply({content:'Use this command inside a server.',flags:EPHEMERAL}).catch(()=>{});
    const allowed=i.memberPermissions?.has(PermissionsBitField.Flags.ManageRoles) || i.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
    if(!allowed) return i.reply({content:'You need Manage Roles permission.',flags:EPHEMERAL}).catch(()=>{});
    try {
      const action=i.options.getString('action');
      if(action==='create') return await createPanel(i);
      if(action==='list') {
        const panels=Object.values(db.getReactionRolePanels(i.guild.id));
        if(!panels.length) return i.reply({content:'No reaction-role panels configured.',flags:EPHEMERAL});
        const lines=panels.slice(0,20).map((p,n)=>`**${n+1}.** <#${p.channelId}> • \`${p.messageId}\` • ${p.mappings.length} roles • ${p.mode}`);
        return i.reply({embeds:[new EmbedBuilder().setColor(0x5865F2).setTitle('Reaction-role panels').setDescription(lines.join('\n'))],flags:EPHEMERAL});
      }
      if(action==='delete') {
        const id=i.options.getString('message_id'), panel=id && db.getReactionRolePanels(i.guild.id)[id];
        if(!panel) return i.reply({content:'Provide a valid configured panel message ID.',flags:EPHEMERAL});
        db.deleteReactionRolePanel(i.guild.id,id);
        const ch=i.guild.channels.cache.get(panel.channelId);
        const msg=ch?.isTextBased()?await ch.messages.fetch(id).catch(()=>null):null;
        if(msg) await msg.delete().catch(()=>{});
        return i.reply({content:'✅ Reaction-role panel removed.',flags:EPHEMERAL});
      }
    } catch(e) {
      console.error('[ReactionRoles] Command failed:',e);
      const payload={content:'Reaction-role action failed. Check permissions and try again.',flags:EPHEMERAL};
      return (i.deferred||i.replied)?i.followUp(payload).catch(()=>{}):i.reply(payload).catch(()=>{});
    }
  });
  client.on('messageReactionAdd',(r,u)=>handleReaction(r,u,true));
  client.on('messageReactionRemove',(r,u)=>handleReaction(r,u,false));
};