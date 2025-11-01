//chamar função para adicionar produto ao carrinho


(() => {
    const carousel   = document.getElementById('productCarousel');
    const images     = carousel.querySelectorAll('.carousel-img');
    const thumbs     = carousel.querySelectorAll('.thumb');
    const prevBtn    = carousel.querySelector('.nav.prev');
    const nextBtn    = carousel.querySelector('.nav.next');
    let   current    = 0;
  
    
    const show = (index) => {
      
      if (index < 0) index = images.length - 1;
      if (index >= images.length) index = 0;
      
      images[current].classList.remove('active');
      thumbs[current].classList.remove('active');
      images[index].classList.add('active');
      thumbs[index].classList.add('active');
      current = index;
    };
  
   
    prevBtn.addEventListener('click', () => show(current - 1));
    nextBtn.addEventListener('click', () => show(current + 1));
  
   
    thumbs.forEach(thumb =>
      thumb.addEventListener('click', e => show(+e.currentTarget.dataset.index))
    );
  
   
    let startX = 0, isDown = false;
  
    const startDrag = (x) => { isDown = true; startX = x; };
    const endDrag   = (x) => {
      if (!isDown) return;
      const diff = x - startX;
      if (Math.abs(diff) > 50) diff < 0 ? show(current + 1) : show(current - 1);
      isDown = false;
    };
  
    
    carousel.addEventListener('touchstart',  e => startDrag(e.touches[0].clientX), {passive:true});
    carousel.addEventListener('touchend',    e => endDrag(e.changedTouches[0].clientX));
  
    
    carousel.addEventListener('mousedown',   e => startDrag(e.clientX));
    carousel.addEventListener('mouseup',     e => endDrag(e.clientX));
    carousel.addEventListener('mouseleave',  e => endDrag(e.clientX));
})();


const createUniqeuId = ()=>{
  try{

    const uniqueIdTDR = localStorage.getItem('ID_TDR');

    if(uniqueIdTDR){

      return
    };

    const id = Date.now() * (Math.floor(Math.random() * 51));

    localStorage.setItem("ID_TDR", id);

    return;

  }catch(error){
    throw(statusHandler.messageError(error));
  }
};









$(document).ready(function(){

  createUniqeuId();

  $("[c-id=open-info], [c-id=close-info]").on("click", (e)=>{
    try{

      const ctx = $(e.target).closest("[c-id=div-info]");
      const target = $(e.delegateTarget).attr("c-id")

      target == "open-info" ? $(ctx).find("[c-id=close-info]").removeClass("none") : $(ctx).find("[c-id=open-info]").removeClass("none");
      $(e.delegateTarget).addClass("none");
      target == "open-info" ? $(ctx).find("[c-id=info]").removeClass("none") : $(ctx).find("[c-id=info]").addClass("none")

    }catch(error){
      statusHandler.messageError(error);
    }
  });

  $("[c-id=add],[c-id=sub]").on("click", (e)=>{
    try{

      const input = $("[c-id=amount]").val();
      const target = $(e.delegateTarget).attr("c-id");

      if(target == "sub" && input > 1){
        $("[c-id=amount]").val(parseInt(input) - 1);

        return;
      }

      target == "add" &&  $("[c-id=amount]").val(parseInt(input) + 1);

    }catch(error){  
      statusHandler.messageError(error);
    }
  });

  $("select").on("change", (e)=>{
    try{

        const select = $(e.target).val();
 
        $(e.target).prev().find("b").text(select);

    }catch(error){
      statusHandler.messageError(error);
    }
  });

  $("#Couleur,#Color,#Color Harness 1,#Color Harness 2").on("click", "[c-id=option-couleur]", (e)=>{
    try{

      const id = $(e.delegateTarget).attr("id");
      const allOptions = $(`#${id}`).find("[c-id=option-couleur]");
      const value = $(e.currentTarget).attr("value")

      $(allOptions).each(function(){
        $(this).removeClass("option-selected");
      });

      $(e.currentTarget).addClass("option-selected");
      $(e.delegateTarget).prev().find("b").text(value);

    }catch(error){
      statusHandler.messageError(error);
    }
  });

  const thumbnails = document.querySelectorAll('.thumbnail');
  const mainImage = document.getElementById('mainImage');

  thumbnails.forEach(thumb => {

    thumb.addEventListener('click', () => {
      thumbnails.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      mainImage.src = thumb.dataset.full;
    });

  });


  let startX = 0;
  mainImage.addEventListener('mousedown', (e) => {
    startX = e.pageX;
    mainImage.style.cursor = 'grabbing';
  });

  mainImage.addEventListener('mouseup', () => {
    mainImage.style.cursor = 'grab';
  });


  mainImage.addEventListener('dragstart', (e) => {
    e.preventDefault(); 
  });


});

