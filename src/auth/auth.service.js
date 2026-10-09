const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const statusHandler = require("../helpers/helpers.statusHandler");
const { findOne, findById, save, updateById } = require("../query");
const { Admin, ADMIN_ROLES } = require("./auth.schema");
const { Account } = require("../account/account.schema");

const COOKIE_NAME = "admin_token";
const IMPERSONATE_COOKIE = "admin_as";   // superadmin "entrando" numa conta: escopo do painel vira essa conta
const LOGIN_PATH = "/admin/login";
const HOME_PATH = "/admin/home";
const REGISTER_PATH = "/admin/register";
const PENDING_PATH = "/admin/pending";
const SALT_ROUNDS = 10;
// hash de uma senha qualquer: comparado quando o usuário não existe, para o tempo de resposta não revelar isso
const DUMMY_HASH = bcrypt.hashSync("tdr-dummy-password", SALT_ROUNDS);
const ACCOUNT_CACHE_MS = 30 * 1000;

const nowBrazil = ()=> new Date(Date.now() - 3 * 60 * 60 * 1000);
const normalizeUsername = (value)=> String(value || "").trim().toLowerCase();
const normalizeEmail = (value)=> String(value || "").trim().toLowerCase();
const validEmail = (value)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

const signToken = (admin)=> jwt.sign({
    sub:String(admin._id),
    username:admin.username,
    role:admin.role || "owner",
    account:admin.account ? String(admin.account) : null,
    tv:admin.token_version || 0
}, getSecret(), {algorithm:"HS256", expiresIn:getExpires()});

