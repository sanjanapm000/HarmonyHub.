const mongoose = require('mongoose');
const Order = require('../models/orderSchema'); // Adjust path as needed
const Product = require('../models/productSchema'); // Adjust path as needed
const Category = require('../models/categorySchema'); // Adjust path as needed


async function getTopSellingProducts() {
    const topSellingProducts = await Product.find()
        .sort({ salesCount: -1 }) // Sort by salesCount in descending order
        .limit(4) // Limit to top 4 products
        .select('productName salesCount'); // Select only the fields you need

    console.log('Top Selling Products:', topSellingProducts); // Debugging line
    return topSellingProducts;
}

const getTopSellingCategories = async () => {
    try {
        const topSellingCategories = await Category.find()
            .sort({ totalSales: -1 }) // Sort by totalSales in descending order
            .limit(2) // Limit to top 2 categories
            .select('name totalSales'); // Select only the fields you need

        console.log('Top Selling Categories:', topSellingCategories);
        return topSellingCategories;
    } catch (error) {
        console.error('Error fetching top selling categories:', error);
        throw error; // Rethrow the error for handling in the calling function
    }
};

module.exports = {
    getTopSellingProducts,
    getTopSellingCategories,
    
};
