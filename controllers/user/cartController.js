const User = require('../../models/userSchema');
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose");
const razorpay = require('../../config/razorpay');
const crypto = require('crypto');
const Wallet = require("../../models/walletSchema")


const grandTotal = async (req, res) => {
    try {
        let userCartData = await Cart.find({ userId: req.session.user._id }).populate('productId');

        let grandTotal = 0;

        for (const cartItem of userCartData) {
            if (isNaN(cartItem.productId.salePrice) || isNaN(cartItem.productQty)) {
                throw new Error(`Invalid price or quantity for product: ${cartItem.productId.productName}`);
            }

            const totalCostPerProduct = cartItem.productId.salePrice * cartItem.productQty;
            if (isNaN(totalCostPerProduct)) {
                throw new Error(`Invalid total cost calculation for product: ${cartItem.productId.productName}`);
            }

            cartItem.totalCostPerProduct = totalCostPerProduct;
            grandTotal += totalCostPerProduct;

            await cartItem.save();
        }

        req.session.grandTotal = grandTotal;

        return JSON.parse(JSON.stringify(userCartData));
    } catch (error) {
        console.log("Error calculating grand total:", error);
        res.status(500).send("Error calculating grand total");
    }
};

const getMyCart = async (req, res) => {
    console.log("req.session.user",req.session.user);
    
    if (req.session.user) {
        try {
            const userCartData = await Cart.find({ userId: req.session.user._id || req.session.user }).populate('productId');
            const updatedCartData = userCartData.map(item => {
                const productStock = item.productId.quantity;
                const itemTotal = item.productQty * item.productId.salePrice;
                return {
                    ...item.toObject(),
                    productStock,
                    itemTotal,
                };
            });

            const grandTotal = updatedCartData.reduce((total, item) => total + item.itemTotal, 0);

            req.session.grandTotal = grandTotal;

            res.render('myCart', {
                userCartData: updatedCartData,
                grandTotal: grandTotal,
            });
        } catch (error) {
            console.error("Error fetching cart data:", error);
            res.render('myCart', { userCartData: [], grandTotal: 0 });
        }
    } else {
        res.redirect('/login');
    }
};

const addToCart = async (req, res) => {
    try {
        // const userId = req.session.user._id;
        console.log("Session Data:", req.session); // Log the session data
        const productId = req.params.id;
        const productQty = req.body.productQty || 1;
        const userId = req.session.user || req.session.user._id;
        if (!userId) {
            return res.status(400).send('User is not authenticated');
        }
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).send("Invalid product ID format");
        }

        let existingProduct = await Cart.findOne({ userId, productId });

        if (!existingProduct) {
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).send('Product not found');
            }

            const totalCostPerProduct = productQty * product.salePrice;
            await Cart.create({
                userId,
                productId,
                productQty,
                currentUser: req.session.user,
                totalCostPerProduct,
            });
        } else {
            await Cart.updateOne({ _id: existingProduct._id }, { $inc: { productQty: productQty } });
        }

        res.redirect("/mycart");
    } catch (error) {
        console.error("Error in addToCart:", error);
        res.status(500).send("Internal Server Error");
    }
};

const deleteFromCart = async (req, res) => {
    try {
        await Cart.findOneAndDelete({ _id: req.params.id });
        res.send("Cart item deleted successfully");
    } catch (error) {
        console.error(error);
    }
};

const decQty = async (req, res) => {
    try {
        let cartProduct = await Cart.findOne({ _id: req.params.id }).populate("productId");
        if (cartProduct.productQty > 1) {
            cartProduct.productQty--;
            cartProduct.totalCostPerProduct = cartProduct.productQty * cartProduct.productId.salePrice;
            cartProduct = await cartProduct.save();
        }

        await grandTotal(req, res);
        res.json({
            success: true,
            cartProduct,
            grandTotal: req.session.grandTotal,
        });
    } catch (error) {
        console.error(error);
    }
};