// ---------------------------------------------------------------- usuários
const createAdmin = async({username, password, email, account = null, role = "owner"})=>{
    try{

        username = normalizeUsername(username);
        email = normalizeEmail(email);

        if(!username || !password){
            throw(statusHandler.newResponse(400, "Informe usuário e senha"));
        }

        if(password.length < 8){
            throw(statusHandler.newResponse(400, "A senha precisa ter no mínimo 8 caracteres"));
        }

        if(!ADMIN_ROLES.includes(role)){
            throw(statusHandler.newResponse(400, `Papel inválido: ${role}`));
        }

        if(role != "superadmin" && !account){
            throw(statusHandler.newResponse(400, "Informe a conta do usuário"));
        }

        if(email && !validEmail(email)){
            throw(statusHandler.newResponse(400, "E-mail inválido"));
        }

        const exist = await findOne(Admin, {username});

        if(exist){
            throw(statusHandler.newResponse(400, "Usuário já existe"));
        }

        const admin = await save(Admin, {
            username,
            password:await bcrypt.hash(password, SALT_ROUNDS),
            email:email || undefined,
            account:account || undefined,
            role,
            createdAt:nowBrazil()
        });

        return statusHandler.newResponse(200, {message:"Usuário criado", id:String(admin._id), username, role});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Cadastro público: conta pendente + usuário dono. Devolve o token para o usuário já entrar e ver a página de espera.
const register = async({company, email, username, password, password_confirm} = {})=>{
    try{

        company = String(company || "").trim();
        email = normalizeEmail(email);
        username = normalizeUsername(username);

        if(!company){
            throw(statusHandler.newResponse(400, "Informe o nome da empresa"));
        }

        if(!validEmail(email)){
            throw(statusHandler.newResponse(400, "Informe um e-mail válido"));
        }

        if(!username || !password){
            throw(statusHandler.newResponse(400, "Informe usuário e senha"));
        }

        if(password.length < 8){
            throw(statusHandler.newResponse(400, "A senha precisa ter no mínimo 8 caracteres"));
        }

        if(password_confirm !== undefined && password_confirm !== password){
            throw(statusHandler.newResponse(400, "As senhas não conferem"));
        }

        if(await findOne(Admin, {username})){
            throw(statusHandler.newResponse(400, "Usuário já existe"));
        }

        if(await findOne(Account, {email})){
            throw(statusHandler.newResponse(400, "Já existe um cadastro com este e-mail"));
        }

        const account = await save(Account, {name:company, email, status:"pending", createdAt:nowBrazil()});
        const admin = await save(Admin, {
            username,
            password:await bcrypt.hash(password, SALT_ROUNDS),
            email,
            account:account._id,
            role:"owner",
            createdAt:nowBrazil()
        });

        return statusHandler.newResponse(200, {token:signToken(admin), account:String(account._id)});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Valida usuário/senha e devolve o JWT assinado. Conta pendente entra (e vê a página de espera); bloqueada não entra.
const login = async({username, password} = {})=>{
    try{

        username = normalizeUsername(username);

        const admin = username ? await findOne(Admin, {username, status:true}) : null;
        const valid = await bcrypt.compare(password || "", admin ? admin.password : DUMMY_HASH);

        if(!admin || !valid){
            throw(statusHandler.newResponse(401, "Usuário ou senha inválidos"));
        }

        if(admin.role != "superadmin"){
            const account = admin.account ? await findById(Account, admin.account) : null;

            if(!account || account.status == "blocked"){
                throw(statusHandler.newResponse(403, "Conta bloqueada. Fale com o suporte."));
            }
        }

        return statusHandler.newResponse(200, {token:signToken(admin), role:admin.role});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// ---------------------------------------------------------------- perfil (o próprio usuário, /admin/profile)
// `id` é o `sub` do JWT (req.admin.sub). Usuário e papel não mudam por aqui: só e-mail e senha.
const getProfile = async(id)=>{
    try{

        const admin = await findById(Admin, id);

        if(!admin){
            throw(statusHandler.newResponse(404, "Usuário não encontrado"));
        }

        const account = admin.account ? await findById(Account, admin.account) : null;

        return statusHandler.newResponse(200, {
            username:admin.username,
            email:admin.email || "",
            role:admin.role,
            createdAt:admin.createdAt || null,
            password_changed_at:admin.password_changed_at || null,
            account:account ? {name:account.name, status:account.status, email:account.email || ""} : null
        });

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const updateProfile = async(id, {email} = {})=>{
    try{

        email = normalizeEmail(email);

        if(email && !validEmail(email)){
            throw(statusHandler.newResponse(400, "E-mail inválido"));
        }

        const admin = await findById(Admin, id);

        if(!admin){
            throw(statusHandler.newResponse(404, "Usuário não encontrado"));
        }

        await updateById(Admin, id, {email});

        return statusHandler.newResponse(200, "Dados atualizados");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// troca de senha: exige a senha atual; o JWT não guarda a senha, então a sessão atual continua válida
const changePassword = async(id, {current_password, password, password_confirm} = {})=>{
    try{

        if(!current_password || !password){
            throw(statusHandler.newResponse(400, "Informe a senha atual e a nova senha"));
        }

        if(password.length < 8){
            throw(statusHandler.newResponse(400, "A nova senha precisa ter no mínimo 8 caracteres"));
        }

        if(password !== password_confirm){
            throw(statusHandler.newResponse(400, "A confirmação não confere com a nova senha"));
        }

        if(password === current_password){
            throw(statusHandler.newResponse(400, "A nova senha precisa ser diferente da atual"));
        }

        const admin = await findById(Admin, id);

        if(!admin){
            throw(statusHandler.newResponse(404, "Usuário não encontrado"));
        }

        if(!(await bcrypt.compare(current_password, admin.password))){
            throw(statusHandler.newResponse(400, "Senha atual incorreta"));
        }

        const token_version = (admin.token_version || 0) + 1;

        await updateById(Admin, id, {password:await bcrypt.hash(password, SALT_ROUNDS), password_changed_at:nowBrazil(), token_version});
        forgetAdmin(id);

        // as outras sessões (tv antigo) caem; esta recebe um token novo pelo controller
        return statusHandler.newResponse(200, {message:"Senha alterada", token:signToken({...admin.toObject(), token_version})});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// ---------------------------------------------------------------- sessão e escopo
// Lê e valida o JWT do cookie; devolve o payload ou null. Tokens antigos (sem papel) são descartados: novo login.
const getAdminFromRequest = (req)=>{
    try{

        const token = req.cookies?.[COOKIE_NAME];
        const payload = token ? jwt.verify(token, getSecret(), {algorithms:["HS256"]}) : null;

        return payload && payload.role ? payload : null;

    }catch(error){
        return null;
    }
};

// status/nome da conta com cache curto (uma consulta a cada 30 s por conta, não por requisição)
const accountCache = new Map();

const accountInfo = async(id)=>{
    if(!id) return null;

    const key = String(id);
    const hit = accountCache.get(key);

    if(hit && Date.now() - hit.at < ACCOUNT_CACHE_MS){
        return hit.info;
    }

    const doc = await findById(Account, key).catch(()=> null);
    const info = doc ? {id:String(doc._id), name:doc.name, status:doc.status, email:doc.email} : null;

    accountCache.set(key, {info, at:Date.now()});

    return info;
};

const forgetAccount = (id)=> accountCache.delete(String(id));

// status e versão de token do usuário, com o mesmo cache curto: usuário desativado ou senha trocada derruba a sessão
const adminCache = new Map();

const adminInfo = async(id)=>{
    if(!id) return null;

    const key = String(id);
    const hit = adminCache.get(key);

    if(hit && Date.now() - hit.at < ACCOUNT_CACHE_MS){
        return hit.info;
    }

    const doc = await findById(Admin, key).catch(()=> null);
    const info = doc ? {status:doc.status !== false, token_version:doc.token_version || 0} : null;

    adminCache.set(key, {info, at:Date.now()});

    return info;
};

const forgetAdmin = (id)=> adminCache.delete(String(id));

// conta em uso: a do usuário; para o superadmin, a conta em que ele "entrou" (cookie) ou null = todas
const scopeOf = (req)=> req.admin?.role == "superadmin" ? (req.cookies?.[IMPERSONATE_COOKIE] || null) : (req.admin?.account || null);

// Monta o contexto da requisição do painel: req.admin, req.scope, req.account_info e res.locals.admin_user (menu).
// Devolve {ok:true} ou {ok:false, reason:"auth"|"pending"|"blocked"}.
const loadContext = async(req, res)=>{
    const admin = getAdminFromRequest(req);

    if(!admin){
        return {ok:false, reason:"auth"};
    }

    const info = await adminInfo(admin.sub);

    if(!info || !info.status || (admin.tv || 0) !== info.token_version){
        return {ok:false, reason:"auth"};
    }

    req.admin = admin;

    const own = admin.account ? await accountInfo(admin.account) : null;

    if(admin.role != "superadmin"){
        if(!own || own.status == "blocked") return {ok:false, reason:"blocked"};
        if(own.status != "active") return {ok:false, reason:"pending"};
    }

    req.scope = scopeOf(req);

    let impersonating = null;

    if(admin.role == "superadmin" && req.scope){
        impersonating = await accountInfo(req.scope);

        if(!impersonating){
            req.scope = null;
            res.clearCookie(IMPERSONATE_COOKIE, cookieOptions(req));
        }
    }

    req.account_info = admin.role == "superadmin" ? impersonating : own;
    res.locals.admin_user = {
        username:admin.username,
        role:admin.role,
        superadmin:admin.role == "superadmin",
        account:own,
        impersonating
    };

    return {ok:true};
};

// Páginas /admin/*: sem sessão válida redireciona para o login; conta pendente/bloqueada vai para a página de espera
const requireAdminPage = async(req, res, next)=>{
    try{

        const context = await loadContext(req, res);

        if(context.ok){
            return next();
        }

        if(context.reason == "auth"){
            res.clearCookie(COOKIE_NAME, cookieOptions(req));

            return res.redirect(LOGIN_PATH);
        }

        return res.redirect(PENDING_PATH);

    }catch(error){
        return next(error);
    }
};

// Rotas JSON do admin: sem sessão válida responde 401; conta pendente/bloqueada responde 403
const requireAdminApi = async(req, res, next)=>{
    try{

        const context = await loadContext(req, res);

        if(context.ok){
            return next();
        }

        if(context.reason == "auth"){
            return res.status(401).send(statusHandler.newResponse(401, "Não autenticado"));
        }

        return res.status(403).send(statusHandler.newResponse(403, context.reason == "pending" ? "Conta aguardando aprovação" : "Conta bloqueada"));

    }catch(error){
        return next(error);
    }
};

// ações que precisam de uma conta definida (superadmin precisa "entrar" numa conta antes)
const requireScope = (req, res, next)=> req.scope ? next() : res.status(400).send(statusHandler.newResponse(400, "Entre em uma conta (Contas > entrar como) para usar esta função"));

const requireSuperadmin = (req, res, next)=> req.admin?.role == "superadmin" ? next() : res.status(403).send(statusHandler.newResponse(403, "Somente o superadmin"));
const requireSuperadminPage = (req, res, next)=> req.admin?.role == "superadmin" ? next() : res.redirect("/admin/home");

// Domínios reservados ao sistema: ADMIN_HOSTS=admin.loja.com,painel.outra.com e o host de HOST (endereço do painel).
// Neles a vitrine não existe (rota de vitrine ou inexistente redireciona para o login) e eles não podem ser
// cadastrados como domínio de loja em /admin/domain (nem com www.). localhost e IPs ficam fora da reserva.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const cleanHost = (value)=> String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/:].*$/, "");
const adminHosts = ()=> (process.env.ADMIN_HOSTS || "").split(",").map(cleanHost).filter(Boolean);
const reservedHosts = ()=>{
    const hosts = new Set(adminHosts());
    const main = cleanHost(process.env.HOST);

    main && !LOCAL_HOSTS.has(main) && !/^\d+\.\d+\.\d+\.\d+$/.test(main) && hosts.add(main);

    return [...hosts];
};
const isReservedHost = (value)=>{
    const host = cleanHost(value);

    if(!host) return false;

    const bare = host.replace(/^www\./, "");

    return reservedHosts().some(reserved=> reserved == host || reserved.replace(/^www\./, "") == bare);
};
const isAdminHost = (req)=> isReservedHost(req.hostname || req.get("host"));
// rotas de vitrine num host reservado vão para a home do painel (login, se não houver sessão)
const notOnAdminHost = (req, res, next)=> isAdminHost(req) ? res.redirect(HOME_PATH) : next();

module.exports = {
    COOKIE_NAME,
    IMPERSONATE_COOKIE,
    LOGIN_PATH,
    HOME_PATH,
    REGISTER_PATH,
    PENDING_PATH,
    adminHosts,
    reservedHosts,
    isReservedHost,
    isAdminHost,
    notOnAdminHost,
    createAdmin,
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
    cookieMaxAge,
    cookieOptions,
    getAdminFromRequest,
    accountInfo,
    forgetAccount,
    adminInfo,
    forgetAdmin,
    scopeOf,
    loadContext,
    requireAdminPage,
    requireAdminApi,
    requireScope,
    requireSuperadmin,
    requireSuperadminPage
};
