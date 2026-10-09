const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

require("dotenv").config();
const port = process.env.PORT;
const host = process.env.HOST;
const cors = require('cors');
const {
    useragent, 
    requestFilter
} = require("./src/cloacker/cloacker.service");
require("twig");
// bloqueia source(), template_from_string(), attribute() perigoso e chamadas de função a partir dos templates
// (os templates da vitrine são dos inquilinos; ver src/helpers/helpers.twig-sandbox.js)
require("./src/helpers/helpers.twig-sandbox");
const { requireAdminApi } = require("./src/auth/auth.service");
app.use(cors());
app.set("twig options", {
    allowInlineIncludes:true,
    allow_async:true,
    strict_variables:false,
    // páginas do painel escapam tudo; o HTML da vitrine (já renderizado) e o CSS passam por |raw em index/head/footer
    autoescape:true
});


app.use(useragent.express());
// TRUST_PROXY: quantos proxies há na frente do app (1 = só o nginx do compose; 2 = Cloudflare + nginx; false = nenhum).
// Com `true` qualquer cliente forjaria o próprio IP no X-Forwarded-For (lista branca, limites de taxa, métricas).
const trustProxy = (value = "1")=>{
    const text = String(value).trim().toLowerCase();

    if(text == "false" || text == "0") return false;
    if(text == "true") return true;
    if(/^\d+$/.test(text)) return parseInt(text, 10);

    return text;   // lista de IPs/CIDRs, como o Express aceita
};
app.set('trust proxy', trustProxy(process.env.TRUST_PROXY || "1"));
app.use(express.static('public'));

app.use(bodyParser.urlencoded({extended:true}));
app.use(cookieParser());

// Corpo JSON: 1 MB por padrão (rotas públicas), 15 MB no formulário de problema do pedido (fotos) e BODY_LIMIT_ADMIN
// (200 MB, imagens em base64) só nas rotas de escrita do painel e só depois de confirmar a sessão do admin,
// para ninguém sem login mandar um corpo gigante
const jsonSmall = express.json({limit:process.env.BODY_LIMIT || "1mb"});
const jsonCharge = express.json({limit:"15mb"});
const jsonAdmin = express.json({limit:process.env.BODY_LIMIT_ADMIN || "200mb"});
const ADMIN_BIG_BODY = /^\/(product|product\/[^/]+|store-config(\/.*)?|collection(\/[^/]+)?)$/;

app.use((req, res, next)=>{
    const write = req.method == "POST" || req.method == "PUT";

    if(write && ADMIN_BIG_BODY.test(req.path)){
        return requireAdminApi(req, res, ()=> jsonAdmin(req, res, next));
    }

    if(write && req.path == "/order/charge"){
        return jsonCharge(req, res, next);
    }

    return jsonSmall(req, res, next);
});
 
//app.use(async(req, res, next) => requestFilter({ req, res, next }));

// healthcheck do Docker/nginx (não toca no banco)
app.get("/health", (req, res)=> res.status(200).send({status:200, content:"ok"}));

app.use(require("./src/controller"));

// rota inexistente: sob /admin (ou no domínio reservado do painel) vai para a home do painel, que leva ao login
// se não houver sessão; na vitrine volta para a raiz da loja
const { isAdminHost, HOME_PATH } = require("./src/auth/auth.service");
app.use((req, res) => {
    res.redirect(req.path.startsWith("/admin") || isAdminHost(req) ? HOME_PATH : '/');
});

const { startPricesRefreshJob } = require("./src/pricing/pricing.service");

app.listen(parseInt(port), ()=>{
    console.log(`Server running in ${host}:${port}`);
    // cache de preços por país (Shopify Markets): PRICES_REFRESH_HOURS no .env, padrão 24h
    startPricesRefreshJob();
});
