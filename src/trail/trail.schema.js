const mongoose = require('mongoose');

const Trail = mongoose.model("Trail", {
    ip:{
        type:String,
    },
    last_page:{
        type:String,
    },
    domain:{
        type:String
    },
    language:{
        type:String,
    },
    cookies:{
        type:String,
    },
    isMobile:{
        type:Boolean,
    },
    browser:{
        type:String,
    },
    os:{
        type:String,
    },
    origin:{
        type:String
    },
    city:{
        type:String
    },
    region:{
        type:String
    },
    country:{
        type:String
    },
    country_code:{
        type:String
    },    
    org:{
        type:String
    },
    proxy:{
        type:Boolean,
    },
    vpn:{
        type:Boolean,
    },
    hosting:{
        type:Boolean,
    },
    createdAt:{
        type:Date,
       
    },
    page:String
});

module.exports = {
    Trail
};