require('dotenv').config()
const express = require('express')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const { getProducts, createOrder } = require('./printful');
const pool = require('./db');

const app = express()
const port = process.env.PORT || 3000;

app.use(express.json());
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
    res.render('index.ejs')
})

app.post('/checkout', async (req, res) => {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Canvas Print',
                    },
                    unit_amount: 100 * 100,
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'BE', 'AU', 'DE', 'FR', 'IT', 'JP', 'NL', 'NZ', 'ES', 'CH', 'AT', 'DK', 'NO', 'SE', 'SG'],
        },
        success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BASE_URL}/cancel`,
        // Keep this cancel route is case of need to keep info on cancel
    })
    // res.json({ id: session.id })
    // console.log(session)
    res.redirect(session.url)

})

app.get('/success', async (req, res) => {
    // console.log(req.query.session_id)
    const result = Promise.all([stripe.checkout.sessions.retrieve(
        req.query.session_id, {expand: ['payment_intent.payment_method']}),
        stripe.checkout.sessions.retrieve(req.query.session_id, {expand: ['payment_intent.payment_method']})
    ])

    console.log(JSON.stringify(await result))

    res.send('Payment Successful')
    // TODO: Add success page

})

app.get('/cancel', (req, res) => {
    // res.send('Payment Cancelled')
    // TODO: Add cancel page
    res.redirect('/')
})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
