const mongoose = require('mongoose');
const messageSchema = new mongoose.Schema({
 senderType:{type:String,enum:['customer','ai','agent','system'],required:true},
 senderId:{type:String,default:null}, senderName:{type:String,default:''},
 content:{type:String,required:true,maxlength:6000}, aiModel:{type:String,default:null},
 createdAt:{type:Date,default:Date.now}
});
const conversationSchema = new mongoose.Schema({
 conversationId:{type:String,required:true,unique:true,index:true},
 userId:{type:String,required:true,index:true}, username:{type:String,default:'Discord user'},
 subject:{type:String,required:true,maxlength:120},
 status:{type:String,enum:['ai_active','waiting_agent','agent_active','closed'],default:'ai_active',index:true},
 priority:{type:String,enum:['normal','high'],default:'normal'},
 assignedAgentId:{type:String,default:null,index:true},assignedAgentName:{type:String,default:null},
 escalatedReason:{type:String,default:null},closedAt:{type:Date,default:null},
 messages:{type:[messageSchema],default:[]}
},{timestamps:true});
conversationSchema.index({userId:1,updatedAt:-1});
conversationSchema.index({status:1,updatedAt:-1});
module.exports=mongoose.models.SupportConversation||mongoose.model('SupportConversation',conversationSchema);
