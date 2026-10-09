// Dispositivos do filtro de visitantes. A loja marca quais atende (Store.devices), como faz com os países;
// quem chega em outro dispositivo cai no filtro (layout second). Lista vazia/ausente = DEFAULT_DEVICES, o
// comportamento original (desktop filtrado, celular e tablet liberados: no express-useragent tablet também é isMobile).
const DEVICES = [
    { value:"mobile", key:"Celular", hint:"telefones", icon:"bi-phone" },
    { value:"tablet", key:"Tablet", hint:"iPad e tablets Android", icon:"bi-tablet" },
    { value:"desktop", key:"Desktop", hint:"computadores e notebooks", icon:"bi-laptop" }
];

const deviceCodes = DEVICES.map(device=> device.value);

const DEFAULT_DEVICES = ["mobile", "tablet"];

// classe do visitante a partir do req.useragent (express-useragent); sem flags (bots, UA desconhecido) conta como desktop
const deviceOf = (useragent = {})=>{
    if(useragent?.isTablet){
        return "tablet";
    }

    return useragent?.isMobile ? "mobile" : "desktop";
};

// lista válida da loja ou o padrão
const allowedDevices = (devices)=>{
    const list = Array.isArray(devices) ? devices.filter(device=> deviceCodes.includes(device)) : [];

    return list.length ? list : DEFAULT_DEVICES;
};

module.exports = { DEVICES, deviceCodes, DEFAULT_DEVICES, deviceOf, allowedDevices };
