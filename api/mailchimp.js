import crypto from 'crypto';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
const MAILCHIMP_DC = 'us12';
const BASE_URL = `https://${MAILCHIMP_DC}.api.mailchimp.com/3.0`;

function md5(str) {
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex');
}

/**
 * Add or update a contact in Mailchimp audience.
 * Called on signup and when plan changes.
 */
export async function addOrUpdateContact({ email, firstName = '', tags = [] }) {
  const subscriberHash = md5(email);

  const res = await fetch(
    `${BASE_URL}/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${MAILCHIMP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status_if_new: 'subscribed',
        merge_fields: { FNAME: firstName },
        tags,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error('Mailchimp addOrUpdateContact error:', data);
    return { success: false, error: data };
  }
  return { success: true };
}

/**
 * Apply or remove tags on a contact.
 * tagUpdates: [{ name: 'trial-exhausted', status: 'active' | 'inactive' }]
 */
export async function updateTags(email, tagUpdates) {
  const subscriberHash = md5(email);

  const res = await fetch(
    `${BASE_URL}/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash}/tags`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MAILCHIMP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: tagUpdates }),
    }
  );

  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) {
    console.error('Mailchimp updateTags error:', data);
    return { success: false, error: data };
  }
  return { success: true };
}
