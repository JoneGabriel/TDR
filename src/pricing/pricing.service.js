// Cache de preços por país. A Shopify é a fonte: cada país é consultado com @inContext(country) na Storefront API,
// que devolve o preço já na moeda e nas regras do mercado (câmbio, arredondamento ou preço fixo). O TDR nunca converte.
// Resultado: OtherVariants.variants.variant_values[].prices[país], Product.prices[país] (menor preço, para os cards)
// e Store.market_currencies[país] (moeda que a Shopify realmente usou, que define o símbolo na vitrine).
const statusHandler = require("../helpers/helpers.statusHandler");
const { findAll, findById, updateById } = require("../query");
const { Product, OtherVariants } = require("../product/product.schema");
const { Store } = require("../store/store.schema");
const { Shopify } = require("../shopify/shopify.schema");
const { shopifyGraphql } = require("../shopify/shopify.client");
const { countryCodes } = require("../helpers/helpers.countries");

const CONCURRENCY = 4;                      // consultas simultâneas à Shopify por produto
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

const nowBrazil = ()=> new Date(Date.now() - BRAZIL_OFFSET_MS);

// Mensagem curta para o resumo: a Shopify devolve arrays/objetos de erro (ex.: "Unavailable Shop")
const describeError = (error)=>{
    const content = error?.content ?? error?.message ?? error;

    if(typeof content == "string"){
        return content;
    }

    const list = Array.isArray(content) ? content : [content];

    return list.map(item=> item?.message || JSON.stringify(item)).join("; ");
};

const mapLimit = async(items, limit, fn)=>{
    let index = 0;

    const worker = async()=>{
        while(index < items.length){
            const item = items[index++];

            await fn(item);
        }
    };

    await Promise.all(Array.from({length:Math.min(limit, items.length)}, worker));
};

// Preços de todas as variantes de um produto Shopify no contexto de um país: { id_shopify: {price, last_price, currency} }
const fetchVariantPrices = async(shopify, id_shopify, country)=>{
    const query = `
      query VariantPrices($id: ID!, $country: CountryCode!, $after: String) @inContext(country: $country) {
        product(id: $id) {
          variants(first: 100, after: $after) {
            nodes {
              id
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `;

    let after = null;
    let hasNext = true;
    let prices = {};

    while(hasNext){
        const data = await shopifyGraphql(shopify, "storefront", query, {
            id:`gid://shopify/Product/${id_shopify}`,
            country,
            after
        });

        const product = data.product;

        if(!product){
            throw(statusHandler.newResponse(404, `Produto ${id_shopify} nao encontrado na Shopify`));
        }

        product.variants.nodes.forEach(variant=>{
            prices[variant.id.replace("gid://shopify/ProductVariant/", "")] = {
                price:Number(variant.price.amount),
                last_price:variant.compareAtPrice ? Number(variant.compareAtPrice.amount) : null,
                currency:variant.price.currencyCode
            };
        });

        hasNext = product.variants.pageInfo.hasNextPage;
        after = product.variants.pageInfo.endCursor;
    }

    return prices;
};

// Atualiza o cache de preços de um produto para os países da loja (ou os informados)
const refreshProductPrices = async(productId, countries = null)=>{
    try{

        const product = await findById(Product, productId);

        if(!product){
            throw(statusHandler.newResponse(404, "Produto não encontrado"));
        }

        const store = product.store ? await findById(Store, product.store) : null;

        countries = (countries || store?.country || []).filter(code=> countryCodes.includes(code));

        let summary = {product:product.name, countries:countries.length, variants:0, errors:[]};

        if(!countries.length){
            summary.skipped = "loja sem países cadastrados";

            return summary;
        }

        const docs = await findAll(OtherVariants, {product:productId});

        if(!docs.length){
            summary.skipped = "produto sem Shopify vinculada";

            return summary;
        }

        const now = nowBrazil();
        let productPrices = null;
        let marketCurrencies = {};

        for(const doc of docs){
            const shopify = await findById(Shopify, doc.store);

            if(!shopify){
                summary.errors.push(`Shopify ${doc.store} não encontrada`);
                continue;
            }

            let byCountry = {};

            await mapLimit(countries, CONCURRENCY, async(country)=>{
                try{
                    byCountry[country] = await fetchVariantPrices(shopify, doc.id_shopify, country);
                }catch(error){
                    summary.errors.push(`${shopify.url} ${country}: ${describeError(error)}`);
                }
            });

            const variants = doc.toObject().variants || {};
            const values = variants.variant_values || [];

            values.forEach(value=>{
                value.prices = value.prices || {};

                countries.forEach(country=>{
                    const found = byCountry[country]?.[value.id_shopify];

                    if(found){
                        value.prices[country] = found;
                        marketCurrencies[country] = found.currency;
                    }
                });
            });

            summary.variants += values.length;

            await updateById(OtherVariants, doc._id, {variants, prices_updated_at:now, prices_countries:countries});

            // preço "a partir de" do produto: menor preço entre as variantes da primeira Shopify (a que a vitrine usa)
            if(!productPrices){
                productPrices = {};

                countries.forEach(country=>{
                    const list = values.map(value=> value.prices?.[country]).filter(Boolean);

                    list.length && (productPrices[country] = list.reduce((min, item)=> item.price < min.price ? item : min));
                });
            }
        }

        if(productPrices){
            await updateById(Product, productId, {prices:productPrices, prices_updated_at:now});
        }

        if(store && Object.keys(marketCurrencies).length){
            await updateById(Store, store._id, {market_currencies:{...(store.toObject().market_currencies || {}), ...marketCurrencies}});
        }

        return summary;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

let running = false;

// Atualiza todos os produtos, um por vez (o paralelismo fica dentro de cada produto)
const refreshAllPrices = async()=>{
    try{

        if(running){
            throw(statusHandler.newResponse(409, "Atualização de preços já em andamento"));
        }

        running = true;

        const started = Date.now();
        const products = await findAll(Product, {}, {name:1});
        let result = {products:products.length, variants:0, errors:[], skipped:0};

        for(const product of products){
            try{
                const summary = await refreshProductPrices(String(product._id));

                result.variants += summary.variants;
                summary.skipped && result.skipped++;
                result.errors.push(...summary.errors.map(error=> `${summary.product}: ${error}`));
            }catch(error){
                result.errors.push(`${product.name}: ${describeError(error)}`);
            }
        }

        result.seconds = Math.round((Date.now() - started) / 1000);
        console.log(`[pricing] ${result.products} produto(s), ${result.variants} variante(s), ${result.errors.length} erro(s) em ${result.seconds}s`);

        return result;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }finally{
        running = false;
    }
};

// Job diário (PRICES_REFRESH_HOURS, padrão 24; 0 desliga). Fora de DEV roda também 2 min após subir.
const startPricesRefreshJob = ()=>{
    const hours = Number(process.env.PRICES_REFRESH_HOURS ?? 24);

    if(!hours || hours <= 0){
        return;
    }

    const run = ()=> refreshAllPrices().catch(error=> console.warn('\x1b[33m%s\x1b[0m', `[pricing] ${describeError(error)}`));

    process.env.ENV != "DEV" && setTimeout(run, 2 * 60 * 1000);
    setInterval(run, hours * 60 * 60 * 1000);
};

module.exports = {
    fetchVariantPrices,
    refreshProductPrices,
    refreshAllPrices,
    startPricesRefreshJob
};
