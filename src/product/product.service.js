const {
    Product,
    Collection,
    OtherVariants
} = require("../product/product.schema");

const {
    save,
    findOne,
    findAll,
    findById,
    populate,
    updateById,
    removeOne,
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

const {
    compareVariants
} = require("../cart/cart.service");

const getInfoCollection = async(id)=>{
    try{
       
        const collection = await findById(Collection, id);
        const products = await findAll(Product, {
            collection_:id, status:true
        }, {name:1, last_price:1, price:1, brand:1, status:true, images:{
            $slice:1
        }});
        
        return {
            products,
            collection,
            number_products:products.length
        }

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const createObjectCollections = async(collections)=>{
    try{

        let object = [];

        for(i in collections){

            const {_id, name} = collections[i];
            const products = await findAll(Product, 
                {collection_:_id}, 
                {
                    name:1, 
                    last_price:1, 
                    price:1, 
                    images:{
                        $slice:1}
                }
            );

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

const getFirtsCollection = async(store)=>{
    try{    

        const collections = await findAll(Collection, {status:true, store});
        const position = collections.length-1;
        const products = await findAll(Product, {
            collection_:collections[position]?._id, status:true, store
        }, {name:1, last_price:1, price:1, brand:1,images:{
            $slice:1
        }});

        
        return {
            collection_id:collections[position]?._id,
            collection_name:collections[position]?.name,
            products:products.slice(0,4),
            collections,
            object_collections: await createObjectCollections(collections)
        };
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const createCollections = async(collection)=>{
    try{

        await save(Collection, collection);

        return statusHandler.newResponse(200, "Created collection");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getAllCollections = async(admin = true, store)=>{
    try{

        let query = {};

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
        img:variant?.image?.url
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

const getVariants = async(id_shopify, domain, token)=>{
    try {
        const productGid = `gid://shopify/Product/${id_shopify}`;
    
        let cursor  = null;
        let hasNext = true;
        let variants = [];
        let productInfo = null;
    
        while (hasNext) {
          const query = `
            query {
              product(id: "${productGid}") {
                id
                title
                handle
                variants(first: 100${cursor ? `, after: "${cursor}"` : ""}) {
                  edges {
                    cursor
                    node {
                      id
                      title
                      sku
                      price {
                        amount
                        currencyCode
                      }
                      image {
                        url        
                    }
                      selectedOptions { name value }
                    }
                  }
                  pageInfo { hasNextPage }
                }
              }
            }
          `;
    
          const raw = await request(
            "POST",
            `https://${domain}/api/2023-10/graphql.json`,
            { query },
            { "X-Shopify-Storefront-Access-Token": token }
          );
    
          const res = typeof raw === "string" ? JSON.parse(raw) : raw;
    
          const p = res.data.product;
          if (!productInfo) {
            productInfo = { id: p.id, title: p.title, handle: p.handle };
          }
    
          const edges = p.variants.edges;
          variants.push(...edges.map((e) => e.node));
    
          hasNext = p.variants.pageInfo.hasNextPage;
          cursor  = hasNext ? edges[edges.length - 1].cursor : null;
        }
        
        variants = formatVariants(variants);

        return  variants;
      } catch (error) {
        throw statusHandler.serviceError(error);
      }
};

const createOtherVariants = async(otherShopify, idProduct)=>{
    try{

        for(i in otherShopify){

            const {store, id_shopify_store} = otherShopify[i];
            const {url, token_storefront} = await findById(Shopify, store);

            let otherVariants = {};
            otherVariants["variants"] = await getVariants(id_shopify_store, url, token_storefront);
            
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

const createProduct = async(product)=>{
    try{
        
        const shopify = product["other_shopify"];
        const idProduct = await save(Product, product);

        if(!isEmpty(shopify)){
            
            await createOtherVariants(shopify, "" + (idProduct)._id);
        }


        return statusHandler.newResponse(200, "Created product");
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getAllProducts = async()=>{
    try{

        let products = await findAll(Product, {}, 
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

const arrangeVariants = (product)=>{
    try{

        const {variants} = product;

        let newVariants = [];


        Object.keys(variants).forEach(key=>{

            if((key == "title_1" || key == "title_2" || key == "title_3") && variants[key]){

                let numberKey = key.split("title_")[1]
                let object = {};
                object["title"] = variants[key].replaceAll(" ", "-");
                object["values"] = [];

                variants.variant_values.forEach(value=>{

                    const exist =  object["values"].find(val=>val.value == value[`value_${numberKey}`]) || object["values"].find(val=>val == value[`value_${numberKey}`]);
                    const condition = object["title"] == 'Couleur' || object["title"] == 'Color' || object["title"] == 'Color-Harness-1' || object["title"] == 'Color-Harness-2'

                    if(condition){
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

const getProductById = async(id, api = false)=>{
    try{

        let product = await findById(Product, id);
        product = product.toJSON();
        
        if(api){

            let findStores = await findAll(OtherVariants, {product:id}, {store:1, id_shopify:1});
            findStores = await populate(OtherVariants, findStores, 'store');

            if(findStores.length){
                product["other_shopify"] = findStores;
            }
             
        }

        if(!api){
            const otherVariants = await findOne(OtherVariants, {product:id});

            product['variants'] = otherVariants?.variants || {};
            product.discount = parseInt((product.price/(product.last_price)*100)-100);
        }

        return !api ? product : statusHandler.newResponse(200, product);
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getProductByIdForCart = async({id}, {cart})=>{
    try{
        
        let product =  await findById(Product,id, {name:1, last_price:1, price:1});
        const otherVariants = await findOne(OtherVariants, {product:id});
        
        product = product.toJSON();
        product['variants'] = otherVariants?.variants || {};

        const idShopify = compareVariants(cart, product["variants"]);
        product["variants"] = product["variants"]["variant_values"].filter(val=> val.id_shopify == idShopify);

        return statusHandler.newResponse(200, product);
    }catch(error){  
        throw(statusHandler.serviceError(error));
    }
};

const getProductsRamdon = async(collection_, store)=>{
    try{

        let products = await findAll(Product, {collection_, status:true, store});
        
        return products.slice(0,6);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeProduct = async({id}, product)=>{
    try{
        
        const otherShopify = product["other_shopify"];
        
        if(!isEmpty(otherShopify)){
            await createOtherVariants(otherShopify, id);
        }

        await updateById(Product, id, product)

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
    changeStatusCollection
};