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
        const userCartData = await Cart.find({ userId: req.session.user._id || req.session.user }).populate('productId');
        console.log("userCartData",userCartData);
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
            if(userCartData.length<3){
                await Cart.create({
                    userId,
                    productId,
                    productQty,
                    currentUser: req.session.user,
                    totalCostPerProduct,
                });
                return res.json({success:true,message:"Item added to cart"});
            }else{
                return res.json({success:false,message:"You have reached the cart limit"});

            }
            
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
        delete req.session.discountAmount;
        
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

       
   // Validate stock before proceeding
   for (const item of cartData) {
    const product = await Product.findById(item.productId._id);
    
    if (!product || product.quantity < item.productQty) {
        // Redirect to cart with error message
        req.session.stockError = `${item.productId.productName} is out of stock or has insufficient quantity`;
        return res.redirect('/mycart');
    }
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

        let availableCoupons = await Coupon.find({
            expireOn: { $gte: new Date() },  // Only valid coupons
        });
        
        // Filter out coupons the user has already used
        availableCoupons = availableCoupons.filter(coupon => {
            // Access the usage count for the user in usageCountByUser
            const userUsageCount = coupon.usageCountByUser[user._id] || 0;  // Default to 0 if user hasn't used the coupon
            return userUsageCount < coupon.usageLimitPerCustomer; // Only show coupons the user can still use
        });
        if (availableCoupons.length === 0) {
            console.log("No available coupons.");
            // Optionally, you can add a message to the response to inform the user
            req.session.noCouponsAvailable = true;
        } else {
            req.session.noCouponsAvailable = false;
        }
        
        console.log("Available Coupons: ", availableCoupons);

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
                availableCoupons,
                noCouponsAvailable: req.session.noCouponsAvailable

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
                availableCoupons,
                noCouponsAvailable: req.session.noCouponsAvailable

            });
        }



    } catch (error) {
        console.log(error);
        res.redirect("/addAddress");
    }
};
// const checkoutPage = async (req, res) => {
//     try {
//         console.log('Selected address:', req.body.addressChosen);
//         const user = await User.findById(req.session.user._id || req.session.user);
//         const orderId = req.body.orderId;

//         if (!req.session.user || !req.session.user._id) {
//             return res.redirect('/login');
//         }

//         const cartData = await Cart.find({ userId: req.session.user._id || req.session.user}).populate('productId');
//         let addressData = await Address.find({ userId: req.session.user._id || req.session.user});
//         const addressId = addressData._id;

//         if (addressData.length === 0) {
//             return res.redirect("/addAddress");
//         }

//         let totalAmount = 0;
//         cartData.forEach(item => {
//             totalAmount += item.productId.salePrice * item.productQty;
//         });

//         if (req.session.couponApplied && req.session.discountAmount) {
//             totalAmount = totalAmount - req.session.discountAmount;
//         }

//         req.session.grandTotal = totalAmount;

//         // Fetch available coupons before if/else block
//         const availableCoupons = await Coupon.find({
//             expireOn: { $gt: new Date() },
//             minimumPrice: { $lte: totalAmount },
//             isList: true
//         }).lean();

//         // Filter coupons based on usage limit
//         const filteredCoupons = availableCoupons.filter(coupon => {
//             const userUsageCount = coupon.usageCountByUser[user._id] || 0;
//             return userUsageCount < coupon.usageLimitPerCustomer;
//         });

//         if (req.body.addressChosen) {
//             const order = await Order.create({
//                 userId: req.session.user._id || req.session.user,
//                 orderNumber: (await Order.countDocuments()) + 1,
//                 orderDate: new Date(),
//                 addressChosen: req.body.addressChosen,
//                 cartData: await grandTotal(req, res),
//                 grandTotalCost: req.session.grandTotal,
//             });

//             req.session.currentOrder = req.session.order;
//             req.session.currentorderId = req.session.order._id;
//             req.session.save((err) => {
//                 if (err) {
//                     console.error('Error saving session:', err);
//                 }
//             });

