const { Domain } = require("../domain/domain.schema");
const statusHandler = require("../helpers/helpers.statusHandler");
const { Product, Collection } = require("../product/product.schema");
const { findAll, findById, save, findOne, updateById, removeOne, countDocuments } = require("../query");
const { Shopify } = require("../shopify/shopify.schema");
const { countries, legacyMoeda, symbolOf, pickBuyerCountry } = require("../helpers/helpers.countries");
const { DEVICES, deviceCodes } = require("../helpers/helpers.devices");
const { Store, defaultLayout, layoutNames, visualFieldNames } = require("./store.schema");
const Twig = require('twig');
const mongoose = require('mongoose');


// dispositivos atendidos: só valores válidos e ao menos um (lista ausente no body = não mexe; loja antiga sem o campo usa o padrão)
const normalizeDevices = (store = {})=>{
    if(store.devices === undefined){
        return store;
    }

    const devices = (Array.isArray(store.devices) ? store.devices : [store.devices]).filter(device=> deviceCodes.includes(device));

    if(!devices.length){
        throw(statusHandler.newResponse(400, "Marque ao menos um dispositivo atendido (celular, tablet ou desktop)"));
    }

    store.devices = [...new Set(devices)];

    return store;
};

// opções da seção "Dispositivos atendidos" do modal da loja
const options_devices = DEVICES;

