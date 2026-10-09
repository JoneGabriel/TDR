const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");
const { IMPERSONATE_COOKIE, cookieOptions, forgetAccount, requireAdminApi, requireAdminPage, requireSuperadmin } = require("../auth/auth.service");
const { listAccounts, setAccountStatus, getAccount } = require("./account.service");

// gestão de contas: só superadmin
router.use("/accounts", requireAdminApi, requireSuperadmin);

router.get("/accounts", async(req, res)=>{
    try{

        const response = await listAccounts();

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

// aprovar (active), bloquear (blocked) ou devolver à fila (pending)
router.put("/accounts/:id/status", async({params, body, admin}, res)=>{
    try{

        const response = await setAccountStatus(params.id, body.status, admin.username);

        forgetAccount(params.id);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

// "entrar como": o painel passa a mostrar só os dados dessa conta (cookie admin_as) até sair
router.post("/accounts/:id/impersonate", async(req, res)=>{
    try{

        const account = await getAccount(req.params.id);

        if(!account){
            throw(statusHandler.newResponse(404, "Conta não encontrada"));
        }

        res.cookie(IMPERSONATE_COOKIE, String(account._id), cookieOptions(req, 12 * 60 * 60 * 1000));

        return res.status(200).send(statusHandler.newResponse(200, {account:String(account._id), name:account.name}));
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/accounts/leave", (req, res)=>{
    res.clearCookie(IMPERSONATE_COOKIE, cookieOptions(req));

    return res.status(200).send(statusHandler.newResponse(200, "ok"));
});

// versão de página (link do menu): sai da conta e volta à lista
router.get("/admin/leave-account", requireAdminPage, (req, res)=>{
    res.clearCookie(IMPERSONATE_COOKIE, cookieOptions(req));

    return res.redirect(req.admin.role == "superadmin" ? "/admin/accounts" : "/admin/home");
});

module.exports = router;
