const statusHandler = require("../helpers/helpers.statusHandler");
const {
    save,
    findAll,
    findById,
    updateById,
    removeOne,
    countDocuments
} =require("../query");

const { OtherVariants } = require("../product/product.schema");

const {
    Shopify
} = require("./shopify.schema");

const createShopify = async(shopify)=>{
    try{

        const saved = await save(Shopify, shopify);

        return statusHandler.newResponse(200, {_id:saved?._id, message:"ok"});
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const { storeFilter } = require("../account/account.service");

const getAllShopify = async(scope = null)=>{
    try{
        
        const Shopifys = await findAll(Shopify, await storeFilter(scope));

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

// Exclusão definitiva da Shopify; bloqueada enquanto produtos tiverem variantes vindas dela
const removeShopify = async({id})=>{
    try{

        const shopify = await findById(Shopify, id);

        if(!shopify){
            throw(statusHandler.newResponse(404, "Shopify não encontrada"));
        }

        const variants = await countDocuments(OtherVariants, {store:id});

        if(variants){
            throw(statusHandler.newResponse(400, `${variants} produto(s) ainda usam variantes desta Shopify. Remova a Shopify desses produtos antes.`));
        }

        await removeOne(Shopify, id);

        return statusHandler.newResponse(200, "Shopify excluída");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    removeShopify,
    createShopify,
    getAllShopify,
    getShopifyById,
    changeShopify
};