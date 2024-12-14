const Order = require("../../models/orderSchema.js");
const User = require("../../models/userSchema.js");
const Wallet = require("../../models/walletSchema.js")

// order management page
const orderManagement = async (req, res) => {
  try {
    let page = Number(req.query.page) || 1;
    let limit = 15;
    let skip = (page - 1) * limit;

    let count = await Order.find().estimatedDocumentCount();
    let orderData = await Order
      .find()
      .populate("userId").skip(skip).limit(limit);
     
    console.log(orderData[0]);
    console.log("order data::::",orderData);
    res.render("orderManagement", { orderData, count, limit, currentPage: page,
      totalPages: Math.ceil(count / limit) });
  } catch (error) {
    console.error(error);
  }
};

// pending
const changeStatusPending = async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log("orderId:::::::::::::::::::::::",orderId);
    await Order.findOneAndUpdate(
      { _id: req.params.id },
      { $set: { orderStatus: "Pending" } }
    );
    res.redirect("/admin/orderManagement");
  } catch (error) {
    console.error(error);
  }
};

//shipped
const changeStatusShipped = async (req, res) => {

  try {
    const orderId = req.params.id;
    console.log("orderId:::::::::::::::::::::::",orderId);
    
    await Order.findOneAndUpdate(
      { _id: orderId},
      { $set: { orderStatus: "Shipped" } },
      {new:true}
    );
    res.redirect("/admin/orderManagement");
  } catch (error) {
    console.error(error);
  }
};

//deliverd
const changeStatusDelivered = async (req, res) => {
  try {
    await Order.findOneAndUpdate(
      { _id: req.params.id },
      { $set: { orderStatus: "Delivered" } }
    );
    res.redirect("/admin/orderManagement");
  } catch (error) {
    console.error(error);
  }
};

//return
// const changeStatusReturn = async (req, res) => {
//   try {
//     await Order.findOneAndUpdate(
//       { _id: req.params.id },
//       { $set: { orderStatus: "Return" } }
//     );
//     res.redirect("/admin/orderManagement");
//   } catch (error) {
//     console.error(error);
//   }
// };

// const changeStatusReturn = async (req, res) => {
//   try {
//     const order = await Order.findOne({ _id: req.params.id }).populate("userId");
//     if (!order) {
//       throw new Error('Order not found');
//     }

//     const refundAmount = order.grandTotalCost - order.discountAmount;

//     const user = await User.findById(order.userId._id);
//     if (user) {
//       user.wallet += refundAmount;

//       const transaction = new Wallet({
//         amount: refundAmount,
//         status: 'Returned',
//         description: `Refund for order #${order.orderNumber}`
//       });

//       await transaction.save();
//       user.walletHistory.push(transaction._id);
//       await user.save();
//     }

//     order.orderStatus = "Return";
//     await order.save();
//     console.log('Wallet History:', user.walletHistory);
//     res.redirect("/admin/orderManagement");
//   } catch (error) {
//     console.error('Error processing return:', error);
//     res.status(500).send('Server Error');
//   }
// };


const changeStatusReturn = async (req, res) => {
  try {
    // Fetch the order and populate the userId field
    const order = await Order.findOne({ _id: req.params.id }).populate("userId");
    if (!order) {
      throw new Error('Order not found');
    }

    // Calculate the refund amount
    const refundAmount = order.grandTotalCost - order.discountAmount;

    // Find the user associated with the order
    const user = await User.findById(order.userId._id);
    if (user) {
      // Ensure user.wallet is initialized, if not set to 0
      if (user.wallet === undefined) {
        user.wallet = 0;
      }

      // Add the refund amount to the user's wallet
      user.wallet += refundAmount;

      // Create a wallet transaction for the return
      const transaction = new Wallet({
        userId: user._id, // Make sure to associate the transaction with the user
        amount: refundAmount,
        status: 'Returned',
        description: `Refund for order #${order.orderNumber}`
      });

      // Save the transaction
      await transaction.save();

      // Push the transaction ID to the walletHistory array
      user.walletHistory = user.walletHistory || []; // Ensure walletHistory is initialized
      user.walletHistory.push(transaction._id);

      // Save the updated user document with the new wallet balance and walletHistory
      await user.save();
    }

    // Update the order status to "Returned"
    order.orderStatus = "Return";
    await order.save();

    // Log the wallet history for debugging
    console.log('Wallet History:', user.walletHistory);

    // Redirect to the order management page
    res.redirect("/admin/orderManagement");
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).send('Server Error');
  }
};


//cancelled
const changeStatusCancelled = async (req, res) => {
  try {
    let orderData = await Order
      .findOne({ _id: req.params.id })
      .populate("userId");
    await User.findByIdAndUpdate(
      { _id: orderData.userId._id },
      // { wallet: orderData.grandTotalCost }
    );
    orderData.orderStatus = "Cancelled";
    orderData.save();
    console.log("orderData",orderData);
    
    res.redirect("/admin/orderManagement");
  } catch (error) {
    console.error(error);
  }
};




module.exports = {
  orderManagement,
  changeStatusCancelled,
  changeStatusReturn,
  changeStatusDelivered,
  changeStatusShipped,
  changeStatusPending,
  
};