const incQty = async (req, res) => {
    try {
        let cartProduct = await Cart.findOne({ _id: req.params.id }).populate("productId");
        if (cartProduct.productQty < cartProduct.productId.quantity) {
            cartProduct.productQty++;
            cartProduct.totalCostPerProduct = cartProduct.productQty * cartProduct.productId.salePrice;
            cartProduct =  await cartProduct.save();
        }
        

        await grandTotal(req, res);
        res.json({
            success: true,
            cartProduct,
            grandTotal: req.session.grandTotal,
        });
    } catch (error) {
        console.error(error);
    }
};

const checkoutPage = async (req, res) => {
    try {
        
        
        console.log('Selected address:', req.body.addressChosen);
        const user = await User.findById(req.session.user._id || req.session.user);
        const orderId = req.body.orderId;
        console.log(req.body);

        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/login');
        }

        const cartData = await Cart.find({ userId: req.session.user._id || req.session.user}).populate('productId');
        let addressData = await Address.find({ userId: req.session.user._id || req.session.user});
        const addressId = addressData._id;

        if (addressData.length === 0) {
            return res.redirect("/addAddress");
        }

        let totalAmount = 0;
        cartData.forEach(item => {
            totalAmount += item.productId.salePrice * item.productQty;
        });


        if (req.session.couponApplied && req.session.discountAmount) {
            totalAmount = totalAmount - req.session.discountAmount;
        }

        // Store in session
        req.session.grandTotal = totalAmount;

        console.log('Total Amount:', totalAmount);



        if (req.body.addressChosen) {
            const order = await Order.create({
                userId: req.session.user._id || req.session.user,
                orderNumber: (await Order.countDocuments()) + 1,
                orderDate: new Date(),
                addressChosen: req.body.addressChosen,
                cartData: await grandTotal(req, res),
                grandTotalCost: req.session.grandTotal,
            });
            console.log('Session before creating order:', req.session);
            console.log("Order created successfully:", order);
            req.session.currentOrder = req.session.order;
            req.session.currentorderId = req.session.order._id;
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving session:', err);
                } else {
                    console.log('Session after creating order:', req.session);
                }
            });
            console.log('Session after creating order:', req.session);
            res.render("checkout", {
                user: req.session.user,
                grandTotal: req.session.grandTotal,
                userCartData: await grandTotal(req, res),
                cartData,
                addressData,
                addressId,
                totalAmount,
                couponApplied: req.session.couponApplied,
                couponName: req.session.couponName,
                discountAmount: req.session.discountAmount,
                walletBalance: user.wallet,
                currentOrderId: orderId,
            });
            console.log("CARTDATA NEW ",cartData);
            

        } else {

            console.log("address data", addressData);
            return res.render("checkout", {
                user: req.session.user,
                grandTotal: req.session.grandTotal,
                userCartData: await grandTotal(req, res),
                cartData,
                addressData,
                addressId,
                // error: "Please select an address before proceeding",
                totalAmount,
                couponApplied: req.session.couponApplied,
                couponName: req.session.couponName,
                discountAmount: req.session.discountAmount,
                walletBalance: user.wallet,

                currentOrderId: orderId || null,

            });
        }



    } catch (error) {
        console.log(error);
        res.redirect("/addAddress");
    }
};


// const processOrder = async (req, res) => {
//     try {

//         const user = await User.findById(req.session.user._id);
//         const selectedAddressId = req.body.addressChosen; 
//         console.log("Selected address ID:", selectedAddressId);
//         const {paymentMethod,orderId} = req.body;
//         const orderTotal = req.session.grandTotal;

//         const selectedAddressDoc = await Address.findOne({
//             userId: req.session.user._id,
//             "address._id": selectedAddressId, 
//         });

//         if (!selectedAddressDoc) {
//             return res.status(400).send('Invalid address selection.');
//         }

//         const selectedAddress = selectedAddressDoc.address.find(
//             addr => addr._id.toString() === selectedAddressId
//         );

//         if (!selectedAddress) {
//             return res.status(400).send('Address not found in the address array.');
//         }

//         if (paymentMethod === 'wallet') {
//             if (user.wallet >= orderTotal) {
//                 // Deduct the order total from the wallet
//                 user.wallet -= orderTotal;

