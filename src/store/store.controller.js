
const {
    createStore,
    getAllStores,
    getStoreById,
    changeStore,
    getFile,
    changeFile
} = require("./store.service");
const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");

router.post("/store-config", async({body}, res)=>{
    try{    

        const response = await createStore(body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/store-config/:id", async({body, params}, res)=>{
    try{    

        const response = await changeStore(params.id, body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/store-config", async(req, res)=>{
    try{    

        const response = await getAllStores();

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/store-config/:id", async({params}, res)=>{
    try{    

        const response = await getStoreById(params.id);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/store-config/:idStore/:idFile", async({params}, res)=>{
    try{    

        const response = await getFile(params);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/store-config/:idStore/:idFile", async({params, body}, res)=>{
    try{    

        const response = await changeFile(params, body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});


module.exports = router;
