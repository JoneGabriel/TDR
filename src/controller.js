const {readdirSync, existsSync} = require("fs");
const { isEmpty } = require("./helpers/helpers.global");
const app = require("express")();
const dirs = readdirSync(__dirname);


if(dirs.length>0){
    dirs.forEach(dir=>{

        const path = `${__dirname}/${dir}/${dir}.controller.js`;

        if(existsSync(path)){
            const routes = require(path);
            isEmpty(routes) ? console.warn('\x1b[33m%s\x1b[0m', `The ${dir.toUpperCase()} model is not exporting its routes`) : app.use(require(path));
        }

    });
}

module.exports = app;