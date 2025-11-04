const statusHandler = require("../helpers/helpers.statusHandler")
const {request, isEmpty} = require("../helpers/helpers.global");

const {
    Product,
    OtherVariants,
    Bundle
} =require("../product/product.schema");
const { findById, findAll } = require("../query");
const { Shopify } = require("../shopify/shopify.schema");


let cash_products = {};

const compareVariants = (variantsCart, variantsProduct)=>{
    try{
       
      
        variantsCart.forEach((val)=>{
            const {value, title} = val;
            variantsProduct["variant_values"] = variantsProduct["variant_values"].filter(variant=> (variant.value_1 == value ||  variant.value_2 == value ||  variant.value_3 == value));

        });

        if(variantsProduct["variant_values"]?.length){
            const {id_shopify} = variantsProduct["variant_values"][0];

            return  id_shopify;
        }

        
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const checkOptionsStore = async(product, existStore)=>{
    try{
        
        let all_variants = await findAll(OtherVariants, {product});

        
        if(isEmpty(cash_products)){
            
            cash_products[product] = 0;

            return all_variants[0];
        }


        if(existStore == 'not'){ //o objeto no array de carrinho n tem store, retornar main
            
            cash_products[product] = 0;

            return all_variants[0];
        }

        if(existStore && existStore != 'not'){ //existe uma loja especifica no primeiro objeto do array, todos os outros produtos devem ser da mesma loja

            const findStore = all_variants.find(val=>val.store + "" == "" + existStore);

            return findStore;
        }

        all_variants = all_variants.map(val=>{
            delete val["product"];

            return val;
        }).sort(function(a,b) {
            return a.id_shopify < b.id_shopify ? -1 : a.id_shopify > b.id_shopify ? 1 : 0;
        });

        const current_position = cash_products[product];

        if(all_variants?.[current_position+1]){

            cash_products[product] = current_position + 1;

            return all_variants[current_position+1];
        }
        
        cash_products[product] = 0;

        return all_variants[0];

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getInfoProducts = async(cart)=>{
    try{

        if(cart?.length){
            const arrayShopify = [];

            let existStore = null;

            for(i in cart){

                const {product, variants, amount, is_bundle} = cart[i];
               

                let current_variants = !is_bundle ? await checkOptionsStore(product) : await findById(Bundle, is_bundle);

                const variantsCompare = current_variants.store || is_bundle ? current_variants["variants"] : current_variants;

                if(is_bundle){
                    current_variants = current_variants.toJSON();
                    current_variants['store'] = current_variants.shopify
                }

                console.log(current_variants)
                
                const id_shopify = compareVariants(variants, variantsCompare);

                let objectShopify = {
                    id_shopify,
                    amount
                };

                existStore = 'not';

                if(current_variants.store){
                    objectShopify["store"] = current_variants.store;
                    existStore = current_variants.store;
                }   

                arrayShopify.push(objectShopify)
            }

            if(arrayShopify.length){
                
                return await createUrlCheckout(arrayShopify);
            }
        }

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const createLinesCheckout = (cart)=>{
    try{

        let lines = "";

        cart.forEach((line, index) => {
            const {id_shopify, amount} = line;
            lines += `{merchandiseId:"gid://shopify/ProductVariant/${id_shopify}", quantity: ${amount}},\n`;
        });

        return lines;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const createUrlCheckout = async(cart)=>{
    try{

        if(!cart?.length){
            throw(statusHandler.newResponse(400, "Invalid cart"))
        }

        const lines = createLinesCheckout(cart);
        
        const query = `
            mutation {
                cartCreate(input: {
                    lines: [
                        ${lines}
                    ]
                }) {
                    cart {
                    id
                    checkoutUrl
                    }
                    userErrors {
                    field
                    message
                    }
                }
                }
        `;
        

        if(cart[0].store){

            const {url, token_storefront} = await findById(Shopify, cart[0].store);

            domain = url;
            token = token_storefront;
        }

        const response = await request(
            "POST", 
            `https://${domain}/api/2023-10/graphql.json`,
            {query},
            {'X-Shopify-Storefront-Access-Token': token}
        );
       
        const url = response?.data?.cartCreate?.cart?.checkoutUrl;
        
        return statusHandler.newResponse(200, {url});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    createUrlCheckout,
    getInfoProducts,
    compareVariants
};