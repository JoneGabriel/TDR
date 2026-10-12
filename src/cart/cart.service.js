const { pickBuyerCountry, baseCurrencyOf } = require("../helpers/helpers.countries");
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

// ---------------------------------------------------------------- checkout externo (PagAmerican)
// O script pag-checkout da plataforma foi feito para temas Shopify: lê o carrinho em /cart.js e envia à plataforma.
// Na vitrine do TDR o carrinho é local e só o servidor sabe os ids de variante, então esta função monta o carrinho
// local no formato do /cart.js (ids de variante e produto da Shopify, preços em centavos na moeda da visita) para
// public/scripts/pag-checkout.js enviar. Produto sem variante da Shopify não pode ser comprado: 400 com a mensagem.
const cents = (value)=> Math.round(Number(value || 0) * 100);

// entrada de variant_values que casa com as opções escolhidas (mesma regra de compareVariants, devolvendo o objeto)
const matchVariant = (variantsCart = [], variantsProduct = {})=>{
    let values = variantsProduct?.variant_values || [];

    (Array.isArray(variantsCart) ? variantsCart : []).forEach(({value})=>{
        values = values.filter(variant=> variant.value_1 == value || variant.value_2 == value || variant.value_3 == value);
    });

    return values[0] || null;
};

const variantOptions = (variant, variants = {})=> ["1", "2", "3"]
    .filter(n=> variants[`title_${n}`] && variant[`value_${n}`])
    .map(n=> ({name:variants[`title_${n}`], value:variant[`value_${n}`]}));

// Item no formato que a Pagou.ai (plataforma irmã) aceita, com os campos que o /cart.js da Shopify também tem.
// Sem token/key/handle/url inventados e sem imagem em base64: só URL de imagem vinda da Shopify (ou nenhuma).
const cartJsonItem = ({product, otherVariants, variant, quantity, country})=>{
    const local = variant.prices?.[country];
    const unit = Number(local?.price ?? variant.price ?? product.price) || 0;
    const price = cents(unit);
    const variantId = parseInt(variant.id_shopify, 10) || variant.id_shopify;
    const productId = parseInt(otherVariants.id_shopify, 10) || otherVariants.id_shopify;
    const options = variantOptions(variant, otherVariants.variants);
    const variantTitle = options.length ? options.map(option=> option.value).join(" / ") : null;
    const image = typeof variant.img == "string" && /^https?:\/\//.test(variant.img) ? variant.img : null;

    return {
        id:variantId,
        quantity,
        variant_id:variantId,
        title:variantTitle ? `${product.name} - ${variantTitle}` : product.name,
        price,
        original_price:price,
        presentment_price:unit,
        discounted_price:price,
        line_price:price * quantity,
        original_line_price:price * quantity,
        product_id:productId,
        final_price:price,
        final_line_price:price * quantity,
        image,
        requires_shipping:true,
        product_title:product.name,
        variant_title:variantTitle
    };
};

const buildCartJson = async(cart, requestedCountry = null)=>{
    try{

        if(!Array.isArray(cart) || !cart.length){
            throw(statusHandler.newResponse(400, "Carrinho vazio"));
        }

        const items = [];
        const codes = new Set();
        let shopify = null;
        let country = null;
        let currency = null;

        for(const line of cart){
            const {product:productId, variants:chosen, amount, is_bundle} = line || {};
            const product = productId ? await findById(Product, productId) : null;

            if(!product){
                throw(statusHandler.newResponse(400, "Produto do carrinho não encontrado"));
            }

            const otherVariants = await findOne(OtherVariants, {product:product._id});

            if(!otherVariants?.variants?.variant_values?.length){
                throw(statusHandler.newResponse(400, `"${product.name}" não tem variante da Shopify vinculada e não pode ser comprado`));
            }

            if(!shopify){
                shopify = await findById(Shopify, otherVariants.store);
            }else if(String(otherVariants.store) != String(shopify._id)){
                throw(statusHandler.newResponse(400, "O carrinho mistura produtos de lojas Shopify diferentes"));
            }

            if(!shopify){
                throw(statusHandler.newResponse(400, "Loja Shopify do produto não encontrada"));
            }

            if(!country){
                const store = await findById(Store, product.store);

                country = pickBuyerCountry(store?.country, requestedCountry);
                currency = store?.market_currencies?.[country] || baseCurrencyOf(store?.moeda);
            }

            if(is_bundle){
                const bundle = await findById(Bundle, is_bundle);

                if(!bundle){
                    throw(statusHandler.newResponse(400, "Bundle do carrinho não encontrado"));
                }

                const options = Array.isArray(chosen) && chosen.length ? chosen : [[]];
                // mesma divisão de createLinesCheckout: a quantidade do bundle repartida entre as opções escolhidas
                const perVariant = Math.max(1, Math.round((Number(bundle.amount) || options.length) / options.length));

                options.forEach(option=>{
                    const variant = matchVariant(option, otherVariants.variants);

                    if(!variant){
                        throw(statusHandler.newResponse(400, `Opção do bundle "${bundle.title_bundle}" não encontrada`));
                    }

                    items.push(cartJsonItem({product, otherVariants, variant, quantity:perVariant, country}));
                });

                bundle.cupom_code && codes.add(String(bundle.cupom_code).trim());
                continue;
            }

            const variant = matchVariant(chosen, otherVariants.variants);

            if(!variant){
                throw(statusHandler.newResponse(400, `Opção escolhida de "${product.name}" não encontrada`));
            }

            items.push(cartJsonItem({product, otherVariants, variant, quantity:Math.max(1, parseInt(amount, 10) || 1), country}));
        }

        const total = items.reduce((sum, item)=> sum + item.line_price, 0);

        // mesmo formato do objeto enviado à Pagou.ai em getInfoProductsNew (um subconjunto do /cart.js da Shopify)
        return statusHandler.newResponse(200, {
            shop:shopify.url,
            country,
            currency,
            discount_codes:[...codes],
            cart:{
                items,
                currency,
                requires_shipping:true,
                total_price:total,
                item_count:items.reduce((sum, item)=> sum + item.quantity, 0),
                items_subtotal_price:total,
                original_total_price:total
            }
        });

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    createUrlCheckout,
    getInfoProducts,
    compareVariants,
    getInfoProductsNew,
    buildCartJson
};