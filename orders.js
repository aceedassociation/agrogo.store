/* Order delivery only. Prices and availability are confirmed by Agrogo. */
(() => {
  'use strict';
  const endpoint = 'https://formspree.io/f/xoeeyeqv';
  const amount = cents => cents == null ? 'Sur devis' : (cents / 100).toFixed(2) + ' MAD';

  function createPayload({reference, language, contact, items, totals, message, submittedAt}) {
    if (!reference || !items.length) throw new Error('Empty order');
    const quoted = items.filter(item => item.totalCents == null).length;
    const payload = {
      subject: `AGROGO STORE — ${quoted === items.length ? 'Demande de devis' : 'Commande'} ${reference}`,
      reference,
      submitted_at: submittedAt,
      language,
      name: contact.name || '',
      phone: contact.phone || '',
      city: contact.city || '',
      address: contact.address || '',
      note: contact.note || '',
      products: items.map((item, i) => `${i + 1}. ${item.name}\nRéf. ${item.sku} | ${item.option}\nQuantité : ${item.qty} ${item.unit}\nPrix unitaire : ${amount(item.unitPriceCents)} | Ligne : ${amount(item.totalCents)}`).join('\n\n'),
      subtotal: amount(totals.subtotal),
      delivery: totals.shipping == null ? 'À confirmer sur devis' : totals.shipping === 0 ? 'Offerte' : amount(totals.shipping),
      known_total: amount(totals.total),
      quote_items: quoted ? `${quoted} ligne(s) sur devis, exclue(s) du total chiffré.` : '0',
      message: `Référence : ${reference}\nDate : ${submittedAt}\n\n${message}`
    };
    if (contact.email?.trim()) payload.email = contact.email.trim();
    return payload;
  }

  async function submit(payload, {fetchImpl = window.fetch.bind(window), timeoutMs = 20000} = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
        credentials: 'omit',
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      let result;
      try { result = await response.json(); } catch { throw new Error('Unconfirmed response'); }
      if (!response.ok || result?.ok === false || result?.errors?.length) {
        const error = new Error('Order not accepted');
        error.status = response.status;
        throw error;
      }
      // Never treat a redirect, empty body or invalid JSON as delivery success.
      if (!result || result.ok !== true || response.redirected) throw new Error('Unconfirmed response');
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  window.AGROGO_ORDERS = Object.freeze({endpoint, createPayload, submit});
})();
