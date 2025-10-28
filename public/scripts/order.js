let loadingTextActive = false;
let loadingTextActive_2 = false;
let loadingTextActive_3 = false;

let last_position = 0;

const loadingText = ()=>{
    const texts = [
        'Rechercher des informations.',
        'Rechercher des informations..',
        'Rechercher des informations...',
    ];

    const texts_2 = [
        'Service de démarrage.',
        'Service de démarrage..',
        'Service de démarrage...',
    ];

    const texts_3 = [
        '<b>Élodie</b> tape.',
        '<b>Élodie</b> tape..',
        '<b>Élodie</b> tape...',
    ];

    let text = texts;

    if(loadingTextActive_2){
        text = texts_2
    }

    if(loadingTextActive_3){
        text = texts_3
    }

    !loadingTextActive_3 ? $("[c-id=text-loading]").text(text[last_position]) : $("[c-id=text-loading]").html(text[last_position])

    if(last_position > text.length){
        last_position = 0;

        return;
    }

    last_position+=1;

};

const listText = async(ctx, text)=>{
    try{

        let x = 0;
        while(text.length > x){

            const current = $(ctx).find("[c-id=chat]").text() || '';
            const newText = current+text[x];

            await delay(100);
            $(ctx).find("[c-id=chat]").text(newText);

            x++;
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const getTextAboutOrder = async(ctx)=>{
    try{

        const url = window.location.pathname;
        const idOrder = url.split('/').pop();

        loadingTextActive_2 = true;
        last_position = 0;

        const response = await request("GET", `/order/support/${idOrder}`);

        if(response.status == 200){
            
            $(ctx).find("[c-id=spinner-option]").addClass("none");
            loadingTextActive_2 = false;
            loadingTextActive_3 = true;
            last_position = 0;
            await listText(ctx, response.content);
            loadingTextActive = false;
            loadingTextActive_3 = false;
            $(ctx).find("[c-id=text-loading]").html("<b>Élodie:</b>");

        }

        

    }catch(error){
        loadingTextActive = false;
        loadingTextActive_3 = false;
        loadingTextActive_2 = false;
        $(ctx).find("[c-id=text-loading]").html("");

        throw(statusHandler.messageError(error));
    }
};

const listDefaultText = async(ctx)=>{
    try{

        const defaultText = `
            Informations concernant les échanges de taille ou de couleur

            Toutes les demandes liées à un changement de taille ou de couleur doivent être traitées directement par e-mail.
            Merci d’envoyer un message à l’adresse suivante : service@galerieslaclub.com

            Important :
            Veuillez indiquer le numéro de votre commande dans l’objet de l’e-mail et préciser le motif de votre demande.

            Si votre commande est déjà en cours de livraison (c’est-à-dire si le numéro de suivi est disponible ou si le produit est déjà pris en charge par le transporteur), le changement ne pourra se faire qu’à travers un échange du produit après réception.

            Merci de votre compréhension et de votre confiance 
            — L’équipe suporte
        `
        let x = 0;
        
        $(ctx).find("[c-id=spinner-option]").addClass("none");
        $("[c-id=text-loading]").text("")
        loadingTextActive_3 = true;

        while(defaultText.length > x){

            const current = $(ctx).find("[c-id=chat]").text() || '';
            const newText = current+defaultText[x];

            await delay(100);
            $(ctx).find("[c-id=chat]").text(newText);

            x++;
        }

        loadingTextActive_3 = false;
        loadingTextActive = false;
        $(ctx).find("[c-id=text-loading]").html("<b>Élodie:</b>");


    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getImages = async()=>{
    try{

        const file = $("[c-id=form]").find("[c-id=images]").prop("files");
        
        let imgs = [];

        if(file.length){

            for(i in file){

                if(file[i].size){
                    const base64 = await convertFileToBase64(file[i]);
                    imgs.push(base64);
                }
                
            }
            
        }
        
        return imgs;
    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const saveForm = async()=>{
    try{

        const url = window.location.pathname;
        const idOrder = url.split('/').pop();

        const ctx = "[c-id=form]";

        const email = $(ctx).find("[c-id=email]").val();
        const justification = $(ctx).find("[c-id=justification]").val();
        const images = await getImages()

        if(email && justification && images.length){

            const body = {
                email,
                justification,
                images,
                idOrder
            };
            
            const response = await request("POST", "/order/charge", body);

            if(response.status == 200){
                $(ctx).html("");
                $(ctx).html("<p>Votre formulaire a été envoyé avec <b>succès</b>. Vous recevrez prochainement des mises à jour. Nous vous invitons à revenir sur ce même formulaire dans les prochaines 24 heures pour consulter les informations complémentaires.</p>");
                await delay(4000);
                window.location.href = `/order/${idOrder}`;
            }
        }


    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getInformations = async(option, text)=>{
    try{

        const ctx = "[c-id=box-info]";

        $(ctx).find("[c-id=text-option]").text(text);
        $(ctx).find("[c-id=spinner-option]").removeClass("none");
        $(ctx).find("[c-id=text-loading]").removeClass("none");
        loadingTextActive = true;

        if(option == 1 || option == 2){
            await delay(1500);

            return await getTextAboutOrder(ctx);
        }

        if(option == 3){
            await delay(1500);
            
            return await listDefaultText(ctx);
        }

        if(option == 4 || option == 5){
            await delay(1500);
            $(ctx).find("[c-id=text-option]").text(text);
            $(ctx).find("[c-id=spinner-option]").addClass("none");
            $(ctx).find("[c-id=text-loading]").text("");
            loadingTextActive = false;
            $("[c-id=form]").removeClass("none");

        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

setInterval(()=>{

    if(loadingTextActive){
        loadingText();
    }

}, 500);

$(document).ready(function(){

    $("[c-id=save-form]").on("click", async()=>{
        try{

            await saveForm();

        }catch(error){
            statusHandler.messageError(error);
        }
    })

    $("[c-id=check]").on("click", async(e)=>{
        try{    

            const option = $("[c-id=option-problem]").val();
            const text = $("[c-id=option-problem] option:selected").text();

            $(e.target).addClass("none");

            return await getInformations(option, text);

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=btn-problem-order]").on("click", ()=>{
        try{

            $("[c-id=modal-problem-order]").modal("show");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=close-modal]").on("click", (e)=>{
        try{

            $("[c-id=modal-problem-order]").modal("hide");
            $("[c-id=modal-problem-order]").find("[c-id=text-option]").text("");
            $("[c-id=modal-problem-order]").find("[c-id=text-loading]").text("");
            $("[c-id=modal-problem-order]").find("[c-id=chat]").text("");
            $("[c-id=modal-problem-order]").find("[c-id=check]").removeClass("none");
            !$("[c-id=modal-problem-order]").find("[c-id=form]").hasClass("none") && $("[c-id=modal-problem-order]").find("[c-id=form]").addClass("none")


            

            

        }catch(error){
            statusHandler.messageError(error);
        }
    });

});