const { pickBuyerCountry } = require("../helpers/helpers.countries");
const statusHandler = require("../helpers/helpers.statusHandler")
const {request, isEmpty} = require("../helpers/helpers.global");

const {
    Product,
    OtherVariants,
    Bundle
} =require("../product/product.schema");
const { findById, findAll, findOne } = require("../query");
const { Shopify } = require("../shopify/shopify.schema");
const { shopifyGraphql } = require("../shopify/shopify.client");
const { Store } = require("../store/store.schema");


let cash_products = {};

const compareVariants = (variantsCart, variantsProduct, prices = false)=>{
    try{
       
        let varProd = variantsProduct["variant_values"];
      
        variantsCart.forEach((val)=>{
            const {value, title} = val;
            varProd = varProd.filter(variant=> (variant.value_1 == value ||  variant.value_2 == value ||  variant.value_3 == value));

        });

        if(varProd?.length && prices){
          const {price, last_price} = varProd[0];
          console.log(varProd[0])
          return {price, last_price}
        }

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

const getInfoProducts = async(cart, requestedCountry = null)=>{
    try{
        
      let country;

        if(cart?.length){
            const arrayShopify = [];

            let existStore = null;

            for(i in cart){

                const {product, variants, amount, is_bundle} = cart[i];
               

                let current_variants =  await checkOptionsStore(product);

                const {store:storeCountry} = await findById(Product, product);
                const {country:served} = await findById(Store, storeCountry);

                // país do comprador: o da visita se a loja o atende, senão o primeiro país da loja (define a moeda do checkout)
                country = pickBuyerCountry(served, requestedCountry);

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
                
                return await createUrlCheckout(arrayShopify, country);
            }
        }

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const createLinesCheckout = (cart) => {
  try {
    const lines = [];
    cart.forEach((line) => {
      if (line.is_bundle && Array.isArray(line.ids) && line.ids.length) {
        const qty = Number.parseInt(String(line.amount ?? 1), 10) || 1;
        line.ids.forEach((variantId) => {
          lines.push({ merchandiseId: `gid://shopify/ProductVariant/${variantId}`, quantity: qty / line.ids.length });
        });
      } else {
        const { id_shopify, amount } = line;
        const qty = Number.parseInt(String(amount ?? 1), 10) || 1;
        lines.push({ merchandiseId: `gid://shopify/ProductVariant/${id_shopify}`, quantity: qty });
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

    console.log(finalCountry);

    const query = `
      mutation CartCreate($lines: [CartLineInput!]!, $country: CountryCode!) @inContext(country: $country) {
        cartCreate(input: { lines: $lines, buyerIdentity: { countryCode: $country } }) {
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

    const shopify = await findById(Shopify, cart[0].store);

    if (!shopify) {
      throw statusHandler.newResponse(400, "Shopify nao encontrada para o carrinho");
    }

    const data = await shopifyGraphql(shopify, "storefront", query, { lines, country: finalCountry });

    if (data.cartCreate?.userErrors?.length) {
      console.warn('\x1b[33m%s\x1b[0m', JSON.stringify(data.cartCreate.userErrors));
    }

    let checkoutUrl = data.cartCreate?.cart?.checkoutUrl;
    const cartId = data.cartCreate?.cart?.id;

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
        mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) {
          cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
            cart {
              checkoutUrl
              discountCodes { code applicable }
            }
            userErrors { field message }
          }
        }
      `;

      const discountRes = await shopifyGraphql(shopify, "storefront", applyCouponQuery, {
        cartId,
        discountCodes: codesToApply
      });

      const dUpdate = discountRes?.cartDiscountCodesUpdate;
      const dErrors = dUpdate?.userErrors;
      // cupom invalido nao gera userErrors, volta com applicable: false
      const notApplicable = (dUpdate?.cart?.discountCodes || []).filter((d) => !d.applicable);
      const ok = (!Array.isArray(dErrors) || dErrors.length === 0) && notApplicable.length === 0;

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

const createUrlCheckoutPagouAi = async(cartPayload)=>{
    try{

        const cartEndpoint = 'https://api-checkout.pagou.ai/public/cart'
        var data = {
            cart_payload: cartPayload,
            shop: 'pro-collagencream.co.uk',
            shopify_internal_domain: "zg5103-f0.myshopify.com",
        };
        
        const response = await request("POST", cartEndpoint, data);
        
        if(response.statusCode == 200){
            
            return statusHandler.newResponse(200, {url:response.data.checkout_url});
        }


    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const compareVariantsNew = (variantsCart, variantsProduct)=>{
    try{
       
      
        variantsCart.forEach((val)=>{
            const {value, title} = val;
            variantsProduct["variant_values"] = variantsProduct["variant_values"].filter(variant=> (variant.value_1 == value ||  variant.value_2 == value ||  variant.value_3 == value));

        });

        if(variantsProduct["variant_values"]?.length){
            const {id_shopify, img} = variantsProduct["variant_values"][0];

            return  {id_shopify, img};
        }

        
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getVariantsValues = (variants)=>{
    try{

        let values = "";

        variants.forEach((val, index)=>{
            const {value} = val;
            values+=` ${value} ${!index && variants.length > 1 ? "/" : ""}`
        })

        return values;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const getInfoProductsNew = async(cart)=>{
    try{

        if(cart?.length){
            const arrayItems = [];

            for(i in cart){

                const {product, variants, amount} = cart[i];
                const findProduct = await findById(Product, product, {variants:1,is_variant:1, id_shopify:1, name:1, price:1});

               
                const {id_shopify:idShopify, variants:vari} = await findOne(OtherVariants, {product});

                let variantsForCompare = vari;
                variantsForCompare["id_shopify"] = idShopify;
              
                const {id_shopify, img} = compareVariantsNew(variants, variantsForCompare);
                const titleVariant = getVariantsValues(variants);
                const {price:priceVariant} = compareVariants(variants, vari, true)

                const realPrice = priceVariant || findProduct.price
                

                let objectShopify = {
                    id:parseInt(id_shopify),
                    quantity:parseInt(amount),
                    variant_id:parseInt(id_shopify),
                    title:`${findProduct.name} - ${titleVariant}`,
                    price:realPrice*100,
                    original_price:realPrice*100,
                    presentment_price:realPrice,
                    discounted_price:realPrice*100,
                    line_price:realPrice*100,
                    original_line_price:realPrice*100,
                    product_id:parseInt(idShopify),
                    final_price:realPrice*100,
                    final_line_price:realPrice*100,
                    image:img, 
                    requires_shipping:true,
                };
               
                arrayItems.push(objectShopify)
                
            }
            
            if(arrayItems.length){

                let total_price = 0;
                let item_count = 0;

                arrayItems.forEach(value=>{
                    const {price, quantity} = value;

                    total_price += (price*quantity);
                    item_count+= quantity;
                })

                let objectPagouAi = {
                    items:arrayItems,
                    currency:"GBP",
                    requires_shipping: true,
                    total_price:total_price,
                    item_count,
                    items_subtotal_price:total_price,
                    original_total_price:total_price
                }
               
                return await createUrlCheckoutPagouAi(objectPagouAi);
            }
        }

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    createUrlCheckout,
    getInfoProducts,
    compareVariants,
    getInfoProductsNew
};