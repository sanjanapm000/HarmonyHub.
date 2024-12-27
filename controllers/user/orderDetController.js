const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");
const Product = require("../../models/productSchema")
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;


const getUserOrders = async (req, res) => {
    try {
        console.log("inside getUserOrders");
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const userId = req.session.user._id;
        const addressData = await Address.findOne({ userId: userId });
        const totalOrders = await Order.countDocuments({ userId });

        const totalPages = Math.ceil(totalOrders / limit);


        res.redirect('/order');
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("An error occurred while fetching your orders.");
    }
};



// const cancelOrder = async (req, res) => {
//     try {
//         const orderId = req.params.id;
        
//         const order = await Order.findOneAndUpdate(
//             { _id: orderId },
//             { $set: { orderStatus: 'Cancelled' } },
//             { new: true }
//         );
//         const orderData = await Order.findById(orderId);
//         console.log("orderData from cancel order",orderData)
//         if (!order) {
//             return res.status(404).send('Order not found');
//         }

//         const user = await User.findById(order.userId);
//         const refundAmount = order.grandTotalCost;
//         if (orderData.paymentType !== 'Pending') {
//             user.wallet += refundAmount;

//             const transaction = new Wallet({
//                 userId: order.userId,
//                 amount: refundAmount,
//                 status: 'Refund',
//                 description: `Refund for canceled order #${order.orderNumber}`
//             });

//             await transaction.save();
//             user.walletHistory.push(transaction._id);
//             await user.save();
//         }

        
//         for (const item of order.cartData) {
//             const product = await Product.findById(item.productId._id);

//             if (product) {
//                 // Increase the stock by the quantity of the product in the canceled order
//                 product.quantity += item.productQty;
//                 await product.save();
//             }
//         }

//         console.log('Order cancelled and refund processed');

//         res.redirect('/order?page=1');
//     } catch (error) {
//         console.error('Error cancelling order:', error);
//         res.status(500).send('Something went wrong');
//     }
// };







const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId);
        const orderData = await Order.findById(orderId);
        console.log("orderData from cancel order",orderData)
        if (!order) {
            return res.status(404).send('Order not found');
        }

        const user = await User.findById(order.userId);
        const refundAmount = order.grandTotalCost;
        if (orderData.paymentType !== 'Pending') {
            user.wallet += refundAmount;

            const transaction = new Wallet({
                userId: order.userId,
                amount: refundAmount,
                status: 'Refund',
                description: `Refund for canceled order #${order.orderNumber}`
            });

            await transaction.save();
            user.walletHistory.push(transaction._id);
            await user.save();
        }

        
        for (const item of order.cartData) {
            const product = await Product.findById(item.productId._id);

            if (product) {
                // Increase the stock by the quantity of the product in the canceled order
                product.quantity += item.productQty;
                await product.save();
            }
        }


        if (!order) {
            return res.json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order can be cancelled
        if (order.orderStatus === 'Delivered' || order.orderStatus === 'Shipped') {
            return res.json({
                success: false,
                message: 'Cannot cancel order at this stage'
            });
        }

        // Update order status
        await Order.findByIdAndUpdate(orderId, {
            orderStatus: 'Cancelled',
            cancelled: true
        });

        // If it was a COD order, update payment status
        if (order.paymentType === 'COD') {
            await Order.findByIdAndUpdate(orderId, {
                paymentStatus: 'Failed'
            });
        }

        // Return success response
        res.json({
            success: true,
            message: 'Order cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.json({
            success: false,
            message: 'Error cancelling order'
        });
    }
};








// orderStatus
// const orderStatusPage = async (req, res) => {
//   try {
//     const userId = req.session.user._id;
//     console.log("userId",userId);

//     if (!req.session.user || !req.session.user._id) {
//       return res.redirect('/login');
//     }
//     const orderId = req.params.id;
//     console.log("orderid",orderId);
//     const order = await Order.findOne({ _id: orderId });


//     const orderData = await Order.findById(orderId).populate('products.productId').populate('addressChosen');

// console.log("my orderdata:",orderData);



//     if (!orderData) {
//         return res.status(404).send("Order not found");
//     }

//     const isCancelled = orderData.orderStatus === 'Cancelled';
//     const isDelivered = orderData.orderStatus === 'Delivered';


// const userAddress = await Address.findById(userId);
// console.log("userAddress",userAddress);



//     // const userAddresses = await Address.findOne({ userId });
//     //     const orderObj = order.toObject();