//             return res.render("checkout", {
//                 user: req.session.user,
//                 grandTotal: req.session.grandTotal,
//                 userCartData: await grandTotal(req, res),
//                 cartData,
//                 addressData,
//                 addressId,
//                 totalAmount,
//                 couponApplied: req.session.couponApplied,
//                 couponName: req.session.couponName,
//                 discountAmount: req.session.discountAmount,
//                 walletBalance: user.wallet,
//                 currentOrderId: orderId,
//                 availableCoupons: filteredCoupons
//             });
//         } else {
//             return res.render("checkout", {
//                 user: req.session.user,
//                 grandTotal: req.session.grandTotal,
//                 userCartData: await grandTotal(req, res),
//                 cartData,
//                 addressData,
//                 addressId,
//                 totalAmount,
//                 couponApplied: req.session.couponApplied,
//                 couponName: req.session.couponName,
//                 discountAmount: req.session.discountAmount,
//                 walletBalance: user.wallet,
//                 availableCoupons: filteredCoupons,
//                 currentOrderId: orderId || null
//             });
//         }

//     } catch (error) {
//         console.error("Checkout error:", error);
//         res.redirect("/addAddress");
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

        let discountAmount = req.session.discountAmount || 0;  

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
                paymentStatus: 'Completed'
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
                    let orderId = req.session.currentOrder._id;
                    await Order.findByIdAndUpdate(orderId,{
                        paymentType: 'Pending',
                    })
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


   
    const applyCoupon = async (req, res) => {
        try {
            const { name } = req.body;
            const userId = req.session.user._id;
            let couponData = await Coupon.findOne({ name });
            // console.log("req.session",req.session);
            
           
            if (couponData) {




                let usageCount = couponData.usageCountByUser[userId] || 0;

            // Check if the user has exceeded the usage limit
            if (usageCount >= couponData.usageLimitPerCustomer) {
                return res.json({
                    success: false,
                    message: "You have already used this coupon the maximum number of times.",
                });
            }
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
                if (!expiryDateCheck) {
                    return res.json({
                        success: false,
                        message: "Coupon has expired.",
                    });
                }
                

                if (minimumPurchaseCheck && expiryDateCheck) {
                    const discountAmount = parseFloat(couponData.offerPrice);
                    const grandTotalAfterDiscount = grandTotal - discountAmount;

                    req.session.grandTotal = grandTotalAfterDiscount;
                    req.session.couponApplied = true;
                    req.session.couponName = name;
                    req.session.discountAmount = discountAmount;

                    couponData.usageCountByUser[userId] = usageCount + 1;

                    await couponData.save();


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
        console.log("req.body from razorpay",req.body);
        
        try {
            const options = {
                amount: req.body.amount - ((req.session.discountAmount || 0) * 100),
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
            const transaction = new Wallet({
                userId: order.userId, 
                amount: order.grandTotalCost,
                status: 'Debited',
                description: `Debited for purchased order #${order.orderNumber}`
            });

            
            await transaction.save();
            user.walletHistory.push(transaction._id);

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

    const validateStock = async (req, res) => {
        try {
            const userId = req.session.user._id || req.session.user;
            
            // Get cart items with product details
            const cartItems = await Cart.find({ userId }).populate('productId');
            
            let outOfStockItems = [];
    
            // Check each cart item
            for (const item of cartItems) {
                // Get current product stock
                const product = await Product.findById(item.productId._id);
                
                if (!product) {
                    outOfStockItems.push('Product not found');
                    continue;
                }
    
                // Check if requested quantity is available
                if (product.quantity < item.productQty) {
                    outOfStockItems.push(product.productName);
                }
            }
    
            if (outOfStockItems.length > 0) {
                return res.json({
                    valid: false,
                    message: `The following items are out of stock: ${outOfStockItems.join(', ')}`
                });
            }
    
            res.json({ valid: true });
    
        } catch (error) {
            console.error('Stock validation error:', error);
            res.status(500).json({
                valid: false,
                message: 'Error validating stock'
            });
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
        validateStock,
    };
