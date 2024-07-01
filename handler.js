const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
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
  };

  try {
    const command = new ScanCommand(params);
    const { Items } = await docClient.send(command);
    if (Items && Items.length > 0) {
      Items.sort((a, b) =>
        b.registration_date.localeCompare(a.registration_date)
      );
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

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

exports.handler = serverless(app);
