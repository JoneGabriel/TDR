// Nomes dos campos nas mensagens de validação (ValidationError/CastError do Mongoose viram 400 legíveis)
const FIELD_LABELS = {
    name:"Título", price:"Preço", last_price:"Comparação de preços", images:"Fotos", description:"Descrição",
    store:"Loja", collection_:"Coleção", logo:"Logo", domain:"Domínio", idioma:"Idioma", moeda:"Moeda base",
    country:"Países atendidos", devices:"Dispositivos atendidos", username:"Usuário", password:"Senha", email:"E-mail",
    url:"URL da Shopify", amount:"Quantidade", price_bundle:"Preço do bundle", last_price_bundle:"Comparação do bundle",
    title_bundle:"Título do bundle", ip:"IP", _id:"Id", "layouts.second.price":"Preço (second)",
    "layouts.second.last_price":"Comparação de preços (second)", "layouts.second.name":"Título (second)"
};

const label = (path)=> FIELD_LABELS[path] || path || "campo";
const shown = (value)=> value === undefined || value === null || value === "" ? "" : ` (${String(value).slice(0, 40)})`;

class statusHandler {
    constructor(status, content){
        this.status = status;
        this.content = content;
    }

    static newResponse(status, content){
        
        return new statusHandler(status, content);
    };

    // erros de validação e de conversão do Mongoose: resposta 400 com o campo e o motivo, em vez de 500 genérico
    static fromMongoose(error){
        if(!error || error.status){
            return error;
        }

        if(error.name == "ValidationError" && error.errors){
            const parts = Object.values(error.errors).map(item=>{
                if(item.name == "CastError" || item.kind == "Number" || item.kind == "ObjectId" || item.kind == "Date" || item.kind == "Boolean"){
                    return `${label(item.path)}: valor inválido${shown(item.value)}`;
                }

                if(item.kind == "required"){
                    return `${label(item.path)}: obrigatório`;
                }

                if(item.kind == "enum"){
                    return `${label(item.path)}: valor não permitido${shown(item.value)}`;
                }

                return `${label(item.path)}: ${item.message}`;
            });

            return new statusHandler(400, parts.join("; "));
        }

        if(error.name == "CastError"){
            return new statusHandler(400, `${label(error.path)}: valor inválido${shown(error.value)}`);
        }

        return error;
    };

    static log(error){
        // 400 de validação: uma linha; o resto com o erro completo (stack) para o diagnóstico
        error?.status && error.status != 500
            ? console.warn('\x1b[33m%s\x1b[0m', error)
            : console.warn('\x1b[33m%s\x1b[0m', error);
    };

    static serviceError(error){
        const known = statusHandler.fromMongoose(error);

        statusHandler.log(known.status ? known : error);

        return known.status ? known : new statusHandler(500, "Internal Error");
    };

    static responseError (error, res){
        const known = statusHandler.fromMongoose(error);

        statusHandler.log(known.status ? known : error);

        return known.status ? res.status(known.status).send(known) : res.status(500).send({status:500, content:"Internal Error"});
    }

};

module.exports = statusHandler;
