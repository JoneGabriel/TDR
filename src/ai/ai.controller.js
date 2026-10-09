const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");
const { requireAdminApi, requireAdminPage, requireScope } = require("../auth/auth.service");
const {
    getStatus,
    updateDefaults,
    startConnect,
    finishConnect,
    disconnect,
    testConnection,
    generateImage,
    getJob,
    getJobImage
} = require("./ai.service");

// endereço público do admin (redirect_uri do OAuth); `trust proxy` faz req.protocol respeitar X-Forwarded-Proto
const originOf = (req)=> `${req.protocol}://${req.get("host")}`;

// retorno do OAuth é uma navegação do navegador do admin: página, não API
router.get("/ai/oauth/callback", requireAdminPage, async(req, res)=>{
    try{

        if(req.query.error){
            throw(statusHandler.newResponse(400, `${req.query.error}: ${req.query.error_description || "autorização negada"}`));
        }

        if(!req.scope){
            throw(statusHandler.newResponse(400, "Entre em uma conta (Contas > entrar como) antes de conectar a Higgsfield"));
        }

        await finishConnect(originOf(req), req.query.code, req.query.state, req.scope);

        return res.redirect("/admin/integrations?connected=1");

    }catch(error){

        return res.redirect(`/admin/integrations?error=${encodeURIComponent(error.content || error.message || "erro")}`);
    }
});

// demais rotas: JSON do painel, sempre no contexto de uma conta (a conexão Higgsfield é por conta)
router.use("/ai", requireAdminApi, requireScope);

router.get("/ai/settings", async(req, res)=>{
    try{

        return res.status(200).send(statusHandler.newResponse(200, await getStatus(req.scope)));
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/ai/settings", async(req, res)=>{
    try{

        const response = await updateDefaults(req.body, req.scope);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/ai/connect", async(req, res)=>{
    try{

        const response = await startConnect(originOf(req), req.scope);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/ai/disconnect", async(req, res)=>{
    try{

        const response = await disconnect(req.scope);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/ai/test", async(req, res)=>{
    try{

        const response = await testConnection(req.scope);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

// geração: inicia, acompanha e baixa a imagem (data URL) que o admin insere como upload
router.post("/ai/image", async(req, res)=>{
    try{

        const response = await generateImage(req.body, req.scope);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/ai/image/:id", async(req, res)=>{
    try{

        const response = getJob(req.params.id, req.scope);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/ai/image/:id/file", async(req, res)=>{
    try{

        const response = getJobImage(req.params.id, req.scope);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
