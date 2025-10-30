const router = require("express").Router();
const path = require('path');
const relativePath =  path.resolve(`${__dirname}/../`);
const index = relativePath + '/template/index.twig';

const {
    getFirtsCollection,
    getInfoCollection,
    getProductById,
    arrangeVariants,
    getAllCollections,
    getProductsRamdon,
    getAllProducts
} = require("../product/product.service");

const {
    getOrderShopify,
    getCharges
} = require("../order/order.service");

const {
    requestFilter,
    getAllIps
} = require("../cloacker/cloacker.service");

const {
    saveSession,
    getCountry
} = require("../trail/trail.service");

const {
    getAllShopify 
} = require("../shopify/shopify.service")

const {
    getAllSessions
} = require("../metrics/metrics.service");
const { getAllDomains } = require("../domain/domain.service");
const { 
    getAllStores,
    getConfigStore,
    options_country,
    options_moeda,
    options_idioma,
    policies
} = require("../store/store.service");

//rotas admin

router.get("/admin/products", async(req, res)=>{
    try{

        const products_ = await getAllProducts();

        return res.render(index, {
            products_:products_.content,
            template:'{% include "' + relativePath + '/components/admin/products.twig" %}',
            script:"products-admin.js",
            admin:true,
            products:'active',
        });
        
    }catch(error){
      
        
    }   
});

router.get("/admin/home", async(req, res)=>{
    try{

        let max = new Date(Date.now());
        let month = max.getMonth()+1;
        let date = max.getDate();
        max = `${max.getFullYear()}-${(month+"").length == 1 ? `0${month}` : month}-${(date+"").length == 1 ? `0${date}` : date}`;
        
        let now = new Date(Date.now());
        month = now.getMonth()+1;
        date = now.getDate();
        now = `${now.getFullYear()}-${(month+"").length == 1 ? `0${month}` : month}-${(date+"").length == 1 ? `0${date}` : date}`
    
       
        return res.render(index, {
            template:'{% include "' + relativePath + '/components/admin/home.twig" %}',
            script:"home-admin.js",
            admin:true,
            home:'active',
            max,
            now,
            
        });
        
    }catch(error){
      console.log(error)
        
    }   
});


router.get("/admin/collections", async(req, res)=>{
    try{

        const all_collections =  await getAllCollections(true);

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/admin/collections.twig" %}',
            script:"collections-admin.js",
            admin:true,
            collections:'active',
            all_collections:all_collections.content,
        });
        
    }catch(error){
      
        
    }   
});


router.get("/admin/shopify", async(req, res)=>{
    try{

        const shopifys = await getAllShopify()

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/admin/shopify.twig" %}',
            script:"shopify-admin.js",
            admin:true,
            shopify:'active',
            shopifys:shopifys.content
        });
        
    }catch(error){
      
        
    }   
});

router.get("/admin/stores", async(req, res)=>{
    try{

        const stores = await getAllStores()

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/admin/store.twig" %}',
            script:"store-admin.js",
            admin:true,
            store:'active',
            stores:stores.content,
            options_country,
            options_moeda,
            options_idioma
        });
        
    }catch(error){
      
        
    }   
});


router.get("/admin/cloacker", async(req, res)=>{
    try{

        const ips = await getAllIps();

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/admin/cloacker.twig" %}',
            script:"cloacker-admin.js",
            admin:true,
            cloacker:'active',
            ips:ips.content
        });
        
    }catch(error){
      
        
    }   
});

router.get("/admin/domain", async(req, res)=>{
    try{

        const domains = await getAllDomains();

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/admin/domain.twig" %}',
            script:"domain-admin.js",
            admin:true,
            domain:'active',
            domains:domains.content
        });
        
    }catch(error){
      
        
    }   
});

// rotas loja
router.get("/", async(req, res)=>{
    try{

    
        const config = await getConfigStore(req.get('host'), 'domain');
        const isSecure = await saveSession(req, config.country);

        if(!isSecure){                
            const host = req.get('host');
            const newUrl = `https://www.${host}${req.originalUrl}`;

            return res.redirect(newUrl);
        }

        const firstCollection = await getFirtsCollection(config._id);
        const all_collections =  await getAllCollections(false, config._id);

        
        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/home.twig" %}',
            script:"home.js",
            store:true,
            all_collections:all_collections.content,
           ...firstCollection,
            ...config
        });

    }catch(error){
        const host = req.get('host');
        const newUrl = `https://www.${host}${req.originalUrl}`;

        return res.redirect(newUrl);
    }
});

router.get("/collections/:id", async(req , res)=>{
    try{    
        
        const config = await getConfigStore(req.params.id, 'collection');
       

        const isSecure = await saveSession(req, config.country);
        
        if(!isSecure){
            const host = req.get('host');
            const newUrl = `https://www.${host}${req.originalUrl}`;

            return res.redirect(newUrl);
        }
        
        const {id} = req.params;
        const info = await getInfoCollection(id);
        const all_collections =  await getAllCollections(false, config._id);


        console.log("END", new Date(Date.now()))


        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/collection.twig" %}',
            script:"collection.js",
            store:true,
            title:info.collection.name,
            all_collections:all_collections.content,
            ...info,
            ...config
        });

    }catch(error){

        const host = req.get('host');
        const newUrl = `https://www.${host}${req.originalUrl}`;

        return res.redirect(newUrl);
    }
});