//                 // Save the transaction in wallet history
//                 const transaction = new Wallet({
//                     amount: -orderTotal,
//                     status: 'Payment',
//                     description: `Payment for order`
//                 });

//                 await transaction.save();
//                 user.walletHistory.push(transaction._id);
//                 await user.save();

//                 const updatedOrder = await Order.findByIdAndUpdate(
//                     orderId,
//                     {
//                         paymentType: 'Wallet', // Set payment type to wallet
//                         orderStatus: 'Paid', // Update order status to Paid
//                         grandTotalCost: orderTotal // Update the grand total cost if necessary
//                     },
//                     { new: true } // Return the updated document
//                 );

//                 if (!updatedOrder) {
//                     return res.status(404).send('Order not found');
//                 }






//                 console.log('Payment successful using wallet');
//                 return res.json({ success: true });
//             } else {
//                 return res.status(400).send('Insufficient wallet balance');
//             }
//         }

//         if (!req.session.currentOrder) {
//             console.log('Creating a new order in session...');

//             const newOrder = await Order.create({
//                 userId: req.session.user._id,
//                 orderNumber: (await Order.countDocuments()) + 1, 
//                 orderDate: new Date(),
//                 paymentType: "Pending",
//                 orderStatus: "Pending",
//                 cartData: await grandTotal(req, res),
//                 grandTotalCost: req.session.grandTotal,
//                 addressChosen: selectedAddress, 
//                 couponApplied: req.session.couponApplied || false,
//                 couponName: req.session.couponName || null,
//                 discountAmount: req.session.discountAmount || 0,
//             });

//             req.session.currentOrder = {
//                 ...newOrder.toObject(),  
//                 addressChosen: selectedAddress, 
//             };

//             console.log('New order created:', req.session.currentOrder); 
//             // res.redirect('/checkout/orderPlacedEnd')
//         } else {
//             req.session.currentOrder.addressChosen = selectedAddress;
//         }

//         req.session.save((err) => {
//             if (err) {
//                 console.error('Error saving session:', err);
//                 return res.status(500).send('Error saving session.');
//             }
//             console.log('Session after creating/updating order:', req.session);
//         });


//     } catch (error) {
//         console.error("Error processing order:", error);
//         res.status(500).send('Error processing your order.');
//     }
// };







// const orderPlaced = async (req, res) => {
//     try {
//         if (!req.session.currentOrder || !req.session.currentOrder._id) {
//             return res.status(400).json({ success: false, message: "No order found in session" });
//         }

//         console.log("Updating order with ID:", req.session.currentOrder._id);

//         const result = await Order.updateOne(
//             { _id: req.session.currentOrder._id },
//             { $set: { paymentId: "generatedAtDelivery", paymentType: "COD" } }
//         );


//       console.log("ed");
//       res.json({ success: true });
//         if (result.nModified === 0) {
//             return res.status(404).json({ success: false, message: "Order not found or already updated" });
//         }

//         res.json({ success: true, message: "Order updated successfully" });
//     } catch (error) {
//         console.error("Error while updating order:", error);
//         res.status(500).json({ success: false, message: "Internal server error" });
//     }
// };


// const processOrder = async (req, res) => {
//     try {
//         const userId=req.session.user._id;
//         const selectedAddressId = req.body.addressChosen; 
//         console.log("Selected address ID:", selectedAddressId);
//         console.log("REQUEST BODY:",req.body);

//         const { paymentMethod, addressChosen, orderId } = req.body; // Get payment method, address, and order ID from the request
//         const totalAmount = req.session.grandTotal; // Assuming grandTotal is stored in session

//         if (paymentMethod === 'wallet') {
//             const walletResult = await processWalletPayment(userId, totalAmount, orderId);
//             if (!walletResult.success) {
//                 return res.json({ success: false, message: walletResult.message });
//             }
//             return res.json({ success: true });
//         }

//         const selectedAddressDoc = await Address.findOne({
//             userId: req.session.user._id,
//             "address._id": selectedAddressId, 
//         });

//         if (!selectedAddressDoc) {
//             return res.status(400).send('Invalid address selection.');
//         }

