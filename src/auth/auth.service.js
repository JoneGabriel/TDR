const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const statusHandler = require("../helpers/helpers.statusHandler");
const { findOne, save } = require("../query");
const { Admin } = require("./auth.schema");

const COOKIE_NAME = "admin_token";
const LOGIN_PATH = "/admin/login";
const SALT_ROUNDS = 10;
// hash de uma senha qualquer: comparado quando o usuário não existe, para o tempo de resposta não revelar isso
const DUMMY_HASH = bcrypt.hashSync("tdr-dummy-password", SALT_ROUNDS);

const getSecret = ()=>{
    const secret = process.env.JWT_SECRET;

    if(!secret || secret.length < 16){
        throw(statusHandler.newResponse(500, "JWT_SECRET não configurado no .env (mínimo 16 caracteres)"));
    }

    return secret;
};

const getExpires = ()=> process.env.JWT_EXPIRES || "12h";

// Duração do cookie (ms) igual à do token
const cookieMaxAge = (token)=>{
    const {exp} = jwt.decode(token) || {};

    return exp ? Math.max(exp * 1000 - Date.now(), 0) : undefined;
};

const cookieOptions = (req, maxAge)=>({
    httpOnly:true,
    sameSite:"lax",
    secure:req.secure,
    path:"/",
    maxAge
});

const createAdmin = async({username, password})=>{
    try{

        username = (username || "").trim().toLowerCase();

        if(!username || !password){
            throw(statusHandler.newResponse(400, "Informe usuário e senha"));
        }

        if(password.length < 8){
            throw(statusHandler.newResponse(400, "A senha precisa ter no mínimo 8 caracteres"));
        }

        const exist = await findOne(Admin, {username});

        if(exist){
            throw(statusHandler.newResponse(400, "Usuário já existe"));
        }

        const nowBrazil = new Date(Date.now() - 3 * 60 * 60 * 1000);

        await save(Admin, {
            username,
            password:await bcrypt.hash(password, SALT_ROUNDS),
            createdAt:nowBrazil
        });

        return statusHandler.newResponse(200, "Usuário criado");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Valida usuário/senha e devolve o JWT assinado
const login = async({username, password} = {})=>{
    try{

        username = (username || "").trim().toLowerCase();

        const admin = username ? await findOne(Admin, {username, status:true}) : null;
        const valid = await bcrypt.compare(password || "", admin ? admin.password : DUMMY_HASH);

        if(!admin || !valid){
            throw(statusHandler.newResponse(401, "Usuário ou senha inválidos"));
        }

        const token = jwt.sign({sub:String(admin._id), username:admin.username}, getSecret(), {expiresIn:getExpires()});

        return statusHandler.newResponse(200, {token});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Lê e valida o JWT do cookie; devolve o payload ou null (token ausente, inválido, expirado ou sem JWT_SECRET)
const getAdminFromRequest = (req)=>{
    try{

        const token = req.cookies?.[COOKIE_NAME];

        return token ? jwt.verify(token, getSecret()) : null;

    }catch(error){
        return null;
    }
};

// Páginas /admin/*: sem sessão válida redireciona para o login
const requireAdminPage = (req, res, next)=>{
    const admin = getAdminFromRequest(req);

    if(!admin){
        res.clearCookie(COOKIE_NAME, cookieOptions(req));

        return res.redirect(LOGIN_PATH);
    }

    req.admin = admin;

    return next();
};

// Rotas JSON do admin: sem sessão válida responde 401
const requireAdminApi = (req, res, next)=>{
    const admin = getAdminFromRequest(req);

    if(!admin){
        return res.status(401).send(statusHandler.newResponse(401, "Não autenticado"));
    }

    req.admin = admin;

    return next();
};

// Domínios exclusivos do painel: ADMIN_HOSTS=admin.loja.com,painel.outra.com. Neles a vitrine não existe: rota de
// vitrine ou inexistente redireciona para o login do admin. Um host listado aqui NÃO pode ser domínio de loja.
// Sem a variável o recurso fica desligado (nenhum fallback, para não bloquear por engano uma loja que use o mesmo host de HOST).
const cleanHost = (value)=> String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/:].*$/, "");
const adminHosts = ()=> (process.env.ADMIN_HOSTS || "").split(",").map(cleanHost).filter(Boolean);
const isAdminHost = (req)=> {
    const host = cleanHost(req.hostname || req.get("host"));

    return !!host && adminHosts().includes(host);
};
const notOnAdminHost = (req, res, next)=> isAdminHost(req) ? res.redirect(LOGIN_PATH) : next();

module.exports = {
    COOKIE_NAME,
    LOGIN_PATH,
    adminHosts,
    isAdminHost,
    notOnAdminHost,
    createAdmin,
    login,
    cookieMaxAge,
    cookieOptions,
    getAdminFromRequest,
    requireAdminPage,
    requireAdminApi
};
