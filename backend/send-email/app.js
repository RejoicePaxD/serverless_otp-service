const AWS = require("aws-sdk");
const ses = new AWS.SES();

const fromAddress = process.env.FROM_ADDRESS;

if (!fromAddress) {
  console.error("Environment variable FROM_ADDRESS is not set. Please configure it in Lambda.");
  throw new Error("FROM_ADDRESS environment variable is missing.");
} else {
  console.log("FROM_ADDRESS:", fromAddress);  // Log the value to verify
}

exports.lambdaHandler = async (event, context) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    if (record.eventName === "INSERT") {
      try {
        // Extract sessionToken, OTP, and email
        const sessionToken = record.dynamodb.NewImage.sessionToken.S;
        const otp = record.dynamodb.NewImage.otp.S;
        const toAddress = record.dynamodb.NewImage.email.S;

        console.log("Extracted values - Session Token:", sessionToken, ", OTP:", otp, ", Recipient Email:", toAddress);

        // Validate extracted values
        if (!sessionToken || !otp || !toAddress) {
          console.error("Missing one or more required fields: sessionToken, OTP, or email.");
          continue; // Skip this record
        }

        // Send the OTP email
        const emailResult = await sendEmail(otp, toAddress);
        console.log("Email result:", emailResult);
      } catch (error) {
        console.error("Error processing record:", error);
      }
    } else {
      console.log("Skipping non-INSERT event.");
    }
  }
};

async function sendEmail(otp, toAddress) {
  console.log("Preparing to send email...");

  if (!otp || !toAddress) {
    console.error("Missing OTP or recipient email address.");
    throw new Error("OTP and recipient email address are required.");
  }

  const htmlBody = 
    <!DOCTYPE html>
    <html>
      <body>
        <p>Use this code to approve your Invoice on RosePay</p>
        <p><h1>${otp}</h1></p>
      </body>
    </html>;

  const params = {
    Destination: {
      ToAddresses: [toAddress],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: htmlBody,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Your OTP for your approved Invoice on RosePay",
      },
    },
    Source: fromAddress,
  };

  console.log("Sending email with parameters:", JSON.stringify(params, null, 2));

  try {
    const result = await ses.sendEmail(params).promise();
    console.log("Email sent successfully:", result);
    return result;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email.");
  }
}