const express = require("express");
const app = express();
const bodyParser = require("body-parser");

require("dotenv").config();
const port = process.env.PORT;
const host = process.env.HOST;
const cors = require('cors');
const {
    useragent, 
    requestFilter
} = require("./src/cloacker/cloacker.service");
require("twig");
app.use(cors());
app.set("twig options", {
    allowInlineIncludes:true,
    allow_async:true,
    strict_variables:false
});


app.use(useragent.express());
app.set('trust proxy', true);
app.use(express.static('public'));

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.json({limit:'200mb'}));
 
//app.use(async(req, res, next) => requestFilter({ req, res, next }));

app.use(require("./src/controller"));

app.use((req, res) => {
    res.redirect('/');
});

app.listen(parseInt(port), ()=>{
    console.log(`Server running in ${host}:${port}`);
});
