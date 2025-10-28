const mongoose = require('mongoose');


const WhitePage = mongoose.model("White_Page", {
    html:{
        required:true,
        type:String
    },
    updatedAt:Date
});

const WhiteList = mongoose.model("white_list", {
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