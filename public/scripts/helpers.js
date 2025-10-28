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

          return resp;
      });

      return resposta;
  }catch(error){  
      console.log(error);
  }
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