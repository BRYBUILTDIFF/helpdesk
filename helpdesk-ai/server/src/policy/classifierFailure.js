// Return only fixed labels and HTTP status; provider error messages can contain secrets or prompts.
function classifierFailure(error) {
  const status = Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599 ? error.status : undefined;
  let category = 'UNAVAILABLE';
  if (error?.code === 'CLASSIFIER_NOT_CONFIGURED') category = 'MISSING_API_KEY';
  else if (error?.code === 'CLASSIFIER_INVALID_RESPONSE') category = 'INVALID_RESPONSE';
  else if (status === 401 || status === 403) category = 'AUTHENTICATION_OR_PERMISSION';
  else if (status === 402) category = 'BILLING';
  else if (status === 429) category = 'RATE_LIMIT_OR_QUOTA';
  else if (status === 400 || status === 404 || status === 422) category = 'MODEL_OR_REQUEST_CONFIGURATION';
  else if (status >= 500) category = 'PROVIDER_OUTAGE';
  else if (error?.name === 'APIConnectionTimeoutError' || error?.name === 'TimeoutError') category = 'TIMEOUT';
  else if (error?.name === 'AbortError' || error?.name === 'APIUserAbortError') category = 'REQUEST_ABORTED';
  else if (error?.name === 'APIConnectionError' || ['ECONNREFUSED','ECONNRESET','ENOTFOUND','ETIMEDOUT'].includes(error?.code || error?.cause?.code)) category = 'NETWORK';
  return { category, ...(status ? { status } : {}) };
}
function classifierError(code, message) {
  return Object.assign(new Error(message), { code });
}
module.exports = { classifierFailure, classifierError };
