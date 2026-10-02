const mongoose = require('mongoose');


const Shopify = mongoose.model("Shopify", {
    url:{
        type:String,
        required:true,
    },
    // App do Dev Dashboard (client credentials grant)
    client_id:String,
    client_secret:String,
    // Gerado automaticamente via Admin API quando vazio
    token_storefront:String,
    // Apenas apps legados criados no admin da Shopify
    token_admin:String,
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'store' },
});

module.exports  = {
    Shopify
}
