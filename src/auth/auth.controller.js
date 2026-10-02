const router = require("express").Router();
const path = require("path");
const statusHandler = require("../helpers/helpers.statusHandler");
const {
    COOKIE_NAME,
    LOGIN_PATH,
    createAdmin,
    login,
    cookieMaxAge,
    cookieOptions,
    getAdminFromRequest,
    requireAdminApi
} = require("./auth.service");

const loginPage = path.resolve(`${__dirname}/../components/admin/login.twig`);

if(!process.env.JWT_SECRET){
    console.warn('\x1b[33m%s\x1b[0m', "JWT_SECRET não definido no .env: o painel admin fica inacessível até configurá-lo");
}

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
        const {token} = response.content;

        res.cookie(COOKIE_NAME, token, cookieOptions(req, cookieMaxAge(token)));

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

router.get("/admin/logout", (req, res)=>{
    res.clearCookie(COOKIE_NAME, cookieOptions(req));

    return res.redirect(LOGIN_PATH);
});

// cria outro usuário do painel (exige sessão válida); o primeiro é criado com `npm run create-admin`
router.post("/admin/users", requireAdminApi, async({body}, res)=>{
    try{

        const response = await createAdmin(body);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
