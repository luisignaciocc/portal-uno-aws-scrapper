const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const dotenv = require("dotenv");
dotenv.config();
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);
const COTIZATION_TABLE = process.env.COTIZATION_TABLE;

async function scraperPortalUno() {
  let browser;
  let page;
  try {
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    page = await browser.newPage();
    console.log("Browser launched.");
    console.log("Logging in...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36"
    );

    // El sitio ahora redirige "https://portal.uno.cl/login" a la home
    // "https://www.uno.cl/". Hay que entrar por la home y hacer click en el
    // botón "UNOnline" para llegar al formulario de login.
    //
    // Usamos "domcontentloaded" en vez de "networkidle0": la home tiene
    // analytics/chat/pixels de marketing que hacen requests en background
    // continuamente, así que "networkidle0" puede no cumplirse nunca y
    // colgar la navegación hasta su propio timeout de 60s (todo el
    // presupuesto del Lambda en un solo paso). El waitForFunction de abajo
    // ya se encarga de esperar a que React termine de hidratar el botón,
    // así que no necesitamos esperar la red completa aquí.
    await page.goto("https://www.uno.cl/", {
      timeout: 30000,
      waitUntil: "domcontentloaded",
    });
    console.log("Home page loaded.");

    // El botón "UNOnline" no tiene un selector único y estable (sus clases
    // son hashes generados por CSS-in-JS que cambian con cada build), así
    // que lo ubicamos por su texto visible en vez de por clase/id.
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).some((b) =>
          b.textContent.includes("UNOnline")
        ),
      { timeout: 30000 }
    );

    // Usamos evaluateHandle (API estable, no depende de page.$x que fue
    // removido en versiones recientes de Puppeteer) para ubicar el botón
    // por su texto y obtener un ElementHandle real sobre el que hacer click.
    const unoOnlineHandle = await page.evaluateHandle(() =>
      Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent.includes("UNOnline")
      )
    );
    const unoOnlineButton = unoOnlineHandle.asElement();

    // Usamos un click real de Puppeteer (simula mousedown/mouseup/click)
    // en vez de invocar btn.click() por JS. Es más fiel a lo que hace un
    // usuario real y evita posibles diferencias con componentes de Ant
    // Design que dependen de la secuencia completa de eventos de mouse.
    if (!unoOnlineButton) {
      throw new Error("No se encontró el botón 'UNOnline' en la home.");
    }
    try {
      await unoOnlineButton.click();
    } catch (clickError) {
      // Si algo tapa visualmente el botón (ej. un banner de cookies), el
      // click real de Puppeteer puede fallar. Como respaldo, disparamos el
      // evento por JS directamente sobre el elemento.
      console.log(
        "Real click failed, falling back to programmatic click:",
        clickError.message
      );
      await page.evaluate((el) => el.click(), unoOnlineButton);
    }

    // El click NO navega a otra URL: abre un panel deslizable (slideout/drawer)
    // dentro de la misma página que contiene el formulario de login. Por eso
    // esperamos a que aparezca el campo #username en vez de esperar navegación.
    console.log("Waiting for login slideout to appear...");

    const username = process.env.USERNAME_SCRAPER;
    const password = process.env.PASSWORD_SCRAPER;

    // El portal fue rediseñado con Ant Design (React). Los ids reales ahora
    // son #username y #password (antes eran #rutAfiliado / #passwordAfiliado).
    // Además ambos campos nacen con `readonly` y se desbloquean al hacer
    // foco/click (truco típico para evitar el autofill del navegador), así
    // que hay que hacer click() antes de escribir en cada uno.
    await page.waitForSelector("#username", { visible: true, timeout: 30000 });
    await page.click("#username");
    await page.type("#username", username, { delay: 50 });

    await page.waitForSelector("#password", { visible: true, timeout: 30000 });
    await page.click("#password");
    await page.type("#password", password, { delay: 50 });
    console.log("Username and password entered.");

    // El botón de submit arranca deshabilitado (Ant Design lo habilita solo
    // cuando el formulario valida en tiempo real). Hay que esperar a que
    // pierda el atributo disabled antes de hacer click.
    await page.waitForSelector('button[type="submit"]:not([disabled])', {
      timeout: 15000,
    });
    await page.click('button[type="submit"]');
    console.log("Logging in...");
    // Esperamos a que aparezca el bloque de saldo. Usamos el texto "Total
    // ahorrado" como ancla en vez de la clase (los nombres de clase son CSS
    // Modules con un hash de build, ej. "_textoPink_1l1rg_26", que puede
    // cambiar en cada deploy del portal aunque la estructura no cambie).
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("p")).some((el) =>
          el.textContent.includes("Total ahorrado")
        ),
      { timeout: 60000 }
    );
    console.log("Successful login.");

    const balanceText = await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll("p")).find((el) =>
        el.textContent.includes("Total ahorrado")
      );
      const container = label.closest("div");
      const span = container ? container.querySelector("span") : null;
      return span ? span.textContent : null;
    });

    if (!balanceText) {
      throw new Error(
        "No se pudo encontrar el monto ahorrado en la página tras el login."
      );
    }

    let balance = balanceText.replace(/[^0-9]/g, "");
    balance = parseFloat(balance);
    const currentDate = new Date().toISOString().split("T")[0];
    const putParams = {
      TableName: COTIZATION_TABLE,
      Item: {
        registration_date: currentDate,
        balance: balance,
      },
    };
    const putCommand = new PutCommand(putParams);
    await docClient.send(putCommand);
    console.log("New record created:", currentDate);
  } catch (error) {
    console.error("An error occurred while running the script:", error);

    // Diagnóstico automático: si algo falla, volcamos la URL actual y un
    // extracto del HTML a CloudWatch. Así, la próxima vez que el portal
    // cambie de nuevo, no hay que reproducirlo manualmente para ver qué
    // selector cambió — queda en los logs.
    if (page) {
      try {
        const currentUrl = page.url();
        console.error("Current URL at time of failure:", currentUrl);
        const html = await page.content();
        console.error(
          "Page HTML at time of failure (truncated to 3000 chars):",
          html.slice(0, 3000)
        );
      } catch (diagError) {
        console.error("Could not capture diagnostic info:", diagError);
      }
    }
  } finally {
    if (browser !== null && browser !== undefined) {
      await browser.close();
    }
  }
}

module.exports.scraper = scraperPortalUno;
