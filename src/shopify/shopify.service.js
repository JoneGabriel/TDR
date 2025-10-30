const statusHandler = require("../helpers/helpers.statusHandler");
const {
    save,
    findAll,
    findById,
    updateById
} =require("../query");

const {
    Shopify
} = require("./shopify.schema");

const createShopify = async(shopify)=>{
    try{

        await save(Shopify, shopify);

        return statusHandler.newResponse(200, "ok");
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getAllShopify = async()=>{
    try{
        
        const Shopifys = await findAll(Shopify);

        return statusHandler.newResponse(200, Shopifys);
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getShopifyById = async({id})=>{
    try{

        const shopifyInfo = await findById(Shopify, id);

        return statusHandler.newResponse(200, shopifyInfo);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeShopify = async({id}, shopify)=>{
    try{

        await updateById(Shopify, id, shopify);

        return statusHandler.newResponse(200, "ok");
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    createShopify,
    getAllShopify,
    getShopifyById,
    changeShopify
};