const mongoose = require('mongoose');

// Configurações do sistema, uma chave por integração.
// `higgsfield`: cliente OAuth registrado, tokens, conta conectada e padrões de geração de imagem.
// uma configuração por chave e por conta (ex.: conexão Higgsfield de cada conta)
const Setting = mongoose.model("setting", {
    account:{ type:mongoose.Schema.Types.ObjectId, ref:'account', index:true },
    key:{
        type:String,
        required:true,
        index:true
    },
    value:{
        type:mongoose.Schema.Types.Mixed,
        default:{}
    },
    updatedAt:Date
});

module.exports = {
    Setting
};
