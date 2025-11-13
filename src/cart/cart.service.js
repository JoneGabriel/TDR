const statusHandler = require("../helpers/helpers.statusHandler")
const {request, isEmpty} = require("../helpers/helpers.global");

const {
    Product,
    OtherVariants,
    Bundle
} =require("../product/product.schema");
const { findById, findAll } = require("../query");
const { Shopify } = require("../shopify/shopify.schema");
const { Store } = require("../store/store.schema");


let cash_products = {};

const compareVariants = (variantsCart, variantsProduct)=>{
    try{
       
        let varProd = variantsProduct["variant_values"];
      
        variantsCart.forEach((val)=>{
            const {value, title} = val;
            varProd = varProd.filter(variant=> (variant.value_1 == value ||  variant.value_2 == value ||  variant.value_3 == value));

        });

        if(varProd?.length){
            const {id_shopify} = varProd[0];

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
               

                let current_variants =  await checkOptionsStore(product);

                const variantsCompare = current_variants.store ? current_variants["variants"] : current_variants;

                let objectShopify = {};

                if(is_bundle){
                    const {price_bundle, amount:amountBundle, cupom_code} = await findById(Bundle, is_bundle);
                    let ids = [];

                    variants.forEach(vari=>{
                        
                        const id_shopify = compareVariants(vari, variantsCompare);

                        ids.push(id_shopify);

                    }); 

                    objectShopify['ids'] = ids;
                    objectShopify['is_bundle'] = true;
                    objectShopify['price_bundle'] = price_bundle;
                    objectShopify['amount'] = amountBundle;
                    objectShopify['cupom_code'] = cupom_code;
                }else{

                    const id_shopify = compareVariants(variants, variantsCompare);

                    objectShopify = {
                        id_shopify,
                        amount
                    };

                }

                existStore = 'not';

                if(current_variants.store){
                    objectShopify["store"] = current_variants.store;
                    existStore = current_variants.store;
                }   

                arrayShopify.push(objectShopify)
            }

            if(arrayShopify.length){
                const { store:storeCountry } = await findById(Shopify, arrayShopify[0].store);
                const {country} = await findById(Store, storeCountry);
                return await createUrlCheckout(arrayShopify, country[0]);
            }
        }

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const createLinesCheckout = (cart) => {
  try {
    let lines = "";
    cart.forEach((line) => {
      if (line.is_bundle && Array.isArray(line.ids) && line.ids.length) {
        const qty = Number.parseInt(String(line.amount ?? 1), 10) || 1;
        line.ids.forEach((variantId) => {
          lines += `{merchandiseId:"gid://shopify/ProductVariant/${variantId}", quantity: ${qty/line.ids.length}},\n`;
        });
      } else {
        const { id_shopify, amount } = line;
        const qty = Number.parseInt(String(amount ?? 1), 10) || 1;
        lines += `{merchandiseId:"gid://shopify/ProductVariant/${id_shopify}", quantity: ${qty}},\n`;
      }
    });
    return lines;
  } catch (error) {
    throw (statusHandler.serviceError(error));
  }
};

const createUrlCheckout = async (cart, country) => {
  try {
    if (!cart?.length) {
      throw statusHandler.newResponse(400, "Invalid cart");
    }

    const lines = createLinesCheckout(cart);

    // -------------------------
    // PRIORIDADE PARA PARÂMETRO COUNTRY
    // -------------------------
    let finalCountry = String(country || "").toUpperCase();

    if (finalCountry !== "GB" && finalCountry !== "FR") {
      finalCountry = "FR"; // fallback
    }

    const query = `
      mutation @inContext(country: ${finalCountry}) {
        cartCreate(input: {
          lines: [
            ${lines}
          ]
          buyerIdentity: {
            countryCode: ${finalCountry}
          }
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

    let domain;
    let token;

    if (cart[0].store) {
      const { url, token_storefront } = await findById(Shopify, cart[0].store);
      domain = url;
      token = token_storefront;
    }

    const response = await request(
      "POST",
      `https://${domain}/api/2023-10/graphql.json`,
      { query },
      { "X-Shopify-Storefront-Access-Token": token }
    );

    let checkoutUrl = response?.data?.cartCreate?.cart?.checkoutUrl;
    const cartId = response?.data?.cartCreate?.cart?.id;

    // -------------------------
    // CUPONS (mantido igual)
    // -------------------------
    const codes = Array.from(
      new Set(
        cart
          .map((l) => l?.cupom_code)
          .filter(Boolean)
          .map((c) => String(c).trim())
      )
    );

    const applyCodes = async (codesToApply) => {
      const applyCouponQuery = `
        mutation {
          cartDiscountCodesUpdate(cartId: "${cartId}", discountCodes: [${codesToApply
            .map((c) => `"${c}"`)
            .join(", ")}]) {
            cart { checkoutUrl }
            userErrors { field message }
          }
        }
      `;

      const discountRes = await request(
        "POST",
        `https://${domain}/api/2023-10/graphql.json`,
        { query: applyCouponQuery },
        { "X-Shopify-Storefront-Access-Token": token }
      );

      const dUpdate = discountRes?.data?.cartDiscountCodesUpdate;
      const dErrors = dUpdate?.userErrors;
      const ok = !Array.isArray(dErrors) || dErrors.length === 0;

      return { ok, url: dUpdate?.cart?.checkoutUrl || checkoutUrl };
    };

    if (cartId && codes.length > 0) {
      let res = await applyCodes(codes);

      if (!res.ok) {
        let applied = false;

        for (let i = 0; i < codes.length && !applied; i++) {
          for (let j = i + 1; j < codes.length && !applied; j++) {
            const tryPair = await applyCodes([codes[i], codes[j]]);
            if (tryPair.ok) {
              checkoutUrl = tryPair.url;
              applied = true;
            }
          }
        }

        if (!applied) {
          for (let i = 0; i < codes.length && !applied; i++) {
            const trySingle = await applyCodes([codes[i]]);
            if (trySingle.ok) {
              checkoutUrl = trySingle.url;
              applied = true;
            }
          }
        }

        if (!applied) {
          checkoutUrl = res.url || checkoutUrl;
        }
      } else {
        checkoutUrl = res.url || checkoutUrl;
      }
    }

    return statusHandler.newResponse(200, { url: checkoutUrl });

  } catch (error) {
    throw statusHandler.serviceError(error);
  }
};


module.exports = {
    createUrlCheckout,
    getInfoProducts,
    compareVariants
};