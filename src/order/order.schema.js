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

module.exports = {
    Charge
}