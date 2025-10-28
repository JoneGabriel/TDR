const statusHandler = require("../helpers/helpers.statusHandler");
const {
    request,
    isEmpty
} = require("../helpers/helpers.global");
const { Store } = require("../shopify/shopify.schema");
const { findOne, save, findAll } = require("../query");

const {
  Charge
} = require("./order.schema");

const getDomainAndToken = async(urlStore)=>{
  try{

    const storeInfo = await findOne(Store, {url:urlStore});
    
    if(!isEmpty(storeInfo)){

      return {domain:urlStore, token:storeInfo.token_admin};
    }


  }catch(error){
    throw(statusHandler.serviceError(error));
  }
};

const getOrderShopify = async (orderId, {urlStore}) => {
    try {

      const gid = `gid://shopify/Order/${orderId}`;
  
      const query = `
        query {
          order(id: "${gid}") {
            id
            name                  
            legacyResourceId      
            createdAt
            
            displayFinancialStatus      # PAID, PENDING, REFUNDED…
            displayFulfillmentStatus    # FULFILLED, UNFULFILLED…
            fulfillments {
                trackingInfo {
                    number
                    url
                    company
                }
            }
    
            
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
              customer {
        id
        firstName
        lastName
        email
      }
            lineItems(first: 100) {
              edges {
                node {
                  title
                  quantity
                  sku
                  variant {
                    id
                    title
                    image {
                      url
                      altText
                    }
                   
                  }
                }
              }
            }
          }
        }
      `;
      const {domain, token} = await getDomainAndToken(urlStore);
      const response = await request(
        "POST",
        `https://${domain}/admin/api/2023-10/graphql.json`,
        { query },
        {
          "X-Shopify-Access-Token": token
        }
      );
     
      let res = typeof response === "string" ? JSON.parse(response) : response;
      const formatterParis = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
     
      if(!isEmpty(res?.data?.order?.createdAt)){
          let newDate = formatterParis.format(new Date(res?.data?.order?.createdAt));

          res.data.order.createdAt = newDate
      }
      
      return res.data.order;
  
    } catch (error) {
      throw statusHandler.serviceError(error);
    }
};

const createTextGpt = async(idOrder, {urlStore})=>{
  try{

    let {name, fulfillments, createdAt} = await getOrderShopify(idOrder, {urlStore});
    const apiKey = process.env.API_GPT;
  
    let payload = { 
      model: "gpt-5",
      temperature: 1,
      messages: [
        {
          role: "system",
          content:
            "Tu es une assistante du service client d'une boutique en ligne française. Ton prénom est 'Élodie'. Tu dois toujours écrire en français, avec un ton chaleureux, empathique et professionnel. Le texte doit ressembler à une vraie conversation de chat entre Élodie et un client."
        },
        {
          role: "user",
          content: `Crée un message de chat où Élodie répond à un client inquiet concernant sa commande. Voici les informations de la commande :

      - ID de commande : ${name}
      - Date de commande : ${createdAt} mm/dd/yyyy

        Utilise ces informations pour :
        1. Rassurer le client en expliquant que le transporteur a eu un léger retard dans le traitement de sa commande, mais que le colis est maintenant en route et devrait arriver dans les prochains jours.
        2. Mentionner qu’il est actuellement dans un centre logistique situé dans une ville crédible en France (choisie au hasard pour rendre la réponse naturelle, par exemple : 'le centre logistique de Lille' ou 'de Lyon').
        3. Terminer le message avec une formule aimable et offrir un code de réduction 'FIDELITE' pour la prochaine commande.
        4. Le message doit ressembler à une vraie conversation de chat, avec une salutation, un ton rassurant et une signature '— Élodie'.`
            }
      ]
    };

    if(fulfillments.length){
      
      const {number:trackingCode } = fulfillments?.[0]?.trackingInfo?.[0];

      payload['messages'] = [
        {
          role: "system",
          content:
            "Tu es une assistante du service client d'une boutique en ligne française. Ton prénom est 'Élodie'. Tu dois toujours écrire en français, avec un ton chaleureux, empathique et professionnel. Le texte doit ressembler à une vraie conversation de chat entre Élodie et un client."
        },
        {
          role: "user",
          content: `Crée un message de chat où Élodie répond à un client concernant sa commande déjà expédiée. Voici les informations de la commande :

        - ID de commande : ${name}
        - Date de commande : ${createdAt} mm/dd/yyyy
        - Code de suivi : ${trackingCode}

        Utilise ces informations pour :
        1. Informer le client que le colis est déjà en route vers son domicile.
        2. Mentionner qu’il vient de passer par le centre de distribution d’une ville française crédible et aléatoire (par exemple : Lyon, Bordeaux, Nantes, Toulouse, Lille...).
        3. Rassurer le client que le colis ne devrait plus tarder à arriver.
        4. Inclure le code de suivi dans le message (ex: 'Voici votre code de suivi : ${trackingCode}').
        5. Terminer avec une formule aimable et offrir le code de réduction 'FIDELITE'.
        6. Le message doit ressembler à une vraie conversation de chat, avec une salutation initiale et une signature '— Élodie'.`
        }
      ]
    }

    const response = await request("POST","https://api.openai.com/v1/chat/completions", 
     payload,
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      
    );
    
    return statusHandler.newResponse(200, response.choices[0].message.content);

  }catch(error){
    throw(statusHandler.serviceError(error));
  }
}

