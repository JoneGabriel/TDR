const router = require("express").Router();
const { requireAdminApi } = require("../auth/auth.service");
const { assertProduct } = require("../account/account.service");

// atualização do cache de preços por país é ação do painel admin, limitada aos produtos da conta em uso
router.use("/pricing", requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");
const { refreshAllPrices, refreshProductPrices } = require("./pricing.service");

router.post("/pricing/refresh", async(req, res)=>{
    try{

        const result = await refreshAllPrices(req.scope);

        return res.status(200).send(statusHandler.newResponse(200, result));
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/pricing/refresh/:productId", async(req, res)=>{
    try{

        await assertProduct(req.scope, req.params.productId);

        const result = await refreshProductPrices(req.params.productId);

        return res.status(200).send(statusHandler.newResponse(200, result));
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
