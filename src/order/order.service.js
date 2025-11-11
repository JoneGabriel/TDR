const statusHandler = require("../helpers/helpers.statusHandler");
const {
    request,
    isEmpty
} = require("../helpers/helpers.global");
const { Shopify } = require("../shopify/shopify.schema");
const { findOne, save, findAll } = require("../query");

const {
  Charge
} = require("./order.schema");

const getDomainAndToken = async(urlStore)=>{
  try{

    urlStore = `${urlStore}.myshopify.com`

    const storeInfo = await findOne(Shopify, {url:urlStore});
    
    if(!isEmpty(storeInfo)){
      
      return {domain:urlStore, token:storeInfo.token_admin};
    }


  }catch(error){
    throw(statusHandler.serviceError(error));
  }
};

const timeZoneCountry = {
  "GB":"Europe/London",
  "US":"America/New_York",
  "FR":"Europe/Paris"
};

const getOrderShopify = async (orderId, {urlStore}, country) => {
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
      
      const timeZone = timeZoneCountry[country];

      let res = typeof response === "string" ? JSON.parse(response) : response;
      const formatterParis = new Intl.DateTimeFormat("en-US", {
        timeZone,
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

const getPromptByIdioma = (country, variables)=>{
  try{

    const {
      name,
      createdAt,
      trackingCode
    } = variables;
   
    const countrys = {
  FR: {
    prompt_1: [
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
    ],
    prompt_2: [
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
  },

  GB: {
    prompt_1: [
      {
        role: "system",
        content:
          "You are a customer service assistant for a British online store. Your name is 'Emily'. You must always write in polite, friendly, empathetic and professional British English. The message should feel like a real chat conversation between Emily and a customer."
      },
      {
        role: "user",
        content: `Create a chat message where Emily responds to a concerned customer about their order. Here are the order details:

- Order ID: ${name}
- Order date: ${createdAt} (mm/dd/yyyy)

Use this information to:
1. Reassure the customer by explaining that the courier experienced a slight delay in processing their order, but the parcel is now on its way and should arrive within the next few days.
2. Mention that it is currently at a logistics centre located in a believable UK city (randomly chosen to sound natural, for example: 'the logistics centre in Luton' or 'in Birmingham').
3. End the message kindly and offer a discount code 'LOYALTY' for their next order.
4. The message should sound like a real chat conversation, with a greeting, a reassuring tone, and end with a signature '– Emily'.`
      }
    ],
    prompt_2: [
      {
        role: "system",
        content: `You are a customer service assistant for a British online store. Your name is 'Emily'. You must always write in polite, friendly, empathetic and professional British English. The message should feel like a real chat conversation between Emily and a customer.`
      },
      {
        role: "user",
        content: `Create a chat message where Emily responds to a customer about their already shipped order. Here are the order details:
- Order ID: ${name}
- Order date: ${createdAt} (mm/dd/yyyy)
- Tracking code: ${trackingCode}

Use this information to:
1. Inform the customer that their parcel is already on its way to their address.
2. Mention that it has just passed through the distribution centre of a believable UK city (for example: Luton, Birmingham, Manchester, Bristol, or Leeds).
3. Reassure the customer that their parcel should arrive very soon.
4. Include the tracking code in the message (e.g., 'Here is your tracking code: ${trackingCode}').
5. End with a kind note and offer the discount code 'LOYALTY'.
6. The message should sound like a genuine chat conversation, with a warm greeting and a closing signature '– Emily'.`
      }
    ]
  },

  US: {
    prompt_1: [
      {
        role: "system",
        content:
          "You are a customer service assistant for an American online store. Your name is 'Emily'. You must always write in polite, friendly, empathetic and professional American English. The message should feel like a real chat conversation between Emily and a customer."
      },
      {
        role: "user",
        content: `Create a chat message where Emily responds to a concerned customer about their order. Here are the order details:
- Order ID: ${name}
- Order date: ${createdAt} (mm/dd/yyyy)

Use this information to:
1. Reassure the customer by explaining that the shipping carrier experienced a slight delay while processing their order, but the package is now on its way and should arrive within the next few days.
2. Mention that it is currently at a logistics facility located in a believable U.S. city (randomly chosen to sound natural, for example: 'the distribution center in Dallas' or 'in Chicago').
3. End the message kindly and offer a discount code 'LOYALTY' for their next order.
4. The message should sound like a real chat conversation, with a friendly greeting, a reassuring tone, and end with a signature '– Emily'.`
      }
    ],
    prompt_2: [
      {
        role: "system",
        content:
          "You are a customer service assistant for an American online store. Your name is 'Emily'. You must always write in polite, friendly, empathetic and professional American English. The message should feel like a real chat conversation between Emily and a customer."
      },
      {
        role: "user",
        content: `Create a chat message where Emily responds to a customer about their already shipped order. Here are the order details:
- Order ID: ${name}
- Order date: ${createdAt} (mm/dd/yyyy)
- Tracking code: ${trackingCode}

Use this information to:
1. Inform the customer that their package is already on its way to their home.
2. Mention that it has just passed through a logistics facility located in a believable U.S. city (for example: Dallas, Chicago, Atlanta, Phoenix, or Denver).
3. Reassure the customer that their package should arrive very soon.
4. Include the tracking code in the message (e.g., 'Here is your tracking code: ${trackingCode}').
5. End with a friendly closing and offer the discount code 'LOYALTY' for their next purchase.
6. The message should sound like a genuine chat conversation, with a warm greeting, a reassuring tone, and a closing signature '– Emily'.`
      }
    ]
  }
    };

    
    return countrys[country];

  }catch(error){
    throw(statusHandler.serviceError(error));
  }
}

const createTextGpt = async(idOrder, {urlStore}, country)=>{
  try{

    let {name, fulfillments, createdAt} = await getOrderShopify(idOrder, {urlStore}, country);
    const apiKey = process.env.API_GPT;

    let variables = {
      name,
      createdAt,
      trackingCode:""
    }

    const {prompt_1} = getPromptByIdioma(country, variables);
    
    let payload = { 
      model: "gpt-5",
      temperature: 1,
      messages:prompt_1
    };

    if(fulfillments.length){
      
      const {number:trackingCode } = fulfillments?.[0]?.trackingInfo?.[0];

      variables = {
        name,
        createdAt,
        trackingCode
      };

      const {prompt_2} = getPromptByIdioma(country, variables);
   
      payload['messages'] = prompt_2;
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

const saveChange = async(charge, country)=>{
  try{

    const timeZone = timeZoneCountry[country]
    const dateParis = (new Date(Date.now())).toLocaleString("en-US", {timeZone});
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

const getDiffInDays = (createdAt, country) => {
  try {
    
    const timeZone = timeZoneCountry[country]
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone})
    );

    const created = new Date(createdAt);

  
    const diffMs = now - created;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  } catch (error) {
    throw(statusHandler.newResponse(error))
  }
};

const getCharges = async(idOrder, country)=>{
  try{
    
    const charge = await findOne(Charge, {idOrder});

    const AllLabels = {
    "FR":[
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
    ],

    "GB":[
      { 
        days:-1,
        title: "Under Internal Review",
        description:
          "The case is currently being evaluated by our internal teams and systems. Once relevant updates are available, the status will be automatically adjusted."
      },
      { 
        days:2,
        title: "Awaiting Institution Response",
        description:
          "The case has been forwarded to the card issuer and an official response is pending. This typically occurs within standard operational timelines."
      },
      { 
        days:5,
        title: "Technical Review in Progress",
        description:
          "We are conducting technical and documentation checks related to this transaction. The analysis follows our internal validation procedures."
      },
      {
        days:9,
        title: "Data Verification Phase",
        description:
          "The dispute request has entered the data validation stage with financial platforms. Timelines may vary depending on ongoing case volume."
      },
      { 
        days:12,
        title: "Awaiting Banking System Update",
        description:
          "We are awaiting an official update from the issuing institution. Once information syncs, the status will update automatically."
      },
      { 
        days:15,
        title: "Active Monitoring",
        description:
          "The case remains under continuous monitoring by our team. No new information is available at the moment, but any development will be reflected in real time."
      }
    ],

    "US":[
      { 
        days:-1,
        title: "Internal Review in Progress",
        description:
          "The case is currently being reviewed by our internal teams and automated systems. The status will be updated as soon as new information becomes available."
      },
      { 
        days:2,
        title: "Pending Issuer Response",
        description:
          "The case has been submitted to the card issuer, and we are awaiting their official response. This typically aligns with standard processing timelines."
      },
      { 
        days:5,
        title: "Technical Review",
        description:
          "A technical and documentation review is underway for this transaction. The process follows our established internal verification steps."
      },
      {
        days:9,
        title: "Validation Stage",
        description:
          "The dispute request is in the data validation stage with financial platforms. Response times may vary depending on case volume."
      },
      { 
        days:12,
        title: "Bank Update Pending",
        description:
          "We are waiting for the issuing bank’s system to provide an official update. The status will refresh automatically once updated."
      },
      { 
        days:15,
        title: "Ongoing Monitoring",
        description:
          "The case remains under active monitoring. No new updates are available at the moment, but changes will be reflected in real time."
      }
    ],

    "DE":[
      { 
        days:-1,
        title: "Interne Prüfung",
        description:
          "Der Vorgang wird derzeit von unseren internen Teams und Systemen geprüft. Sobald relevante Informationen vorliegen, wird der Status automatisch aktualisiert."
      },
      { 
        days:2,
        title: "Warten auf Antwort der Bank",
        description:
          "Der Vorgang wurde an den Kartenaussteller übermittelt und wir warten auf eine offizielle Rückmeldung. Dies erfolgt in der Regel innerhalb der üblichen Bearbeitungszeiten."
      },
      { 
        days:5,
        title: "Technische Überprüfung",
        description:
          "Wir führen eine technische und dokumentarische Überprüfung dieser Transaktion durch. Die Analyse folgt unseren internen Validierungsprozessen."
      },
      {
        days:9,
        title: "Validierungsphase",
        description:
          "Die Anfrage befindet sich in der Datenvalidierungsphase bei den Finanzplattformen. Die Bearbeitungszeit kann je nach aktuellem Arbeitsaufkommen variieren."
      },
      { 
        days:12,
        title: "Warten auf Bankaktualisierung",
        description:
          "Wir warten auf eine offizielle Aktualisierung im System des Herausgebers. Sobald die Informationen synchronisiert sind, wird der Status automatisch angepasst."
      },
      { 
        days:15,
        title: "Aktive Überwachung",
        description:
          "Der Vorgang wird weiterhin von unserem Team aktiv überwacht. Derzeit liegen keine neuen Informationen vor, aber Änderungen werden in Echtzeit angezeigt."
      }
    ]
  };

    if(charge){
      let response = [];

      const {createdAt} = charge;
      const diff = getDiffInDays(createdAt, country);
      
      AllLabels[country].forEach(value=>{
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