const saveChange = async(charge)=>{
  try{

    const dateParis = (new Date(Date.now())).toLocaleString("en-US", { timeZone: "Europe/Paris" });
    charge['createdAt'] = dateParis;
    const {idOrder} = charge;
    const exist = await findOne(Charge, {idOrder});

    if(!exist){
      await save(Charge, charge);
    }
  
    return statusHandler.newResponse(200, 'ok');

  }catch(error){  
    throw(statusHandler.serviceError(error));
  }
};

const getDiffInDays = (createdAt) => {
  try {
    
    const nowParis = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
    );

    const created = new Date(createdAt);

  
    const diffMs = nowParis - created;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  } catch (error) {
    throw(statusHandler.newResponse(error))
  }
};

const getCharges = async(idOrder)=>{
  try{
    
    const charge = await findOne(Charge, {idOrder});

    const labels = [
      { 
        days:-1,
        title: "En cours de traitement interne",
        description:
          "Le dossier est actuellement en cours d’évaluation par nos équipes et systèmes internes. Dès qu’une mise à jour pertinente sera disponible, le statut sera automatiquement ajusté."
      },
      { 
        days:2,
        title: "En attente du retour de l’institution",
        description:
          "Le dossier a été transmis à l’émetteur de la carte et nous attendons une réponse officielle. Ce retour intervient généralement dans les délais opérationnels habituels."
      },
      { 
        days:5,
        title: "En révision technique",
        description:
          "Nous procédons à une vérification technique et documentaire concernant cette transaction. L’analyse suit les étapes internes de validation prévues."
      },
      {
        days:9,
        title: "En phase de validation",
        description:
          "La demande de contestation est entrée dans la phase de validation des données auprès des plateformes financières. Le délai peut varier en fonction du volume d’analyses en cours."
      },
      { 
        days:12,
        title: "En attente de mise à jour bancaire",
        description:
          "Nous attendons la mise à jour officielle dans le système de l’émetteur. Dès que les informations seront synchronisées, le statut sera automatiquement actualisé."
      },
      { 
        days:15,
        title: "Surveillance active",
        description:
          "Le dossier reste sous suivi continu par notre équipe. Pour le moment, aucune nouvelle information n’est disponible, mais toute évolution sera reflétée en temps réel dans ce tableau."
      }
    ];

    if(charge){
      let response = [];

      const {createdAt} = charge;
      const diff = getDiffInDays(createdAt);
      
      labels.forEach(value=>{
        const {days} = value;
        
        if(diff < days){
          return;
        }
        
        let date = createdAt;

        if(days>0){
          date = new Date(createdAt);
          date.setDate(date.getDate()+days);
        }
        delete value['days']

        response.push({
          ...value,
          date
        })
      })

      
      return response;

    }

    return false;

  }catch(error){
    throw(statusHandler.serviceError(error));
  }
};



module.exports = {
    getOrderShopify,
    createTextGpt,
    saveChange,
    getCharges
};