//         const selectedAddress = selectedAddressDoc.address.find(
//             addr => addr._id.toString() === selectedAddressId
//         );

//         if (!selectedAddress) {
//             return res.status(400).send('Address not found in the address array.');
//         }

//         if (!req.session.currentOrder) {
//             console.log('Creating a new order in session...');

//             const newOrder = await Order.create({
//                 userId: req.session.user._id,
//                 orderNumber: (await Order.countDocuments()) + 1, 
//                 orderDate: new Date(),
//                 paymentType: "Pending",
//                 orderStatus: "Pending",
//                 cartData: await grandTotal(req, res),
//                 grandTotalCost: req.session.grandTotal,
//                 addressChosen: selectedAddress, 
//                 couponApplied: req.session.couponApplied || false,
//                 couponName: req.session.couponName || null,
//                 discountAmount: req.session.discountAmount || 0,
//             });

//             req.session.currentOrder = {
//                 ...newOrder.toObject(),  
//                 addressChosen: selectedAddress, 
//             };

//             console.log('New order created:', req.session.currentOrder); 
//         } else {
//             req.session.currentOrder.addressChosen = selectedAddress;
//         }

//         req.session.save((err) => {
//             if (err) {
//                 console.error('Error saving session:', err);
//                 return res.status(500).send('Error saving session.');
//             }
//             console.log('Session after creating/updating order:', req.session);
//         });


//     } catch (error) {
//         console.error("Error processing order:", error);
//         res.status(500).send('Error processing your order.');
//     }
// };


