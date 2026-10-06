// Catálogo de países que uma loja pode atender: código ISO 3166-1, nome (admin), moeda ISO 4217 esperada,
// fuso horário IANA (datas da página do pedido, rastreio e chat) e localidade de formatação de datas.
// A moeda que vale na vitrine é a que a Shopify devolveu para o país no último refresh (Store.market_currencies);
// a daqui é só referência. Países sem mercado próprio na Shopify recebem preços no mercado padrão da loja.
const countries = [
    // já atendidos
    { code:"FR", name:"França", currency:"EUR", timezone:"Europe/Paris", locale:"fr-FR" },
    { code:"BE", name:"Bélgica", currency:"EUR", timezone:"Europe/Brussels", locale:"fr-BE" },
    { code:"GB", name:"Reino Unido", currency:"GBP", timezone:"Europe/London", locale:"en-GB" },
    { code:"US", name:"Estados Unidos", currency:"USD", timezone:"America/New_York", locale:"en-US" },
    { code:"DE", name:"Alemanha", currency:"EUR", timezone:"Europe/Berlin", locale:"de-DE" },
    { code:"CH", name:"Suíça", currency:"CHF", timezone:"Europe/Zurich", locale:"fr-CH" },
    { code:"NL", name:"Holanda", currency:"EUR", timezone:"Europe/Amsterdam", locale:"nl-NL" },
    // Europa
    { code:"AT", name:"Áustria", currency:"EUR", timezone:"Europe/Vienna", locale:"de-AT" },
    { code:"IE", name:"Irlanda", currency:"EUR", timezone:"Europe/Dublin", locale:"en-IE" },
    { code:"IT", name:"Itália", currency:"EUR", timezone:"Europe/Rome", locale:"it-IT" },
    { code:"ES", name:"Espanha", currency:"EUR", timezone:"Europe/Madrid", locale:"es-ES" },
    { code:"PT", name:"Portugal", currency:"EUR", timezone:"Europe/Lisbon", locale:"pt-PT" },
    { code:"LU", name:"Luxemburgo", currency:"EUR", timezone:"Europe/Luxembourg", locale:"fr-LU" },
    { code:"FI", name:"Finlândia", currency:"EUR", timezone:"Europe/Helsinki", locale:"fi-FI" },
    { code:"GR", name:"Grécia", currency:"EUR", timezone:"Europe/Athens", locale:"el-GR" },
    { code:"SE", name:"Suécia", currency:"SEK", timezone:"Europe/Stockholm", locale:"sv-SE" },
    { code:"NO", name:"Noruega", currency:"NOK", timezone:"Europe/Oslo", locale:"nb-NO" },
    { code:"DK", name:"Dinamarca", currency:"DKK", timezone:"Europe/Copenhagen", locale:"da-DK" },
    { code:"PL", name:"Polônia", currency:"PLN", timezone:"Europe/Warsaw", locale:"pl-PL" },
    { code:"CZ", name:"Tchéquia", currency:"CZK", timezone:"Europe/Prague", locale:"cs-CZ" },
    { code:"HU", name:"Hungria", currency:"HUF", timezone:"Europe/Budapest", locale:"hu-HU" },
    { code:"RO", name:"Romênia", currency:"RON", timezone:"Europe/Bucharest", locale:"ro-RO" },
    // Américas
    { code:"CA", name:"Canadá", currency:"CAD", timezone:"America/Toronto", locale:"en-CA" },
    { code:"MX", name:"México", currency:"MXN", timezone:"America/Mexico_City", locale:"es-MX" },
    { code:"BR", name:"Brasil", currency:"BRL", timezone:"America/Sao_Paulo", locale:"pt-BR" },
    { code:"AR", name:"Argentina", currency:"ARS", timezone:"America/Argentina/Buenos_Aires", locale:"es-AR" },
    { code:"CL", name:"Chile", currency:"CLP", timezone:"America/Santiago", locale:"es-CL" },
    { code:"CO", name:"Colômbia", currency:"COP", timezone:"America/Bogota", locale:"es-CO" },
    // Ásia, Oceania, Oriente Médio e África
    { code:"AU", name:"Austrália", currency:"AUD", timezone:"Australia/Sydney", locale:"en-AU" },
    { code:"NZ", name:"Nova Zelândia", currency:"NZD", timezone:"Pacific/Auckland", locale:"en-NZ" },
    { code:"JP", name:"Japão", currency:"JPY", timezone:"Asia/Tokyo", locale:"ja-JP" },
    { code:"KR", name:"Coreia do Sul", currency:"KRW", timezone:"Asia/Seoul", locale:"ko-KR" },
    { code:"SG", name:"Singapura", currency:"SGD", timezone:"Asia/Singapore", locale:"en-SG" },
    { code:"HK", name:"Hong Kong", currency:"HKD", timezone:"Asia/Hong_Kong", locale:"zh-HK" },
    { code:"TW", name:"Taiwan", currency:"TWD", timezone:"Asia/Taipei", locale:"zh-TW" },
    { code:"IN", name:"Índia", currency:"INR", timezone:"Asia/Kolkata", locale:"en-IN" },
    { code:"AE", name:"Emirados Árabes Unidos", currency:"AED", timezone:"Asia/Dubai", locale:"en-AE" },
    { code:"SA", name:"Arábia Saudita", currency:"SAR", timezone:"Asia/Riyadh", locale:"en-SA" },
    { code:"IL", name:"Israel", currency:"ILS", timezone:"Asia/Jerusalem", locale:"he-IL" },
    { code:"TR", name:"Turquia", currency:"TRY", timezone:"Europe/Istanbul", locale:"tr-TR" },
    { code:"ZA", name:"África do Sul", currency:"ZAR", timezone:"Africa/Johannesburg", locale:"en-ZA" }
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
// fuso e localidade de datas de um país do catálogo; fora do catálogo, os padrões (Paris / en-GB)
const timeZoneOf = (code, fallback = "Europe/Paris")=> findCountry(code)?.timezone || fallback;
const localeOf = (code, fallback = "en-GB")=> findCountry(code)?.locale || fallback;

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
    timeZoneOf,
    localeOf,
    pickBuyerCountry
};
