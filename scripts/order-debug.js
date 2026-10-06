// Diagnóstico de fuso/data de um pedido real: mostra o que a Shopify devolve e o que a página calcula.
// Uso (na VPS): docker compose exec app node scripts/order-debug.js <idPedido> <urlStore> [paisDaLoja] [idioma]
//   idPedido = número do fim da URL /order/<id>; urlStore = subdomínio Shopify (sem .myshopify.com)
require("dotenv").config();
const { getOrderShopify } = require("../src/order/order.service");
const { timeZoneOf, localeOf } = require("../src/helpers/helpers.countries");

const [orderId, urlStore, storeCountry = "ES", idioma = "ES"] = process.argv.slice(2);

if(!orderId || !urlStore){
    console.error("Uso: node scripts/order-debug.js <idPedido> <urlStore> [paisDaLoja] [idioma]");
    process.exit(1);
}

(async()=>{
    try{

        const order = await getOrderShopify(orderId, {urlStore}, storeCountry, idioma);

        if(!order){
            console.log("Pedido não encontrado");
            process.exit(1);
        }

        const iso = order.createdAtISO;
        const show = (tz)=> new Intl.DateTimeFormat("en-GB", {timeZone:tz, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false}).format(new Date(iso));

        console.log(JSON.stringify({
            pedido:order.name,
            createdAt_shopify_utc:iso,
            pais_entrega:order.shippingAddress?.countryCodeV2 || null,
            pais_loja_informado:storeCountry,
            pais_usado_para_datas:order.date_country,
            fuso_usado:order.time_zone,
            locale_usado:localeOf(order.date_country),
            createdAt_exibido:order.createdAt,
            referencia:{UTC:show("UTC"), "Europe/Madrid":show("Europe/Madrid"), "America/Sao_Paulo":show("America/Sao_Paulo"), fuso_da_loja:show(timeZoneOf(storeCountry))},
            servidor:{TZ:process.env.TZ || "(não definido)", fuso_do_processo:Intl.DateTimeFormat().resolvedOptions().timeZone, node:process.version},
            ultimo_evento:order.last_event ? {status:order.last_event.status, date:order.last_event.date} : null
        }, null, 2));
        process.exit(0);

    }catch(error){
        console.error(error.content || error.message || error);
        process.exit(1);
    }
})();
