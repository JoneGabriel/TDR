
const createGoogleChart = async(info = false)=>{
    try{

        if(!info){
            const date = new Date(Date.now())

            const response = await request("GET", `/session/interval?start=${date}&end=${date}`);

            if(response.status != 200){
                throw(statusHandler.messageError("Erro ao buscar sessões", true));
            }

            info = response.content;
        }
        

        let data = new google.visualization.DataTable();
        data.addColumn('string', 'Hora');
        data.addColumn('number', 'Sessões');
        data.addRows(info);

        // Set chart options
        var options = {
            'title':'', 
            legend: { position: 'none' },
            colors: ['#000000'],
        };

        
        var chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));
        chart.draw(data, options);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getMetrics = async(total)=>{
    try{

        let date = $("[c-id=date]").val();

        date ? ( date = new Date(date)) : (date = new Date(Date.now()))
        
        const query = `?start=${date}&end=${date}`;
        const response = await request("GET", `/metrics${query}`);

        if(response.status == 200){
            const {content} = response;

            const addCart = content.filter(value=> value.type_event == 'add-to-cart');
            const initCheckout = content.filter(value=> value.type_event == 'init-checkout');

            $("[c-id=add-value]").text(addCart.length);
            $("[c-id=add-percentage]").text(`${parseFloat(addCart.length*100/total).toFixed(2)}%`);

            $("[c-id=chart-cart]").css('height', `${addCart.length/10}px`);

            $("[c-id=init-value]").text(initCheckout.length);
            $("[c-id=chart-init]").css('height', `${initCheckout.length/10}px`);
            $("[c-id=init-percentage]").text(`${parseFloat(initCheckout.length*100/total).toFixed(2)}%`);

        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const filter = async()=>{
    try{

        let date = $("[c-id=date]").val();

        const domain = $("[c-id=domain]").val();

        date ? ( date = new Date(date)) : (date = new Date(Date.now()))
        
        const query = `?start=${date}&end=${date}${domain && `&domain=${domain}`}`;
        const response = await request("GET", `/session${query}`);

        if(response.status != 200){
            throw(statusHandler.messageError("Erro ao buscar sessões", true));
        }

        const {total, interval} = response.content;
        
        createGoogleChart(interval);
        $("[c-id=total-session]").text(total);

        $("[c-id=session-value]").text(total);
        $("[c-id=chart-session]").css('height', `${total/10}px`);
        await getMetrics(total);


    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

$(document).ready(function(){

    google.charts.load('current', {'packages':['corechart']});
    
    

    $("[c-id=filter]").on("click", async()=>{
        try{

            await filter();

        }catch(error){
            throw(statusHandler.messageError(error));
        }
    });
    $("[c-id=filter]").click();
    
});