const createStore = async(store, scope = null)=>{
    try{

        normalizeDevices(store);

        // dona da loja: a conta em uso; superadmin fora de uma conta precisa informar `account`
        if(scope){
            store.account = scope;
        }else if(!store.account){
            throw(statusHandler.newResponse(400, "Entre em uma conta (Contas > entrar como) para criar a loja"));
        }

        // cada loja nasce com os dois layouts materializados a partir dos padrões (campos visuais vazios ficam de fora)
        store.layouts = {
            first:{...defaultLayout, ...cleanLayoutInput(store.layouts?.first)},
            second:{...defaultLayout, ...cleanLayoutInput(store.layouts?.second)}
        };

        const saved = await save(Store, store);

        // o admin usa `_id` para seguir editando a loja no mesmo modal
        return statusHandler.newResponse(200, {_id:saved?._id, name:store.name});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// moeda base da loja em ISO (Store.moeda é legado: euro/dolar/libra); sem valor, EUR, como na vitrine
const baseCurrencyOf = (moeda)=> legacyMoeda[moeda] || "EUR";

const getAllStores = async(scope = null)=>{
    try{

        const stores = (await findAll(Store, scope ? {account:scope} : {})).map(store=>{
            const doc = store.toObject ? store.toObject() : store;
            const currency = baseCurrencyOf(doc.moeda);

            // o admin usa `currency_symbol` como prefixo dos campos de preço do produto
            return {...doc, currency, currency_symbol:symbolOf(currency)};
        });

        return statusHandler.newResponse(200, stores);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getStoreById = async(id)=>{
    try{

        const store = await findById(Store, id);

        return statusHandler.newResponse(200, store);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Exclusão definitiva da loja; bloqueada enquanto houver domínios, produtos, coleções ou Shopifys vinculados
const removeStore = async(id)=>{
    try{

        const store = await findById(Store, id);

        if(!store){
            throw(statusHandler.newResponse(404, "Loja não encontrada"));
        }

        const linked = [
            [await countDocuments(Domain, {store:id}), "domínio(s)"],
            [await countDocuments(Product, {store:id}), "produto(s)"],
            [await countDocuments(Collection, {store:id}), "coleção(ões)"],
            [await countDocuments(Shopify, {store:id}), "Shopify(s)"]
        ].filter(([total])=> total);

        if(linked.length){
            const list = linked.map(([total, name])=> `${total} ${name}`).join(", ");

            throw(statusHandler.newResponse(400, `A loja ainda tem ${list} vinculado(s). Exclua ou troque a loja desses itens antes.`));
        }

        await removeOne(Store, id);

        return statusHandler.newResponse(200, "Loja excluída");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Só chaves conhecidas de um layout (templates e campos visuais), sem valores vazios
const layoutKeys = [...Object.keys(defaultLayout), ...visualFieldNames];
const cleanLayoutInput = (own)=>{
    if(!own || typeof own != "object") return {};

    return Object.fromEntries(Object.entries(own).filter(([key, value])=> layoutKeys.includes(key) && value !== "" && value !== null && value !== undefined));
};

// `layouts` chega do admin como objeto aninhado. Gravá-lo como está substituiria o subdocumento inteiro (apagando os
// templates do layout), então vira caminhos pontuados: valor preenchido -> $set, vazio -> $unset (volta a herdar).
const layoutsToUpdate = (store = {})=>{
    const {layouts, ...rest} = store;
    const set = {...rest};
    const unset = {};

    if(layouts && typeof layouts == "object"){
        layoutNames.forEach(name=>{
            const own = layouts[name];

            if(!own || typeof own != "object") return;

            Object.entries(own).forEach(([key, value])=>{
                if(!layoutKeys.includes(key)) return;

                if(value === "" || value === null || value === undefined){
                    unset[`layouts.${name}.${key}`] = "";
                }else{
                    set[`layouts.${name}.${key}`] = value;
                }
            });
        });
    }

    const update = {};

    if(Object.keys(set).length) update.$set = set;
    if(Object.keys(unset).length) update.$unset = unset;

    return update;
};

const changeStore = async(id, store)=>{
    try{

        // dona e id nunca vêm do formulário (impediria mover a loja para outra conta ou trocar o _id)
        delete store.account;
        delete store._id;

        const update = layoutsToUpdate(normalizeDevices(store));

        if(!Object.keys(update).length){
            throw(statusHandler.newResponse(400, "Nada para atualizar"));
        }

        await updateById(Store, id, update);

        return statusHandler.newResponse(200, 'ok')

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const idioma = {
    'FR':{
        product_page:{
            amount:'Quantité',
            description:"Description",
            payments:'Moyens de paiement acceptés',
            btn:'Ajouter au panier',
            shipping_1:'Livraison Express',
            shipping_2:"Offert à partir de",
            shipping_3:'entre 3 et 5 jours',
            return:'Retours sous 14 jours',
            other_products:'Découvrez également',
            default_bundle:"Le plus populaire"
        },
        footer:{
            privacy_policy:'Politique de Confidentialité',
            shipping_policy:"Politique d'expédition",
            return_refund:'Politique de retour et de Remboursement',
            terms_service:"Conditions d'utilisation",
            contact:'Contact',
            copywrite:'Tous droits réservés Copyright © 2025'

        },
        cart:{
            title:'Panier',
            btn_checkout:'Passer à la caisse',
            btn_add_items:"Ajouter plus d'éléments"

        },
        home:{
            collection:"Toutes les collections"
        },
        order:{
            title:"Détails de votre commande",
            order:"Commande",
            approved:"Passée le",
            quantity:"Quantité",
            total:"Sous-total",
            payment_status:"Statut de paiement",
            shipping_status:"Statut de livraison",
            tracking:"Suivi de la commande",
            tracking_code:"Code de suivi",
            tracking_message_1:"Votre commande est en cours de traitement.",
            tracking_message_2:"Votre commande a été envoyée au transporteur.",
            tracking_message_3:"Le suivi sera disponible sous peu.",
            return_store:"Return to the store",
            order_problems:"Problèmes avec ma commande",
            close:"fermer",
            btn_modal:"Vérifier",
            title_options_problem:"Dites-nous ce qui est arrivé à votre commande",
            options_problem: [
                {
                    title: "Commande en retard",
                    value: "1"
                },
                {
                    title: "Je n'ai pas reçu ma commande",
                    value: "2"
                },
                {
                    title: "Je me suis trompé(e) de taille",
                    value: "3"
                },
                {
                    title: "Commande défectueuse",
                    value: "4"
                },
                {
                    title: "Exercice du droit de rétractation",
                    value: "5"
                },
            ],
            await_update:"En attente de mises à jour",
            label_email:"E-mail où vous recevrez des mises à jour",
            label_image:"Images du produit",
            label_details:"Détails",
            btn_form:"Envoyer",
            scripts_var:{
                texts:[
                    {
                        name:"texts",
                        values:[
                            'Rechercher des informations.',
                            'Rechercher des informations..',
                            'Rechercher des informations...',
                        ]
                    },
                    {
                        name:"texts_2",
                        values:[
                            'Service de démarrage.',
                            'Service de démarrage..',
                            'Service de démarrage...',
                        ]
                    },
                    {
                        name:"texts_3",
                        values:[
                            '<b>Élodie</b> tape.',
                            '<b>Élodie</b> tape..',
                            '<b>Élodie</b> tape...',
                        ]
                    },
                ],
                default_text:{
                    name:"defaultText",
                    value:`
                        Informations concernant les échanges de taille ou de couleur

                        Toutes les demandes liées à un changement de taille ou de couleur doivent être traitées directement par e-mail.
                

                        Important :
                        Veuillez indiquer le numéro de votre commande dans l’objet de l’e-mail et préciser le motif de votre demande.

                        Si votre commande est déjà en cours de livraison (c’est-à-dire si le numéro de suivi est disponible ou si le produit est déjà pris en charge par le transporteur), le changement ne pourra se faire qu’à travers un échange du produit après réception.

                        Merci de votre compréhension et de votre confiance 
                        — L’équipe suporte
                    `
                },
                attendant:"Élodie",
                default_message:"Votre formulaire a été envoyé avec <b>succès</b>. Vous recevrez prochainement des mises à jour. Nous vous invitons à revenir sur ce même formulaire dans les prochaines 24 heures pour consulter les informations complémentaires."
            }
        }
    },
    'EN':{
        footer:{
            privacy_policy:'Privacy Policy',
            shipping_policy:'Shipping Policy',
            return_refund:'Return & Refund Policy',
            terms_service:'Terms of Service',
            contact:'Contact',
            copywrite:'All Rights Reserved Copyright © 2025'
        },
        product_page: {
            amount: 'Quantity',
            description: 'Description',
            payments: 'Accepted payment methods',
            btn: 'Add to cart',
            shipping_1: 'Express delivery',
            shipping_2: 'Free from ',
            shipping_3: 'between 3 and 5 days',
            return: 'Returns within 14 days',
            other_products: 'You may also like',
            default_bundle:"Most Popular"
        },
        cart: {
            title: 'Cart',
            btn_checkout: 'Proceed to checkout',
            btn_add_items: 'Add more items'
        },
        home: {
            collection: 'All collections'
        },
        order: {
            title: "Your order details",
            order: "Order",
            approved: "Placed on",
            quantity: "Quantity",
            total:"Subtotal",
            payment_status: "Payment status",
            shipping_status: "Delivery status",
            tracking: "Order tracking",
            tracking_code: "Tracking code",
            tracking_message_1: "Your order is being processed.",
            tracking_message_2: "Your order has been sent to the carrier.",
            tracking_message_3: "Tracking will be available shortly.",
            return_store: "Return to the store",
            order_problems: "Problems with my order",
            close:"close",
            btn_modal:"Check",
            title_options_problem:"Tell us what happened to your order",
            options_problem:[
                {
                    title:"Late order",
                    value:"1"
                },
                {
                    title:"I haven't received my order",
                    value:"2"
                },
                {
                    title:"I chose the wrong size",
                    value:"3"
                },
                {
                    title:"Faulty order",
                    value:"4"
                },
                {
                    title:"Exercising the right of return",
                    value:"5"
                },

            ],
            await_update:"Awaiting updates",
            label_email:"Email address where you will receive updates",
            label_image:"Product images",
            label_details:"Details",
            btn_form:"Send",
            scripts_var: {
                texts: [
                    {
                        name: "texts",
                        values: [
                            'Searching for information.',
                            'Searching for information..',
                            'Searching for information...'
                        ]
                    },
                    {
                        name: "texts_2",
                        values: [
                            'Starting service.',
                            'Starting service..',
                            'Starting service...'
                        ]
                    },
                    {
                        name: "texts_3",
                        values: [
                            '<b>Emily</b> is typing.',
                            '<b>Emily</b> is typing..',
                            '<b>Emily</b> is typing...'
                        ]
                    },
                ],
                default_text:{
                    name:"defaultText",
                    value:`
                        Information regarding size or color exchanges

                        All requests related to a change of size or color must be handled directly by email.
                
                        Important:
                        Please include your order number in the subject line of the email and specify the reason for your request.

                        If your order is already in transit (i.e., if a tracking number is available or the product has already been handed over to the carrier), the change can only be made through a product exchange after delivery.

                        Thank you for your understanding and trust.
                        — The support team
                    `
                },
                attendant:"Emily",
                default_message:"Your form has been <b>successfully</b> submitted. You will receive updates soon. Please check back on this form within the next 24 hours for further information."
                
            }
        }


    },
    'DE':{
        footer: {
            privacy_policy: 'Datenschutzerklärung',
            shipping_policy: 'Versandrichtlinie',
            return_refund: 'Rückgabe- & Erstattungsrichtlinie',
            terms_service: 'Nutzungsbedingungen',
            contact: 'Kontakt',
            copywrite: 'Alle Rechte vorbehalten © 2025'
        },
        product_page: {
            amount: 'Menge',
            description: 'Beschreibung',
            payments: 'Akzeptierte Zahlungsmethoden',
            btn: 'In den Warenkorb legen',
            shipping_1: 'Expresslieferung',
            shipping_2: 'Kostenlos ab ',
            shipping_3: 'zwischen 3 und 5 Tagen',
            return: 'Rückgabe innerhalb von 14 Tagen',
            other_products: 'Das könnte Ihnen auch gefallen',
            default_bundle:"Am beliebtesten"
        },
        cart: {
            title: 'Warenkorb',
            btn_checkout: 'Zur Kasse gehen',
            btn_add_items: 'Weitere Artikel hinzufügen'
        },
        home: {
            collection: 'Alle Kollektionen'
        },
    },
    'ES':{
        product_page:{
            amount:'Cantidad',
            description:'Descripción',
            payments:'Métodos de pago aceptados',
            btn:'Añadir al carrito',
            shipping_1:'Envío exprés',
            shipping_2:'Gratis a partir de',
            shipping_3:'entre 3 y 5 días',
            return:'Devoluciones en 14 días',
            other_products:'También te puede interesar',
            default_bundle:'El más popular'
        },
        footer:{
            privacy_policy:'Política de privacidad',
            shipping_policy:'Política de envíos',
            return_refund:'Política de devoluciones y reembolsos',
            terms_service:'Términos de uso',
            contact:'Contacto',
            copywrite:'Todos los derechos reservados © 2025'
        },
        cart:{
            title:'Carrito',
            btn_checkout:'Finalizar compra',
            btn_add_items:'Añadir más artículos'
        },
        home:{
            collection:'Todas las colecciones'
        },
        order:{
            title:'Detalles de tu pedido',
            order:'Pedido',
            approved:'Realizado el',
            quantity:'Cantidad',
            total:'Subtotal',
            payment_status:'Estado del pago',
            shipping_status:'Estado del envío',
            tracking:'Seguimiento del pedido',
            tracking_code:'Código de seguimiento',
            tracking_message_1:'Tu pedido se está preparando.',
            tracking_message_2:'Tu pedido ha sido entregado al transportista.',
            tracking_message_3:'El seguimiento estará disponible en breve.',
            return_store:'Volver a la tienda',
            order_problems:'Problemas con mi pedido',
            close:'cerrar',
            btn_modal:'Consultar',
            title_options_problem:'Cuéntanos qué ha pasado con tu pedido',
            options_problem:[
                {
                    title:'Pedido retrasado',
                    value:'1'
                },
                {
                    title:'No he recibido mi pedido',
                    value:'2'
                },
                {
                    title:'Me equivoqué de talla',
                    value:'3'
                },
                {
                    title:'Pedido defectuoso',
                    value:'4'
                },
                {
                    title:'Ejercer el derecho de desistimiento',
                    value:'5'
                },
            ],
            await_update:'Esperando novedades',
            label_email:'Correo electrónico donde recibirás las novedades',
            label_image:'Imágenes del producto',
            label_details:'Detalles',
            btn_form:'Enviar',
            scripts_var:{
                texts:[
                    {
                        name:'texts',
                        values:[
                            'Buscando información.',
                            'Buscando información..',
                            'Buscando información...',
                        ]
                    },
                    {
                        name:'texts_2',
                        values:[
                            'Iniciando el servicio.',
                            'Iniciando el servicio..',
                            'Iniciando el servicio...',
                        ]
                    },
                    {
                        name:'texts_3',
                        values:[
                            '<b>Lucía</b> está escribiendo.',
                            '<b>Lucía</b> está escribiendo..',
                            '<b>Lucía</b> está escribiendo...',
                        ]
                    },
                ],
                default_text:{
                    name:'defaultText',
                    value:`
                        Información sobre cambios de talla o color

                        Todas las solicitudes de cambio de talla o color deben gestionarse directamente por correo electrónico.

                        Importante:
                        Indica el número de tu pedido en el asunto del correo y especifica el motivo de tu solicitud.

                        Si tu pedido ya está en camino (es decir, si el número de seguimiento está disponible o el transportista ya tiene el producto), el cambio solo podrá realizarse mediante un cambio del producto tras su recepción.

                        Gracias por tu comprensión y tu confianza.
                        — El equipo de atención al cliente
                    `
                },
                attendant:'Lucía',
                default_message:'Tu formulario se ha enviado <b>correctamente</b>. Recibirás novedades en breve. Te invitamos a volver a este mismo formulario en las próximas 24 horas para consultar la información adicional.'
            }
        }
    },
    'NL':{
        footer: {
            privacy_policy: 'Privacybeleid',
            shipping_policy: 'Verzendbeleid',
            return_refund: 'Retour- en restitutiebeleid',
            terms_service: 'Servicevoorwaarden',
            contact: 'Contact',
            copywrite: 'Alle rechten voorbehouden © 2025'
        },
        product_page: {
            amount: 'Aantal',
            description: 'Beschrijving',
            payments: 'Geaccepteerde betaalmethoden',
            btn: 'Toevoegen aan winkelwagen',
            shipping_1: 'Expresslevering',
            shipping_2: 'Gratis vanaf ',
            shipping_3: 'tussen 3 en 5 dagen',
            return: 'Retour binnen 14 dagen',
            other_products: 'Misschien ook interessant voor jou',
            default_bundle:"Meest populair"
        },
        cart: {
            title: 'Winkelwagen',
            btn_checkout: 'Afrekenen',
            btn_add_items: 'Meer artikelen toevoegen'
        },
        home: {
            collection: 'Alle collecties'
        },
    }

};

const moeda = {
    'euro':'€',
    'dolar':'$',
    'libra':'£'
};



// Nome de layout válido ou `fallback` (vitrine: valor inválido na query cai no layout da loja)
const pickLayoutName = (layout, fallback = "first")=>{
    return layoutNames.includes(layout) ? layout : fallback;
};

// Nome de layout vindo da API admin: ausente -> "first" (compatível com chamadas antigas); inválido -> 400
const getLayoutName = (layout)=>{
    if(layout === undefined || layout === null || layout === ""){
        return "first";
    }

    if(!layoutNames.includes(layout)){
        throw(statusHandler.newResponse(400, `Layout inválido: ${layout}`));
    }

    return layout;
};

const isTemplateId = (idFile)=> files.some(file=> file.id == idFile);

// Monta o conjunto de templates de um layout.
// Prioridade: layouts.<name>.<campo> -> (só para "first") campo legado na raiz -> padrão do schema.
const resolveLayout = (store, name)=>{
    const doc = typeof store.toJSON == "function" ? store.toJSON() : store;
    const own = doc.layouts?.[name] || {};

    let templates = {};

    Object.keys(defaultLayout).forEach(key=>{
        templates[key] = own[key] ?? (name == "first" ? doc[key] : undefined) ?? defaultLayout[key];
    });

    // visuais (logo, posição, banners, CSS): valor próprio do layout ou o da raiz da loja (valores do "first")
    visualFieldNames.forEach(key=>{
        templates[key] = own[key] || doc[key];
    });

    // título do navegador: próprio do layout -> título do first (raiz) -> nome da loja
    templates.title = own.title || doc.title || doc.name;

    return templates;
};

// Aplica um layout em `config` (vindo de getConfigStore): os templates vão para a raiz e `config.layout` guarda o nome.
// Pode ser chamado de novo para trocar o layout (ex.: visitante filtrado -> "second"). Nome inválido/ausente -> "first".
const useLayout = (config, name)=>{
    const layoutName = pickLayoutName(name, "first");

    Object.assign(config, config.layouts[layoutName]);
    config.layout = layoutName;

    return config;
};

// Define o país e a moeda da visita em `config`: país do visitante se a loja o atende, senão o primeiro país da loja.
// O símbolo (config.moeda) segue a moeda que a Shopify devolveu para o país no refresh de preços; sem refresh, a moeda base.
const useCountry = (config, countryCode)=>{
    const buyerCountry = pickBuyerCountry(config.country, countryCode);
    const currency = (buyerCountry && config.market_currencies?.[buyerCountry]) || baseCurrencyOf(config.moeda_base);

    config.buyer_country = buyerCountry;
    config.currency = currency;
    config.moeda = symbolOf(currency);

    return config;
};

// Loja da visita a partir do host ('domain'), de um produto ('product') ou de uma coleção ('collection').
// Qualquer elo faltando (id inválido, documento inexistente, sem loja vinculada, loja apagada) vira 404,
// que renderError() mostra como "página não encontrada" em vez de estourar TypeError no log.
const getConfigStore = async(id, type)=>{
    try{

        let idStore = null;
        const notFound = (message)=> statusHandler.newResponse(404, message);

        if(type == "product" || type == "collection"){
            if(!mongoose.isValidObjectId(id)){
                throw(notFound(`${type} inválido: ${id}`));
            }

            const doc = await findById(type == "product" ? Product : Collection, id, {store:1});

            if(!doc){
                throw(notFound(`${type} não encontrado: ${id}`));
            }

            idStore = doc.store;
        }

        if(type == 'domain'){
            const domain = await findOne(Domain, {domain:id});

            if(!domain){
                throw(notFound(`domínio não cadastrado: ${id}`));
            }

            idStore = domain.store;
        }

        if(!idStore){
            throw(notFound(`${type} ${id} sem loja vinculada`));
        }

        const store = await findById(Store, idStore);

        if(!store){
            throw(notFound(`loja ${idStore} não encontrada (${type} ${id})`));
        }

        {
            let config = store.toJSON();

            // os dois layouts já resolvidos (com fallback) ficam em config.layouts;
            // useLayout() copia os templates de um deles para a raiz de config. Começa em "first".
            config.layouts = {
                first:resolveLayout(config, "first"),
                second:resolveLayout(config, "second")
            };
            useLayout(config, "first");

            // políticas da loja já resolvidas (texto próprio ou padrão do país); usa o idioma ainda como código
            config.policies = resolvePolicies(config);

            config.idioma_code = config['idioma'];
            config.idioma = idioma[config['idioma']];
            // moeda legada da loja fica como base; useCountry() define país/moeda da visita (padrão: primeiro país)
            config.moeda_base = config['moeda'];
            useCountry(config, null);
            // config.title já veio de useLayout (título por layout, com fallback no nome)

            delete config['name'];

            return config;  
        }


    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const getFile = async({idStore, idFile}, layout)=>{
  try{  

    const layoutName = getLayoutName(layout);

    if(!isTemplateId(idFile)){
      throw(statusHandler.newResponse(400, `Arquivo inválido: ${idFile}`));
    }

    const store = await findById(Store, idStore);

    if(!store){
      throw(statusHandler.newResponse(404, "Loja não encontrada"));
    }

    const templates = resolveLayout(store, layoutName);

    let file = {_id:store._id, layout:layoutName};
    file[idFile] = templates[idFile];

    return statusHandler.newResponse(200, file)

  }catch(error){
    throw(statusHandler.serviceError(error));
  }
};

const changeFile = async({idStore, idFile}, {file}, layout)=>{
  try{

      const layoutName = getLayoutName(layout);

      if(!isTemplateId(idFile)){
        throw(statusHandler.newResponse(400, `Arquivo inválido: ${idFile}`));
      }

      const render = Twig.twig({ data: file });
      
      if(!render.tokens.length){
        throw(statusHandler.newResponse(400, "Error"))
      }
      
      let update = {};
      update[`layouts.${layoutName}.${idFile}`] = file;
      await updateById(Store, idStore, update);

      return statusHandler.newResponse(200, "ok");

  }catch(error){
    throw(statusHandler.serviceError(error))
  }
}


// países disponíveis no admin (catálogo em helpers.countries.js)
const options_country = countries.map(country=> ({key:country.name, value:country.code}));


const options_moeda = [
    {
        key:"Euro - €",
        value:"euro"
    },
    {
        key:"Libra - £",
        value:"libra"
    },
     {
        key:"Dolar - $",
        value:"dolar"
    }
];


const options_idioma = [
    {
        value:"FR",
        key:"Frances"
    },
    {
        value:"EN",
        key:"Ingles"
    },
    {
        value:"DE",
        key:"Alemão"
    },
    {
        value:"NL",
        key:"Holandes"
    },
    {
        value:"ES",
        key:"Espanhol"
    }
];

const policies = {
    "FR":{
        privacy:{
            title_policy:"Politique de Confidentialité",
            text_policy:`
                <section class="privacy-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">
 

  <h2 style="font-size:20px; margin-top:30px;">1. Introduction</h2>
  <p>
    La présente Politique de Confidentialité décrit la manière dont nous recueillons, utilisons et protégeons les informations personnelles des utilisateurs qui visitent notre site internet et effectuent des achats en ligne.
    Nous nous engageons à respecter la confidentialité et la sécurité de vos données personnelles, conformément au Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679) et aux lois françaises en vigueur.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">2. Données collectées</h2>
  <p>Nous collectons les informations suivantes lorsque vous utilisez notre site :</p>
  <ul>
    <li><strong>Informations d’identification :</strong> nom, prénom, adresse postale, adresse e-mail, numéro de téléphone.</li>
    <li><strong>Informations de paiement :</strong> données bancaires ou de carte (cryptées et traitées par nos prestataires de paiement sécurisés).</li>
    <li><strong>Informations de commande :</strong> produits achetés, montant, date et historique de vos commandes.</li>
    <li><strong>Informations techniques :</strong> adresse IP, type de navigateur, système d’exploitation, pages consultées, durée de la visite.</li>
    <li><strong>Cookies et technologies similaires :</strong> pour améliorer votre expérience et analyser le trafic.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3. Finalités du traitement</h2>
  <p>Vos données personnelles sont utilisées pour :</p>
  <ul>
    <li>Traiter et expédier vos commandes.</li>
    <li>Vous informer sur le statut de votre commande.</li>
    <li>Gérer votre compte client et vos préférences.</li>
    <li>Vous envoyer des offres promotionnelles et newsletters (si vous y avez consenti).</li>
    <li>Améliorer notre site et nos services.</li>
    <li>Prévenir les fraudes et respecter nos obligations légales.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">4. Base légale du traitement</h2>
  <p>Le traitement de vos données repose sur :</p>
  <ul>
    <li><strong>L’exécution d’un contrat :</strong> pour la gestion de vos commandes et livraisons.</li>
    <li><strong>Votre consentement :</strong> pour l’envoi d’e-mails marketing et l’utilisation de cookies non essentiels.</li>
    <li><strong>Nos obligations légales :</strong> facturation, lutte contre la fraude, comptabilité.</li>
    <li><strong>Notre intérêt légitime :</strong> amélioration continue de nos services et sécurité du site.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5. Partage des données</h2>
  <p>Vos données peuvent être transmises uniquement à des tiers de confiance lorsque cela est nécessaire :</p>
  <ul>
    <li>Prestataires de paiement (ex. Stripe, PayPal, etc.).</li>
    <li>Services de livraison et logistique (ex. La Poste, Colissimo, Mondial Relay, etc.).</li>
    <li>Prestataires techniques (hébergement, maintenance, e-mailing).</li>
    <li>Autorités administratives ou judiciaires, uniquement en cas d’obligation légale.</li>
  </ul>
  <p><strong>Nous ne vendons jamais vos données personnelles à des tiers.</strong></p>

  <h2 style="font-size:20px; margin-top:30px;">6. Durée de conservation</h2>
  <ul>
    <li>Données clients : 3 ans à compter de la dernière interaction commerciale.</li>
    <li>Données de commande et facturation : 10 ans (obligation légale).</li>
    <li>Données marketing : jusqu’à votre désinscription.</li>
    <li>Cookies : jusqu’à 13 mois maximum après leur dépôt.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7. Sécurité des données</h2>
  <p>
    Nous mettons en place des mesures techniques et organisationnelles adaptées pour protéger vos données contre toute perte, destruction, accès non autorisé ou divulgation.
    Toutes les transactions sont sécurisées via le protocole <strong>SSL (Secure Socket Layer)</strong> et les paiements sont traités par des plateformes certifiées PCI-DSS.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8. Vos droits</h2>
  <p>Conformément au RGPD, vous disposez des droits suivants :</p>
  <ul>
    <li><strong>Droit d’accès :</strong> obtenir une copie de vos données personnelles.</li>
    <li><strong>Droit de rectification :</strong> corriger des données inexactes ou incomplètes.</li>
    <li><strong>Droit à l’effacement :</strong> demander la suppression de vos données (“droit à l’oubli”).</li>
    <li><strong>Droit d’opposition :</strong> refuser le traitement de vos données à des fins marketing.</li>
    <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré.</li>
    <li><strong>Droit à la limitation du traitement :</strong> suspendre temporairement l’usage de vos données.</li>
  </ul>
  <p>
    Pour exercer vos droits, vous pouvez envoyer une demande à l’adresse suivante :
    <br>📧 <a href="mailto:contact@service-client.fr">contact@service-client.fr</a>
  </p>
  <p>Toute demande sera traitée dans un délai maximum de <strong>30 jours</strong>.</p>

  <h2 style="font-size:20px; margin-top:30px;">9. Cookies</h2>
  <p>
    Notre site utilise des cookies afin d’assurer son bon fonctionnement et d’améliorer votre expérience utilisateur.
    Certains cookies sont essentiels au fonctionnement du site (panier, session, sécurité), d’autres sont optionnels (analyse, personnalisation, publicité).
    Vous pouvez gérer vos préférences de cookies à tout moment via le bandeau de consentement.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">10. Transfert international des données</h2>
  <p>
    Vos données peuvent être traitées dans l’Espace Économique Européen (EEE).
    En cas de transfert hors EEE, nous nous assurons que le pays bénéficiaire offre un niveau de protection adéquat, conformément aux exigences du RGPD.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">11. Modifications de la politique</h2>
  <p>
    Nous nous réservons le droit de modifier la présente Politique de Confidentialité à tout moment.
    Toute mise à jour sera publiée sur cette page, avec la date de dernière modification indiquée ci-dessous.
  </p>
  <p><em>Dernière mise à jour : 30 octobre 2025</em></p>

  <h2 style="font-size:20px; margin-top:30px;">12. Contact</h2>
  <p>
    Pour toute question relative à la protection de vos données personnelles, veuillez nous contacter :
    <br>📧 <a href="mailto:privacy@service-client.fr">privacy@service-client.fr</a>
    <br>📬 Service Confidentialité – 75000 Paris, France
  </p>
</section>

            `
        },
        shipping:{
            title_policy:"Politique d’Expédition & Livraison",
            text_policy:`
                <section class="shipping-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">
  <p>
    La présente Politique d’Expédition décrit nos modalités de préparation, d’envoi et de livraison des commandes passées sur ce site. 
    Elle s’applique à tous les clients résidant en France et à l’international, selon les zones desservies ci-dessous.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Zones desservies</h2>
  <ul>
    <li><strong>France métropolitaine & Monaco</strong> – desservies.</li>
    <li><strong>DOM-TOM</strong> – desservis avec délais et frais spécifiques.</li>
    <li><strong>Union Européenne</strong> – desservie.</li>
    <li><strong>Royaume-Uni & Suisse</strong> – desservis (droits & taxes éventuels à la charge du destinataire).</li>
    <li><strong>Autres pays</strong> – selon disponibilité des transporteurs et restrictions locales.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">2) Délais de traitement (préparation)</h2>
  <ul>
    <li><strong>Préparation standard :</strong> 24 à 48h ouvrées après confirmation du paiement.</li>
    <li><strong>Périodes de forte demande (soldes, fêtes, lancements) :</strong> +1 à +3 jours ouvrés.</li>
    <li><strong>Précommandes / articles sur commande :</strong> délai indiqué sur la fiche produit ; les commandes mixtes peuvent être fractionnées (voir §6).</li>
    <li>Les commandes passées après <strong>14h (heure de Paris)</strong> sont traitées le jour ouvré suivant.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3) Transporteurs & options</h2>
  <ul>
    <li><strong>France :</strong> La Poste / Colissimo, Chronopost, Mondial Relay (Point Relais) selon option choisie.</li>
    <li><strong>UE & International :</strong> La Poste / Colissimo International, DHL/UPS/Chronopost International (selon disponibilité).</li>
    <li><strong>Preuve de livraison :</strong> remise contre signature peut être proposée selon l’option.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">4) Délais indicatifs de livraison (hors préparation)</h2>
  <table style="width:100%; border-collapse:collapse; font-size:14px;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Zone</th>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Mode</th>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Délai indicatif</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">France métropolitaine</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Colissimo / Point Relais</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">48–72h ouvrées</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">France (express)</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Chronopost</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">24h ouvrées</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Union Européenne</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Standard International</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">3–7 jours ouvrés</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Royaume-Uni / Suisse</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Standard / Express</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">3–8 jours ouvrés</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">DOM-TOM</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Standard</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">5–12 jours ouvrés</td>
      </tr>
      <tr>
        <td style="padding:8px;">Autres pays</td>
        <td style="padding:8px;">Standard / Express</td>
        <td style="padding:8px;">5–15 jours ouvrés</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top:8px; font-size:13px; color:#555;">
    <em>Les délais sont fournis à titre indicatif par les transporteurs et peuvent varier selon la période, l’adresse et les contrôles douaniers.</em>
  </p>

  <h2 style="font-size:20px; margin-top:30px;">5) Frais de livraison & franco</h2>
  <ul>
    <li>Les frais sont calculés au panier selon l’adresse, le poids/volume et l’option choisie.</li>
    <li><strong>Franco de port :</strong> livraison standard offerte à partir de <strong>XX,XX €</strong> d’achat (France métropolitaine). Montant ajustable selon promotions.</li>
    <li>Les options express et internationales peuvent ne pas être éligibles au franco.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">6) Expéditions partielles (split) & articles en rupture</h2>
  <ul>
    <li>En cas d’articles en précommande/rupture, nous pouvons fractionner la commande sans frais supplémentaires de standard, sauf mention contraire.</li>
    <li>Le suivi est fourni pour chaque envoi lorsqu’il est disponible.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7) Suivi de commande</h2>
  <ul>
    <li>Un <strong>numéro de suivi</strong> (lorsqu’il est disponible) est envoyé par e-mail dès l’expédition.</li>
    <li>Le statut peut mettre 24–48h à s’actualiser sur le site du transporteur.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">8) Adresse de livraison & modifications</h2>
  <ul>
    <li>Vérifiez soigneusement vos informations avant validation. Les modifications <strong>ne sont plus garanties</strong> après préparation.</li>
    <li>Les réexpéditions dues à une adresse incomplète/erronée ou à un colis non réclamé peuvent engendrer de nouveaux frais d’envoi.</li>
    <li>Livraison vers boîtes postales et adresses militaires : selon possibilités du transporteur.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">9) Droits & taxes (international)</h2>
  <p>
    Pour les envois hors UE (p. ex. Royaume-Uni, Suisse, pays tiers), des droits de douane, taxes d’importation et frais administratifs peuvent s’appliquer,
    à la charge du destinataire, selon la réglementation locale. Les délais peuvent être prolongés par les contrôles douaniers.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">10) Colis perdus, endommagés ou volés</h2>
  <ul>
    <li><strong>Colis déclaré livré mais non reçu :</strong> vérifiez la boîte aux lettres, voisins, gardien et Point Relais. Contactez-nous sous <strong>72h</strong> après la mention “livré”.</li>
    <li><strong>Colis endommagé :</strong> refusez la livraison si possible ou émettez des réserves précises. Signalez-nous sous <strong>48h</strong> avec photos (colis, étiquette, contenu).</li>
    <li><strong>Colis perdu / sans mise à jour :</strong> contactez-nous si aucune évolution n’apparaît après <strong>7 jours ouvrés</strong>. Nous ouvrirons une enquête auprès du transporteur.</li>
    <li>Les enquêtes transporteur peuvent prendre <strong>5 à 15 jours ouvrés</strong>. Les solutions proposées (remboursement, renvoi) dépendent de l’issue de l’enquête et de la couverture.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">11) Cas de force majeure & retards</h2>
  <p>
    Nous ne sommes pas responsables des retards dus à des circonstances indépendantes de notre volonté (intempéries, grèves,
    restrictions sanitaires, contrôles douaniers, pics d’activité, événements exceptionnels). Nous nous engageons toutefois à vous accompagner et à vous informer.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">12) Commandes comprenant des produits réglementés / volumineux</h2>
  <p>
    Certains produits peuvent nécessiter des conditions d’expédition particulières (matières réglementées, produits volumineux/fragiles).
    Le cas échéant, des délais et surcoûts spécifiques peuvent s’appliquer ; ces informations sont précisées avant paiement.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">13) Retours liés à la livraison</h2>
  <p>
    Pour toute demande de retour suite à un problème de livraison, merci de consulter la <strong>Politique de Retour & Rétractation</strong>
    et de nous contacter avant tout renvoi afin d’obtenir les instructions et l’étiquette éventuelle.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">14) Contact</h2>
  <p>
    Pour toute question sur l’expédition, la livraison ou le suivi de votre commande :
    <br>📧 <a href="mailto:expedition@service-client.fr">expedition@service-client.fr</a>
  </p>

  <h2 style="font-size:20px; margin-top:30px;">15) Mises à jour de la politique</h2>
  <p>
    Nous pouvons modifier cette Politique d’Expédition afin de refléter des changements de transporteurs, tarifs ou réglementations.
    Les mises à jour sont publiées sur cette page.
  </p>
  <p><em>Dernière mise à jour : 30 octobre 2025</em></p>
</section>
            `
        },
        return:{
            title_policy:"Politique de retour et de Remboursement",
            text_policy:`
                <section class="return-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">
  

  <p>
    Cette Politique de Retour et de Remboursement décrit vos droits et les conditions applicables aux retours, échanges et remboursements
    pour les produits achetés sur notre site. Elle est conforme au Code de la Consommation et au droit européen de la vente à distance.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Droit de rétractation (14 jours)</h2>
  <p>
    Conformément à l’article L.221-18 du Code de la Consommation, vous disposez d’un délai de <strong>14 jours calendaires</strong> à compter
    de la réception de votre commande pour exercer votre droit de rétractation, sans avoir à justifier de motif ni à payer de pénalité.
  </p>
  <ul>
    <li>Le délai commence à courir le lendemain de la livraison du colis.</li>
    <li>Si le délai expire un samedi, dimanche ou jour férié, il est prolongé jusqu’au jour ouvrable suivant.</li>
    <li>Pour exercer ce droit, vous devez nous notifier votre décision par écrit (e-mail ou formulaire de contact).</li>
  </ul>
  <p>
    Exemple d’adresse de contact : <br>
    📧 <a href="mailto:retour@service-client.fr">retour@service-client.fr</a>
  </p>

  <h2 style="font-size:20px; margin-top:30px;">2) Conditions de retour</h2>
  <ul>
    <li>Les produits doivent être retournés <strong>neufs, non utilisés, non lavés</strong> et dans leur emballage d’origine complet (boîte, étiquette, accessoires, notice…).</li>
    <li>Les retours incomplets, endommagés ou présentant des signes d’usage ne pourront être acceptés.</li>
    <li>Les produits personnalisés, hygiéniques ou périssables ne sont <strong>pas éligibles</strong> au droit de rétractation (ex. produits cosmétiques ouverts, sous-vêtements, etc.).</li>
    <li>Les articles reçus en cadeau doivent être retournés par l’acheteur initial.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3) Procédure de retour</h2>
  <p>
    Pour effectuer un retour, veuillez suivre les étapes suivantes :
  </p>
  <ol>
    <li>Contactez notre service client à <a href="mailto:retour@service-client.fr">retour@service-client.fr</a> pour obtenir l’autorisation et l’adresse de retour.</li>
    <li>Emballez soigneusement le produit dans son emballage d’origine avec tous les accessoires et le bon de commande.</li>
    <li>Expédiez le colis à l’adresse fournie. Nous vous recommandons un envoi suivi (Colissimo, Mondial Relay ou équivalent) afin de garantir sa traçabilité.</li>
  </ol>
  <p><strong>Les retours non préalablement autorisés peuvent être refusés.</strong></p>

  <h2 style="font-size:20px; margin-top:30px;">4) Frais de retour</h2>
  <ul>
    <li>Les frais de retour sont à la charge du client, sauf erreur de notre part (article défectueux, erreur d’expédition, etc.).</li>
    <li>En cas de produit défectueux ou erreur, nous prenons en charge les frais de retour après validation par notre service client.</li>
    <li>En cas de refus du colis ou d’adresse erronée fournie par le client, les frais de réexpédition pourront être facturés.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5) Délais et mode de remboursement</h2>
  <p>
    Une fois le produit reçu et vérifié, le remboursement sera effectué sous <strong>5 à 10 jours ouvrés</strong>, selon le mode de paiement initial :
  </p>
  <ul>
    <li><strong>Carte bancaire :</strong> remboursement sur la même carte utilisée lors du paiement.</li>
    <li><strong>PayPal :</strong> remboursement sur le compte PayPal du client.</li>
    <li><strong>Autres méthodes (Klarna, etc.) :</strong> selon les conditions du prestataire.</li>
  </ul>
  <p>
    Le délai total dépend du traitement bancaire et peut atteindre <strong>jusqu’à 14 jours</strong> après réception du retour.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">6) Échanges</h2>
  <ul>
    <li>Les échanges sont possibles dans la limite des stocks disponibles.</li>
    <li>Pour un échange de taille ou de couleur, précisez votre souhait lors de la demande de retour.</li>
    <li>Si l’article de remplacement n’est plus disponible, un remboursement sera effectué.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7) Articles endommagés ou défectueux</h2>
  <p>
    Si un article reçu est endommagé, défectueux ou ne correspond pas à la commande, contactez-nous sous <strong>48h après réception</strong>
    avec des photos du produit et de l’emballage.  
    Notre équipe vous proposera une solution : échange, réparation, ou remboursement.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8) Commandes non livrées ou perdues</h2>
  <p>
    En cas de colis déclaré “livré” mais non reçu, signalez-le sous <strong>72h</strong> suivant la notification.
    Une enquête sera ouverte auprès du transporteur (délai 5 à 15 jours ouvrés).
    Si la perte est confirmée, un nouvel envoi ou un remboursement complet sera proposé.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">9) Remboursements partiels</h2>
  <ul>
    <li>Si la commande comporte plusieurs articles, seul le produit retourné sera remboursé.</li>
    <li>Les frais d’expédition initiaux peuvent ne pas être remboursés sauf en cas d’erreur de notre part.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">10) Cas particuliers</h2>
  <ul>
    <li>Les promotions, ventes flash et articles soldés sont éligibles aux retours selon les mêmes conditions légales.</li>
    <li>Les produits offerts ou reçus gratuitement (cadeaux, échantillons) ne sont pas remboursables.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">11) Adresse de contact</h2>
  <p>
    Pour toute demande relative à un retour, un échange ou un remboursement :
    <br>📧 <a href="mailto:retour@service-client.fr">retour@service-client.fr</a>
    <br>📬 Service Retours – 75000 Paris, France
  </p>

  <h2 style="font-size:20px; margin-top:30px;">12) Mise à jour de la politique</h2>
  <p>
    Nous nous réservons le droit de modifier la présente Politique de Retour et de Remboursement à tout moment.
    Les changements entreront en vigueur dès leur publication sur cette page.
  </p>
  <p><em>Dernière mise à jour : 30 octobre 2025</em></p>
</section>

            `
        },
        terms:{
            title_policy:"Conditions d'utilisation",
            text_policy:`
                <section class="terms-of-use" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">

  <p>
    Les présentes Conditions Générales d’Utilisation (ci-après les « Conditions ») régissent l’accès et l’utilisation du présent site internet, 
    ainsi que des services qui y sont proposés.  
    En accédant au site, vous acceptez sans réserve l’intégralité des dispositions décrites ci-dessous.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Objet du site</h2>
  <p>
    Ce site a pour objet la présentation, la vente et la distribution en ligne de produits destinés aux consommateurs.  
    Les informations diffusées ont un caractère informatif et peuvent être modifiées sans préavis.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">2) Acceptation des conditions</h2>
  <p>
    L’utilisation du site implique l’acceptation pleine et entière des présentes Conditions Générales d’Utilisation.  
    Si vous n’acceptez pas ces conditions, vous devez cesser d’utiliser le site.  
    Nous nous réservons le droit de les modifier à tout moment ; la version applicable est celle publiée en ligne à la date de votre utilisation.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">3) Accès au site</h2>
  <p>
    Le site est accessible 24h/24 et 7j/7, sauf interruption pour maintenance, mise à jour ou en cas de force majeure.  
    L’éditeur du site ne saurait être tenu responsable des interruptions, retards ou impossibilités d’accès dus à des circonstances extérieures (panne de réseau, hébergeur, force majeure…).
  </p>
  <p>
    L’utilisateur s’engage à ne pas perturber le fonctionnement du site, ni à introduire de virus ou toute technologie nuisible.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">4) Compte utilisateur</h2>
  <ul>
    <li>Pour passer commande, la création d’un compte utilisateur peut être requise.</li>
    <li>L’utilisateur est seul responsable de la confidentialité de ses identifiants (e-mail et mot de passe).</li>
    <li>Toute activité réalisée via le compte est réputée provenir du titulaire de celui-ci.</li>
    <li>En cas d’utilisation non autorisée, l’utilisateur doit en informer immédiatement le service client.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5) Produits et services</h2>
  <p>
    Les produits présentés sont décrits et photographiés avec la plus grande exactitude possible.  
    Toutefois, de légères variations peuvent exister entre les photos et le produit final (couleur, emballage, texture, etc.).
  </p>
  <p>
    Les offres et prix sont valables tant qu’ils sont visibles sur le site, dans la limite des stocks disponibles.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">6) Responsabilités de l’utilisateur</h2>
  <ul>
    <li>Utiliser le site dans le respect de la loi, des bonnes mœurs et de la sécurité publique.</li>
    <li>Fournir des informations exactes lors de la création de compte et de la commande.</li>
    <li>Ne pas détourner le site à des fins frauduleuses, commerciales non autorisées ou nuisibles.</li>
    <li>Ne pas usurper l’identité d’autrui ni tenter d’accéder à des zones restreintes sans autorisation.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7) Responsabilité de l’éditeur</h2>
  <p>
    L’éditeur met tout en œuvre pour assurer l’exactitude des informations publiées.  
    Toutefois, il ne peut garantir l’absence d’erreurs typographiques ou d’omissions.  
    En conséquence, il décline toute responsabilité pour d’éventuelles imprécisions, interruptions ou indisponibilités temporaires du service.
  </p>
  <p>
    L’éditeur ne pourra être tenu responsable des dommages directs ou indirects liés à l’utilisation du site, y compris perte de données, d’exploitation ou de profit.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8) Propriété intellectuelle</h2>
  <p>
    Tous les éléments du site (textes, images, logos, graphismes, vidéos, codes sources, structure, design, marques) sont protégés par les lois françaises et internationales relatives à la propriété intellectuelle.  
    Toute reproduction, diffusion, modification ou utilisation, totale ou partielle, sans autorisation écrite préalable, est strictement interdite.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">9) Liens externes</h2>
  <p>
    Le site peut contenir des liens vers d’autres sites tiers.  
    Ces liens sont fournis à titre informatif et ne constituent pas une approbation.  
    L’éditeur ne peut être tenu responsable du contenu, des pratiques ou des politiques de confidentialité de ces sites externes.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">10) Données personnelles</h2>
  <p>
    Le traitement des données personnelles est régi par notre <a href="/pages/politique-de-confidentialite">Politique de Confidentialité</a>, 
    conforme au Règlement Général sur la Protection des Données (RGPD).  
    En utilisant le site, vous consentez au traitement de vos données selon les finalités indiquées.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">11) Sécurité</h2>
  <p>
    L’utilisateur reconnaît être conscient des risques liés à l’utilisation d’internet (virus, interception de données, etc.).  
    L’éditeur décline toute responsabilité en cas d’attaque informatique ou d’accès non autorisé aux serveurs.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">12) Suspension ou suppression du compte</h2>
  <p>
    L’éditeur se réserve le droit de suspendre ou de supprimer tout compte utilisateur en cas de non-respect des présentes conditions, 
    d’utilisation abusive ou de tentative de fraude, sans préavis ni indemnité.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">13) Force majeure</h2>
  <p>
    En cas de force majeure (catastrophe naturelle, grève, panne internet, guerre, pandémie, etc.), la responsabilité de l’éditeur ne pourra être engagée.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">14) Droit applicable et juridiction compétente</h2>
  <p>
    Les présentes Conditions sont régies par le droit français.  
    En cas de litige, et à défaut d’accord amiable, la juridiction compétente sera celle du lieu de domicile du consommateur (conformément à l’article R.631-3 du Code de la Consommation).
  </p>

  <h2 style="font-size:20px; margin-top:30px;">15) Contact</h2>
  <p>
    Pour toute question relative à ces Conditions Générales d’Utilisation :  
    📧 <a href="mailto:contact@service-client.fr">contact@service-client.fr</a>  
    <br>📬 Service Juridique – 75000 Paris, France
  </p>

  <h2 style="font-size:20px; margin-top:30px;">16) Mise à jour</h2>
  <p>
    Ces conditions peuvent être modifiées à tout moment afin de refléter les évolutions légales ou techniques.  
    La version applicable est celle publiée sur cette page à la date de votre visite.
  </p>
  <p><em>Dernière mise à jour : 30 octobre 2025</em></p>
</section>

            `
        }
    },
    'ES': {
    privacy: {
      title_policy: "Política de privacidad",
      text_policy: `
<section class="privacy-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">

  <h2 style="font-size:20px; margin-top:30px;">1. Introducción</h2>
  <p>
    Esta Política de privacidad explica cómo recogemos, utilizamos y protegemos los datos personales de las personas que visitan nuestro sitio web y compran en línea.
    Cumplimos el <strong>Reglamento (UE) 2016/679 (RGPD)</strong>, la <strong>Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD)</strong> y la <strong>Ley 34/2002 de servicios de la sociedad de la información (LSSI-CE)</strong>.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">2. Datos que recogemos</h2>
  <ul>
    <li><strong>Identidad y contacto:</strong> nombre, dirección de facturación y de envío, correo electrónico, teléfono.</li>
    <li><strong>Pedido y pago:</strong> artículos comprados, importes, historial de pedidos; los datos de tarjeta o cuenta bancaria los tratan pasarelas de pago certificadas PCI-DSS y nosotros no los almacenamos en claro.</li>
    <li><strong>Datos técnicos:</strong> dirección IP, información del dispositivo y del navegador, páginas visitadas, identificadores de sesión.</li>
    <li><strong>Cookies y tecnologías similares:</strong> para funciones esenciales del sitio, analítica y marketing (véase “Cookies”).</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3. Finalidades del tratamiento</h2>
  <ul>
    <li>Tramitar y entregar los pedidos (incluida la prevención del fraude y la gestión de devoluciones).</li>
    <li>Atención al cliente y gestión de la cuenta.</li>
    <li>Mejora del servicio, resolución de incidencias y analítica.</li>
    <li>Comunicaciones comerciales con tu consentimiento o cuando lo permita la LSSI-CE (clientes existentes, productos similares).</li>
    <li>Cumplimiento de obligaciones legales, contables y fiscales.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">4. Bases jurídicas (art. 6 RGPD)</h2>
  <ul>
    <li><strong>Ejecución del contrato:</strong> para gestionar tu pedido y prestar los servicios.</li>
    <li><strong>Consentimiento:</strong> para cookies no esenciales y marketing directo.</li>
    <li><strong>Obligación legal:</strong> fiscalidad, contabilidad y conservación de registros.</li>
    <li><strong>Interés legítimo:</strong> seguridad del sitio, mejora del servicio y prevención del fraude (ponderado con tus derechos).</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5. Destinatarios de los datos</h2>
  <ul>
    <li>Proveedores de pago (por ejemplo, Stripe, PayPal, Klarna).</li>
    <li>Transportistas y logística (por ejemplo, Correos, SEUR, MRW, GLS, DHL).</li>
    <li>Proveedores de alojamiento, informática y soporte bajo los contratos correspondientes.</li>
    <li>Autoridades cuando la ley lo exija.</li>
  </ul>
  <p><strong>Nunca vendemos tus datos personales.</strong></p>

  <h2 style="font-size:20px; margin-top:30px;">6. Conservación</h2>
  <ul>
    <li>Datos de clientes y pedidos: hasta 6 años por obligaciones mercantiles y fiscales.</li>
    <li>Datos de marketing: hasta que te des de baja o retires el consentimiento.</li>
    <li>Cookies: normalmente entre 6 y 13 meses según el tipo (véase el detalle en el banner).</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7. Seguridad</h2>
  <p>
    Aplicamos medidas técnicas y organizativas adecuadas; las transacciones están protegidas con <strong>SSL/TLS</strong> y los pagos los gestionan proveedores certificados <strong>PCI-DSS</strong>.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8. Tus derechos (RGPD y LOPDGDD)</h2>
  <ul>
    <li>Acceso, rectificación, supresión, limitación, portabilidad y oposición (incluida la oposición al marketing directo).</li>
    <li>Retirar el consentimiento en cualquier momento (sin que ello afecte a la licitud del tratamiento anterior).</li>
    <li>Presentar una reclamación ante la <strong>Agencia Española de Protección de Datos (AEPD)</strong>, www.aepd.es.</li>
  </ul>
  <p>
    Contacto: 📧 <a href="mailto:privacy@service-client.com">privacy@service-client.com</a>
  </p>

  <h2 style="font-size:20px; margin-top:30px;">9. Cookies</h2>
  <p>
    Utilizamos cookies esenciales (compra, seguridad) y cookies no esenciales (analítica y publicidad) sujetas a tu consentimiento a través del banner de cookies, conforme al artículo 22.2 de la LSSI-CE.
    Puedes modificar tus preferencias en cualquier momento.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">10. Transferencias internacionales</h2>
  <p>
    Si los datos se transfieren fuera del Espacio Económico Europeo, nos basamos en decisiones de adecuación de la Comisión Europea o en garantías adecuadas (por ejemplo, cláusulas contractuales tipo).
  </p>

  <h2 style="font-size:20px; margin-top:30px;">11. Cambios en esta política</h2>
  <p>Podemos actualizar este aviso; los cambios se publicarán en esta página.</p>
  <p><em>Última actualización: 30 de octubre de 2025</em></p>

  <h2 style="font-size:20px; margin-top:30px;">12. Contacto</h2>
  <p>
    📧 <a href="mailto:privacy@service-client.com">privacy@service-client.com</a><br>
    📬 Protección de Datos, Madrid, España
  </p>
</section>
      `
    },
    shipping: {
      title_policy: "Política de envíos y entregas",
      text_policy: `
<section class="shipping-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">
  <p>
    Esta política explica la preparación de los pedidos, las opciones de envío y los plazos de entrega para España y para los destinos internacionales disponibles.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Zonas de envío</h2>
  <ul>
    <li><strong>Península</strong> – con servicio.</li>
    <li><strong>Baleares</strong> – con servicio, con plazos específicos.</li>
    <li><strong>Canarias, Ceuta y Melilla</strong> – con servicio, con plazos y recargos específicos y trámites aduaneros (véase “Impuestos y aduanas”).</li>
    <li><strong>Unión Europea e internacional</strong> – disponible donde operen los transportistas y lo permitan las restricciones locales.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">2) Plazos de preparación</h2>
  <ul>
    <li><strong>Preparación estándar:</strong> de 24 a 48 horas laborables tras la confirmación del pago.</li>
    <li><strong>Periodos de alta demanda (rebajas, festivos):</strong> de 1 a 3 días laborables adicionales.</li>
    <li><strong>Reservas y pedidos pendientes:</strong> el plazo se indica en la página del producto; pueden producirse envíos parciales.</li>
    <li>Los pedidos realizados después de las <strong>14:00 (hora peninsular)</strong> se procesan el siguiente día laborable.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3) Transportistas y opciones</h2>
  <ul>
    <li><strong>España:</strong> Correos, SEUR, MRW, GLS (el servicio varía según la cesta y la opción elegida al finalizar la compra).</li>
    <li><strong>Internacional:</strong> Correos Internacional, DHL/UPS/GLS (según disponibilidad).</li>
    <li><strong>Prueba de entrega:</strong> en algunas opciones puede ofrecerse entrega con firma.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">4) Plazos de tránsito orientativos (sin contar la preparación)</h2>
  <table style="width:100%; border-collapse:collapse; font-size:14px;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Zona</th>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Servicio</th>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Plazo estimado</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Península</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Estándar con seguimiento</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">3–20 días laborables</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Península (Exprés)</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Entrega prioritaria (según transportista)</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">2–18 días laborables</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Baleares</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Estándar / Exprés</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">3–7 días laborables</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Canarias, Ceuta y Melilla</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Estándar</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">5–12 días laborables</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Unión Europea</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Internacional estándar</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">3–7 días laborables</td>
      </tr>
      <tr>
        <td style="padding:8px;">Resto del mundo</td>
        <td style="padding:8px;">Estándar / Exprés</td>
        <td style="padding:8px;">5–15 días laborables</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top:8px; font-size:13px; color:#555;"><em>Los plazos son estimaciones y pueden variar según la zona, la meteorología, las aduanas o los picos de demanda.</em></p>

  <h2 style="font-size:20px; margin-top:30px;">5) Gastos de envío y envío gratuito</h2>
  <ul>
    <li>Los gastos se calculan al finalizar la compra según la dirección, el peso o volumen y el servicio elegido.</li>
    <li><strong>Envío estándar gratuito</strong> a partir de <strong>XX,XX €</strong> (Península) — ajústalo según tu tienda.</li>
    <li>Los servicios exprés e internacionales pueden no beneficiarse del envío gratuito.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">6) Dirección, apartados de correos y cambios</h2>
  <ul>
    <li>Comprueba tu dirección. Una vez iniciada la preparación, los cambios <strong>no están garantizados</strong>.</li>
    <li>Los apartados de correos se aceptan cuando la política del transportista lo permite (normalmente a través de Correos).</li>
    <li>Los reenvíos por direcciones incorrectas o incompletas pueden conllevar nuevos gastos de envío.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7) Impuestos y aduanas</h2>
  <p>
    Los precios para Península y Baleares incluyen el IVA. En los envíos a <strong>Canarias, Ceuta y Melilla</strong> pueden aplicarse el IGIC o el IPSI y gastos de despacho aduanero a cargo del destinatario.
    En los envíos <strong>fuera de la Unión Europea</strong>, los derechos e impuestos locales pueden exigirse en la importación.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8) Paquetes perdidos, dañados o robados</h2>
  <ul>
    <li><strong>Marcado como entregado pero no recibido:</strong> revisa el buzón, pregunta a vecinos o conserjería y avísanos en un plazo de <strong>72 h</strong>.</li>
    <li><strong>Dañado:</strong> rechaza el paquete si es posible o firma con reservas; contáctanos en <strong>48 h</strong> con fotos.</li>
    <li><strong>Sin novedades en el seguimiento:</strong> contáctanos pasados <strong>7 días laborables</strong>; abriremos una investigación con el transportista (de 5 a 15 días).</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">9) Fuerza mayor</h2>
  <p>No somos responsables de los retrasos debidos a causas ajenas a nuestro control (meteorología, huelgas, restricciones, aduanas, picos de demanda).</p>

  <h2 style="font-size:20px; margin-top:30px;">10) Contacto</h2>
  <p>📧 <a href="mailto:shipping@service-client.com">shipping@service-client.com</a></p>

  <h2 style="font-size:20px; margin-top:30px;">11) Actualizaciones</h2>
  <p><em>Última actualización: 30 de octubre de 2025</em></p>
</section>
      `
    },
    return: {
      title_policy: "Política de devoluciones y reembolsos",
      text_policy: `
<section class="return-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">
  <p>
    Esta política recoge tus derechos y nuestros procedimientos de devolución, cambio y reembolso en España.
    Se ajusta al <strong>Real Decreto Legislativo 1/2007 (texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios)</strong> y a la normativa de consumo aplicable.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Derecho de desistimiento (14 días)</h2>
  <p>
    Dispones de <strong>14 días naturales</strong> desde la recepción para desistir de la compra sin necesidad de justificar el motivo. Si el plazo termina en un día inhábil, se amplía al siguiente día hábil.
    Comunícanoslo por escrito (correo electrónico o formulario de contacto) para ejercer este derecho.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">2) Condiciones de la devolución</h2>
  <ul>
    <li>Los artículos deben estar <strong>nuevos, sin usar, sin lavar</strong> y en su embalaje original con etiquetas y accesorios.</li>
    <li>Los productos personalizados, los precintados por razones de higiene que se hayan desprecintado y los perecederos pueden <strong>no admitir devolución</strong>, salvo defecto.</li>
    <li>Las devoluciones de regalos debe iniciarlas la persona que realizó la compra.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3) Procedimiento de devolución</h2>
  <ol>
    <li>Escribe a <a href="mailto:returns@service-client.com">returns@service-client.com</a> para obtener la autorización y la dirección de devolución (RMA).</li>
    <li>Embala el producto de forma segura con todos sus componentes y la referencia del pedido.</li>
    <li>Utiliza un servicio con seguimiento (Correos, mensajería) y conserva el justificante de envío.</li>
  </ol>

  <h2 style="font-size:20px; margin-top:30px;">4) Costes de la devolución</h2>
  <ul>
    <li>Los gastos de devolución corren a cargo del cliente, salvo que el artículo sea defectuoso o el error sea nuestro.</li>
    <li>En caso de defecto o error nuestro, asumiremos los costes razonables de devolución una vez validados.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5) Reembolsos</h2>
  <p>
    Una vez recibido y revisado el artículo, el reembolso se realiza en un plazo de <strong>5 a 10 días laborables</strong> por el mismo medio de pago, y en todo caso dentro de los <strong>14 días naturales</strong> que establece la ley.
    Los plazos bancarios pueden ampliar el total hasta <strong>14 días</strong>.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">6) Cambios</h2>
  <ul>
    <li>Sujetos a disponibilidad de stock; en caso contrario se tramitará un reembolso.</li>
    <li>Indica la talla o el color deseados al solicitar tu RMA.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7) Artículos dañados o incorrectos (garantía legal)</h2>
  <p>
    Comunícalo en un plazo de <strong>48 h</strong> desde la entrega con fotos del embalaje y del artículo. Ofreceremos sustitución, reparación o reembolso.
    Además, los productos cuentan con la <strong>garantía legal de conformidad de 3 años</strong> prevista en la normativa de consumo.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8) No entrega o pérdida</h2>
  <p>
    Si el pedido figura como entregado pero no lo has recibido, avísanos en <strong>72 h</strong>. Si el seguimiento no avanza, contáctanos pasados <strong>7 días laborables</strong> para abrir una investigación (de 5 a 15 días).
  </p>

  <h2 style="font-size:20px; margin-top:30px;">9) Reembolsos parciales y gastos de envío</h2>
  <ul>
    <li>Si el pedido contiene varios artículos, solo se reembolsa el artículo devuelto.</li>
    <li>Los gastos de envío originales pueden no ser reembolsables, salvo cuando la ley lo exija o en caso de error nuestro.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">10) Contacto</h2>
  <p>
    📧 <a href="mailto:returns@service-client.com">returns@service-client.com</a><br>
    📬 Departamento de Devoluciones, Madrid, España
  </p>

  <h2 style="font-size:20px; margin-top:30px;">11) Actualizaciones</h2>
  <p><em>Última actualización: 30 de octubre de 2025</em></p>
</section>
      `
    },
    terms: {
      title_policy: "Términos de uso",
      text_policy: `
<section class="terms-of-use" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">

  <p>
    Estos Términos regulan el acceso y el uso de este sitio web y de sus servicios. Al utilizar el sitio aceptas estos Términos en su totalidad.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Objeto del sitio</h2>
  <p>El sitio ofrece información y servicios de comercio electrónico de productos de consumo. El contenido puede cambiar sin previo aviso.</p>

  <h2 style="font-size:20px; margin-top:30px;">2) Aceptación y modificaciones</h2>
  <p>El uso del sitio implica la aceptación plena de estos Términos. Podemos actualizarlos; se aplica la versión publicada en el momento del uso.</p>

  <h2 style="font-size:20px; margin-top:30px;">3) Acceso y disponibilidad</h2>
  <p>El sitio está disponible las 24 horas, salvo mantenimiento o causas ajenas a nuestro control. No respondemos de interrupciones o retrasos.</p>

  <h2 style="font-size:20px; margin-top:30px;">4) Cuentas</h2>
  <ul>
    <li>Eres responsable de la custodia de tus credenciales de acceso.</li>
    <li>Avísanos de inmediato ante cualquier uso no autorizado.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5) Contenido y exactitud</h2>
  <p>Procuramos que la información sea exacta, pero no podemos garantizar un contenido sin errores ni un servicio ininterrumpido.</p>

  <h2 style="font-size:20px; margin-top:30px;">6) Propiedad intelectual</h2>
  <p>Todos los elementos del sitio están protegidos. Queda prohibida cualquier reproducción o uso sin autorización previa por escrito.</p>

  <h2 style="font-size:20px; margin-top:30px;">7) Enlaces externos</h2>
  <p>Los enlaces a sitios de terceros tienen carácter informativo. No respondemos de su contenido ni de sus políticas.</p>

  <h2 style="font-size:20px; margin-top:30px;">8) Protección de datos</h2>
  <p>Los datos personales se tratan conforme a nuestra <a href="/privacy-policy">Política de privacidad</a> (RGPD, LOPDGDD, LSSI-CE).</p>

  <h2 style="font-size:20px; margin-top:30px;">9) Legislación aplicable y reclamaciones</h2>
  <p>Estos Términos se rigen por la legislación española. En caso de conflicto, serán competentes los juzgados y tribunales del domicilio del consumidor. Puedes acudir también a las Juntas Arbitrales de Consumo y solicitar las hojas de reclamaciones.</p>

  <h2 style="font-size:20px; margin-top:30px;">10) Contacto</h2>
  <p>📧 <a href="mailto:legal@service-client.com">legal@service-client.com</a></p>

  <h2 style="font-size:20px; margin-top:30px;">11) Actualizaciones</h2>
  <p><em>Última actualización: 30 de octubre de 2025</em></p>
</section>
      `
    }
  },
    'GB': {
    privacy: {
      title_policy: "Privacy Policy",
      text_policy: `
<section class="privacy-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">

  <h2 style="font-size:20px; margin-top:30px;">1. Introduction</h2>
  <p>
    This Privacy Policy explains how we collect, use, and protect personal information of users who visit our website and purchase online.
    We comply with the <strong>UK GDPR</strong>, the <strong>Data Protection Act 2018</strong>, and the <strong>Privacy and Electronic Communications Regulations (PECR)</strong>.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">2. Data We Collect</h2>
  <ul>
    <li><strong>Identity & Contact:</strong> name, billing/shipping address, email, phone.</li>
    <li><strong>Order & Payment:</strong> items purchased, amounts, order history; card/bank data are processed by PCI-DSS compliant payment processors and are not stored by us in plain text.</li>
    <li><strong>Technical Data:</strong> IP address, device/browser info, pages viewed, session identifiers.</li>
    <li><strong>Cookies & similar tech:</strong> for essential site functions, analytics, and marketing (see “Cookies”).</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3. Purposes of Processing</h2>
  <ul>
    <li>Process and deliver orders (including fraud prevention and returns).</li>
    <li>Customer service and account management.</li>
    <li>Service improvement, troubleshooting, and analytics.</li>
    <li>Marketing communications with your consent (opt-in) or where permitted by PECR.</li>
    <li>Legal, accounting, and regulatory compliance.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">4. Lawful Bases (UK GDPR)</h2>
  <ul>
    <li><strong>Contract:</strong> to fulfil your order and provide services.</li>
    <li><strong>Consent:</strong> for non-essential cookies and direct marketing.</li>
    <li><strong>Legal obligation:</strong> tax, accounting, and record-keeping.</li>
    <li><strong>Legitimate interests:</strong> site security, service improvement, and fraud prevention (balanced against your rights).</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5. Sharing Your Data</h2>
  <ul>
    <li>Payment providers (e.g., Stripe, PayPal, Klarna).</li>
    <li>Couriers/fulfilment (e.g., Royal Mail, Evri, DPD, UPS).</li>
    <li>IT, hosting, and support vendors under appropriate contracts.</li>
    <li>Authorities where required by law.</li>
  </ul>
  <p><strong>We never sell your personal data.</strong></p>

  <h2 style="font-size:20px; margin-top:30px;">6. Retention</h2>
  <ul>
    <li>Customer & order records: up to 6 years for legal/tax purposes.</li>
    <li>Marketing data: until you unsubscribe or withdraw consent.</li>
    <li>Cookies: typically 6–13 months depending on type (see banner details).</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7. Security</h2>
  <p>
    We implement appropriate technical and organisational measures; transactions are protected with <strong>SSL/TLS</strong>, and payments are handled by <strong>PCI-DSS</strong> compliant processors.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8. Your Rights (UK GDPR)</h2>
  <ul>
    <li>Access, rectification, erasure, restriction, portability, and objection (including to direct marketing).</li>
    <li>Withdraw consent at any time (does not affect prior lawful processing).</li>
    <li>Lodge a complaint with the <strong>ICO (Information Commissioner’s Office)</strong>.</li>
  </ul>
  <p>
    Contact: 📧 <a href="mailto:privacy@service-client.com">privacy@service-client.com</a>
  </p>

  <h2 style="font-size:20px; margin-top:30px;">9. Cookies</h2>
  <p>
    We use essential cookies (checkout, security) and non-essential cookies (analytics/ads) subject to your consent via the cookie banner in line with PECR.
    You can update preferences at any time.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">10. International Transfers</h2>
  <p>
    Where data are transferred outside the UK, we rely on adequacy regulations or appropriate safeguards (e.g., UK Addendum/IDTA with Standard Contractual Clauses).
  </p>

  <h2 style="font-size:20px; margin-top:30px;">11. Changes to This Policy</h2>
  <p>We may update this notice; changes will be posted here.</p>
  <p><em>Last updated: 30 October 2025</em></p>

  <h2 style="font-size:20px; margin-top:30px;">12. Contact</h2>
  <p>
    📧 <a href="mailto:privacy@service-client.com">privacy@service-client.com</a><br>
    📬 Data Protection, London, United Kingdom
  </p>
</section>
      `
    },
    shipping: {
      title_policy: "Shipping & Delivery Policy",
      text_policy: `
<section class="shipping-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">
  <p>
    This policy explains order processing, shipping options, and delivery times for the United Kingdom and overseas destinations as available.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Service Areas</h2>
  <ul>
    <li><strong>UK Mainland</strong> – serviced.</li>
    <li><strong>Highlands & Islands, Channel Islands, Isle of Man, Northern Ireland</strong> – serviced with specific lead times/surcharges.</li>
    <li><strong>EU & International</strong> – available where carriers operate and local restrictions permit.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">2) Handling Times</h2>
  <ul>
    <li><strong>Standard handling:</strong> 24–48 business hours after payment confirmation.</li>
    <li><strong>Peak periods (sales/holidays):</strong> +1–3 business days.</li>
    <li><strong>Pre-orders / backorders:</strong> lead time shown on product page; split shipments may occur.</li>
    <li>Orders after <strong>2pm (UK time)</strong> are processed the next business day.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3) Carriers & Options</h2>
  <ul>
    <li><strong>UK:</strong> Royal Mail, Evri, DPD, UPS (service varies by basket/checkout choice).</li>
    <li><strong>International:</strong> Royal Mail International, DHL/UPS/DPD (subject to availability).</li>
    <li><strong>Proof of delivery:</strong> signature service may be offered for certain options.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">4) Indicative Transit Times (ex-handling)</h2>
  <table style="width:100%; border-collapse:collapse; font-size:14px;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Zone</th>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Service</th>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">ETA</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">UK Mainland</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Tracked 48 / Courier Standard</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">3–20 business days</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">UK Mainland (Express)</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Next-Day (by carrier)</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">2–18 business days</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Highlands, Islands, NI</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Standard / Express</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">2–5 business days</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">EU</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">International Standard</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">3–7 business days</td>
      </tr>
      <tr>
        <td style="padding:8px;">Rest of World</td>
        <td style="padding:8px;">Standard / Express</td>
        <td style="padding:8px;">5–15 business days</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top:8px; font-size:13px; color:#555;"><em>Times are estimates and may vary by location, weather, customs, or peak traffic.</em></p>

  <h2 style="font-size:20px; margin-top:30px;">5) Shipping Fees & Free Threshold</h2>
  <ul>
    <li>Fees are calculated at checkout based on address, weight/volume, and service chosen.</li>
    <li><strong>Free standard shipping</strong> from <strong>£XX.XX</strong> (UK Mainland) — adjust as needed.</li>
    <li>Express and international services may not qualify for free shipping.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">6) Address, PO Boxes & Changes</h2>
  <ul>
    <li>Please verify your address. After fulfilment begins, changes are <strong>not guaranteed</strong>.</li>
    <li>PO Boxes and BFPO are accepted where carrier policy allows (often via Royal Mail).</li>
    <li>Re-shipments due to incorrect/incomplete addresses may incur new postage.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7) Duties, VAT & Customs</h2>
  <p>
    For <strong>UK deliveries from outside the UK</strong>, import VAT/duties or courier fees may apply to the recipient.
    For <strong>exports from the UK</strong> to non-UK destinations, local duties/taxes may be due upon import.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8) Lost, Damaged or Stolen Parcels</h2>
  <ul>
    <li><strong>Marked delivered, not received:</strong> check mailbox, neighbours, safe place; notify us within <strong>72h</strong>.</li>
    <li><strong>Damaged:</strong> refuse if possible or sign with reservations; contact us within <strong>48h</strong> with photos.</li>
    <li><strong>No tracking updates:</strong> contact us after <strong>7 business days</strong>; we will open a carrier investigation (5–15 days).</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">9) Force Majeure</h2>
  <p>We are not liable for delays due to events beyond our control (weather, strikes, restrictions, customs, peak surges).</p>

  <h2 style="font-size:20px; margin-top:30px;">10) Contact</h2>
  <p>📧 <a href="mailto:shipping@service-client.com">shipping@service-client.com</a></p>

  <h2 style="font-size:20px; margin-top:30px;">11) Updates</h2>
  <p><em>Last updated: 30 October 2025</em></p>
</section>
      `
    },
    return: {
      title_policy: "Returns & Refunds Policy",
      text_policy: `
<section class="return-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">
  <p>
    This policy sets out your rights and our procedures for returns, exchanges, and refunds in the United Kingdom.
    It aligns with the <strong>Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013</strong> and related UK consumer laws.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Right to Cancel (14 days)</h2>
  <p>
    You have <strong>14 calendar days</strong> from receipt to cancel without giving any reason. If the deadline falls on a weekend/public holiday, it is extended to the next working day.
    Notify us in writing (email or contact form) to exercise this right.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">2) Return Conditions</h2>
  <ul>
    <li>Items must be <strong>new, unused, unwashed</strong>, and in original packaging with tags/accessories.</li>
    <li>Personalised, hygiene-sensitive or perishable goods may be <strong>non-returnable</strong> unless faulty.</li>
    <li>Gift returns should be initiated by the original purchaser.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3) Return Procedure</h2>
  <ol>
    <li>Email <a href="mailto:returns@service-client.com">returns@service-client.com</a> to obtain authorisation and the return address (RMA).</li>
    <li>Pack securely with all components and order reference.</li>
    <li>Use a tracked service (Royal Mail Tracked, courier) and retain proof of postage.</li>
  </ol>

  <h2 style="font-size:20px; margin-top:30px;">4) Return Costs</h2>
  <ul>
    <li>Return postage is borne by the customer unless the item is faulty or we made an error.</li>
    <li>For faults/our error, we will cover reasonable return costs after validation.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5) Refunds</h2>
  <p>
    Once received and inspected, refunds are issued within <strong>5–10 working days</strong> to the original payment method.
    Banking times may extend the total to <strong>up to 14 days</strong>.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">6) Exchanges</h2>
  <ul>
    <li>Subject to stock availability; otherwise a refund will be processed.</li>
    <li>Indicate desired size/colour when requesting your RMA.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7) Damaged/Incorrect Items</h2>
  <p>
    Report within <strong>48h</strong> of delivery with photos of the packaging and item. We will offer a replacement, repair, or refund.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8) Non-Delivery or Lost</h2>
  <p>
    If marked delivered but not received, notify us within <strong>72h</strong>. For stalled tracking, contact us after <strong>7 business days</strong> for an investigation (5–15 days).
  </p>

  <h2 style="font-size:20px; margin-top:30px;">9) Partial Refunds & Shipping Fees</h2>
  <ul>
    <li>Where an order contains multiple items, only the returned item is refunded.</li>
    <li>Original shipping charges may be non-refundable except where legally required or in case of our error.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">10) Contact</h2>
  <p>
    📧 <a href="mailto:returns@service-client.com">returns@service-client.com</a><br>
    📬 Returns Department, London, United Kingdom
  </p>

  <h2 style="font-size:20px; margin-top:30px;">11) Updates</h2>
  <p><em>Last updated: 30 October 2025</em></p>
</section>
      `
    },
    terms: {
      title_policy: "Terms of Use",
      text_policy: `
<section class="terms-of-use" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">

  <p>
    These Terms govern access to and use of this website and services. By using the site, you accept these Terms in full.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Site Purpose</h2>
  <p>The site provides information and e-commerce services for consumer products. Content may change without notice.</p>

  <h2 style="font-size:20px; margin-top:30px;">2) Acceptance & Changes</h2>
  <p>Use of the site implies full acceptance. We may update these Terms; the online version at the time of use applies.</p>

  <h2 style="font-size:20px; margin-top:30px;">3) Access & Availability</h2>
  <p>Available 24/7 except for maintenance or events beyond our control. We are not liable for interruptions or delays.</p>

  <h2 style="font-size:20px; margin-top:30px;">4) Accounts</h2>
  <ul>
    <li>You are responsible for safeguarding login credentials.</li>
    <li>Notify us immediately of unauthorised use.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5) Content & Accuracy</h2>
  <p>We endeavour to ensure accuracy but cannot guarantee error-free content or uninterrupted service.</p>

  <h2 style="font-size:20px; margin-top:30px;">6) Intellectual Property</h2>
  <p>All site elements are protected. Any reproduction or use without prior written consent is prohibited.</p>

  <h2 style="font-size:20px; margin-top:30px;">7) External Links</h2>
  <p>Links to third-party sites are informational. We are not responsible for their content or policies.</p>

  <h2 style="font-size:20px; margin-top:30px;">8) Data Protection</h2>
  <p>Personal data are processed according to our <a href="/pages/privacy-policy">Privacy Policy</a> (UK GDPR, DPA 2018, PECR).</p>

  <h2 style="font-size:20px; margin-top:30px;">9) Governing Law</h2>
  <p>These Terms are governed by the laws of England and Wales. In case of dispute, courts of the consumer’s domicile may apply as per UK consumer rules.</p>

  <h2 style="font-size:20px; margin-top:30px;">10) Contact</h2>
  <p>📧 <a href="mailto:legal@service-client.com">legal@service-client.com</a></p>

  <h2 style="font-size:20px; margin-top:30px;">11) Updates</h2>
  <p><em>Last updated: 30 October 2025</em></p>
</section>
      `
    }
  },
  'US': {
    privacy: {
      title_policy: "Privacy Policy",
      text_policy: `
<section class="privacy-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">

  <h2 style="font-size:20px; margin-top:30px;">1. Introduction</h2>
  <p>
    This Privacy Policy explains how we collect, use, and disclose personal information for users in the United States.
    While the U.S. has no single federal privacy law for all consumers, certain states (e.g., California, Virginia, Colorado, Connecticut, Utah, and others) grant specific rights.
    Where required, we honour those rights and provide state-specific disclosures below (e.g., <strong>CCPA/CPRA</strong> for California residents).
  </p>

  <h2 style="font-size:20px; margin-top:30px;">2. Personal Information We Collect</h2>
  <ul>
    <li><strong>Identifiers:</strong> name, postal address, email, phone, device identifiers, IP address.</li>
    <li><strong>Commercial information:</strong> order history, products purchased, payment method (processed by PCI-DSS compliant providers).</li>
    <li><strong>Internet/technical activity:</strong> browsing data, interactions with pages, cookies, and similar technologies.</li>
    <li><strong>Inferences & preferences:</strong> derived from your interactions (e.g., segments for marketing), where permitted by law.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3. Use of Personal Information</h2>
  <ul>
    <li>Provide and fulfil orders; customer service; returns and warranties.</li>
    <li>Improve services, debug, and ensure security and fraud prevention.</li>
    <li>Marketing and advertising (including interest-based ads) consistent with your choices.</li>
    <li>Compliance with legal obligations and enforcement of our terms.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">4. Disclosures of Personal Information</h2>
  <ul>
    <li>Payment processors (e.g., Stripe, PayPal, Shop Pay, Klarna).</li>
    <li>Logistics and shipping partners (USPS, UPS, FedEx, DHL, etc.).</li>
    <li>IT providers, analytics, and advertising partners.</li>
    <li>Law enforcement or regulators if required.</li>
  </ul>
  <p><strong>We do not sell personal information for money.</strong> Some states define “sale” or “share” to include certain advertising/analytics. See your state rights below.</p>

  <h2 style="font-size:20px; margin-top:30px;">5. Retention & Security</h2>
  <ul>
    <li>We retain records as needed to provide services and comply with law (typically 3–7 years for order/tax records).</li>
    <li>We use appropriate safeguards; payments are processed by <strong>PCI-DSS</strong> compliant vendors over <strong>TLS</strong>.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">6. Cookies & Interest-Based Ads</h2>
  <p>
    We use essential cookies and, with your consent where required, analytics/advertising cookies. You may adjust settings via our banner and limit interest-based ads using platform tools.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">7. Children’s Privacy</h2>
  <p>
    Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13 (<strong>COPPA</strong>).
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8. U.S. State Privacy Rights</h2>
  <p>
    Depending on your state, you may have rights to <strong>know/access</strong>, <strong>delete</strong>, <strong>correct</strong>, <strong>opt-out of “sale” or “sharing”</strong>, and <strong>opt-out of targeted advertising</strong>.
    California residents have additional rights under <strong>CCPA/CPRA</strong>, including the right to limit the use/disclosure of sensitive personal information (if collected).
  </p>
  <ul>
    <li>To exercise rights or appeal a decision, contact: 📧 <a href="mailto:privacy@service-client.com">privacy@service-client.com</a>.</li>
    <li>To opt-out of “sale”/“sharing” or targeted ads, use the link: <a href="/do-not-sell-or-share">Do Not Sell or Share My Personal Information</a>.</li>
    <li>We will verify your request; authorised agents may act on your behalf where permitted.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">9. International Transfers</h2>
  <p>
    If your information is transferred outside your state or country (e.g., to the EU/UK), we use appropriate safeguards and contracts with service providers.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">10. Changes & Contact</h2>
  <p>
    We may revise this policy. Updates will be posted here.<br>
    <em>Last updated: 30 October 2025</em>
  </p>
  <p>
    📧 <a href="mailto:privacy@service-client.com">privacy@service-client.com</a><br>
    📬 Privacy Office, United States
  </p>
</section>
      `
    },
    shipping: {
      title_policy: "Shipping & Delivery Policy",
      text_policy: `
<section class="shipping-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">
  <p>
    This policy describes order handling, shipping options, and delivery timelines within the United States and internationally where available.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Service Areas</h2>
  <ul>
    <li><strong>Contiguous U.S. (48 states)</strong> – serviced.</li>
    <li><strong>Alaska, Hawaii, Puerto Rico</strong> – serviced with specific lead times/surcharges.</li>
    <li><strong>APO/FPO/DPO</strong> – typically via USPS; restrictions may apply.</li>
    <li><strong>International</strong> – offered where carriers operate and local rules permit.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">2) Handling Times</h2>
  <ul>
    <li><strong>Standard handling:</strong> 24–48 business hours after payment confirmation.</li>
    <li><strong>Peak seasons:</strong> +1–3 business days.</li>
    <li><strong>Pre-orders/backorders:</strong> lead time shown on the product page; we may split shipments.</li>
    <li>Orders placed after <strong>2pm (local warehouse time)</strong> process next business day.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3) Carriers & Options</h2>
  <ul>
    <li><strong>Domestic:</strong> USPS, UPS, FedEx (service varies by checkout selection).</li>
    <li><strong>International:</strong> USPS International, DHL/UPS/FedEx (subject to availability).</li>
    <li><strong>Signature:</strong> may be offered for higher-value orders.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">4) Indicative Transit Times (ex-handling)</h2>
  <table style="width:100%; border-collapse:collapse; font-size:14px;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Zone</th>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">Service</th>
        <th style="border-bottom:1px solid #ddd; text-align:left; padding:8px;">ETA</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Contiguous U.S.</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Ground</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">2–5 business days</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">Contiguous U.S. (Express)</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">2-Day / Next-Day</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">1–2 business days</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee; padding:8px;">AK/HI/PR</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">Ground/Air</td>
        <td style="border-bottom:1px solid #eee; padding:8px;">3–7 business days</td>
      </tr>
      <tr>
        <td style="padding:8px;">International</td>
        <td style="padding:8px;">Standard / Express</td>
        <td style="padding:8px;">5–15 business days</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top:8px; font-size:13px; color:#555;"><em>Times are estimates and can vary due to weather, customs, or peak demand.</em></p>

  <h2 style="font-size:20px; margin-top:30px;">5) Shipping Fees, Taxes</h2>
  <ul>
    <li>Rates are calculated at checkout based on destination, weight/volume, and service.</li>
    <li><strong>Free standard shipping</strong> from <strong>$XX.XX</strong> (contiguous U.S.).</li>
    <li>Sales tax may apply according to state/local rules.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">6) Address Issues & PO Boxes</h2>
  <ul>
    <li>Verify your address; after fulfilment begins, changes aren’t guaranteed.</li>
    <li>PO Boxes are usually served by USPS only.</li>
    <li>Re-shipping due to incorrect/incomplete addresses may incur fees.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7) Duties & Customs (International)</h2>
  <p>International recipients may owe duties, taxes, and brokerage fees according to the destination’s regulations.</p>

  <h2 style="font-size:20px; margin-top:30px;">8) Lost, Damaged, or Stolen</h2>
  <ul>
    <li><strong>Delivered but not received:</strong> check mailbox/porch/neighbours; notify us within <strong>72h</strong>.</li>
    <li><strong>Damaged:</strong> refuse or note damage with the carrier; contact us within <strong>48h</strong> with photos.</li>
    <li><strong>No updates:</strong> contact us after <strong>7 business days</strong> for a carrier investigation (5–15 days).</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">9) Contact</h2>
  <p>📧 <a href="mailto:shipping@service-client.com">shipping@service-client.com</a></p>

  <h2 style="font-size:20px; margin-top:30px;">10) Updates</h2>
  <p><em>Last updated: 30 October 2025</em></p>
</section>
      `
    },
    return: {
      title_policy: "Returns & Refunds Policy",
      text_policy: `
<section class="return-policy" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">
  <p>
    This policy sets out return, exchange, and refund procedures for U.S. customers. Federal law does not mandate a universal cooling-off period for online retail; however, we provide a fair returns window described below.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Return Window</h2>
  <p>
    Returns are accepted within <strong>30 days</strong> of delivery for most items. Items must be <strong>new, unused, unwashed</strong>, and in original packaging with tags/accessories.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">2) Non-Returnable Items</h2>
  <ul>
    <li>Personalised items, hygiene-sensitive products, and perishables (unless defective).</li>
    <li>Free gifts, samples, or promotional items.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">3) RMA Procedure</h2>
  <ol>
    <li>Email <a href="mailto:returns@service-client.com">returns@service-client.com</a> to obtain an <strong>RMA</strong> and return address.</li>
    <li>Pack securely with all components and the order reference.</li>
    <li>Use a tracked method (USPS/UPS/FedEx) and keep proof of postage.</li>
  </ol>

  <h2 style="font-size:20px; margin-top:30px;">4) Return Shipping Costs</h2>
  <ul>
    <li>Customer pays return postage unless we made an error or the item is defective.</li>
    <li>For defects/our error, we will cover reasonable return costs after validation.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5) Refunds</h2>
  <p>
    After inspection, refunds issue within <strong>5–10 business days</strong> to the original payment method; card issuer times may extend total to <strong>up to 14 days</strong>.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">6) Exchanges</h2>
  <ul>
    <li>Exchanges are subject to stock availability; otherwise, a refund will be processed.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">7) Damaged/Incorrect Items</h2>
  <p>
    Report within <strong>48h</strong> of delivery with photos of packaging and item. We will arrange replacement, repair, or refund.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">8) Non-Delivery or Lost</h2>
  <p>
    If marked delivered but not received, notify us within <strong>72h</strong>. For stalled tracking, contact us after <strong>7 business days</strong> for investigation (5–15 days).
  </p>

  <h2 style="font-size:20px; margin-top:30px;">9) Partial Refunds & Shipping Fees</h2>
  <ul>
    <li>Only the returned item is refunded when an order contains multiple items.</li>
    <li>Original shipping charges may be non-refundable unless required by law or due to our error.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">10) Contact</h2>
  <p>
    📧 <a href="mailto:returns@service-client.com">returns@service-client.com</a><br>
    📬 Returns Department, United States
  </p>

  <h2 style="font-size:20px; margin-top:30px;">11) Updates</h2>
  <p><em>Last updated: 30 October 2025</em></p>
</section>
      `
    },
    terms: {
      title_policy: "Terms of Use",
      text_policy: `
<section class="terms-of-use" style="font-family:'Open Sans', sans-serif; line-height:1.7; color:#333; max-width:900px; margin:0 auto; padding:40px 20px;">

  <p>
    These Terms govern your access to and use of this website and services. By using the site, you accept these Terms.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">1) Site Purpose</h2>
  <p>The site provides information and e-commerce services for consumer products.</p>

  <h2 style="font-size:20px; margin-top:30px;">2) Acceptance & Changes</h2>
  <p>Use of the site implies acceptance. We may modify these Terms; the online version at the time of use applies.</p>

  <h2 style="font-size:20px; margin-top:30px;">3) Access & Availability</h2>
  <p>Available 24/7 except for maintenance or events beyond our control. We are not liable for interruptions or delays.</p>

  <h2 style="font-size:20px; margin-top:30px;">4) Accounts</h2>
  <ul>
    <li>You are responsible for maintaining the confidentiality of your credentials.</li>
    <li>Notify us immediately of any unauthorised use.</li>
  </ul>

  <h2 style="font-size:20px; margin-top:30px;">5) Content & Accuracy</h2>
  <p>We strive for accuracy but do not guarantee error-free content or uninterrupted service.</p>

  <h2 style="font-size:20px; margin-top:30px;">6) Intellectual Property</h2>
  <p>All site materials are protected. Reproduction or use without prior written permission is prohibited.</p>

  <h2 style="font-size:20px; margin-top:30px;">7) Links to Third Parties</h2>
  <p>We are not responsible for third-party sites’ content, practices, or policies.</p>

  <h2 style="font-size:20px; margin-top:30px;">8) Privacy</h2>
  <p>Personal information is processed under our <a href="/pages/privacy-policy">Privacy Policy</a> and applicable U.S. state laws.</p>

  <h2 style="font-size:20px; margin-top:30px;">9) Governing Law</h2>
  <p>
    These Terms are governed by the laws of the State of <strong>[Your State]</strong>, without regard to conflict-of-law principles.
    Venue and jurisdiction lie in the courts located in <strong>[Your County/State]</strong>, unless consumer protection laws provide otherwise.
  </p>

  <h2 style="font-size:20px; margin-top:30px;">10) Contact</h2>
  <p>📧 <a href="mailto:legal@service-client.com">legal@service-client.com</a></p>

  <h2 style="font-size:20px; margin-top:30px;">11) Updates</h2>
  <p><em>Last updated: 30 October 2025</em></p>
</section>
      `
    }
  }

};


const files = [
  {name:"Header", id:"header_template"},
  {name:"Menu", id:"menu_store"},
  {name:"Cart", id:"cart_template"},
  {name:"Footer", id:"footer_template"},
  {name:"Home", id:"home_template"},
  {name:"Collection", id:"collection_template"},
  {name:"Product", id:"product_template"},
  {name:"Order", id:"order_template"},
]

const options_layout = [
  {key:"First (visitante liberado)", value:"first"},
  {key:"Second (visitante filtrado)", value:"second"},
];

// ---------------------------------------------------------------- políticas por loja
const policy_files = [
  {id:"privacy", name:"Privacidade"},
  {id:"shipping", name:"Envio"},
  {id:"return", name:"Devolução e reembolso"},
  {id:"terms", name:"Termos de serviço"},
];

const isPolicyKey = (key)=> policy_files.some(file=> file.id == key);

// Padrão por país da loja; sem texto para o país (CH, DE, BE, MX...) usa o do idioma; por último, GB
const defaultPoliciesFor = (store)=>{
    const byIdioma = {FR:"FR", EN:"GB", DE:"GB", NL:"GB", ES:"ES"};
    const countryCode = store.country?.[0];

    return policies[countryCode] || policies[byIdioma[store.idioma]] || policies["GB"];
};

// Monta as quatro políticas da loja: texto gravado em `policies.<chave>` ou, se vazio, o padrão.
// `source` diz de onde veio ("store" | "default") para o admin mostrar.
const resolvePolicies = (store)=>{
    const defaults = defaultPoliciesFor(store);
    const own = store.policies || {};
    let result = {};

    policy_files.forEach(({id})=>{
        const custom = own[id];
        const base = defaults[id] || {title_policy:"", text_policy:""};

        result[id] = custom?.text_policy
            ? {title_policy:custom.title_policy || base.title_policy, text_policy:custom.text_policy, source:"store"}
            : {...base, source:"default"};
    });

    return result;
};

const getPolicy = async({idStore, key})=>{
    try{

        if(!isPolicyKey(key)){
            throw(statusHandler.newResponse(400, `Política inválida: ${key}`));
        }

        const store = await findById(Store, idStore);

        if(!store){
            throw(statusHandler.newResponse(404, "Loja não encontrada"));
        }

        const policy = resolvePolicies(store.toJSON())[key];

        return statusHandler.newResponse(200, {key, name:policy_files.find(file=> file.id == key).name, ...policy});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Grava a política da loja; título e texto vazios removem a personalização (volta ao padrão do país)
const changePolicy = async({idStore, key}, {title_policy = "", text_policy = ""} = {})=>{
    try{

        if(!isPolicyKey(key)){
            throw(statusHandler.newResponse(400, `Política inválida: ${key}`));
        }

        const empty = !String(text_policy).trim() && !String(title_policy).trim();
        const update = empty
            ? {$unset:{[`policies.${key}`]:""}}
            : {[`policies.${key}`]:{title_policy:String(title_policy).trim(), text_policy}};

        await updateById(Store, idStore, update);

        return statusHandler.newResponse(200, empty ? "Política restaurada para o padrão" : "Política salva");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    layoutsToUpdate,
    createStore,
    getAllStores,
    getStoreById,
    getConfigStore,
    changeStore,
    removeStore,
    getFile,
    changeFile,
    options_country,
    options_moeda,
    options_devices,
    options_idioma,
    policies,
    files,
    options_layout,
    resolveLayout,
    useLayout,
    useCountry,
    policy_files,
    resolvePolicies,
    getPolicy,
    changePolicy
};
