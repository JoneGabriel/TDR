// Catálogo de países que uma loja pode atender: código ISO 3166-1, nome (admin) e moeda ISO 4217 esperada.
// A moeda que vale na vitrine é a que a Shopify devolveu para o país no último refresh (Store.market_currencies);
// a daqui é só referência. Países sem mercado próprio na Shopify recebem preços no mercado padrão da loja.
const countries = [
    // já atendidos
    { code:"FR", name:"França", currency:"EUR" },
    { code:"BE", name:"Bélgica", currency:"EUR" },
    { code:"GB", name:"Reino Unido", currency:"GBP" },
    { code:"US", name:"Estados Unidos", currency:"USD" },
    { code:"DE", name:"Alemanha", currency:"EUR" },
    { code:"CH", name:"Suíça", currency:"CHF" },
    { code:"NL", name:"Holanda", currency:"EUR" },
    // Europa
    { code:"AT", name:"Áustria", currency:"EUR" },
    { code:"IE", name:"Irlanda", currency:"EUR" },
    { code:"IT", name:"Itália", currency:"EUR" },
    { code:"ES", name:"Espanha", currency:"EUR" },
    { code:"PT", name:"Portugal", currency:"EUR" },
    { code:"LU", name:"Luxemburgo", currency:"EUR" },
    { code:"FI", name:"Finlândia", currency:"EUR" },
    { code:"GR", name:"Grécia", currency:"EUR" },
    { code:"SE", name:"Suécia", currency:"SEK" },
    { code:"NO", name:"Noruega", currency:"NOK" },
    { code:"DK", name:"Dinamarca", currency:"DKK" },
    { code:"PL", name:"Polônia", currency:"PLN" },
    { code:"CZ", name:"Tchéquia", currency:"CZK" },
    { code:"HU", name:"Hungria", currency:"HUF" },
    { code:"RO", name:"Romênia", currency:"RON" },
    // Américas
    { code:"CA", name:"Canadá", currency:"CAD" },
    { code:"MX", name:"México", currency:"MXN" },
    { code:"BR", name:"Brasil", currency:"BRL" },
    { code:"AR", name:"Argentina", currency:"ARS" },
    { code:"CL", name:"Chile", currency:"CLP" },
    { code:"CO", name:"Colômbia", currency:"COP" },
    // Ásia, Oceania, Oriente Médio e África
    { code:"AU", name:"Austrália", currency:"AUD" },
    { code:"NZ", name:"Nova Zelândia", currency:"NZD" },
    { code:"JP", name:"Japão", currency:"JPY" },
    { code:"KR", name:"Coreia do Sul", currency:"KRW" },
    { code:"SG", name:"Singapura", currency:"SGD" },
    { code:"HK", name:"Hong Kong", currency:"HKD" },
    { code:"TW", name:"Taiwan", currency:"TWD" },
    { code:"IN", name:"Índia", currency:"INR" },
    { code:"AE", name:"Emirados Árabes Unidos", currency:"AED" },
    { code:"SA", name:"Arábia Saudita", currency:"SAR" },
    { code:"IL", name:"Israel", currency:"ILS" },
    { code:"TR", name:"Turquia", currency:"TRY" },
    { code:"ZA", name:"África do Sul", currency:"ZAR" }
];

const currencySymbols = {
    EUR:"€", USD:"$", GBP:"£", CHF:"CHF", SEK:"kr", NOK:"kr", DKK:"kr", PLN:"zł", CZK:"Kč", HUF:"Ft", RON:"lei",
    CAD:"CA$", MXN:"MX$", BRL:"R$", ARS:"AR$", CLP:"CLP$", COP:"COP$",
    AUD:"A$", NZD:"NZ$", JPY:"¥", KRW:"₩", SGD:"S$", HKD:"HK$", TWD:"NT$", INR:"₹", AED:"AED", SAR:"SAR", ILS:"₪", TRY:"₺", ZAR:"R"
};

// moedas legadas de Store.moeda -> ISO
const legacyMoeda = { euro:"EUR", dolar:"USD", libra:"GBP" };

const countryCodes = countries.map(country=> country.code);

const findCountry = (code)=> countries.find(country=> country.code == String(code || "").toUpperCase());

const currencyOf = (code)=> findCountry(code)?.currency;

const symbolOf = (currency)=> currencySymbols[currency] || currency || "";

// País do comprador: o pedido, se a loja o atende; senão o primeiro país da loja (define moeda e checkout)
const pickBuyerCountry = (served = [], requested = null)=>{
    const code = String(requested || "").toUpperCase();

    return (served || []).includes(code) ? code : ((served || [])[0] || null);
};

module.exports = {
    countries,
    countryCodes,
    currencySymbols,
    legacyMoeda,
    findCountry,
    currencyOf,
    symbolOf,
    pickBuyerCountry
};
