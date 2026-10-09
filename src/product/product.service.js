const {
    Product,
    Collection,
    OtherVariants,
    Bundle
} = require("../product/product.schema");
const mongoose = require("mongoose");
const { storeFilter } = require("../account/account.service");

const {
    save,
    findOne,
    findAll,
    findById,
    populate,
    updateById,
    removeOne,
    removeMany,
    countDocuments
} =require("../query");

const {
    request,
    isEmpty
} = require("../helpers/helpers.global");

const statusHandler = require("../helpers/helpers.statusHandler");

const {
    Shopify
} = require("../shopify/shopify.schema");
const { shopifyGraphql } = require("../shopify/shopify.client");

const {
    compareVariants
} = require("../cart/cart.service");
const { Store } = require("../store/store.schema");
const { pickBuyerCountry, legacyMoeda, symbolOf } = require("../helpers/helpers.countries");
const { refreshProductPrices } = require("../pricing/pricing.service");

// Campos do produto que têm versão por layout da loja
const productLayoutFields = ["name", "last_price", "price", "images", "description"];

const isFilled = (value)=> Array.isArray(value) ? value.length > 0 : (value !== undefined && value !== null && value !== "");

// Devolve o produto na versão do layout da loja: a raiz do documento é a versão "first";
// em "second", os campos preenchidos em layouts.second sobrepõem a raiz e os vazios caem na "first".
const applyProductLayout = (product, layout = "first", country = null)=>{
    if(!product){
        return product;
    }

    const doc = typeof product.toJSON == "function" ? product.toJSON() : product;
    const second = doc.layouts?.second || {};

    if(layout == "second"){
        productLayoutFields.forEach(field=>{
            isFilled(second[field]) && (doc[field] = second[field]);
        });
    }

    doc.layout = layout == "second" ? "second" : "first";
    delete doc.layouts;

    // preço do país do visitante (cache de pricing.service), só no layout first, que é o que vai ao checkout
    const local = country && doc.layout == "first" ? doc.prices?.[country] : null;

    if(local){
        doc.price = local.price;
        doc.last_price = local.last_price ?? doc.last_price;
        doc.currency = local.currency;
    }

    delete doc.prices;

    return doc;
};

// Variantes com o preço do país quando há cache; sem cache ficam no preço base da Shopify
const localizeVariants = (variants, country)=>{
    const plain = variants ? JSON.parse(JSON.stringify(variants)) : {};

    if(!plain.variant_values || !country){
        return plain;
    }

    plain.variant_values = plain.variant_values.map(value=>{
        const local = value.prices?.[country];

        // base_price guarda o preço base da Shopify para a razão dos bundles continuar correta depois de localizar
        return local ? {...value, base_price:value.price, price:local.price, last_price:local.last_price ?? value.last_price, currency:local.currency} : value;
    });

    return plain;
};

// Razão preço local / preço base da primeira variante com cache: converte preços manuais (bundles) na proporção da Shopify
const countryRatio = (variants, country)=>{
    const value = (variants?.variant_values || []).find(item=> item.prices?.[country]?.price && (item.base_price ?? item.price));

    return value ? value.prices[country].price / (value.base_price ?? value.price) : 1;
};

const round2 = (value)=> Math.round(value * 100) / 100;

// Loja e país do comprador para as rotas JSON (variante, carrinho): país pedido se atendido, senão o primeiro da loja
const buyerContext = async(product, requested)=>{
    const store = product?.store ? await findById(Store, product.store) : null;
    const country = pickBuyerCountry(store?.country, requested);
    const currency = (country && store?.market_currencies?.[country]) || legacyMoeda[store?.moeda] || "EUR";

    return {store, country, currency, moeda:symbolOf(currency)};
};

// Limpa a versão second vinda do admin: campos vazios são removidos para cair na versão first.
// Sem `layouts` no body nada muda no banco (PUT parcial).
const normalizeProductLayouts = (product)=>{
    if(!product.layouts){
        return product;
    }

    const second = product.layouts.second || {};
    let clean = {};

    productLayoutFields.forEach(field=>{
        isFilled(second[field]) && (clean[field] = second[field]);
    });

    product.layouts = {second:clean};

    return product;
};

