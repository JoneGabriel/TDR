const mongoose = require('mongoose');

// Conta (empresa/cliente) dona de lojas e de usuários do painel. Nasce pendente no cadastro público e só
// entra no painel depois que um superadmin aprova; bloqueada fica fora até ser reativada.
const ACCOUNT_STATUS = ["pending", "active", "blocked"];

const Account = mongoose.model("account", {
    name:{
        type:String,
        required:true,
        trim:true
    },
    email:{
        type:String,
        trim:true,
        lowercase:true
    },
    status:{
        type:String,
        enum:ACCOUNT_STATUS,
        default:"pending",
        index:true
    },
    notes:String,
    createdAt:Date,
    approved_at:Date,
    approved_by:String
});

module.exports = {
    Account,
    ACCOUNT_STATUS
};
