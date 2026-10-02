// Componente de mídia do admin: compressão no navegador, arrastar e soltar, reordenação e contador.
// Usado pelos modais de produto, coleção e loja (products-admin.js, collections-admin.js, store-admin.js).
const AdminMedia = (()=>{

    const MAX_SIDE = 1600;      // maior lado após redimensionar
    const QUALITY = 0.85;
    const MAX_MB = 12;

    const readAsDataUrl = (file)=> new Promise((resolve, reject)=>{
        const reader = new FileReader();

        reader.onload = ()=> resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const loadImage = (src)=> new Promise((resolve, reject)=>{
        const image = new Image();

        image.onload = ()=> resolve(image);
        image.onerror = reject;
        image.src = src;
    });

    // Redimensiona para até MAX_SIDE e recodifica em WEBP (PNG/JPEG onde o navegador não gera WEBP).
    // GIF e SVG passam intactos. Nunca devolve algo maior que o original.
    const compress = async(file)=>{
        if(!file.type.startsWith("image/")){
            throw new Error(`${file.name}: não é uma imagem`);
        }

        if(file.size > MAX_MB * 1024 * 1024){
            throw new Error(`${file.name}: maior que ${MAX_MB}MB`);
        }

        const original = await readAsDataUrl(file);

        if(file.type == "image/gif" || file.type == "image/svg+xml"){
            return original;
        }

        const image = await loadImage(original);
        const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

        let output = canvas.toDataURL("image/webp", QUALITY);

        if(!output.startsWith("data:image/webp")){
            output = canvas.toDataURL(file.type == "image/png" ? "image/png" : "image/jpeg", QUALITY);
        }

        return (scale < 1 || output.length < original.length) ? output : original;
    };

    // Converte uma FileList em data URLs comprimidas; arquivos inválidos viram aviso e são pulados
    const filesToDataUrls = async(fileList)=>{
        let output = [];

        for(const file of Array.from(fileList || [])){
            try{
                output.push(await compress(file));
            }catch(error){
                statusHandler.messageError(error.message || "Erro ao ler imagem", true);
            }
        }

        return output;
    };

    // Área de soltar: destaca ao arrastar por cima e entrega os arquivos soltos
    const bindDropzone = (zone, onFiles)=>{
        if(!zone){
            return;
        }

        const stop = (event)=>{
            event.preventDefault();
            event.stopPropagation();
        };

        ["dragenter", "dragover"].forEach(name=> zone.addEventListener(name, (event)=>{
            stop(event);
            zone.classList.add("is-over");
        }));

        ["dragleave", "dragend"].forEach(name=> zone.addEventListener(name, (event)=>{
            stop(event);
            zone.classList.remove("is-over");
        }));

        zone.addEventListener("drop", async(event)=>{
            stop(event);
            zone.classList.remove("is-over");

            const files = Array.from(event.dataTransfer?.files || []).filter(file=> file.type.startsWith("image/"));

            files.length && await onFiles(files);
        });
    };

    // Reordenação por arraste entre os itens de uma grade (os itens precisam de draggable="true")
    const enableReorder = (list, itemSelector = "[c-id=model-img]")=>{
        if(!list){
            return;
        }

        let dragging = null;

        list.addEventListener("dragstart", (event)=>{
            dragging = event.target.closest(itemSelector);

            if(!dragging){
                return;
            }

            dragging.classList.add("is-dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", "");
        });

        list.addEventListener("dragover", (event)=>{
            const over = event.target.closest(itemSelector);

            if(!dragging || !over || over === dragging){
                return;
            }

            event.preventDefault();

            const rect = over.getBoundingClientRect();
            const before = (event.clientX - rect.left) < rect.width / 2;

            list.insertBefore(dragging, before ? over : over.nextSibling);
        });

        list.addEventListener("dragover", (event)=> event.preventDefault());

        list.addEventListener("dragend", ()=>{
            dragging?.classList.remove("is-dragging");
            dragging = null;
        });

        list.addEventListener("drop", (event)=> event.preventDefault());
    };

    // Mantém um contador com a quantidade de itens da grade
    const watchCount = (list, counter, itemSelector = "[c-id=model-img]")=>{
        if(!list || !counter){
            return;
        }

        const update = ()=> counter.textContent = list.querySelectorAll(itemSelector).length;

        new MutationObserver(update).observe(list, {childList:true});
        update();
    };

    // Barra "Gerar com IA" (Higgsfield via /ai/image): envia o prompt, acompanha o job e entrega a imagem
    // já comprimida para o mesmo caminho de um upload. `data-aspect` na barra sobrepõe a proporção padrão.
    const bindAiBar = (bar, onImage)=>{
        if(!bar){
            return;
        }

        const input = bar.querySelector("[c-id=ai-prompt]");
        const button = bar.querySelector("[c-id=ai-generate]");
        const label = button.textContent;

        const setBusy = (busy, text)=>{
            bar.classList.toggle("is-busy", busy);
            button.disabled = busy;
            button.textContent = text || (busy ? "Gerando..." : label);
        };

        const run = async()=>{
            const prompt = (input.value || "").trim();

            if(!prompt){
                return statusHandler.messageError("Descreva a imagem que quer gerar", true);
            }

            const started = Date.now();

            setBusy(true);

            try{
                const start = await request("POST", "/ai/image", {prompt, aspect_ratio:bar.dataset.aspect || undefined});

                if(start.status != 200){
                    throw new Error(start.content || "Erro ao iniciar a geração");
                }

                const id = start.content.job;

                while(true){
                    await new Promise(resolve=> setTimeout(resolve, 3000));

                    const poll = await request("GET", `/ai/image/${id}`);

                    if(poll.status != 200){
                        throw new Error(poll.content || "Erro ao consultar a geração");
                    }

                    if(poll.content.status == "error"){
                        throw new Error(poll.content.error || "Falha na geração");
                    }

                    if(poll.content.status == "done"){
                        break;
                    }

                    setBusy(true, `Gerando... ${Math.round((Date.now() - started) / 1000)}s`);
                }

                const file = await request("GET", `/ai/image/${id}/file`);

                if(file.status != 200){
                    throw new Error(file.content || "Erro ao baixar a imagem");
                }

                // mesma compressão de um upload comum
                const blob = await (await fetch(file.content.image)).blob();
                const dataUrl = await compress(new File([blob], `higgsfield-${id}.png`, {type:blob.type || "image/png"}));

                await onImage(dataUrl);
                input.value = "";
                statusHandler.newMessage("Imagem gerada e adicionada");
            }catch(error){
                statusHandler.messageError(error.message || "Erro na geração", true);
            }finally{
                setBusy(false);
            }
        };

        button.addEventListener("click", run);
        input.addEventListener("keydown", (event)=>{
            if(event.key == "Enter"){
                event.preventDefault();
                run();
            }
        });
    };

    return {compress, filesToDataUrls, bindDropzone, enableReorder, watchCount, bindAiBar};
})();