// Na loja second só entram produtos com versão second cadastrada (pelo menos um campo de layouts.second
// preenchido). O filtro é aplicado na consulta, então vale igual para listas, página do produto e carrinho.
const SECOND_VERSION_FILTER = {$or:[
    {"layouts.second.name":{$nin:[null, ""]}},
    {"layouts.second.price":{$nin:[null, ""]}},
    {"layouts.second.last_price":{$nin:[null, ""]}},
    {"layouts.second.description":{$nin:[null, ""]}},
    {"layouts.second.images.0":{$exists:true}}
]};
const layoutFilter = (layout)=> layout == "second" ? SECOND_VERSION_FILTER : {};

// 404 quando o produto não existe na versão pedida (second sem versão cadastrada)
const assertVisibleInLayout = async(id, layout)=>{
    if(layout != "second") return;

    const visible = await countDocuments(Product, {_id:id, ...SECOND_VERSION_FILTER});

    if(!visible){
        throw(statusHandler.newResponse(404, "Produto não disponível nesta versão da loja"));
    }
};

// Projeção leve para listagens (só a primeira imagem), já com a versão second
const listProjection = {
    name:1, last_price:1, price:1, brand:1, status:1, prices:1,
    images:{$slice:1},
    "layouts.second.name":1, "layouts.second.last_price":1, "layouts.second.price":1,
    "layouts.second.images":{$slice:1}
};

