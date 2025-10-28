const choseTexts = ()=>{
    try{

        const texts = ["Découvrir tous les modèles !"];

    }catch(error){
        console.log(error);
    }
}


$(document).ready(function(){

    $("[c-id=close-menu]").on("click", (e)=>{
        $("[c-id=modal-menu]").modal("hide");
        $(e.target).addClass("none");
        $("[c-id=open-menu]").removeClass("none");

    })

    $("[c-id=open-menu]").on("click", (e)=>{

        const modal = new bootstrap.Modal(document.getElementById('modal-menu'), {
            backdrop: false,
            focus: false,
            keyboard: false
          });
          modal.show();
        $(e.target).addClass("none");
        $("[c-id=close-menu]").removeClass("none");
        
    });


});
