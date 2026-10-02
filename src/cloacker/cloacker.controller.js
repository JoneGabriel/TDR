const router = require("express").Router();
const { requireAdminApi } = require("../auth/auth.service");

// todas as rotas do cloacker são do painel admin
router.use("/cloacker", requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");
const {
    
    getAllIps,
    saveNewIp,
    removeIp
} = require("./cloacker.service");

router.get("/cloacker/white-list", async(req, res)=>{
    try{

        const response = await getAllIps();

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/cloacker/white-list", async({body}, res)=>{
    try{

        const response = await saveNewIp(body);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.delete("/cloacker/white-list/:id", async({params}, res)=>{
    try{

        const response = await removeIp(params);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;