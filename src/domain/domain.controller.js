const {
    getAllDomains,
    createDomain,
    changeStatusDomain,
    getDomainById,
    changeDomain,
    removeDomain
} = require("./domain.service");

const router = require("express").Router();
const { requireAdminApi } = require("../auth/auth.service");
const { assertStore, assertDomain } = require("../account/account.service");

// todas as rotas de domínio são do painel admin e respeitam a conta em uso (req.scope)
router.use("/domain", requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");

router.post("/domain", async(req, res)=>{
    try{

        await assertStore(req.scope, req.body.store);

        const response = await createDomain(req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/domain/:id", async(req, res)=>{
    try{

        await assertDomain(req.scope, req.params.id);
        req.body.store && await assertStore(req.scope, req.body.store);

        const response = await changeDomain(req.params, req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/domain", async(req, res)=>{
    try{

        const response = await getAllDomains(req.query, req.scope);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/domain/:id", async(req, res)=>{
    try{

        await assertDomain(req.scope, req.params.id);

        const response = await getDomainById(req.params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});


router.put("/domain/status/:id", async(req, res)=>{
    try{

        await assertDomain(req.scope, req.params.id);

        const response = await changeStatusDomain(req.params, req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.delete("/domain/:id", async(req, res)=>{
    try{

        await assertDomain(req.scope, req.params.id);

        const response = await removeDomain(req.params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