router.get("/products/:id", async(req, res)=>{
    try{    

        const config = await getConfigStore(req.params.id, 'product');

        const isSecure = await saveSession(req, config.country);

        if(!isSecure){
            const host = req.get('host');
            const newUrl = `https://www.${host}${req.originalUrl}`;

            return res.redirect(newUrl);

        }

        const {id} = req.params;
        const product = await getProductById(id);
     
        const all_collections =  await getAllCollections(false, config._id);
        const ramdonProducts = await getProductsRamdon(product.collection_);

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/product.twig" %}',
            script:"product.js",
            store:true,
            product,
            variants:arrangeVariants(product),
            all_collections:all_collections.content,
            ramdonProducts,
            ...config,
            title:product.name,
        });

    }catch(error){
        const host = req.get('host');
        const newUrl = `https://www.${host}${req.originalUrl}`;

        return res.redirect(newUrl);
    }
});

router.get("/order/:id", async(req, res)=>{
    try{    

        //const isSecure = await saveSession(req);

        const config = await getConfigStore(req.get('host'), 'domain');
        const country =config.country[0];

        const {id} = req.params;
        const order = await getOrderShopify(id, req.query, country);
        const charges = await getCharges(id, country)
        const all_collections =  await getAllCollections(false);

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/order.twig" %}',
            script:"order.js",
            store:true,
            order,
            now: new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }),
            charges,
            all_collections:all_collections.content,
            ...config
        });

    }catch(error){
        console.log(error);

        res.redirect("/");
    }
});

router.get("/privacy-policy", async(req, res)=>{
    try{
    
        
        const config = await getConfigStore(req.get('host'), 'domain');
        const countrCode = config.country[0];
        const isSecure = await saveSession(req, config.country);

        if(!isSecure){                
            const host = req.get('host');
            const newUrl = `https://www.${host}${req.originalUrl}`;

            return res.redirect(newUrl);
        }
        
        const all_collections =  await getAllCollections(false, config._id);
        
        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/policies.twig" %}',
            store:true,
            all_collections:all_collections.content,
           ...policies[countrCode]['privacy'],
           ...config
        });

    }catch(error){
        const host = req.get('host');
        const newUrl = `https://www.${host}${req.originalUrl}`;

        return res.redirect(newUrl);
    }
});


router.get("/shipping-policy", async(req, res)=>{
    try{
    
        const config = await getConfigStore(req.get('host'), 'domain');
        const countrCode = config.country[0];
        const isSecure = await saveSession(req, config.country);

        if(!isSecure){                
            const host = req.get('host');
            const newUrl = `https://www.${host}${req.originalUrl}`;

            return res.redirect(newUrl);
        }
        
        const all_collections =  await getAllCollections(false, config._id);
        
        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/policies.twig" %}',
            store:true,
            all_collections:all_collections.content,
           ...policies[countrCode]['shipping'],
           ...config
        });

    }catch(error){
        const host = req.get('host');
        const newUrl = `https://www.${host}${req.originalUrl}`;

        return res.redirect(newUrl);
    }
});


router.get("/return-refund", async(req, res)=>{
    try{
    
        const config = await getConfigStore(req.get('host'), 'domain');
        const countrCode = config.country[0];
        const isSecure = await saveSession(req, config.country);

        if(!isSecure){                
            const host = req.get('host');
            const newUrl = `https://www.${host}${req.originalUrl}`;

            return res.redirect(newUrl);
        }
        
        const all_collections =  await getAllCollections(false, config._id);
        
        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/policies.twig" %}',
            store:true,
            all_collections:all_collections.content,
           ...policies[countrCode]['return'],
           ...config
        });

    }catch(error){
        const host = req.get('host');
        const newUrl = `https://www.${host}${req.originalUrl}`;

        return res.redirect(newUrl);
    }
});


router.get("/terms-of-service", async(req, res)=>{
    try{
    
        const config = await getConfigStore(req.get('host'), 'domain');
        const countrCode = config.country[0];
        const isSecure = await saveSession(req, config.country);

        if(!isSecure){                
            const host = req.get('host');
            const newUrl = `https://www.${host}${req.originalUrl}`;

            return res.redirect(newUrl);
        }
        
        const all_collections =  await getAllCollections(false, config._id);
        
        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/policies.twig" %}',
            store:true,
            all_collections:all_collections.content,
           ...policies[countrCode]['terms'],
           ...config
        });

    }catch(error){
        const host = req.get('host');
        const newUrl = `https://www.${host}${req.originalUrl}`;

        return res.redirect(newUrl);
    }
});

module.exports = router;