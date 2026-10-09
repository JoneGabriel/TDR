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
    // última verificação de provisionamento (DNS + SSL), gravada por checkDomainById (ver domain.service.js)
    check: { type: mongoose.Schema.Types.Mixed, default: null },
});


module.exports = {
    Domain
}