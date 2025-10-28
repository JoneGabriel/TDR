const mongoose = require('mongoose');


const Shopify = mongoose.model("Shopify", {
    url:{
        type:String,
        required:true,
    },
    token_storefront:{
        type:String,
        required:true
    },
    token_admin:{
        type:String,
        required:true
    },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'store' },
});

module.exports  = {
    Shopify
}