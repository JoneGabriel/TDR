const mongoose = require('mongoose');

// Papéis: superadmin (operador do sistema, vê todas as contas), owner (dono da conta) e staff (usuário da conta)
const ADMIN_ROLES = ["superadmin", "owner", "staff"];

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
    email:{
        type:String,
        trim:true,
        lowercase:true
    },
    // conta dona do usuário (superadmin pode não ter)
    account:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'account',
        index:true
    },
    role:{
        type:String,
        enum:ADMIN_ROLES,
        default:"owner"
    },
    createdAt:Date
});

module.exports = {
    Admin,
    ADMIN_ROLES
};
