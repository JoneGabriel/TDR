const request = async(method, route, body = null)=>{
  try{

      let headers = {};
      headers[ "Content-Type"] =  "application/json";
      let options = {
          method:method, 
          headers
      };
      body ? options["body"] = JSON.stringify(body) : null;

      const urlBase = window.location.protocol + "//" + window.location.host;
      const url = urlBase + route;
      const resposta = await fetch(url, options)
      .then(res=>{
          
          return res.json();
      }).then(resp=>{

          // sessão do admin expirou ou inválida: volta para o login
          if(resp?.status == 401 && window.location.pathname.startsWith("/admin")){
              window.location.href = "/admin/login";
          }

          return resp;
      });

      return resposta;
  }catch(error){  
      console.log(error);
  }
};

// Confirmação para ações destrutivas do admin (modal de src/template/confirm-admin.twig).
// Resolve true se o usuário confirmar. Fora do admin (sem o modal) cai no confirm() nativo.
const confirmAction = ({title = "Confirmar exclusão", message = "Essa ação não pode ser desfeita.", okText = "Excluir"} = {})=>{

  return new Promise(resolve=>{
    const modal = $("[c-id=modal-confirm]");

    if(!modal.length){
      return resolve(window.confirm(message));
    }

    modal.find("[c-id=confirm-title]").text(title);
    modal.find("[c-id=confirm-message]").text(message);
    modal.find("[c-id=confirm-ok]").text(okText);

    let done = false;

    const finish = (value)=>{
      if(done){
        return;
      }

      done = true;
      modal.off(".confirm");
      modal.modal("hide");
      resolve(value);
    };

    modal.on("click.confirm", "[c-id=confirm-ok]", ()=> finish(true));
    modal.on("click.confirm", "[c-id=confirm-cancel]", ()=> finish(false));
    modal.on("hidden.bs.modal.confirm", ()=> finish(false));
    modal.modal("show");
  });
};

const convertFileToBase64 = (file)=>{

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.readAsDataURL(file);
    reader.onloadend = () => {

      const base64String = reader.result;

      resolve(base64String);
    };

    reader.onerror = (error) => reject(error);
  });

};


const delay = (ms)=> {
  return new Promise(resolve => setTimeout(resolve, ms));
}; 