const processOrder = async (req, res) => {
    try {
        const userId=req.session.user._id || req.session.user;
        const selectedAddressId = req.body.addressChosen; 
        
        const cartItems = await Cart.find({ userId }); 
       

        const blockedProducts = await Promise.all(
            cartItems.map(async (item) => {
                const product = await Product.findById(item.productId);
                return product.isBlocked;  // Return true if product is blocked
            })
        );

  
       

        let grandTotalCost = 0;
        cartItems.forEach(item => {
            grandTotalCost += item.productQty * item.totalCostPerProduct; 
        });

        let discountAmount = req.body.discountAmount || 0;  

        const grandTotalAfterDiscount = grandTotalCost - discountAmount;
        
        const { paymentMethod, addressChosen, orderId } = req.body; 
        const totalAmount = req.session.grandTotal; 

        if (paymentMethod === 'wallet') {
            const walletResult = await processWalletPayment(userId, totalAmount, orderId);
            if (!walletResult.success) {
                return res.json({ success: false, message: walletResult.message });
            }
            return res.json({ success: true });
        }
      
        const selectedAddressDoc = await Address.findOne({
            userId: req.session.user._id || req.session.user,
            "address._id": selectedAddressId, 
        });

        if (!selectedAddressDoc) {
            return res.status(400).send('Invalid address selection.');
        }

        const selectedAddress = selectedAddressDoc.address.find(
            addr => addr._id.toString() === selectedAddressId
        );

        if (!selectedAddress) {
            return res.status(400).send('Address not found in the address array.');
        }

        if (!req.session.orderId) {
            console.log('Creating a new order in session...');
            // console.log("CARTDATA NEW ",cartData);
            
            const newOrder = await Order.create({
                userId: req.session.user._id || req.session.user,
                orderNumber: (await Order.countDocuments()) + 1, 
                orderDate: new Date(),
                paymentType: "Pending",
                orderStatus: "Pending",
                cartData: await grandTotal(req, res),
                grandTotalCost: req.session.grandTotal,
                addressChosen: selectedAddress, 
                couponApplied: req.session.couponApplied || false,
                couponName: req.session.couponName || null,
                discountAmount: req.session.discountAmount || 0,
                grandTotalAfterDiscount,
            });

            req.session.currentOrder = {
                ...newOrder.toObject(),  
                addressChosen: selectedAddress, 
            };

            console.log('New order created:', req.session.currentOrder); 
        } else {
            req.session.currentOrder.addressChosen = selectedAddress;
        }

        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.status(500).send('Error saving session.');
            }
            console.log('Session after creating/updating order:', req.session);
           
        console.log("REQ.BODY",req.session.currentOrder._id);
        });


    } catch (error) {
        console.error("Error processing order:", error);
        res.status(500).send('Error processing your order.');
    }
};



    const orderPlaced = async (req, res) => {
        try {
            await Order.findByIdAndUpdate(req.session.currentOrder._id, {
                paymentType: 'COD',
                paymentStatus: 'Pending'
            });
            if(req.session.grandTotal >1000){
                return res.status(400).json({success:false,message:"No COD available for orders above 1000 rupees"});
             }
            res.json({ success: true });
        } catch (error) {
            console.error("Error updating order:", error);
            res.status(500).json({ success: false });
        }
    };



    const orderPlacedEnd = async (req, res) => {
        try {
            const user = req.session.user;
            const userId = req.session.user._id || req.session.user;
            let addressData = await Address.find({ userId: req.session.user._id || req.session.user });
            const addressId = addressData._id;
            const cartData = await Cart.find({ userId: req.session.user._id || req.session.user}).populate('productId');

            console.log("req.session.currentOrder",req.session.currentOrder);
            
             const orderId = req.session.currentOrder._id;
           

            

            console.log("Session data:", req.session);
            console.log("Order ID from session:", req.session.currentOrder?._id);

            
            if (!req.session.currentOrder || !req.session.currentOrder._id) {
                return res.status(400).send('No order found in session');
            }

            const cartItems = await Cart.find({ userId });



            // const blockedProducts = await Promise.all(
            //     cartItems.map(async (item) => {
            //         const product = await Product.findById(item.productId);
            //         return product.isBlocked;  // Return true if product is blocked
            //     })
            // );

           

            console.log(cartData);


            for (const item of cartData) {
                if (item.productId.status !== 'Available') {
                    return res.status(400).send(`Product ${item.productId.productName} is currently not available.`);
                }
                if (item.productId.isBlocked===true) {
                    return res.status(400).json({success:false,message:"One or more products are blocked"});
                }
                if (item.productId.quantity < item.productQty) {
                    return res.status(400).send(`Insufficient stock for product ${item.productId.productName}. Only ${item.productId.quantity} available.`);
                }
            }

            for (const item of cartData) {
                if (item.productId) {
                    item.productId.quantity -= item.productQty;
                    item.productId.stockSold += item.productQty;

                    item.productId.salesCount += item.productQty;

                    await item.productId.save();
                    const categoryId = item.productId.category; // Assuming category is stored in productId
                    await Category.findByIdAndUpdate(categoryId, {
                        $inc: { totalSales: item.productQty } // Increment totalSales
                    });
                }
            }

            let orderData = await Order.findOne({ _id: orderId });

            if (!orderData) {
                return res.status(400).send('Order not found');
            }

            if (orderData.paymentType === "Pending") {
                await Order.findByIdAndUpdate(orderData._id, {
                    $set: { paymentType: "COD", paymentStatus: "Completed" },
                });
            }

            await Cart.deleteMany({ userId: req.session.user._id || req.session.user });

            res.render("orderSuccess", {
                user: req.session.user,
                cartData,
                orderData: {
                    ...req.session.currentOrder,
                    couponApplied: req.session.couponApplied,
                    couponName: req.session.couponName,
                    discountAmount: req.session.discountAmount,
                    grandTotalCost: req.session.grandTotal
                },
            });

        } catch (error) {
            console.error("Error in orderPlacedEnd:", error);
            res.status(500).send("An error occurred while processing your order.");
        }
    };


    // const applyCoupon = async (req, res) => {
    //     try {
    //         const { name } = req.body;

    //         let couponData = await Coupon.findOne({ name });

    //         if (couponData) {
    //             let { grandTotal } = req.session;
    //             let { minimumPrice, expireOn , offerPrice} = couponData;

    //             const minimumPurchaseCheck = minimumPrice <= grandTotal;
    //             const expiryDateCheck = new Date() < new Date(expireOn);

    //             if (minimumPurchaseCheck && expiryDateCheck) {


    //                 const discountAmount = offerPrice;

    //         let { currentOrder } = req.session;

    //         if (currentOrder && currentOrder._id) {
    //             await Order.findByIdAndUpdate(currentOrder._id, {
    //                 $set: {
    //                     couponApplied: true,
    //                     couponName: name,  // Store the applied coupon's name
    //                     discountAmount,
    //                     grandTotalAfterDiscount,
    //                 },
    //             });
    //         }
    //         const grandTotalAfterDiscount = grandTotal - discountAmount;

    //         req.session.grandTotal = grandTotalAfterDiscount;


    //                 res.json({
    //                     success: true,
    //                     name,
    //                     discountAmount,
    //                     grandTotalAfterDiscount,
    //                     grandTotal,
    //                 });
    //             } else {
    //                 res.json({
    //                     success: false,
    //                     message: "Make a purchase of at least $" + minimumPrice + " to use this coupon.",
    //                     minimumPrice,
    //                 });
    //             }
    //         } else {
    //             res.json({
    //                 success: false,
    //                 message: "Coupon does not exist.",
    //             });
    //         }
    //     } catch (error) {
    //         console.error(error);
    //         res.status(500).send("Internal Server Error");
    //     }
    // };


    // const applyCoupon = async (req, res) => {
    //     try {
    //         const { name } = req.body;

    //         // Find the coupon data
    //         let couponData = await Coupon.findOne({ name });

    //         if (couponData) {
    //             let { grandTotal } = req.session;
    //             let { minimumPrice, expireOn, offerPrice } = couponData;

    //             // Check if the minimum purchase condition is met
    //             const minimumPurchaseCheck = minimumPrice <= grandTotal;

    //             // Check if the coupon has not expired
    //             const expiryDateCheck = new Date() < new Date(expireOn);

    //             if (minimumPurchaseCheck && expiryDateCheck) {
    //                 // Calculate the discount amount
    //                 const discountAmount = offerPrice;

    //                 // Calculate grand total after discount
    //                 const grandTotalAfterDiscount = grandTotal - discountAmount;

    //                 // Update the session with the new grand total after discount
    //                 req.session.grandTotal = grandTotalAfterDiscount;

    //                 let { currentOrder } = req.session;

    //                 // Check if there's an active order to update
    //                 if (currentOrder && currentOrder._id) {
    //                     // Update the order in the database with coupon details
    //                     await Order.findByIdAndUpdate(currentOrder._id, {
    //                         $set: {
    //                             couponApplied: true,
    //                             couponName: name,  // Store the applied coupon's name
    //                             discountAmount,     // Store the discount amount
    //                             grandTotalCost: grandTotalAfterDiscount, // Updated grand total after discount
    //                         },
    //                     });
    //                 }

    //                 // Return the response with coupon details and the new grand total
    //                 res.json({
    //                     success: true,
    //                     name,
    //                     discountAmount,
    //                     grandTotalAfterDiscount,
    //                     grandTotal,
    //                 });
    //             } else {
    //                 // If the minimum price is not met or coupon is expired
    //                 res.json({
    //                     success: false,
    //                     message: `Make a purchase of at least $${minimumPrice} to use this coupon.`,
    //                     minimumPrice,
    //                 });
    //             }
    //         } else {
    //             // Coupon not found
    //             res.json({
    //                 success: false,
    //                 message: "Coupon does not exist.",
    //             });
    //         }
    //     } catch (error) {
    //         console.error(error);
    //         res.status(500).send("Internal Server Error");
    //     }
    // };

    // const applyCoupon = async (req, res) => {
    //     try {
    //         const { name } = req.body;
    //         let couponData = await Coupon.findOne({ name });

    //         if (couponData) {
    //             let { grandTotal } = req.session;
    //             let { minimumPrice, expireOn, offerPrice } = couponData;

    //             const minimumPurchaseCheck = minimumPrice <= grandTotal;
    //             const expiryDateCheck = new Date() < new Date(expireOn);

    //             if (minimumPurchaseCheck && expiryDateCheck) {
    //                 const discountAmount = offerPrice;
    //                 const grandTotalAfterDiscount = grandTotal - discountAmount;

    //                 req.session.grandTotal = grandTotalAfterDiscount;
    //                 req.session.couponApplied = true;
    //                 req.session.couponName = name;
    //                 req.session.discountAmount = discountAmount;

    //                 console.log('Coupon applied:', {
    //                     couponName: name,
    //                     discountAmount,
    //                     grandTotalAfterDiscount
    //                 });

    //                 res.json({
    //                     success: true,
    //                     name,
    //                     discountAmount,
    //                     grandTotalAfterDiscount,
    //                     grandTotal,
    //                 });
    //             } else {
    //                 res.json({
    //                     success: false,
    //                     message: `Make a purchase of at least $${minimumPrice} to use this coupon.`,
    //                     minimumPrice,
    //                 });
    //             }
    //         } else {
    //             res.json({
    //                 success: false,
    //                 message: "Coupon does not exist.",
    //             });
    //         }
    //     } catch (error) {
    //         console.error(error);
    //         res.status(500).send("Internal Server Error");
    //     }
    // };

    const applyCoupon = async (req, res) => {
        try {
            const { name } = req.body;
            let couponData = await Coupon.findOne({ name });

            if (couponData) {
                // Convert grandTotal and minimumPrice to numbers
                let grandTotal = parseFloat(req.session.grandTotal);
                let minimumPrice = parseFloat(couponData.minimumPrice);

                console.log('Comparing prices:', {
                    grandTotal,
                    minimumPrice,
                    comparison: grandTotal >= minimumPrice
                });

                const minimumPurchaseCheck = grandTotal >= minimumPrice;
                const expiryDateCheck = new Date() < new Date(couponData.expireOn);

                if (minimumPurchaseCheck && expiryDateCheck) {
                    const discountAmount = parseFloat(couponData.offerPrice);
                    const grandTotalAfterDiscount = grandTotal - discountAmount;

                    req.session.grandTotal = grandTotalAfterDiscount;
                    req.session.couponApplied = true;
                    req.session.couponName = name;
                    req.session.discountAmount = discountAmount;

                    console.log('Coupon applied successfully:', {
                        couponName: name,
                        discountAmount,
                        grandTotalAfterDiscount,
                        originalTotal: grandTotal
                    });

                    res.json({
                        success: true,
                        name,
                        discountAmount,
                        grandTotalAfterDiscount,
                        grandTotal,
                    });
                } else {
                    console.log('Coupon validation failed:', {
                        minimumPurchaseCheck,
                        expiryDateCheck,
                        grandTotal,
                        minimumPrice
                    });

                    res.json({
                        success: false,
                        message: `Make a purchase of at least ₹${minimumPrice} to use this coupon.`,
                        minimumPrice,
                    });
                }
            } else {
                res.json({
                    success: false,
                    message: "Coupon does not exist.",
                });
            }
        } catch (error) {
            console.error('Error in applyCoupon:', error);
            res.status(500).send("Internal Server Error");
        }
    };


    const createRazorpayOrder = async (req, res) => {
        try {
            const options = {
                amount: req.body.amount,
                currency: 'INR',
                receipt: 'order_' + Date.now(),
            };

            const order = await razorpay.orders.create(options);
            res.json(order);
        } catch (error) {
            console.error('Error creating Razorpay order:', error);
            res.status(500).json({ error: 'Error creating order' });
        }
    };

    const verifyPayment = async (req, res) => {

        try {
            const {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            } = req.body;

            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest("hex");

            if (razorpay_signature === expectedSign) {
                await Order.findByIdAndUpdate(req.session.currentOrder._id, {
                    paymentId: razorpay_payment_id,
                    paymentType: 'Razorpay',
                    paymentStatus: 'Completed'
                });


                const orderData = await Order.findById(req.session.currentOrder._id).populate('cartData.productId');

                // Update totalSales for each category
                for (const item of orderData.cartData) {
                    const categoryId = item.productId.category; // Assuming category is stored in productId
                    await Category.findByIdAndUpdate(categoryId, {
                        $inc: { totalSales: item.productQty } // Increment totalSales
                    });
                }

                res.json({ success: true });
            } else {
                await Order.findByIdAndUpdate(req.session.currentOrder._id, {
                    paymentStatus: 'Failed'
                });
                res.json({ success: false });
            }
        } catch (error) {
            console.error('Error verifying payment:', error);
            res.status(500).json({ success: false });
        }
    }




    const removeCoupon = async (req, res) => {
        try {
            req.session.couponApplied = false;
            req.session.couponName = null;
            req.session.discountAmount = 0;

            const userId = req.session.user._id || req.session.user;
            const cartData = await Cart.find({ userId }).populate('productId');

            let grandTotal = 0;
            cartData.forEach(item => {
                grandTotal += item.productId.salePrice * item.productQty;
            });

            req.session.grandTotal = grandTotal;

            if (req.session.currentOrder && req.session.currentOrder._id) {
                await Order.findByIdAndUpdate(req.session.currentOrder._id, {
                    $set: {
                        couponApplied: false,
                        couponName: null,
                        discountAmount: 0,
                        grandTotalCost: grandTotal
                    }
                });
            }

            res.json({
                success: true,
                message: 'Coupon removed successfully',
                newTotal: grandTotal
            });

        } catch (error) {
            console.error('Error removing coupon:', error);
            res.status(500).json({
                success: false,
                message: 'Error removing coupon'
            });
        }
    };


    const processWalletPayment = async (req, res) => {
        console.log("REQ.BODY:", req.session.currentOrder._id);
        try {
            const paymentType = req.session.paymentType;

            const orderId = req.session.currentOrder._id;
            console.log("ORDERID", orderId);



            // Validate the order ID
            if (!orderId || !/^[0-9a-fA-F]{24}$/.test(orderId)) {
                console.error('Invalid Order ID:', orderId);
                return res.status(400).send('Invalid Order ID');
            }

            const order = await Order.findById(orderId);
            if (!order) {
                console.error('Order not found for ID:', orderId);
                return res.status(404).send('Order not found');
            }
            console.log("ORDER", order);

            const user = await User.findById(req.session.user._id || req.session.user);

            if (user.wallet < order.grandTotalCost) {
                return res.status(400).send('Insufficient wallet balance');
            }


            user.wallet -= order.grandTotalCost;
            await user.save();

            order.paymentType = "Wallet";
            order.status = 'Paid';
            await order.save();
            const cartData = await Cart.find({ userId: req.session.user._id || req.session.user }).populate('productId');
            console.log("CARTDATA", cartData);



            let product_id;
            let productData;
            for (let i = 0; i < cartData.length; i++) {
                console.log("inside for loop");
                product_id = cartData[i].productId._id;
                productData = await Product.findById(product_id);
                // productData.quantity -= cartData[i].productQty;
                if (productData) {
                    productData.quantity -= cartData[i].productQty;
                    await productData.save();
                    const categoryId = productData.category; // Assuming category is stored in productData
                await Category.findByIdAndUpdate(categoryId, {
                    $inc: { totalSales: cartData[i].productQty } // Increment totalSales
                });
                }
                console.log("for loop variables", cartData[i].productId.quantity, cartData[i].productQty);

            }
            console.log("CARTDATA new", cartData);


            await Cart.deleteMany({ userId: req.session.user._id || req.session.user});

            res.render("orderSuccess", {
                user: req.session.user,
                cartData,
                orderData: {
                    ...req.session.currentOrder,
                    couponApplied: req.session.couponApplied,
                    couponName: req.session.couponName,
                    discountAmount: req.session.discountAmount,
                    grandTotalCost: req.session.grandTotal
                },
            });
        } catch (error) {
            console.error("Error processing wallet payment:", error);
            res.status(500).send('Error processing payment.');
        }
    };




    module.exports = {
        getMyCart,
        addToCart,
        deleteFromCart,
        incQty,
        decQty,
        checkoutPage,
        processOrder,
        orderPlaced,
        orderPlacedEnd,
        applyCoupon,
        createRazorpayOrder,
        verifyPayment,
        removeCoupon,
        processWalletPayment,
    };
