// Sandbox do Twig.js. Os templates da vitrine (e CSS, políticas, nomes...) são editados pelos inquilinos e compilados
// no servidor com Twig.twig({data}). Sem este módulo um template consegue ler qualquer arquivo (`source(".env")`),
// alcançar o construtor de Function por `attribute()` (execução de código) e chamar métodos de documentos do Mongoose.
// O módulo "twig" é um singleton: carregar isto uma vez em app.js protege todas as renderizações (painel e vitrine).
// `Twig.extend` entrega o núcleo interno (expression, functions...), que o módulo não exporta diretamente.
const Twig = require("twig");

const DANGEROUS_KEYS = new Set(["constructor", "__proto__", "prototype", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"]);

Twig.extend((Core)=>{
    const blocked = (name)=> function(){
        throw new Core.Error(`Função não permitida no template: ${name}`);
    };

    // acesso ao sistema de arquivos e compilação de strings arbitrárias
    Core.functions.source = blocked("source");
    Core.functions.template_from_string = blocked("template_from_string");

    // attribute(obj, chave): só propriedades próprias, nunca funções nem chaves de protótipo
    Core.functions.attribute = (object, key)=>{
        if(object === null || object === undefined || DANGEROUS_KEYS.has(String(key))){
            return undefined;
        }

        const value = typeof object == "object" && Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;

        return typeof value == "function" ? undefined : value;
    };

    // Valores-função alcançados por chave (`x.constructor`, `doc.deleteOne`, macros) nunca são executados: viram vazio.
    // O Twig.js chamaria a função com os parâmetros do template; aqui só se descartam os parênteses seguintes.
    const resolveAsync = Core.expression.resolveAsync;

    Core.expression.resolveAsync = function(value, context, params, nextToken, object){
        if(typeof value == "function"){
            if(nextToken && nextToken.type === Core.expression.type.parameter.end){
                nextToken.cleanup = true;
            }

            return Core.Promise.resolve(undefined);
        }

        return resolveAsync.call(this, value, context, params, nextToken, object);
    };

    // `nome(...)` só resolve funções registradas no Twig (range, date, cycle...), nunca funções que estejam no contexto
    const functionHandler = Core.expression.handler[Core.expression.type._function];
    const functionParse = functionHandler.parse;

    functionHandler.parse = function(token, stack, context, nextToken){
        if(!Object.prototype.hasOwnProperty.call(Core.functions, token.fn) && typeof context?.[token.fn] == "function"){
            throw new Core.Error(`Função não permitida no template: ${token.fn}`);
        }

        return functionParse.call(this, token, stack, context, nextToken);
    };
});

module.exports = { DANGEROUS_KEYS };
