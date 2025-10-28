const mongoose = require('mongoose');

const Store = mongoose.model("store", {
    name:{
        required:true,
        type:String
    },
    logo:{
        required:true,
        type:String,
    },
    position_logo:{
        type:String,
        enum:["left", 'center'],
        default:"left"
    },  
    idioma:{
        type:String,
        enum:['FR', 'EN', 'DE', 'NL']
    },
    moeda:{
        type:String,
        enum:['dolar', 'euro', 'libra']
    },
    country:{
        type:[String],
        enum:["FR", "CH", "GB", "DE", "US", "BE"]
    },
    status:{
        type:Boolean,
        default:true
    },
    banner_1:String,
    banner_2:String,
    banner_3:String,
    message_top:String,
    color_message_top:String,
    bk_message_top:String,
    color_btn_product:String,
    bk_btn_product:String,
    color_btn_add_items:String,
    bk_btn_add_items:String,
    color_btn_checkout:String,
    bk_btn_checkout:String,
    color_footer:String,
    bk_footer:String,
    color_icons:String,
    color_n_items_cart:String,
    css:String
    
});


module.exports = {
    Store
}