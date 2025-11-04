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
    policies,
    files
} = require("../store/store.service");
const Twig = require('twig');

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
        
        let domains = await getAllDomains(true);
        domains = domains.content;
       
        return res.render(index, {
            template:'{% include "' + relativePath + '/components/admin/home.twig" %}',
            script:"home-admin.js",
            admin:true,
            home:'active',
            max,
            now,
            domains
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
            options_idioma,
            files
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

        let {header_template, menu_store, cart_template, footer_template, home_template} = config;

        header_template = Twig.twig({data:header_template}).render({
            store:true,
            ...config
        });
        menu_store = Twig.twig({data:menu_store}).render({
            store:true,
            all_collections:all_collections.content,
            ...config
        });
        cart_template = Twig.twig({data:cart_template}).render({
            ...config
        });
        footer_template = Twig.twig({data:footer_template}).render({
            ...config
        });


        home_template = Twig.twig({data:home_template}).render({
            store:true,
            all_collections:all_collections.content,
            ...firstCollection,
            ...config
        });
        
        return res.render(index, {
            template:home_template,
            script:"home.js",
            store:true,
            ...config,
            header_template,
            menu_store,
            cart_template,
            footer_template
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

        let {header_template, menu_store, cart_template, footer_template, collection_template} = config;

        header_template = Twig.twig({data:header_template}).render({
            store:true,
            ...config
        });
        menu_store = Twig.twig({data:menu_store}).render({
            store:true,
            all_collections:all_collections.content,
            ...config
        });
        cart_template = Twig.twig({data:cart_template}).render({
            ...config
        });
        footer_template = Twig.twig({data:footer_template}).render({
            ...config
        });
       
        collection_template = Twig.twig({data:collection_template}).render({
            ...info,
            ...config,
        });

        return res.render(index, {
            template:collection_template,
            script:"collection.js",
            store:true,
            ...config,
            header_template,
            menu_store,
            cart_template,
            footer_template
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
        const ramdonProducts = await getProductsRamdon(product.collection_, config._id);

        let {header_template, menu_store, cart_template, footer_template, product_template} = config;

        header_template = Twig.twig({data:header_template}).render({
            store:true,
            ...config,
            title:product.name,
        });
        menu_store = Twig.twig({data:menu_store}).render({
            store:true,
            all_collections:all_collections.content,
            ...config
        });
        cart_template = Twig.twig({data:cart_template}).render({
            ...config
        });
        footer_template = Twig.twig({data:footer_template}).render({
            ...config
        });

        let bundles = product.bundles;
        
        if(product.bundles.length > 1){
            
            bundles = bundles.map(bundle=>{
                bundle = bundle.toJSON();
                const variants = arrangeVariants(product, true);
                bundle['variants'] = [];

                let x = 0;

                while(x < bundle.amount){
                    bundle['variants'].push(variants);
                    x++;
                }

                if(bundle.last_price_bundle){
                    bundle['save'] = (bundle.last_price_bundle - bundle.price_bundle).toFixed(2);
                }

                return bundle;
            });
            
        }
        
        product_template = Twig.twig({data:product_template}).render({
            bundles,
            is_bundle:(product.bundles.length > 1),
            product,
            variants:arrangeVariants(product),
            ramdonProducts,
            ...config
        });



        return res.render(index, {
            template:product_template,
            script:"product.js",
            store:true,
            ...config,
            header_template,
            menu_store,
            cart_template,
            footer_template,
            
        });

    }catch(error){
        console.log(error)
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

        const timeZoneCountry = {
            "GB":"Europe/London",
            "US":"America/New_York",
            "FR":"Europe/Paris"
        };

        let {header_template, menu_store, cart_template, footer_template, order_template} = config;

        header_template = Twig.twig({data:header_template}).render({
            store:true,
            ...config
        });
        menu_store = Twig.twig({data:menu_store}).render({
            store:true,
            all_collections:all_collections.content,
            ...config
        });
        cart_template = Twig.twig({data:cart_template}).render({
            ...config
        });
        footer_template = Twig.twig({data:footer_template}).render({
            ...config
        });
        order_template = Twig.twig({data:order_template}).render({
            order,
            now: new Date().toLocaleString("en-US", { timeZone: timeZoneCountry[country] }),
            charges,
            ...config
        });

        return res.render(index, {
            template:order_template,
            script:"order.js",
            store:true,
            ...config,
            header_template,
            menu_store,
            cart_template,
            footer_template
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
        
        let {header_template, menu_store, cart_template, footer_template} = config;

        header_template = Twig.twig({data:header_template}).render({
            store:true,
            ...config
        });
        menu_store = Twig.twig({data:menu_store}).render({
            store:true,
            all_collections:all_collections.content,
            ...config
        });
        cart_template = Twig.twig({data:cart_template}).render({
            ...config
        });
        footer_template = Twig.twig({data:footer_template}).render({
            ...config
        });
        
        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/policies.twig" %}',
            store:true,
            all_collections:all_collections.content,
           ...policies[countrCode]['privacy'],
           ...config,
           policy:true,
           header_template,
            menu_store,
            cart_template,
            footer_template
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
        
        let {header_template, menu_store, cart_template, footer_template} = config;

        header_template = Twig.twig({data:header_template}).render({
            store:true,
            ...config
        });
        menu_store = Twig.twig({data:menu_store}).render({
            store:true,
            all_collections:all_collections.content,
            ...config
        });
        cart_template = Twig.twig({data:cart_template}).render({
            ...config
        });
        footer_template = Twig.twig({data:footer_template}).render({
            ...config
        });

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/policies.twig" %}',
            store:true,
            all_collections:all_collections.content,
           ...policies[countrCode]['shipping'],
           ...config,
           policy:true,
           header_template,
            menu_store,
            cart_template,
            footer_template
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

        let {header_template, menu_store, cart_template, footer_template} = config;

        header_template = Twig.twig({data:header_template}).render({
            store:true,
            ...config
        });
        menu_store = Twig.twig({data:menu_store}).render({
            store:true,
            all_collections:all_collections.content,
            ...config
        });
        cart_template = Twig.twig({data:cart_template}).render({
            ...config
        });
        footer_template = Twig.twig({data:footer_template}).render({
            ...config
        });

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/policies.twig" %}',
            store:true,
            all_collections:all_collections.content,
           ...policies[countrCode]['return'],
           ...config,
            policy:true,
           header_template,
            menu_store,
            cart_template,
            footer_template
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
        
        let {header_template, menu_store, cart_template, footer_template} = config;

        header_template = Twig.twig({data:header_template}).render({
            store:true,
            ...config
        });
        menu_store = Twig.twig({data:menu_store}).render({
            store:true,
            all_collections:all_collections.content,
            ...config
        });
        cart_template = Twig.twig({data:cart_template}).render({
            ...config
        });
        footer_template = Twig.twig({data:footer_template}).render({
            ...config
        });

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/store/policies.twig" %}',
            store:true,
            all_collections:all_collections.content,
           ...policies[countrCode]['terms'],
           ...config,
           policy:true,
           header_template,
            menu_store,
            cart_template,
            footer_template
        });

    }catch(error){
        const host = req.get('host');
        const newUrl = `https://www.${host}${req.originalUrl}`;

        return res.redirect(newUrl);
    }
});

module.exports = router;