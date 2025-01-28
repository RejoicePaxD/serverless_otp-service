const AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient();
var validator = require("email-validator");

let otpExpiryTime = process.env.OTP_EXPIRY_MINUTES;
let sesClient = new AWS.SES();
let fromAddress = process.env.SES_SOURCE_EMAIL;

console.log('SES_SOURCE_EMAIL environment variable:', fromAddress);

exports.lambdaHandler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  let Body;
  try {
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

  // Validate email
  if (!validator.validate(Body.email)) {
    console.error('Invalid email:', Body.email);
    return {
      statusCode: 422,
      body: JSON.stringify({
        message: "Required field email not found or invalid",
      }),
    };
  }

  // Generate session token and OTP
  let sessionToken = generateRandomString(32);
  let otp = generateRandomString(process.env.TOKEN_LENGTH, true);

  console.log('Session Token:', sessionToken);
  console.log('OTP:', otp);
  console.log('FROM_ADDRESS environment variable:', fromAddress);

  // Store session token, OTP, and email in DynamoDB
  var params = {
    Item: {
      pk: sessionToken + "_" + otp,
      email: Body.email,
      expiryAt: Math.floor(new Date().getTime() / 1000) + otpExpiryTime * 60,
    },
    ReturnConsumedCapacity: "TOTAL",
    TableName: process.env.DB_TABLE,
  };

  console.log('DynamoDB put parameters:', params);

  try {
    await docClient.put(params).promise();
    console.log('Item put successfully');
  } catch (error) {
    console.error('Error putting item to DynamoDB:', error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "OTP generation failed",
        error: error.stack,
      }),
    };
  }

  // Send OTP email
  const emailResult = await sendEmail(Body.email, otp);
  if (emailResult.statusCode !== 200) {
    console.error('Error sending email:', emailResult.body);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error sending email",
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "OTP generated and email sent",
      data: {
        token: sessionToken,
      },
    }),
  };
};

async function sendEmail(email, otp) {
  const params = {
    Source: fromAddress,  // Use the 'fromAddress' value here
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'Your OTP' },
      Body: { Text: { Data: `Your OTP is ${otp}` } }
    }
  };

  try {
    console.log('Sending email with parameters:', JSON.stringify(params, null, 2));
    const result = await sesClient.sendEmail(params).promise();
    console.log('SES send result:', result);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Email sent successfully",
      }),
    };
  } catch (error) {
    console.error('Error sending email:', error.stack);  // Log the full error stack
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error sending email",
        error: error.stack,  // Include the full error stack for debugging
      }),
    };
  }
}

function generateRandomString(length, onlyNumbers = false) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  if (onlyNumbers) {
    characters = "0123456789";
  }
  var charactersLength = characters.length;

  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
