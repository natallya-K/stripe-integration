const axios = require('axios');
require('dotenv').config();  // Load environment variables from .env

const PRINTFUL_API_URL = process.env.PRINTFUL_API_URL;  // Get API URL from environment variables
const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;  // Get API key from environment variables

const printfulInstance = axios.create({
    baseURL: PRINTFUL_API_URL,
    headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`
    }
});

const getProducts = async () => {
    try {
        const response = await printfulInstance.get('/store/products');
        return response.data;
    } catch (error) {
        console.error(error);
        throw new Error('Error fetching products');
    }
};

const createOrder = async (orderData) => {
    try {
        const response = await printfulInstance.post('/orders', orderData);
        return response.data;
    } catch (error) {
        console.error(error);
        throw new Error('Error creating order');
    }
};

module.exports = { getProducts, createOrder };
