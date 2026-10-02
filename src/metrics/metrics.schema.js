const mongoose = require('mongoose');


const Event = mongoose.model("event", {
    id:String,            // id do visitante (cookie tdr_vid; antes era o ID_TDR do localStorage)
    visitor:String,
    session:{ type: mongoose.Schema.Types.ObjectId, ref: 'Trail' },
    createdAt:Date,
    type_event:{
        type:String,
        enum:['add-to-cart', 'init-checkout']
    }, 
    domain:String,
    product:String,
    path:String
})



module.exports = {
    Event
};