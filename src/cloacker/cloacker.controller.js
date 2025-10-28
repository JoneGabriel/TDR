const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");
const {
    
    getAllIps,
    saveNewIp
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

module.exports = router;