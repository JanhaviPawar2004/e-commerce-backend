// server/routes/payment.js
const express = require('express');
const router = express.Router();
// const Stripe = require('stripe');
// const stripe = Stripe('sk_test_51Rkn5j4MGjbpiNn3cpvZKN8ilNPqHDXCdJfgsV2symYEBxP2SyhAqVSXmq3M1Nx51nLMpjDrm0kwOeVjuZJ8ykr400NeN08dna'); // Replace with your test secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', async (req, res) => {
  const { items, storeId, customerId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map(item => ({
        price_data: {
          currency: 'inr',
          product_data: { name: item.name },
          unit_amount: item.price * 100,
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `http://localhost:3000/store/${storeId}/success?customerId=${customerId}`,
      cancel_url: `http://localhost:3000/store/${storeId}/cancel?customerId=${customerId}`,
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
