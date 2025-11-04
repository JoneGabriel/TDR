const checkColor = ()=>{
    try{

        const values = ["Couleur", "Color", "Color-Harness-1", "Color-Harness-2"];
        
        let return_ = [];

        values.forEach(val=>{

            const exist = $(`#${val}`).find("[c-id=option-couleur]");

            if(exist.length){
                return_['key'] =val;
                return_['values'] = exist;

                return_.push({
                    key:val,
                    values:exist
                })
            }

        });

        return return_;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const getVariants = ()=>{
    try{

        let variants = [];

        $("select").each(function(){
            let object = {};
            object["title"] = ($(this).attr("id")).replaceAll("-", " ");
            object["value"] = $(this).val();
            variants.push(object);
        });

        const return_ = checkColor();
  
        if(return_.length){
            return_.forEach(({values, key})=>{
                $(values).each(function(){
                    if($(this).hasClass("option-selected")){
                        let object = {};
                        object["title"] = key.replaceAll("-", " ");
                        object["value"] = $(this).attr('value');
                        variants.push(object);
                    }
                });
            })  
        }
        
        return variants;
    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listNumberItemsCart = ()=>{
    try{    

        let cart = localStorage.getItem("cart");
        cart = cart ? (JSON.parse(cart)).length : 0;
        $("[c-id=span-items] label").text(cart);
        
        return cart;
    }catch(error){
        throw(statusHandler.messageError(error));

    }
};

const getProduct = async(id, cart, is_bundle)=>{
    try{

        let body ={
            cart
        };

        if(is_bundle){
            body['is_bundle'] = is_bundle
        }

        const {status, content} = await request("POST", `/product/cart/${id}`, body);

        if(status == 200){

            return content;
        }

        throw(statusHandler.messageError(content))

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const formatValue = (value = 0) =>{

}

const listCartBundle = (product, variants, id)=>{
    try{

        const ctx = "[c-id=all-items]";
        const model = $("[c-id=modal-cart]").find("[c-id=model-cart]").clone()[0];

        const imgs = product.variants.map(var_=>{
            return var_[0].img;
        });

        $(model).find("[c-id=img-cart]").html("")

        imgs.forEach(img=>{
            $(model).find("[c-id=img-cart]")[0].innerHTML += `<img style="width:50px;" src="${img}" class="img-fluid mt-1">`;

        })

        $(model).attr("id", id);
        $(model).find("img").attr("src", product.variants[0].img);
        $(model).find("[c-id=title-item]").text(product.name);

        if(variants?.length){
            $(model).find("[c-id=variants-item-cart]").html("");
            variants.forEach(optionBundle=>{
                optionBundle.forEach(value=>{
                $(model).find("[c-id=variants-item-cart]").append(`
                    <p class="variants">${value.title}: ${value.value}</p>
                `);
            })
            })
            
        }

        $(model).find("[c-id=last-price-item]").text(`${(product.last_price || 0).toFixed(2)}`);
        $(model).find("[c-id=price-item]").text(`${(product.price).toFixed(2)}`);
        $(model).find("[c-id=save]").text(`(Save ${(((product.last_price|| product.price)-product.price)).toFixed(2)}`);
        $(model).removeClass("none");
        $(ctx).append(model);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const listCart = async()=>{
    try{

        let cart = localStorage.getItem("cart");
        cart = cart ? JSON.parse(cart) : null;
        
        if(cart){

            let total = 0;

            const numberItems = cart.length;

            $("[c-id=modal-cart]").find("[c-id=number-things]").text(numberItems);

            const ctx = "[c-id=all-items]";

            $(ctx).html("");

            for(i in cart){

                const {product:_id, variants, id, amount, is_bundle} = cart[i];
                const product = await getProduct(_id, variants, is_bundle);

                if(is_bundle){
                    listCartBundle(product, variants, id);
                    total+=(product.price);

                    continue;
                }

                const model = $("[c-id=modal-cart]").find("[c-id=model-cart]").clone()[0];

                $(model).attr("id", id);
                $(model).find("img").attr("src", product.variants[0].img);
                $(model).find("[c-id=title-item]").text(product.name);

                if(variants?.length){
                    $(model).find("[c-id=variants-item-cart]").html("");
                    variants.forEach(value=>{
                        $(model).find("[c-id=variants-item-cart]").append(`
                            <p class="variants">${value.title}: ${value.value}</p>
                        `);
                    })
                }
                
                total+=(product.price*parseInt(amount));

                $(model).find("[c-id=last-price-item]").text(`${(product.last_price*parseInt(amount)).toFixed(2)}`);
                $(model).find("[c-id=price-item]").text(`${(product.price*parseInt(amount)).toFixed(2)}`);
                $(model).find("[c-id=save]").text(`(Save ${((product.last_price-product.price)*parseInt(amount)).toFixed(2)}`);
                $(model).removeClass("none");
                $(ctx).append(model);

            }

            $("[c-id=btn-checkout]").find("span").html(`<i class="bi bi-dot"></i>${total.toFixed(2)}`);
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const addLocalStorage = (objectCart)=>{
    try{

        const {product, variants} = objectCart;

        let cart = localStorage.getItem("cart");

        if(!cart){
            localStorage.setItem("cart", JSON.stringify([objectCart]));

            return;
        }
        
        cart = JSON.parse(cart);

        let equal = false;
        let index_ = null;

        cart.forEach((productCart, index)=>{
            
            if(productCart.product == product){

                const {variants:variantsCart} = productCart;

                let error;

                if(equal){
                    return;
                }

                variantsCart.forEach(val => {
                    
                    variants.forEach(newVariant=>{

                        if(error === 0){
                            return;
                        }

                        if(val.title == newVariant.title){
                            equal = (val.value == newVariant.value);
                            !equal && (error = 0)
                        }

                        if(equal){
                            index_ = index;
                        }

                    });
                    
                });

            }
        });
        
        if(!equal || objectCart.is_bundle){
            cart.push(objectCart);

            localStorage.setItem("cart", JSON.stringify(cart));

            return;
        }

        cart = cart.map((value, index)=>{

            if(index == index_){

                value.amount = parseInt(value.amount) + parseInt(objectCart.amount);

                return value;
            }

            return value;
        }); 

        localStorage.setItem("cart", JSON.stringify(cart));

        return;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const saveAddCart = async()=>{
    try{

        const check = localStorage.getItem("ADD_TO_CART");

        if(!check){
            const idClient = localStorage.getItem("ID_TDR");
            
            const response = await request("POST","/add-cart", {id:idClient, domain:window.location.hostname});

            if(response.status == 200){
                localStorage.setItem("ADD_TO_CART", true);
            }
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const saveInitCheckout = async()=>{
    try{

        const check = localStorage.getItem("INIT_CHECKOUT");

        if(!check){
            const idClient = localStorage.getItem("ID_TDR");
            
            const response = await request("POST","/init-checkout", {id:idClient, domain:window.location.hostname});

            if(response.status == 200){
                localStorage.setItem("INIT_CHECKOUT", true);
            }
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getBundle = ()=>{
    try{

        let variants = [];
        let id, amount;

        let currentBundle; 
        $("[c-id=model-bundle]").each(function(){
            const isChecked = $(this).find('input').prop("checked");

            if(isChecked){
                currentBundle = this;
            }
        })

        id = $(currentBundle).attr("id");
        amount = $(currentBundle).attr("amount");


        $(currentBundle).find("[c-id=bundle-option]").each(function(){
            let optionsBundle = [];

            $(this).find('select').each(function(){
                let object = {};
                object["title"] = ($(this).attr("id")).replaceAll("-", " ");
                object["value"] = $(this).val();
                optionsBundle.push(object);

            });
            

            variants.push(optionsBundle);
        });

        return {variants, id, amount};

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const addToCartBundle = async()=>{
    try{

        const url = window.location.pathname;
        const product = url.split('/').pop();
        const {id, variants, amount} = getBundle();

        let object = {};
        object["id"] = Date.now();
        object["product"] = product;
        object["is_bundle"] = id;
        object["variants"] = variants
        object["amount"] = amount;

        addLocalStorage(object);
        await listCart();   

        $("[c-id=modal-cart]").modal("show");
        listNumberItemsCart();
        
        saveAddCart();

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const addToCart = async()=>{
    try{

        const isBundles = $("[c-id=model-bundle]");

        if(isBundles.length){

            return await addToCartBundle();
        }

        const url = window.location.pathname;
        const product = url.split('/').pop();

        let object = {};
        object["id"] = Date.now();
        object["product"] = product;
        object["variants"] = getVariants();
        object["amount"] = $("[c-id=amount]").val();
        
        addLocalStorage(object);

        await listCart();   

        $("[c-id=modal-cart]").modal("show");
        listNumberItemsCart();
        
        saveAddCart();
    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const removeItemCart = async(id)=>{
    try{

        let cart = localStorage.getItem("cart");
        cart = JSON.parse(cart);

        if(cart.length){
            cart = cart.filter(item=> item.id != id);
            localStorage.setItem("cart", JSON.stringify(cart));
        }

        await listCart();
        listNumberItemsCart();

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getUrlCheckout = async(cart)=>{
    try{

        const {status, content} = await request("POST", `/checkout`, cart);

        if(status == 200){

            return content.url;
        }

        throw(statusHandler.messageError(content))

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const checkout = async()=>{
    try{

        let cart = localStorage.getItem("cart");

        if(cart){
            cart = JSON.parse(cart);
            const url = await getUrlCheckout(cart);
            const utm = (window.location.href).split("?")[1];
           
           window.location.href = `${url}&${utm}`;
           saveInitCheckout();
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

$(document).ready(function(){

    listNumberItemsCart();

    $("[c-id=btn-checkout]").on("click", async(e)=>{
        try{

            $(e.delegateTarget).addClass("none");
            $(e.delegateTarget).prev().find("div").removeClass("none");
            await delay(500);
            await checkout();
            $(e.delegateTarget).prev().find("div").addClass("none");
            $(e.delegateTarget).removeClass("none");
            
        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("body").on("click", "[c-id=remove-cart]", async(e)=>{
        try{

            const id = $(e.currentTarget).closest("[c-id=model-cart]").attr("id");
            
            await removeItemCart(id);

        }catch(error){
            statusHandler.messageError(error);
        }
    })

    $("[c-id=open-cart]").on("click", async()=>{
        try{

            await listCart();
            $("[c-id=modal-cart]").modal("show");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=add-to-cart]").on("click", async(e)=>{
        try{
            
            $(e.target).addClass("none");
            $(e.target).prev().find("div").removeClass("none");

            await delay(1000);
            $(e.target).prev().find("div").addClass("none");
            $(e.target).removeClass("none");
           
            await addToCart();

        }catch(error){
            statusHandler.messageError(error);
        }
    })
})