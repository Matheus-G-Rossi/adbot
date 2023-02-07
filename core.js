const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

//--------------------- INICIO DAS CONFIGURAÇÕES ------------------------------//

// Navegadores a serem abertos simultaneamente

const numeroDeInstancias = 5;
// Termos pesquisados no Google.
var query = "word";

// Lista de dominios autorizados a clicar.
var allowed_domains = ["domains"];

// Tempo máximo para carregamento das páginas, em milisegundos.
var timeout = 30000;

// Se a janela deve ser exibida.
var window = true;

// Configurações do proxy.
var proxy = {
    "host": "ip",
    "port": "port",
    "user": "user",
    "password": "pass" //
}

//--------------------- FIM DAS CONFIGURAÇÕES ---------------------------------//

/*
 *  Função responsável por escolher o elemento de array aleatóriamente.
 */
const random_choice = function(array){
    return array[Math.round(Math.random() * (array.length-1))];
}

/*
 *  Função responsavel por gerar uma string de sessão aleatória.
 */
const random_session = function(){
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    
    var session = "";
    for(var i=0; i<12; i++){
        session += random_choice(chars);
    }
    return session;
}

// Carrega a lista de useragents.
const useragent_path = path.join(__dirname, "data", "useragents.txt");
const file = fs.readFileSync(useragent_path, "utf8");
const useragents = file.split("\n");

// Pega o caminho para a extensão contra vazamento no WebRTC.
const webrtc_extension = path.join(__dirname, "data", "extensions", "webrtc-leak");

var no_ads = 0;

async function rodar(){
    proxy["password"] = proxy["password"].replace("{{SESSION}}", random_session());

    // Substitui os espaços por +.
    query = query.replaceAll(" ", "+");

    
    var running = true;
    while(running){
        
    
    var browser;

        try {
            
            console.log("\n-> Generating useragent.");

            // Escolhe um useragent aleartório.
            const useragent = random_choice(useragents).replaceAll("\r", "");
            console.log(useragent);

            // Exibe uma mensagem de status do processo.
            //console.log("\n-> Setting up browser.");

            // Inicializa o navegador.
            browser = await puppeteer.launch({
                devtools: false,
                headless: (window == false),
                ignoreHTTPSErrors: true,
                ignoreDefaultArgs: ["--disable-extensions","--enable-automation"],
                args: [
                    "--no-sandbox",
                    "--load-extension="+webrtc_extension,
                    "--proxy-server="+proxy["host"]+":"+proxy["port"]
                ]
            });
			
			

			

            // Inicia a página do navegador.  
            const page = await browser.newPage();
			
            // BLOQUEIA AS IMAGENS (Economizar trafego).
            await page.setRequestInterception(true);
			
    page.on('request', (req) => {
        if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
            req.abort();
        }
        else {
            req.continue();
        }
    });

			


            // Define o useragent para o navegador.
            await page.setUserAgent(useragent);

            // Define o timeout para o carregamento das páginas.
            await page.setDefaultNavigationTimeout(timeout);

            // Exibe uma mensagem de status do processo.
            //console.log("\n-> Authenticating proxy.");

            // Autentica o proxy.
            await page.authenticate({
                username: proxy["user"],
                password: proxy["password"],
            });

            // Exibe uma mensagem de status do processo.
            //console.log("\n-> Loading page.");
            
            // Abre a página.
            await page.goto("https://www.google.com/search?q="+query, {waitUntil: "domcontentloaded"});

            
            console.log("\n-> Searching ads.");

            // Variável com a lista de anúncios encontrados. 
            var ads = [];

            // Pega a lista de anuncios.
            await page.waitForSelector(".uEierd", {"timeout": 5000}).then(async () => {
                var result_ads = await page.$$(".uEierd");
                for(const ad of result_ads){
                    var href = await ad.$(".sVXRqc");
                    if(href != null){
                        var label = await href.$(".CnP9N.U3A9Ac.irmCpc");
                        if(label != null){
                            var label_text = await label.evaluate(el => el.textContent);
                            if(label_text == "Anúncio·"){
                                var link = await href.$(".qzEoUe");
                                if(link != null){
                                    var link_url =  await link.evaluate(el => el.textContent);
                                    ads.push({
                                        "link": link,
                                        "url": link_url
                                    });
                                }
                            }
                        }
                    }
                }
            });

            // Cria um loop para acessar cada anúncio.
            var cliked = false
            for(const ad of ads){
                // Verifica se o link está autorizado de acordo com a lista de sites ignorados.
                var authorized = false; 
                for(const i in allowed_domains){
                    const domain = allowed_domains[i];
                    if(ad["url"].includes(domain)){
                        authorized = true;
                        break;
                    }
                }

                // Se for o link está autorizado.
                if(authorized == true){
                    // Clica no anúncio.
                    console.log("-> Clicando no anuncio de \""+ad["url"]+"\".");

                    ad["link"].click();
                    await page.waitForNavigation({waitUntil: "load", timeout: timeout});

                    cliked = true;
                    break;
                }
            }

            if(cliked == false){
                console.log("-> Nenhum anúncio encontrado.");
				
				no_ads++;
				if(no_ads >= 5){
					running = false;
					break;
				}
            }
            else{
				no_ads = 0;
                console.log("-> Clique concluido com sucesso.");
            }

            await (new Promise(r => setTimeout(r, 10000)));
        }
        catch(e){
            //console.log("Error: ", e);

            // Reinicia o loop.
            continue;
        }
        finally {
            console.log("-> Reiniciando navegador.");

            // Fecha o navegador.
            try{
                await browser.close();
            }catch{console.log("erro ao fechar o browser");}
            
        }
    }
}

for(var i = 0; i < numeroDeInstancias; i++){
    try{rodar()}catch(err){console.log(err)};
}
    
    
