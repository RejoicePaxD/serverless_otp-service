const AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient();

exports.lambdaHandler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  let Body;
  try {
    // Log the event body to diagnose issues
    console.log('Raw event body:', event.body);

    // Parse the incoming request body
    Body = JSON.parse(event.body);
    console.log('Parsed body:', Body);
  } catch (error) {
    // Handle JSON parsing errors
    console.error('Error parsing event body:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid request body",
        error: error.message
      }),
    };
  }

  // Destructure sessionToken and otp from the parsed body
  const { sessionToken, otp } = Body;

  // Check for missing sessionToken or otp
  if (!sessionToken || !otp) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Missing sessionToken or otp",
      }),
    };
  }

  try {
    // Define DynamoDB query parameters
    const pk = `${event.body.sessionToken}_${event.body.otp}`;

    const params = {
      TableName: process.env.DB_TABLE,
      Key: {
        pk: pk, // Correctly defined pk
        expiryAt: Number(event.body.expiryAt), // Ensure the correct field for expiryAt
      },
    };

    // Log DynamoDB query parameters for debugging
    console.log('DynamoDB query parameters:', JSON.stringify(params, null, 2));

    // Query DynamoDB for the item
    const result = await docClient.get(params).promise();

    // Check if the item exists
    if (result.Item) {
      // Get current time in seconds
      const currentTime = Math.floor(new Date().getTime() / 1000);

      // Validate OTP expiry
      if (currentTime <= result.Item.expiresAt) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "OTP verified successfully",
          }),
        };
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "OTP expired",
          }),
        };
      }
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "OTP not found",
        }),
      };
    }
  } catch (error) {
    // Handle errors during DynamoDB operations
    console.error('Error verifying OTP:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "OTP verification failed",
        error: error.message,
      }),
    };
  }
};
