const { Domain } = require("../domain/domain.schema");
const statusHandler = require("../helpers/helpers.statusHandler");
const { Product, Collection } = require("../product/product.schema");
const { findAll, findById, save, findOne, updateById } = require("../query");
const { Store } = require("./store.schema");


const createStore = async(store)=>{
    try{

        await save(Store, store);

        return statusHandler.newResponse(200, "ok");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getAllStores = async()=>{
    try{

        const stores = await findAll(Store);

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

const changeStore = async(id, store)=>{
    try{

        await updateById(Store, id, store);

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
            other_products:'Découvrez également'

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
            other_products: 'You may also like'
        },
        cart: {
            title: 'Cart',
            btn_checkout: 'Proceed to checkout',
            btn_add_items: 'Add more items'
        },
        home: {
            collection: 'All collections'
        },


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
            other_products: 'Das könnte Ihnen auch gefallen'
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
            other_products: 'Misschien ook interessant voor jou'
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

const getConfigStore = async(id, type)=>{
    try{

        let idStore = null;

        if(type == "product"){
            const {store} = await findById(Product, id, {store:1});
            idStore = store;
        }

        if(type == "collection"){
            const {store} = await findById(Collection, id, {store:1});
            idStore = store;
        }

        if(type == 'domain'){
            const {store} = await findOne(Domain, {domain:id}, {store:1});
            idStore = store;
        }

        if(idStore){
            let config = await findById(Store, idStore);
            config = config.toJSON();

            config.idioma = idioma[config['idioma']];
            config.moeda = moeda[config['moeda']];
            config.title = config['name'];

            delete config['name'];

            return config;  
        }


    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}


const options_country = [
    {
        key:"França",
        value:"FR"
    },
    {
        key:"Belgica",
        value:"BE"
    },
    {
        key:"Reino Unido",
        value:"GB"
    },
    {
        key:"Estados Unidos",
        value:"US"
    },
    {
        key:"Alemanha",
        value:"DE"
    },
    {
        key:"Suiça",
        value:"CH"
    },
    {
        key:"Holanda",
        value:"NL"
    },
];


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
    }
];


module.exports = {
    createStore,
    getAllStores,
    getStoreById,
    getConfigStore,
    changeStore,
    options_country,
    options_moeda,
    options_idioma

}
