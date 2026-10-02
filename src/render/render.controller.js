const router = require("express").Router();
const path = require('path');
const relativePath =  path.resolve(`${__dirname}/../`);
const index = relativePath + '/template/index.twig';
const errorPage = relativePath + '/components/store/error.twig';

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
    getCharges,
    getChatContext
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
    files,
    options_layout,
    useLayout,
    useCountry,
    policy_files
} = require("../store/store.service");
const Twig = require('twig');
const { requireAdminPage, notOnAdminHost } = require("../auth/auth.service");

// Página de erro da vitrine, usada no catch das rotas da loja.
// `config` pode estar indefinido se a loja nem chegou a carregar (ex.: domínio não cadastrado).
// Página de erro da vitrine. Erros de negócio com status (404 de loja/produto/coleção inexistente) saem com esse
// status e sem stack no log (serviceError já registrou uma linha); o resto é 500 com o erro completo.
const renderError = (res, error, config)=>{
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;

    if(status >= 500){
        console.error(error);
    }

    return res.status(status).render(errorPage, {
        title:config?.title,
        logo:config?.logo,
        status
    });
};

//rotas admin

router.get("/admin/products", requireAdminPage, async(req, res)=>{
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

router.get("/admin/home", requireAdminPage, async(req, res)=>{
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


router.get("/admin/collections", requireAdminPage, async(req, res)=>{
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


router.get("/admin/shopify", requireAdminPage, async(req, res)=>{
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

router.get("/admin/stores", requireAdminPage, async(req, res)=>{
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
            files,
            options_layout,
            policy_files
        });
        
    }catch(error){
      
        
    }   
});


router.get("/admin/cloacker", requireAdminPage, async(req, res)=>{
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

router.get("/admin/domain", requireAdminPage, async(req, res)=>{
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

router.get("/admin/integrations", requireAdminPage, async(req, res)=>{
    try{

        return res.render(index, {
            template:'{% include "' + relativePath + '/components/admin/integrations.twig" %}',
            script:"integrations-admin.js",
            admin:true,
            integrations:'active'
        });
        
    }catch(error){
      console.log(error)
        
    }   
});

// rotas loja
router.get("/", notOnAdminHost, async(req, res)=>{
    let config;

    try{

    
        config = await getConfigStore(req.get('host'), 'domain');
        const isSecure = await saveSession(req, res, config.country);

        // visitante filtrado pelo cloaker vê o layout "second"; liberado vê "first" (ou ?layout= para pré-visualizar)
        useLayout(config, isSecure ? req.query.layout : "second");
        // moeda e preços pelo país da visita (?country= pré-visualiza outro país atendido)
        useCountry(config, req.query.country || req.visitorCountry);

        // produtos na versão do layout em uso (first/second); /order/:id fica fora dessa regra
        const firstCollection = await getFirtsCollection(config._id, config.layout, config.buyer_country);
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

        return renderError(res, error, config);
    }
});

router.get("/collections/:id", notOnAdminHost, async(req, res)=>{
    let config;

    try{    
        
        config = await getConfigStore(req.params.id, 'collection');
       

        const isSecure = await saveSession(req, res, config.country);
        
        // visitante filtrado pelo cloaker vê o layout "second"; liberado vê "first" (ou ?layout= para pré-visualizar)
        useLayout(config, isSecure ? req.query.layout : "second");
        // moeda e preços pelo país da visita (?country= pré-visualiza outro país atendido)
        useCountry(config, req.query.country || req.visitorCountry);
        
        const {id} = req.params;
        const info = await getInfoCollection(id, config.layout, config.buyer_country);
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

        return renderError(res, error, config);
    }
});

router.get("/products/:id", notOnAdminHost, async(req, res)=>{
    let config;

    try{    

        config = await getConfigStore(req.params.id, 'product');

        const isSecure = await saveSession(req, res, config.country);

        // visitante filtrado pelo cloaker vê o layout "second"; liberado vê "first" (ou ?layout= para pré-visualizar)
        useLayout(config, isSecure ? req.query.layout : "second");
        // moeda e preços pelo país da visita (?country= pré-visualiza outro país atendido)
        useCountry(config, req.query.country || req.visitorCountry);

        const {id} = req.params;
        const product = await getProductById(id, false, config.layout, config.buyer_country);
        
        

        const all_collections =  await getAllCollections(false, config._id);
        const ramdonProducts = await getProductsRamdon(product.collection_, config._id, config.layout, config.buyer_country);

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

                bundle.last_price_bundle && ( bundle.last_price_bundle = bundle.last_price_bundle.toFixed(2));
                bundle.price_bundle = bundle.price_bundle.toFixed(2);


                return bundle;
            });
            
        }

        product.price = product.price?.toFixed(2);
        product.last_price = product.last_price?.toFixed(2);

        
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

        return renderError(res, error, config);
    }
});

router.get("/order/:id", notOnAdminHost, async(req, res)=>{
    let config;

    try{    

        //const isSecure = await saveSession(req);

        config = await getConfigStore(req.get('host'), 'domain');
        // sem filtro de visitante nesta rota: layout "first" por padrão, ?layout= para pré-visualizar
        useLayout(config, req.query.layout);
        useCountry(config, req.query.country || req.visitorCountry);
        const country =config.country[0];

        const {id} = req.params;
        const order = await getOrderShopify(id, req.query, country, config.idioma_code);
        const charges = await getCharges(id, country)
        // contexto do chat inteligente (window.TDR_ORDER em index.twig)
        const order_chat = order ? getChatContext(order, config, req.query.urlStore) : null;
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
            order_chat,
            header_template,
            menu_store,
            cart_template,
            footer_template
        });

    }catch(error){

        return renderError(res, error, config);
    }
});

router.get("/privacy-policy", notOnAdminHost, async(req, res)=>{
    let config;

    try{
    
        
        config = await getConfigStore(req.get('host'), 'domain');
        const countrCode = config.country[0];
        const isSecure = await saveSession(req, res, config.country);

        // visitante filtrado pelo cloaker vê o layout "second"; liberado vê "first" (ou ?layout= para pré-visualizar)
        useLayout(config, isSecure ? req.query.layout : "second");
        // moeda e preços pelo país da visita (?country= pré-visualiza outro país atendido)
        useCountry(config, req.query.country || req.visitorCountry);
        
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
           ...config.policies.privacy,
           ...config,
           policy:true,
           header_template,
            menu_store,
            cart_template,
            footer_template
        });

    }catch(error){

        return renderError(res, error, config);
    }
});


router.get("/shipping-policy", notOnAdminHost, async(req, res)=>{
    let config;

    try{
    
        config = await getConfigStore(req.get('host'), 'domain');
        const countrCode = config.country[0];
        const isSecure = await saveSession(req, res, config.country);

        // visitante filtrado pelo cloaker vê o layout "second"; liberado vê "first" (ou ?layout= para pré-visualizar)
        useLayout(config, isSecure ? req.query.layout : "second");
        // moeda e preços pelo país da visita (?country= pré-visualiza outro país atendido)
        useCountry(config, req.query.country || req.visitorCountry);
        
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
           ...config.policies.shipping,
           ...config,
           policy:true,
           header_template,
            menu_store,
            cart_template,
            footer_template
        });

    }catch(error){

        return renderError(res, error, config);
    }
});


