const mongoose = require('mongoose');

// Usuário do painel admin. `password` guarda o hash bcrypt, nunca a senha em texto.
const Admin = mongoose.model("admin", {
    username:{
        type:String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true
    },
    password:{
        type:String,
        required:true
    },
    status:{
        type:Boolean,
        default:true
    },
    createdAt:Date
});

module.exports = {
    Admin
};
