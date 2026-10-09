const router = require("express").Router();
const path = require("path");
const statusHandler = require("../helpers/helpers.statusHandler");
const {
    COOKIE_NAME,
    IMPERSONATE_COOKIE,
    LOGIN_PATH,
    REGISTER_PATH,
    PENDING_PATH,
    createAdmin,
    register,
    login,
    cookieMaxAge,
    cookieOptions,
    getAdminFromRequest,
    accountInfo,
    requireAdminApi
} = require("./auth.service");

const loginPage = path.resolve(`${__dirname}/../components/admin/login.twig`);
const registerPage = path.resolve(`${__dirname}/../components/admin/register.twig`);
const pendingPage = path.resolve(`${__dirname}/../components/admin/pending.twig`);

if(!process.env.JWT_SECRET){
    console.warn('\x1b[33m%s\x1b[0m', "JWT_SECRET não definido no .env: o painel admin fica inacessível até configurá-lo");
}

const setSession = (req, res, token)=> res.cookie(COOKIE_NAME, token, cookieOptions(req, cookieMaxAge(token)));

router.get(LOGIN_PATH, (req, res)=>{

    // já logado vai direto para o painel
    if(getAdminFromRequest(req)){
        return res.redirect("/admin/home");
    }

    return res.render(loginPage, {});
});

router.post(LOGIN_PATH, async(req, res)=>{
    try{

        const response = await login(req.body);

        setSession(req, res, response.content.token);

        if(req.is("json")){
            return res.status(200).send(statusHandler.newResponse(200, "ok"));
        }

        return res.redirect("/admin/home");

    }catch(error){

        if(req.is("json")){
            return statusHandler.responseError(error, res);
        }

        const status = error.status || 500;

        return res.status(status).render(loginPage, {
            error:status == 401 ? "Usuário ou senha inválidos" : (error.content || "Erro ao entrar"),
            username:req.body?.username
        });
    }
});

// cadastro público de uma nova conta (fica pendente até um superadmin aprovar)
router.get(REGISTER_PATH, (req, res)=>{

    if(getAdminFromRequest(req)){
        return res.redirect("/admin/home");
    }

    return res.render(registerPage, {});
});

router.post(REGISTER_PATH, async(req, res)=>{
    try{

        const response = await register(req.body);

        setSession(req, res, response.content.token);

        if(req.is("json")){
            return res.status(200).send(statusHandler.newResponse(200, {account:response.content.account}));
        }

        return res.redirect(PENDING_PATH);

    }catch(error){

        if(req.is("json")){
            return statusHandler.responseError(error, res);
        }

        return res.status(error.status || 500).render(registerPage, {
            error:error.content || "Erro ao cadastrar",
            form:{company:req.body?.company, email:req.body?.email, username:req.body?.username}
        });
    }
});

// página de espera: conta pendente de aprovação ou bloqueada (sessão válida, mas sem acesso ao painel)
router.get(PENDING_PATH, async(req, res)=>{
    const admin = getAdminFromRequest(req);

    if(!admin){
        return res.redirect(LOGIN_PATH);
    }

    const account = admin.account ? await accountInfo(admin.account) : null;

    if(admin.role == "superadmin" || account?.status == "active"){
        return res.redirect("/admin/home");
    }

    return res.render(pendingPage, {account, username:admin.username, blocked:!account || account.status == "blocked"});
});

router.get("/admin/logout", (req, res)=>{
    res.clearCookie(COOKIE_NAME, cookieOptions(req));
    res.clearCookie(IMPERSONATE_COOKIE, cookieOptions(req));

    return res.redirect(LOGIN_PATH);
});

// cria outro usuário do painel. Dono cria usuários (staff) da própria conta; superadmin cria em qualquer conta
// (a conta em que "entrou" ou `account` no corpo) e também outros superadmins.
router.post("/admin/users", requireAdminApi, async(req, res)=>{
    try{

        const {body, admin, scope} = req;
        let account = scope;
        let role = "staff";

        if(admin.role == "superadmin"){
            account = body.account || scope;
            role = body.role || (account ? "staff" : "superadmin");
        }else if(admin.role != "owner"){
            throw(statusHandler.newResponse(403, "Somente o dono da conta cria usuários"));
        }

        const response = await createAdmin({username:body.username, password:body.password, email:body.email, account, role});

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
