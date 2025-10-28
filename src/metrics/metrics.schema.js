const mongoose = require('mongoose');


const Event = mongoose.model("event", {
    id:String,
    createdAt:Date,
    type_event:{
        type:String,
        enum:['add-to-cart', 'init-checkout']
    }
})



module.exports = {
    Event
};