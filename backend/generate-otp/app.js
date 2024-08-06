const AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient();
var validator = require("email-validator");

let otpExpiryTime = process.env.OTP_EXPIRY_MINUTES;

exports.lambdaHandler = async (event, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  let Body;
  try {
    // Log the raw event body for debugging
    console.log('Raw event body:', event.body);
    
    Body = JSON.parse(event.body);
    console.log('Parsed body:', Body);
  } catch (error) {
    console.error('Error parsing event body:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid request body",
      }),
    };
  }

  if (!validator.validate(Body.email)) {
    console.error('Invalid email:', Body.email);
    return {
      statusCode: 422,
      body: JSON.stringify({
        message: "Required field email not found or invalid",
      }),
    };
  }

  let sessionToken = gerRandomString(32);
  let otp = gerRandomString(process.env.TOKEN_LENGTH, true);

  console.log('Session Token:', sessionToken);
  console.log('OTP:', otp);

  var params = {
    TableName: process.env.DB_TABLE,
    Item: {
      sessionToken: sessionToken, // Partition key
      otp: otp,                   // Sort key
      email: Body.email,
      expiresAt: Math.floor(new Date().getTime() / 1000) + otpExpiryTime * 60,
    },
    ReturnConsumedCapacity: "TOTAL",
  };

  console.log('DynamoDB put parameters:', params);

  try {
    await docClient.put(params).promise();
    console.log('Item put successfully');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: "OTP generated",
        data: {
          token: sessionToken,
        },
      }),
    };
  } catch (error) {
    console.error('Error putting item to DynamoDB:', error.stack);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: "OTP generation failed",
        error: error.stack,
      }),
    };
  }
};

function gerRandomString(length, onlyNumbers = false) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  if (onlyNumbers === true) {
    var characters = "0123456789";
  }
  var charactersLength = characters.length;

  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

