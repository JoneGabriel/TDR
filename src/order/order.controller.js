const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");
const {
    createTextGpt,
    saveChange
} = require("./order.service");

router.get("/order/support/:idOrder", async({params}, res)=>{
    try{

        const response = await createTextGpt(params.idOrder, {});

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/order/charge", async({body}, res)=>{
    try{

        const response = await saveChange(body);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});


module.exports = router;