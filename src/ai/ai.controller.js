const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");
const { requireAdminApi, requireAdminPage } = require("../auth/auth.service");
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

        await finishConnect(originOf(req), req.query.code, req.query.state);

        return res.redirect("/admin/integrations?connected=1");

    }catch(error){

        return res.redirect(`/admin/integrations?error=${encodeURIComponent(error.content || error.message || "erro")}`);
    }
});

// demais rotas: JSON do painel
router.use("/ai", requireAdminApi);

router.get("/ai/settings", async(req, res)=>{
    try{

        return res.status(200).send(statusHandler.newResponse(200, await getStatus()));
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/ai/settings", async({body}, res)=>{
    try{

        const response = await updateDefaults(body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/ai/connect", async(req, res)=>{
    try{

        const response = await startConnect(originOf(req));

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/ai/disconnect", async(req, res)=>{
    try{

        const response = await disconnect();

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/ai/test", async(req, res)=>{
    try{

        const response = await testConnection();

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

// geração: inicia, acompanha e baixa a imagem (data URL) que o admin insere como upload
router.post("/ai/image", async({body}, res)=>{
    try{

        const response = await generateImage(body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/ai/image/:id", async({params}, res)=>{
    try{

        const response = getJob(params.id);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/ai/image/:id/file", async({params}, res)=>{
    try{

        const response = getJobImage(params.id);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
