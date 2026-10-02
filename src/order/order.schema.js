const mongoose = require('mongoose');

const Charge = mongoose.model("Charge", {
    email:{
       
        type:String
    },
    justification:{
        
        type:String,
       
    },
    images:[String],
    createdAt:Date,
    idOrder:String
});

// Conversa do chat de suporte de um pedido (uma por pedido/loja Shopify); `suggestions` são as últimas sugestões da assistente
const OrderChat = mongoose.model("order_chat", {
    idOrder:{ type:String, index:true },
    urlStore:String,
    domain:String,
    visitor:String,
    idioma:String,
    messages:[{
        role:String,          // assistant | user
        content:String,
        action:String,
        at:Date
    }],
    suggestions:[String],
    createdAt:Date,
    updatedAt:Date
});

module.exports = {
    Charge,
    OrderChat
}