router.get("/return-refund", notOnAdminHost, async(req, res)=>{
    let config;

    try{
    
        config = await getConfigStore(req.get('host'), 'domain');
        const countrCode = config.country[0];
        const isSecure = await saveSession(req, res, config.country);

        // visitante filtrado pelo cloaker vê o layout "second"; liberado vê "first" (ou ?layout= para pré-visualizar)
        useLayout(config, isSecure ? req.query.layout : "second");
        // moeda e preços pelo país da visita (?country= pré-visualiza outro país atendido)
        useCountry(config, req.query.country || req.visitorCountry);
        
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
           ...config.policies.return,
           ...config,
            policy:true,
           header_template,
            menu_store,
            cart_template,
            footer_template
        });

    }catch(error){

        return renderError(res, error, config);
    }
});


router.get("/terms-of-service", notOnAdminHost, async(req, res)=>{
    let config;

    try{
    
        config = await getConfigStore(req.get('host'), 'domain');
        const countrCode = config.country[0];
        const isSecure = await saveSession(req, res, config.country);

        // visitante filtrado pelo cloaker vê o layout "second"; liberado vê "first" (ou ?layout= para pré-visualizar)
        useLayout(config, isSecure ? req.query.layout : "second");
        // moeda e preços pelo país da visita (?country= pré-visualiza outro país atendido)
        useCountry(config, req.query.country || req.visitorCountry);
        
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
           ...config.policies.terms,
           ...config,
           policy:true,
           header_template,
            menu_store,
            cart_template,
            footer_template
        });

    }catch(error){

        return renderError(res, error, config);
    }
});

module.exports = router;