const getInfoCollection = async(id, layout = "first", country = null)=>{
    try{
       
        const collection = await findById(Collection, id);
        let products = await findAll(Product, {
            collection_:id, status:true, ...layoutFilter(layout)
        }, listProjection);

        products = products.map(product=> applyProductLayout(product, layout, country));
        
        return {
            products,
            collection,
            number_products:products.length
        }

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const createObjectCollections = async(collections, layout = "first", country = null)=>{
    try{

        let object = [];

        for(i in collections){

            const {_id, name} = collections[i];
            let products = await findAll(Product, {collection_:_id, ...layoutFilter(layout)}, listProjection);

            products = products.map(product=> applyProductLayout(product, layout, country));

            products.length && object.push({
                name,
                _id,
                products
            });
        }

        return object;
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getFirtsCollection = async(store, layout = "first", country = null)=>{
    try{    

        const collections = await findAll(Collection, {status:true, store});
        const position = collections.length-1;
        let products = await findAll(Product, {
            collection_:collections[position]?._id, status:true, store, ...layoutFilter(layout)
        }, listProjection);

        products = products.map(product=> applyProductLayout(product, layout, country));

        
        return {
            collection_id:collections[position]?._id,
            collection_name:collections[position]?.name,
            products:products.slice(0,4),
            collections,
            object_collections: await createObjectCollections(collections, layout, country)
        };
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const createCollections = async(collection)=>{
    try{

        const saved = await save(Collection, collection);

        return statusHandler.newResponse(200, {_id:saved?._id, message:"Created collection"});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// admin: coleções da conta em uso (`scope`); vitrine: só ativas da loja
const getAllCollections = async(admin = true, store, scope = null)=>{
    try{

        let query = admin ? await storeFilter(scope) : {};

        if(!admin){
            query['status'] = true;
            query['store'] = store;
        }

        let collections = await findAll(Collection, query);

        for(i in collections){
            const {_id} = collections[i];

            if(_id){
                 collections[i]['products'] = await countDocuments(Product, {collection_:_id});
            }
        }

        return statusHandler.newResponse(200, collections);
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};


const formatVariants = (shopifyVariants) => {
    
    const variant_values = shopifyVariants.map(variant => {
      const options = variant.selectedOptions;
  
      return {
        value_1: options[0]?.value || null,
        value_2: options[1]?.value || null,
        value_3: options[2]?.value || null,
        id_shopify: variant.id.replace("gid://shopify/ProductVariant/",""),
        img:variant?.image?.url,
        price:variant?.price?.amount,
        last_price:variant?.compareAtPrice?.amount
      };
    });
  
    const [title_1, title_2, title_3] = shopifyVariants[0]?.selectedOptions.map(o => o.name);
  
    return {
      title_1: title_1 || null,
      title_2: title_2 || null,
      title_3: title_3 || null,
      variant_values,
    };
};

const getVariants = async(id_shopify, shopify)=>{
    try {
        const query = `
          query ProductVariants($id: ID!, $after: String) {
            product(id: $id) {
              id
              title
              handle
              variants(first: 100, after: $after) {
                nodes {
                  id
                  title
                  sku
                  price { amount currencyCode }
                  compareAtPrice { amount currencyCode }
                  image { url }
                  selectedOptions { name value }
                }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        `;

        let after = null;
        let hasNext = true;
        let variants = [];

        while (hasNext) {
          const data = await shopifyGraphql(shopify, "storefront", query, {
            id: `gid://shopify/Product/${id_shopify}`,
            after
          });

          const p = data.product;

          if (!p) {
            throw statusHandler.newResponse(404, `Produto ${id_shopify} nao encontrado na Shopify`);
          }

          variants.push(...p.variants.nodes);

          hasNext = p.variants.pageInfo.hasNextPage;
          after = p.variants.pageInfo.endCursor;
        }

        return formatVariants(variants);
      } catch (error) {
        throw statusHandler.serviceError(error);
      }
};

const createOtherVariants = async(otherShopify, idProduct)=>{
    try{

        for(i in otherShopify){

            const {store, id_shopify_store} = otherShopify[i];
            const shopify = await findById(Shopify, store);

            let otherVariants = {};
            otherVariants["variants"] = await getVariants(id_shopify_store, shopify);
            
            otherVariants["store"] = store;
            otherVariants["id_shopify"] = id_shopify_store;
            otherVariants["product"] = idProduct;
            
            const exist = await findOne(OtherVariants, {product:idProduct, id_shopify:id_shopify_store});

            if(exist){
                await updateById(OtherVariants, exist._id, otherVariants);
                continue;
            }
            
            await save(OtherVariants, otherVariants);
        }

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Todo produto precisa de loja: sem `store` no body, herda a da coleção; sem coleção com loja, recusa.
// (Um produto sem loja derrubava a vitrine com TypeError em getConfigStore.)
const ensureProductStore = async(product, id = null)=>{
    if(product.store) return;

    const current = id ? await findById(Product, id, {store:1, collection_:1}) : null;

    if(current?.store) return;

    const collectionId = product.collection_ || current?.collection_;
    const collection = collectionId && mongoose.isValidObjectId(collectionId) ? await findById(Collection, collectionId, {store:1}) : null;

    if(collection?.store){
        product.store = collection.store;
        return;
    }

    throw(statusHandler.newResponse(400, "Selecione a loja do produto"));
};

const createProduct = async(product)=>{
    try{
        
        const shopify = product["other_shopify"];
        // o admin manda os bundles em `bundle` (mesma chave que changeProduct lê); `bundles` fica por compatibilidade
        const bundles = product["bundle"] || product["bundles"];

        await ensureProductStore(product);
        normalizeProductLayouts(product);

        const idProduct = await save(Product, product);

        if(!isEmpty(shopify)){
            
            await createOtherVariants(shopify, "" + (idProduct)._id);
        }

        if(!isEmpty(bundles)){
            await createBundles(bundles, "" + (idProduct)._id);
        }

        // cache de preços por país (falha na Shopify não impede o cadastro)
        await refreshProductPrices("" + (idProduct)._id).catch(error=> console.warn('\x1b[33m%s\x1b[0m', `[pricing] ${error.content || error.message || error}`));

        // o admin usa `_id` para recarregar o produto no mesmo modal (ids de bundles e variantes)
        return statusHandler.newResponse(200, {_id:idProduct._id, message:"Created product"});
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getAllProducts = async(scope = null)=>{
    try{

        let products = await findAll(Product, await storeFilter(scope), 
            {name:1, price:1, collection_:1, status:1, images:{
            $slice:1
        }}
        );
        products = await populate(Product, products, "collection_")

        return statusHandler.newResponse(200, products);
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const arrangeVariants = (product, isBundle = false)=>{
    try{

        const {variants} = product;

        let newVariants = [];


        Object.keys(variants).forEach(key=>{

            if((key == "title_1" || key == "title_2" || key == "title_3") && variants[key]){

                let numberKey = key.split("title_")[1]
                let object = {};
                object["title"] = variants[key].replaceAll(" ", "-");
                object["title_label"] = variants[key];
                object["values"] = [];
              
                variants.variant_values.forEach(value=>{

                    const exist =  object["values"].find(val=>val.value == value[`value_${numberKey}`]) || object["values"].find(val=>val == value[`value_${numberKey}`]);
                    const condition = object["title"] == 'Couleur' || object["title"] == 'Color' || object["title"] == 'Color-Harness-1' || object["title"] == 'Color-Harness-2'
                     || object["title"] == 'Couleur-du-pull-1' || object["title"] == 'Couleur-du-pull-2'

                    if(condition && !isBundle){
                        !exist && object["values"].push({value:value[`value_${numberKey}`], img:value.img});
                        
                        return;
                    }

                    !exist && object["values"].push(value[`value_${numberKey}`]);
                });

                newVariants.push(object);
            }

        });
        return newVariants;
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getProductById = async(id, api = false, layout = "first", country = null)=>{
    try{

        // vitrine na loja second: produto sem versão second não existe
        !api && await assertVisibleInLayout(id, layout);

        let product = await findById(Product, id);
        // admin (api) recebe o documento inteiro, com layouts.second, para editar as duas versões
        product = api ? product.toJSON() : applyProductLayout(product, layout, country);
        
        if(api){

            let findStores = await findAll(OtherVariants, {product:id}, {store:1, id_shopify:1});
            findStores = await populate(OtherVariants, findStores, 'store');

            if(findStores.length){
                product["other_shopify"] = findStores;
            }

            const bundles = await findAll(Bundle, {product:id}, { last_price_bundle:1,  title_bundle:1, _id:1,price_bundle:1, default_bundle:1, amount:1, cupom_code:1});
            product['bundles'] = bundles
             
        }

        if(!api){
            const otherVariants = await findOne(OtherVariants, {product:id});
            const bundles = await findAll(Bundle, {product:id});

            product['bundles'] = bundles;
            product['variants'] = localizeVariants(otherVariants?.variants, country);
            product.discount = parseInt((product.price/(product.last_price)*100)-100);
        }

        return !api ? product : statusHandler.newResponse(200, product);
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getProductByIdForCart = async({id}, {cart, is_bundle, layout, country})=>{
    try{

        await assertVisibleInLayout(id, layout);
        
        let product =  await findById(Product, id, {name:1, last_price:1, price:1, store:1, prices:1, "layouts.second.name":1, "layouts.second.last_price":1, "layouts.second.price":1});

        const otherVariants =  await findOne(OtherVariants, {product:id});
        const buyer = await buyerContext(product, country);
        
        product = applyProductLayout(product, layout, buyer.country);
        product['variants'] = localizeVariants(otherVariants?.variants, buyer.country);
        product['country'] = buyer.country;
        product['currency'] = buyer.currency;
        
        if(is_bundle){

            const bundle = await findById(Bundle, is_bundle);
            // bundle tem preço manual na moeda base: converte na mesma proporção que a Shopify aplicou às variantes
            const ratio = countryRatio(product["variants"], buyer.country);

            product["price"] = round2(bundle.price_bundle * ratio);
            product["last_price"] = bundle.last_price_bundle ? round2(bundle.last_price_bundle * ratio) : bundle.last_price_bundle;
            product["name"] = bundle.title_bundle;

            const variants = product["variants"];
           
            product["variants"] = []
             
            cart.forEach(bundleOption=>{  

                const idShopify = compareVariants(bundleOption, variants);
                const result = variants["variant_values"].filter(val=> val.id_shopify == idShopify);
                
                product["variants"].push(result);

            });

            return statusHandler.newResponse(200, product);
        }

        const idShopify = compareVariants(cart, product["variants"]);

        product["variants"] = product["variants"]["variant_values"].filter(val=> val.id_shopify == idShopify);
        
        if(product["variants"].length){
            const {last_price, price, currency} = product["variants"][0];
            product.last_price = last_price ||  product.last_price;
            product.price = price || product.price;
            // a variante com cache do país manda na moeda; sem cache fica a da loja (base)
            currency && (product.currency = currency);
        }
        
        return statusHandler.newResponse(200, product);

    }catch(error){  
        throw(statusHandler.serviceError(error));
    }
};

const getProductsRamdon = async(collection_, store, layout = "first", country = null)=>{
    try{

        let products = await findAll(Product, {collection_, status:true, store, ...layoutFilter(layout)});
        
        return products.slice(0,6).map(product=> applyProductLayout(product, layout, country));

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};


const createBundles = async(bundles, product)=>{
    try{

        for(i in bundles){

            const bundle = bundles[i];

            if(!isEmpty(bundle)){

                let newBundle = {
                    ...bundle,
                    product
                };

                delete newBundle["id"];

                bundle.id ? await updateById(Bundle, bundle.id, newBundle) : await save(Bundle, newBundle);
            }   

        }

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const removeBundle = async({id})=>{
    try{

        await removeOne(Bundle, id);

        return statusHandler.newResponse(200, "ok");
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Exclusão definitiva do produto e do que só existe por causa dele (variantes Shopify e bundles)
const removeProduct = async({id})=>{
    try{

        const product = await findById(Product, id);

        if(!product){
            throw(statusHandler.newResponse(404, "Produto não encontrado"));
        }

        await removeMany(OtherVariants, {product:id});
        await removeMany(Bundle, {product:id});
        await removeOne(Product, id);

        return statusHandler.newResponse(200, "Produto excluído");
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Exclusão definitiva da coleção; bloqueada enquanto houver produtos nela (não deixa produto órfão)
const removeCollection = async({id})=>{
    try{

        const collection = await findById(Collection, id);

        if(!collection){
            throw(statusHandler.newResponse(404, "Coleção não encontrada"));
        }

        const products = await countDocuments(Product, {collection_:id});

        if(products){
            throw(statusHandler.newResponse(400, `A coleção ainda tem ${products} produto(s). Exclua ou mova os produtos antes.`));
        }

        await removeOne(Collection, id);

        return statusHandler.newResponse(200, "Coleção excluída");
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeProduct = async({id}, product)=>{
    try{
        
        const otherShopify = product["other_shopify"];
        const bundles = product["bundle"];

        if(!isEmpty(otherShopify)){
            await createOtherVariants(otherShopify, id);
        }

        if(!isEmpty(bundles)){
            await createBundles(bundles, id);
        }

        await ensureProductStore(product, id);
        normalizeProductLayouts(product);

        await updateById(Product, id, product)

        // cache de preços por país (falha na Shopify não impede a edição)
        await refreshProductPrices(id).catch(error=> console.warn('\x1b[33m%s\x1b[0m', `[pricing] ${error.content || error.message || error}`));

        return statusHandler.newResponse(200, "Updated product");
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const removeStore = async({id})=>{
    try{

        await removeOne(OtherVariants, id);

        return statusHandler.newResponse(200, "ok");
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getCollectionById = async({id})=>{
    try{

        const collection = await findById(Collection, id)

        return statusHandler.newResponse(200, collection);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeCollection = async({id}, collection)=>{
    try{

        await updateById(Collection, id, collection)

        return statusHandler.newResponse(200, "Updated collection");
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeStatusProduct = async({id}, {status})=>{
    try{

        await updateById(Product, id, {status});

        return statusHandler.newResponse(200, 'ok');

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeStatusCollection = async({id}, {status})=>{
    try{

        await updateById(Collection, id, {status});

        return statusHandler.newResponse(200, 'ok');

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getPriceByVariants = async({id}, options, country = null)=>{
    try{

        const variants = await findOne(OtherVariants, {product:id});
        const product = await findById(Product, id);
        const buyer = await buyerContext(product, country);
        const localized = localizeVariants(variants?.variants, buyer.country);
        const prices =  compareVariants(options, localized, true);
        // a variante escolhida, se tiver cache do país, define a moeda; sem cache fica a da loja (base)
        const match = (localized.variant_values || []).find(value=> value.id_shopify == compareVariants(options, localized));
        const currency = match?.currency || buyer.currency;

        // moeda já vem como símbolo (antes era a chave euro/dolar/libra)
        return statusHandler.newResponse(200, {prices, moeda:symbolOf(currency), currency, country:buyer.country})
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    createProduct,
    getAllProducts,
    createCollections,
    getAllCollections,
    getFirtsCollection,
    getInfoCollection,
    getProductById,
    arrangeVariants,
    getProductByIdForCart,
    getProductsRamdon,
    changeProduct,
    removeStore,
    getCollectionById,
    changeCollection,
    changeStatusProduct,
    changeStatusCollection,
    removeBundle,
    getPriceByVariants,
    applyProductLayout,
    productLayoutFields,
    removeProduct,
    removeCollection,
    localizeVariants,
    countryRatio
};