const mongoose = require('mongoose');

const Product = mongoose.model("Product", {
    name:{
        type:String,
        required:true
    },
    last_price:{
        type:Number,
        required:true
    },
    price:{
        type:Number,
        required:true
    },
    images:[
        {
            base64:String
        }
    ],
   
    description:String,
    lp:String,
    // cache de preços por país (pricing.service): { FR:{price,last_price,currency} } com o menor preço entre as variantes
    prices:mongoose.Schema.Types.Mixed,
    prices_updated_at:Date,
    // Versão "second" do produto (vitrine para visitante filtrado). A raiz do documento é a versão "first".
    // Campo vazio aqui cai no valor da raiz; ver applyProductLayout em product.service.js.
    layouts:{
        second:{
            name:String,
            last_price:Number,
            price:Number,
            images:[
                {
                    base64:String
                }
            ],
            description:String
        }
    },
    collection_: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    status:{
        type:Boolean,
        default:true
    },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'store' },
});

const Collection = mongoose.model("Collection", {
    name:{
        required:true,
        type:String
    },
    status:{
        required:true,
        type:Boolean,
        default:true
    },
    image:{
        type:String
    },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'store' },

});

const OtherVariants = mongoose.model("OTHER_VARIANT", {
    product:{
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required:true 
    },
    store:{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Shopify', 
        required:true 
    },
    id_shopify:String,
    variants:
        {
            title_1:String,
            title_2:String,
            title_3:String,
            variant_values:[
                {   
                    value_1:String,
                    value_2:String,
                    value_3:String,
                    id_shopify:{
                        type:String, 
                        
                        required:true
                    },
                    img:String,
                    last_price:Number,
                    price:Number,
                    // preços por país na moeda do mercado Shopify: { FR:{price,last_price,currency} }
                    prices:mongoose.Schema.Types.Mixed,
                }
            ]
            
            
        
        }
    ,
    prices_updated_at:Date,
    prices_countries:[String]
});


const Bundle = mongoose.model("BUNDLE", {
    product:{
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required:true 
    },
    amount:Number,
    price_bundle:Number,
    last_price_bundle:Number,
    title_bundle:String,
    default_bundle:{
        type:Boolean,
        default:false
    },
    cupom_code:String
});

module.exports = {
    Product,
    Collection,
    OtherVariants,
    Bundle
};