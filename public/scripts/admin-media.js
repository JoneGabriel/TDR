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

    // ---------------------------------------------------------------- visualização (lightbox) e metadados
    // Qualquer miniatura (.model-img) ou card de imagem (.image-picker-preview) ganha: "ver em tamanho real"
    // (botão [c-id=view-img] ou duplo clique), dimensões e tamanho em .media-meta, e "trocar" ([c-id=replace-img])
    // que abre o seletor de arquivo da própria área. Tudo por delegação: nada muda nos scripts que adicionam imagens.
    const sizeOf = (src)=>{
        if(!src || !src.startsWith("data:")) return "";

        const bytes = Math.round((src.length - src.indexOf(",") - 1) * 3 / 4);

        return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
    };

    const describe = (img)=>{
        const holder = img.closest(".model-img, .image-picker-preview");
        const meta = holder?.querySelector(".media-meta");

        if(!meta) return;

        const size = sizeOf(img.getAttribute("src"));

        meta.textContent = img.naturalWidth ? `${img.naturalWidth}×${img.naturalHeight}${size ? " · " + size : ""}` : "";
    };

    // `load` de <img> não borbulha, mas chega na fase de captura
    document.addEventListener("load", (event)=>{
        event.target.tagName == "IMG" && describe(event.target);
    }, true);

    let box = null;
    let gallery = {items:[], index:0};

    const ensureLightbox = ()=>{
        if(box) return box;

        box = document.createElement("div");
        box.className = "media-lightbox none";
        box.setAttribute("c-id", "lightbox");
        box.innerHTML = `
            <button type="button" class="media-lightbox-close" c-id="lightbox-close" title="Fechar (Esc)"><i class="bi bi-x-lg"></i></button>
            <button type="button" class="media-lightbox-nav media-lightbox-prev" c-id="lightbox-prev" title="Anterior (←)"><i class="bi bi-chevron-left"></i></button>
            <figure><img alt=""><figcaption></figcaption></figure>
            <button type="button" class="media-lightbox-nav media-lightbox-next" c-id="lightbox-next" title="Próxima (→)"><i class="bi bi-chevron-right"></i></button>`;
        document.body.appendChild(box);

        box.addEventListener("click", (event)=>{
            const action = event.target.closest("[c-id]")?.getAttribute("c-id");

            if(action == "lightbox-prev") return show(gallery.index - 1);
            if(action == "lightbox-next") return show(gallery.index + 1);
            if(action == "lightbox-close" || event.target === box) return closeLightbox();
        });

        document.addEventListener("keydown", (event)=>{
            if(box.classList.contains("none")) return;

            event.key == "Escape" && closeLightbox();
            event.key == "ArrowLeft" && show(gallery.index - 1);
            event.key == "ArrowRight" && show(gallery.index + 1);
        });

        return box;
    };

    const show = (index)=>{
        const total = gallery.items.length;

        if(!total) return;

        gallery.index = (index + total) % total;

        const item = gallery.items[gallery.index];
        const img = box.querySelector("img");

        img.src = item.src;
        img.onload = ()=> box.querySelector("figcaption").textContent = [total > 1 ? `${gallery.index + 1} / ${total}` : "", item.label, `${img.naturalWidth}×${img.naturalHeight}`, sizeOf(item.src)].filter(Boolean).join("  ·  ");
        box.classList.toggle("is-single", total < 2);
    };

    // abre o visualizador; `items` = [{src, label}]
    const openLightbox = (items, index = 0)=>{
        const list = (Array.isArray(items) ? items : [items]).map(item=> typeof item == "string" ? {src:item} : item).filter(item=> item?.src);

        if(!list.length) return;

        ensureLightbox();
        gallery = {items:list, index:0};
        box.classList.remove("none");
        document.body.classList.add("media-lightbox-open");
        show(index);
    };

    const closeLightbox = ()=>{
        box?.classList.add("none");
        document.body.classList.remove("media-lightbox-open");
    };

    // imagens "irmãs" na mesma grade, para navegar; fora de uma grade, só a própria
    const galleryOf = (img)=>{
        const grid = img.closest(".media-grid");
        const items = grid ? Array.from(grid.querySelectorAll(".model-img:not(.none) img")) : [img];
        const list = items.filter(el=> el.getAttribute("src")).map((el, i)=> ({src:el.getAttribute("src"), label:grid ? (i == 0 ? "capa" : "") : (el.closest(".image-picker")?.dataset.label || "")}));

        return {items:list, index:Math.max(0, items.indexOf(img))};
    };

    document.addEventListener("click", (event)=>{
        const view = event.target.closest("[c-id=view-img]");

        if(view){
            const img = view.closest(".model-img, .image-picker-preview")?.querySelector("img");
            const {items, index} = img ? galleryOf(img) : {items:[], index:0};

            return openLightbox(items, index);
        }

        const replace = event.target.closest("[c-id=replace-img]");

        if(replace){
            return replace.closest(".image-picker")?.querySelector(".dropzone-input")?.click();
        }
    });

    document.addEventListener("dblclick", (event)=>{
        const img = event.target.closest(".model-img img, .image-picker-preview img");

        if(img && img.getAttribute("src")){
            const {items, index} = galleryOf(img);

            openLightbox(items, index);
        }
    });

    return {compress, filesToDataUrls, bindDropzone, enableReorder, watchCount, openLightbox, closeLightbox, describe};
})();
