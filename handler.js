const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const express = require("express");
const serverless = require("serverless-http");

const app = express();

const COTIZATION_TABLE = process.env.COTIZATION_TABLE;
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

app.use(express.json());

app.get("/cotization/latest", async (req, res) => {
  const params = {
    TableName: COTIZATION_TABLE,
    ScanIndexForward: false, // Orden descendente
    Limit: 1,
  };

  try {
    const command = new ScanCommand(params);
    const { Items } = await docClient.send(command);
    if (Items && Items.length > 0) {
      const { registration_date, balance } = Items[0];
      res.json({ registration_date, balance });
    } else {
      res.status(404).json({ error: "No cotization records found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retrieve cotization" });
  }
});

// app.post("/cotization", async (req, res) => {
//   const { registration_date, balance } = req.body;
//   if (typeof registration_date !== "string") {
//     res.status(400).json({ error: '"registration_date" must be a string' });
//   } else if (typeof balance !== "number") {
//     res.status(400).json({ error: '"balance" must be a number' });
//   }

//   const params = {
//     TableName: COTIZATION_TABLE,
//     Item: { registration_date, balance },
//   };

//   try {
//     const command = new PutCommand(params);
//     await docClient.send(command);
//     res.json({ registration_date, balance });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Could not create cotization" });
//   }
// });

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

exports.handler = serverless(app);
