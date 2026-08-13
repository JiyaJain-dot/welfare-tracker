// Every place in the app that needs to text a citizen calls sendSms().
// Today it just logs to your terminal so you can develop and test without
// signing up for an SMS provider or spending money.
//
// When you're ready to connect a real gateway (MSG91, Kaleyra, Twilio),
// this is the ONLY file you need to change - nothing else in the app
// needs to know how SMS actually gets sent.
async function sendSms(phone, message) {
  const provider = process.env.SMS_PROVIDER || 'console';

  if (provider === 'console') {
    console.log(`[SMS to ${phone}] ${message}`);
    return { success: true, provider: 'console' };
  }

  // Example of what a real provider call looks like (commented out).
  // Uncomment and fill in once you have a provider account:
  //
  // const res = await fetch('https://api.msg91.com/api/v5/flow/', {
  //   method: 'POST',
  //   headers: { 'authkey': process.env.SMS_API_KEY, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ mobile: phone, message })
  // });
  // return await res.json();

  console.log(`[SMS to ${phone}] (provider "${provider}" not implemented yet) ${message}`);
  return { success: false, provider };
}

module.exports = { sendSms };
