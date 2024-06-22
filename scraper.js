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
  try {
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    console.log("Browser launched.");

    console.log("Logging in...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36"
    );
    await page.goto("https://portal.uno.cl/login", { timeout: 60000 });
    console.log("Login page loaded.");

    const username = process.env.USERNAME_SCRAPER;
    const password = process.env.PASSWORD_SCRAPER;
    await page.type("#rutAfiliado", username);
    await page.type("#passwordAfiliado", password);
    console.log("Username and password entered.");

    await page.click('button[type="submit"]');
    console.log("Logging in...");

    await page.waitForSelector("h1.uno__color--primary");
    console.log("Successful login.");

    const element = await page.$("h1.uno__color--primary");
    const textContent = await page.evaluate(
      (element) => element.textContent,
      element
    );

    let balance = textContent.replace(/[^0-9]/g, "");
    balance = parseFloat(balance);

    const currentDate = new Date().toISOString().split("T")[0];

    const params = {
      TableName: COTIZATION_TABLE,
      Key: { registration_date: currentDate },
    };

    const command = new ScanCommand(params);
    const { Items } = await docClient.send(command);

    if (Items && Items.length > 0) {
      console.log("Record already exists:", currentDate);
    } else {
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
    }
  } catch (error) {
    console.error("An error occurred while running the script:", error);
  } finally {
    if (browser !== null && browser !== undefined) {
      await browser.close();
    }
  }
}

module.exports.scraper = scraperPortalUno;
