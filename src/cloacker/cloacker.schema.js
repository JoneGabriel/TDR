const mongoose = require('mongoose');


const WhitePage = mongoose.model("White_Page", {
    account:{ type:mongoose.Schema.Types.ObjectId, ref:'account', index:true },
    html:{
        required:true,
        type:String
    },
    updatedAt:Date
});

// IPs da equipe por conta: liberados no cloaker só nas lojas da própria conta
const WhiteList = mongoose.model("white_list", {
    account:{ type:mongoose.Schema.Types.ObjectId, ref:'account', index:true },
    ip:String,
    createdAt:Date,
    status:{
        type:Boolean,
        default:true
    }
});



module.exports = {
    WhitePage,
    WhiteList
};