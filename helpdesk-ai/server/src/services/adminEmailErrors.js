// Static, safe messages only. Never forward raw provider response bodies.
module.exports={
 ADMIN_EMAIL_UNAVAILABLE:'Unable to send verification email. Try again later.',
 ADMIN_EMAIL_NOT_CONFIGURED:'Administrator email delivery is not configured.',
 ADMIN_EMAIL_INVALID_DETAILS:'Administrator email delivery details are invalid.',
 ADMIN_EMAIL_RECIPIENT_RESTRICTED:'Resend does not permit delivery to this administrator email. Complete the Resend account email change or use a verified sending domain.',
 ADMIN_EMAIL_SENDER_UNVERIFIED:'The verification email sender is not verified in Resend. Check the configured sending domain.',
 ADMIN_EMAIL_SENDER_INVALID:'The verification email sender address is invalid. The system owner must check ADMIN_EMAIL_FROM.',
 ADMIN_EMAIL_KEY_INVALID:'Resend rejected the email delivery credentials. The system owner must check the configured API key.',
 ADMIN_EMAIL_RATE_LIMITED:'The email provider limit has been reached. Wait before requesting another code or ask the system owner to check the email quota.',
 ADMIN_EMAIL_TIMEOUT:'The email provider did not respond in time. Try sending the code again shortly.'
};
