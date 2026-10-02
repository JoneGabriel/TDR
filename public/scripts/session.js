// Presença em tempo real da vitrine: avisa o servidor a cada 30s enquanto a aba está visível.
// O visitante é identificado pelo cookie tdr_vid (definido pelo servidor em saveSession);
// o ping só renova a sessão ativa, nunca cria uma nova.
(()=>{
    const INTERVAL = 30000;

    const ping = ()=>{
        if(document.visibilityState !== "visible"){
            return;
        }

        try{
            fetch("/heartbeat", {
                method:"POST",
                keepalive:true,
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({domain:window.location.host, path:window.location.pathname})
            }).catch(()=>{});
        }catch(error){}
    };

    setInterval(ping, INTERVAL);
    document.addEventListener("visibilitychange", ()=>{
        document.visibilityState === "visible" && ping();
    });
})();
