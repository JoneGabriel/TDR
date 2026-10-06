const mongoose = require('mongoose');

// Cache do rastreio consultado no 17TRACK: um documento por código, reaproveitado entre visitas e pedidos.
// carrier_* guardam só a transportadora de última milha; eventos de origem ficam marcados com origin:true.
// O registro no 17TRACK é feito uma vez (consome cota); as consultas seguintes só leem o status.
const Tracking = mongoose.model("Tracking", {
    number:{
        type:String,
        required:true,
        unique:true,
        index:true
    },
    carrier:Number,          // código do transportador no 17TRACK (auto-detectado)
    carrier_name:String,
    carrier_url:String,
    status:String,           // NotFound | InfoReceived | InTransit | Expired | AvailableForPickup | OutForDelivery | DeliveryFailure | Delivered | Exception
    sub_status:String,
    sub_status_descr:String,
    latest_event:{
        time:Date,
        description:String,
        location:String,
        stage:String
    },
    events:[{
        time:Date,
        description:String,
        location:String,
        stage:String,
        country:String,      // país do evento (address.country), quando o 17TRACK informa
        origin:Boolean       // evento do trecho de origem (China/Hong Kong): nunca exibido (modo dropshipping global)
    }],
    origin_country:String,   // país do remetente (shipping_info.shipper_address.country)
    hidden_events:Number,    // quantos eventos de origem foram ocultados
    estimated_from:Date,
    estimated_to:Date,
    days_in_transit:Number,
    days_since_update:Number,
    registered:{
        type:Boolean,
        default:false
    },
    registered_at:Date,
    fetched_at:Date,
    error:String,
    orders:[String]
});

module.exports = {
    Tracking
};
