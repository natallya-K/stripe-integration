require('dotenv').config();
const cors = require('cors');
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index.ejs');
});

app.post('/checkout', async (req, res) => {
    try {
        const { cart, totalPrice, itemCount } = req.body;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ error: "Cart is empty or not provided" });
        }

        console.log("Received cart data:", cart);
        console.log("Total price:", totalPrice);
        console.log("Item count:", itemCount);

        const lineItems = cart.map(item => {
            if (!item.title || !item.price || typeof item.quantity !== 'number') {
                throw new Error("Invalid item in cart");
            }

            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.title,
                    },
                    unit_amount: item.price * 100, // Convert to cents
                },
                quantity: item.quantity,
            };
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/cancel`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Error creating checkout session:", error.message);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

app.get('/success', async (req, res) => {
    const result = await Promise.all([
        stripe.checkout.sessions.retrieve(req.query.session_id, { expand: ['payment_intent.payment_method'] }),
        stripe.checkout.sessions.retrieve(req.query.session_id, { expand: ['payment_intent.payment_method'] })
    ]);

    console.log(JSON.stringify(await result));
    res.send('Payment Successful');
});

app.get('/cancel', (req, res) => {
    res.redirect('/');
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
