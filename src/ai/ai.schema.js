const mongoose = require('mongoose');

// Configurações do sistema, uma chave por integração.
// `higgsfield`: cliente OAuth registrado, tokens, conta conectada e padrões de geração de imagem.
const Setting = mongoose.model("setting", {
    key:{
        type:String,
        required:true,
        unique:true
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
