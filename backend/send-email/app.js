const AWS = require("aws-sdk");
const ses = new AWS.SES();

const fromAddress = process.env.FROM_ADDRESS;

exports.lambdaHandler = async (event, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    // Process only INSERT events
    if (record.eventName === "INSERT") {
      try {
        // Extract sessionToken and OTP from DynamoDB record
        const sessionToken = record.dynamodb.NewImage.sessionToken.S;
        const otp = record.dynamodb.NewImage.otp.S;
        const toAddress = record.dynamodb.NewImage.email.S;

        console.log('Extracted Session Token:', sessionToken);
        console.log('Extracted OTP:', otp);
        console.log('Recipient Email:', toAddress);

        // Send the OTP email
        await sendEmail(otp, toAddress);
      } catch (error) {
        console.error('Error processing record:', error);
      }
    }
  }
};

async function sendEmail(otp, toAddress) {
  // Compose the email body with the OTP
  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <body>
        <p>Use this code to approve your Invoice on RosePay</p>
        <p><h1>${otp}</h1></p>
      </body>
    </html>`;

  // Define the parameters for the SES email
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
    Source: `RosePayOTP <${fromAddress}>`,
  };

  console.log('Sending email with parameters:', JSON.stringify(params, null, 2));

  // Send the email using SES
  try {
    await ses.sendEmail(params).promise();
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
