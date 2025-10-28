const mongoose = require('mongoose');


const Domain = mongoose.model("domain", {
    domain:{
        required:true,
        type:String
    },
    status:{
        required:true,
        type:Boolean,
        default:true
    },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'store' },
});


module.exports = {
    Domain
}