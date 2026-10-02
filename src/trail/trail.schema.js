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
    page:String,
    // --- identidade e janela da sessão (30 min sem atividade encerra a sessão; ver trail.service.js)
    visitor:{
        type:String,
        index:true
    },
    startedAt:Date,
    lastSeenAt:{
        type:Date,
        index:true
    },
    pageviews:{
        type:Number,
        default:1
    },
    entry_page:String,
    last_path:String,
    pages:[String],
    layout:String,
    is_bot:{
        type:Boolean,
        default:false
    },
    geo_source:String,
    // --- funil: marcados pelos eventos da vitrine, uma vez por sessão
    added_cart:{
        type:Boolean,
        default:false
    },
    added_cart_at:Date,
    init_checkout:{
        type:Boolean,
        default:false
    },
    init_checkout_at:Date
});

// consultas do painel filtram por domínio e período
Trail.schema.index({domain:1, createdAt:-1});

module.exports = {
    Trail
};