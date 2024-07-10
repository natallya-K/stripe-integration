require('dotenv').config();
const cors = require('cors');
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getProducts, createOrder } = require('./printful');
const pool = require('./db');
require('dotenv').config();

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
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB', 'BE', 'AU', 'DE', 'FR', 'IT', 'JP', 'NL', 'NZ', 'ES', 'CH', 'AT', 'DK', 'NO', 'SE', 'SG'],
            },
            success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/cancel`,
            metadata: {
                cart: JSON.stringify(cart)
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Error creating checkout session:", error.message);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

app.get('/success', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        // Retrieve the session and payment details from Stripe
        const session = await stripe.checkout.sessions.retrieve(req.query.session_id, { expand: ['payment_intent.payment_method'] });

        const { payment_status, customer_details, metadata } = session;

        if (payment_status !== 'paid') {
            return res.status(400).json({ error: "Payment not successful" });
        }

        // Extract necessary data for creating the Printful order
        const recipient = {
            name: customer_details.name,
            address1: customer_details.address.line1,
            city: customer_details.address.city,
            state_code: customer_details.address.state,
            country_code: customer_details.address.country,
            zip: customer_details.address.postal_code,
        };

        // Here, metadata should contain the cart data, which should be set during the checkout session creation
        const cart = JSON.parse(metadata.cart);

        const items = cart.map(item => ({
            variant_id: item.variant_id, // Ensure that variant_id is included in the cart metadata
            quantity: item.quantity,
            files: [{
                url: item.file_url // Ensure that file_url is included in the cart metadata
            }]
        }));

        // Store order data in the database
        const [result] = await connection.query(
            `INSERT INTO printfulorders (recipient_name, address1, city, state_code, country_code, zip, variant_id, quantity, file_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [recipient.name, recipient.address1, recipient.city, recipient.state_code, recipient.country_code, recipient.zip, items[0].variant_id, items[0].quantity, items[0].files[0].url]
        );

        const orderId = result.insertId;

        // Prepare order data for Printful
        const orderData = {
            recipient,
            items
        };

        // Send order data to Printful
        const printfulResponse = await createOrder(orderData);

        // Send response
        res.json({
            message: 'Payment Successful and order placed with Printful',
            orderId,
            printfulResponse
        });
    } catch (error) {
        console.error("Error during the order process:", error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.get('/cancel', (req, res) => {
    res.redirect('/');
});

// POST REQUEST WITH DATABASE
app.post('/orders', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { recipient, items } = req.body;
        const { name, address1, city, state_code, country_code, zip } = recipient;
        const { variant_id, quantity, files } = items[0];
        const { url } = files[0];

        console.log("Storing order data in the database...");

        // Store order data in the database
        const [result] = await connection.query(
            `INSERT INTO printfulorders (recipient_name, address1, city, state_code, country_code, zip, variant_id, quantity, file_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, address1, city, state_code, country_code, zip, variant_id, quantity, url]
        );

        // Get the inserted order ID
        const orderId = result.insertId;

        console.log(`Order data stored in database with orderId: ${orderId}`);

        // Prepare order data for Printful
        const orderData = {
            recipient: {
                name,
                address1,
                city,
                state_code,
                country_code,
                zip
            },
            items: [
                {
                    variant_id,
                    quantity,
                    files: [
                        {
                            url
                        }
                    ]
                }
            ]
        };

        // Send order data to Printful
        const printfulResponse = await createOrder(orderData);

        console.log("Order data sent to Printful successfully.");

        // Return response
        res.json({
            orderId,
            printfulResponse
        });
    } catch (error) {
        console.error("Error during the order process:", error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