//     //     if (userAddresses && userAddresses.address) {
//     //         orderObj.deliveryAddress = userAddresses.address.find(
//     //             addr => addr._id.toString() === Order.address.toString()
//     //         );
//     //     }

//         // res.render('user/order-indetail', { 
//         //     order: orderObj, 
//         //     session: req.session,
//         //     errorMessage: null
//         // });

//     res.render('orderStatus', {
//         // orderObj,
//         orderData,
//         isCancelled,
//         isDelivered,
//         user:req.session.user,

//     });
// } catch (error) {
//     console.error(error);
//     res.status(500).send("Error retrieving order details");
// }
// }

const orderStatusPage = async (req, res) => {
    try {
        // const userId = req.session.user._id;

        // Check if the user is logged in
        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/login');
        }

        const orderId = req.params.id;

        // Fetch the order data and populate necessary fields
        const orderData = await Order.findById(orderId)
            .populate('cartData.product._Id') // Populate product details
            .populate('addressChosen._Id'); // Populate address details



        const addressChosen = orderData.addressChosen;
        console.log("addressChosen....", addressChosen);

        const addressData = await Address.findOne({ 'address._id': addressChosen });
        console.log("my orderdata:", addressData);



        const selectedAddress = addressData.address.find(address => address._id.equals(orderData.addressChosen));
        console.log("selectedAddress", selectedAddress);


        // Check if the order exists
        if (!orderData) {
            return res.status(404).send("Order not found");
        }

        // Determine the order status
        const isCancelled = orderData.orderStatus === 'Cancelled';
        const isDelivered = orderData.orderStatus === 'Delivered';

        // Render the EJS template with the order data
        res.render('orderStatus', {
            orderData,
            isCancelled,
            isDelivered,
            user: req.session.user,
            addressData,
            selectedAddress,
            orderId,
        });
    } catch (error) {
        console.error("Error retrieving order details:", error);
        res.status(500).send("Error retrieving order details");
    }
};


const processOrderPayment = async (userId, orderTotal) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        if (user.wallet >= orderTotal) {
            user.wallet -= orderTotal;

            const transaction = new Wallet({
                amount: -orderTotal,
                status: 'Payment',
                description: `Payment for order`
            });

            await transaction.save();
            user.walletHistory.push(transaction._id);
            await user.save();

            console.log('Payment successful using wallet');
            return true; // Payment successful
        } else {
            console.log('Insufficient wallet balance');
            return false; // Insufficient balance
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        throw error;
    }
};


const handleOrderCancellation = async (orderId) => {
    try {
        const order = await Order.findById(orderId).populate('userId');

        if (!order) {
            throw new Error('Order not found');
        }

        const user = order.userId;
        const refundAmount = order.grandTotalCost;

        user.wallet += refundAmount;

        const transaction = new Wallet({
            amount: refundAmount,
            status: 'Refund',
            description: `Refund for canceled order #${order.orderNumber}`
        });

        await transaction.save();
        user.walletHistory.push(transaction._id);
        await user.save();

        order.orderStatus = 'Cancelled';
        await order.save();

        console.log('Order cancelled and refund processed');
    } catch (error) {
        console.error('Error handling order cancellation:', error);
        throw error;
    }
};

const returnOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).populate('userId');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const refundAmount = order.grandTotalCost - order.discountAmount;

        const user = await User.findById(order.userId._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.wallet === undefined) {
            user.wallet = 0;
        }

        user.wallet += refundAmount;

        const transaction = new Wallet({
            userId: user._id,
            amount: refundAmount,
            status: 'Returned',
            description: `Refund for order #${order.orderNumber}`,
        });

        await transaction.save();

        user.walletHistory = user.walletHistory || [];
        user.walletHistory.push(transaction._id);

        await user.save();

        order.orderStatus = 'Return';
        await order.save();

        console.log('Wallet History:', user.walletHistory);

        // Send a success response
        res.json({ success: true, message: 'Order has been returned successfully' });
    } catch (error) {
        console.error('Error processing return:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// const cancelProduct = async (req, res) => {
//     try {
//         {
//             const productId = req.params.id;
//             const orderId = req.params.orderId;
//             console.log("Cancelling product:", productId, "from order:", orderId);

//             const order = await Order.aggregate([
//                 { $match: { _id: new ObjectId(orderId) } }, // Match the specific order
//                 { $unwind: "$cartData" }, // Unwind the cartData array to process each item individually
//                 {
//                     $lookup: {
//                         from: "products", // Join with the products collection
//                         localField: "cartData.productId._id", // Match the productId in cartData
//                         foreignField: "_id", // The _id field in the products collection
//                         as: "productDetails" // Name of the field where the product details will be stored
//                     }
//                 },
//                 { $unwind: "$productDetails" }, // Unwind the productDetails array to extract product details
//                 {
//                     $project: { // Project the necessary fields from the order and product details
//                         _id: 1,
//                         userId: 1,
//                         orderNumber: 1,
//                         orderDate: 1,
//                         paymentStatus: 1,
//                         orderStatus: 1,
//                         cartData: 1,
//                         productDetails: 1
//                     }
//                 }
//             ]);
//             console.log("order from cancel", order)
//             if (!order) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "Order not found"
//                 });
//             }

//             // Find the specific product in cartData
//             const cartItemIndex = order.cartData.findIndex(item =>
//                 item.productId._id.toString() === productId
//             );

//             if (cartItemIndex === -1) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "Product not found in order"
//                 });
//             }

//             // Get the cart item
//             const cartItem = order.cartData[cartItemIndex];

//             // Check if already cancelled
//             if (cartItem.isCancelled) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Product already cancelled"
//                 });
//             }

//             // Mark the specific product as cancelled
//             cartItem.isCancelled = true;
//             order.cartData[cartItemIndex] = cartItem;

//             // Update product quantity (return to stock)
//             const product = await Product.findById(productId);
//             if (product) {
//                 product.quantity += cartItem.productQty;
//                 await product.save();
//             }

//             // If payment was completed, process refund
//             if (order.paymentStatus === 'Completed') {
//                 const user = await User.findById(order.userId);
//                 const refundAmount = cartItem.totalCostPerProduct;

//                 if (user) {
//                     // Initialize wallet if it doesn't exist
//                     user.wallet = (user.wallet || 0) + refundAmount;

//                     // Create wallet transaction if you have a Wallet model
//                     if (typeof Wallet !== 'undefined') {
//                         const transaction = new Wallet({
//                             userId: order.userId,
//                             amount: refundAmount,
//                             status: 'Refund',
//                             description: `Refund for cancelled product: ${product.productName}`
//                         });
//                         await transaction.save();

//                         if (!user.walletHistory) {
//                             user.walletHistory = [];
//                         }
//                         user.walletHistory.push(transaction._id);
//                     }

//                     await user.save();
//                 }
//             }
//         }
//     } catch (error) {
//         console.log(error)
//     }
// }

const cancelProduct = async (req, res) => {
    try {
        const { id: productId, orderId } = req.params;
        console.log("Cancelling product:", productId, "from order:", orderId);

        // Validate if the orderId is a valid ObjectId
        const { ObjectId } = require('mongodb');
        if (!ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid orderId format"
            });
        }

        // Fetch the order using findOne (simplified)
        const order = await Order.findOne({ _id: new ObjectId(orderId) }).populate('cartData.productId');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        console.log("Order found:", order);

        // Find the specific product in cartData
        const cartItemIndex = order.cartData.findIndex(item =>
            item.productId._id.toString() === productId
        );

        if (cartItemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Product not found in order"
            });
        }

        // Get the cart item
        const cartItem = order.cartData[cartItemIndex];

        // Check if already cancelled
        if (cartItem.isCancelled) {
            return res.status(400).json({
                success: false,
                message: "Product already cancelled"
            });
        }
        const deductAmount = cartItem.totalCostPerProduct;

        // Mark the specific product as cancelled
        cartItem.isCancelled = true;
        order.cartData[cartItemIndex] = cartItem;


        const newTotalAmount = order.cartData.reduce((total, item) => {
            if (!item.isCancelled) {
                return total + item.totalCostPerProduct;
            }
            return total;
        }, 0);

        // Update order totals
        order.grandTotalCost = newTotalAmount;
        order.grandTotalAfterDiscount = newTotalAmount;




        // Update product quantity (return to stock)
        const product = await Product.findById(productId);
        if (product) {
            product.quantity += cartItem.productQty;
            await product.save();
        }



      



        // If payment was completed, process refund
        if (order.paymentStatus === 'Completed') {
            const user = await User.findById(order.userId);
            const refundAmount = cartItem.totalCostPerProduct;

            if (user) {
                // Initialize wallet if it doesn't exist
                user.wallet = (user.wallet || 0) + refundAmount;

                // Create wallet transaction if you have a Wallet model
                if (typeof Wallet !== 'undefined') {
                    const transaction = new Wallet({
                        userId: order.userId,
                        amount: refundAmount,
                        status: 'Refund',
                        description: `Refund for cancelled product: ${product.productName}`
                    });
                    await transaction.save();

                    if (!user.walletHistory) {
                        user.walletHistory = [];
                    }
                    user.walletHistory.push(transaction._id);
                }

                await user.save();
            }
        }

        // Save updated order
        await order.save();

        return res.status(200).json({
            success: true,
            message: "Product successfully cancelled",
            product: cartItem,
             newTotalAmount: order.grandTotalCost,
            newGrandTotal: order.grandTotalAfterDiscount
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// const returnProduct = async (req, res) => {
//     try {
//         const { productId, orderId } = req.params;

//         const order = await Order.findOne({ _id: orderId }).populate('cartData.productId');
//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Order not found"
//             });
//         }

//         const cartItemIndex = order.cartData.findIndex(item => item.productId._id.toString() === productId);
//         if (cartItemIndex === -1) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Product not found in order"
//             });
//         }

//         const cartItem = order.cartData[cartItemIndex];
//         if (cartItem.isCancelled) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Product has already been canceled"
//             });
//         }

//         // Calculate refund based on product quantity
//         const refundAmount = cartItem.totalCostPerProduct * cartItem.productQty;

//         // Update order totals
//         order.grandTotalCost -= refundAmount;
//         order.grandTotalAfterDiscount -= refundAmount;

//         // Process the refund
//         const user = await User.findById(order.userId);
//         if (user) {
//             user.wallet += refundAmount;

//             const transaction = new Wallet({
//                 userId: user._id,
//                 amount: refundAmount,
//                 status: 'Refund',
//                 description: `Refund for returned product: ${cartItem.productId.productName}`,
//             });
//             await transaction.save();

//             // Update user's wallet history
//             if (!user.walletHistory) user.walletHistory = [];
//             user.walletHistory.push(transaction._id);
//             await user.save();
//         }

//         // Mark the product as returned (canceled)
//         cartItem.isCancelled = true;
//         order.cartData[cartItemIndex] = cartItem;

//         await order.save();

//         return res.status(200).json({
//             success: true,
//             message: "Product successfully returned and refunded",
//             newTotalAmount: order.grandTotalCost,
//             newGrandTotal: order.grandTotalAfterDiscount,
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({
//             success: false,
//             message: "Internal server error"
//         });
//     }
// };





const returnProduct = async (req, res) => {
    try {
        const { productId, orderId } = req.params;

        // Fetch the order and populate cartData with the product details
        const order = await Order.findOne({ _id: orderId }).populate('cartData.productId');
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Find the specific product in cartData
        const cartItemIndex = order.cartData.findIndex(item => item.productId._id.toString() === productId);
        if (cartItemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Product not found in order"
            });
        }

        const cartItem = order.cartData[cartItemIndex];

        // Check if the product has already been returned
        if (cartItem.isReturned) {
            return res.status(400).json({
                success: false,
                message: "Product already returned"
            });
        }

        // Calculate the refund amount based on product quantity
        const refundAmount = cartItem.totalCostPerProduct * cartItem.productQty;

        // Update the order totals
        order.grandTotalCost -= refundAmount;
        order.grandTotalAfterDiscount -= refundAmount;

        // Process refund (e.g., credit wallet)
        const user = await User.findById(order.userId);
        if (user) {
            user.wallet += refundAmount;

            // Create a wallet transaction record for the refund
            const transaction = new Wallet({
                userId: user._id,
                amount: refundAmount,
                status: 'Refund',
                description: `Refund for returned product: ${cartItem.productId.productName}`,
            });
            await transaction.save();

            // Update wallet history if it exists
            if (!user.walletHistory) user.walletHistory = [];
            user.walletHistory.push(transaction._id);
            await user.save();
        }

        // Mark the product as returned
        order.cartData[cartItemIndex].isReturned = true;

        // Save the updated order
        await order.save();


        console.log("Updated Order after return:", order);


        // Return updated data to the frontend
        return res.status(200).json({
            success: true,
            message: "Product successfully returned and refunded",
            newTotalAmount: order.grandTotalCost,
            newGrandTotal: order.grandTotalAfterDiscount,
            updatedOrder: order // Send the updated order data back to the frontend
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};



module.exports = {
    getUserOrders,
    cancelOrder,
    orderStatusPage,
    processOrderPayment,
    handleOrderCancellation,
    returnOrder,
    cancelProduct,
    returnProduct,
}