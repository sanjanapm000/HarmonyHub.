const Order = require("../../models/orderSchema.js");
const User = require("../../models/userSchema.js");
const Wallet = require("../../models/walletSchema.js");
const Address = require('../../models/addressSchema.js');
const Product = require("../../models/productSchema.js")



const viewOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Fetch the order by its ID, populating user details
    const order = await Order.findById(orderId).populate("userId").populate("addressChosen._Id");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    // Prepare order data to pass to the view
    const orderData = {
      orderStatus: order.orderStatus,
      orderDate: order.createdAt,
      orderNumber: order.orderNumber,
      grandTotalCost: order.grandTotalCost,
      paymentType: order.paymentType,
      cartData: order.cartData,
      addressChosen: order.addressChosen,
      userId: order.userId._id,
    };


    const addressChosen = orderData.addressChosen;

    const addressData = await Address.findOne({'address._id':addressChosen});    

    const isCancelled = orderData.orderStatus === 'Cancelled';
    const isDelivered = orderData.orderStatus === 'Delivered';
    const selectedAddress = addressData.address.find(address => address._id.equals(orderData.addressChosen));
    
    // Pass order data to the view
    res.render("orderStatusAdmin", { orderData , isCancelled,
      isDelivered,addressData,selectedAddress,orderId});
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error while fetching order details");
  }
};












// order management page
const orderManagement = async (req, res) => {
  try {
    let page = Number(req.query.page) || 1;
    let limit = 15;
    let skip = (page - 1) * limit;

    let count = await Order.find().estimatedDocumentCount();
    let orderData = await Order
      .find()
      .populate("userId")
      .sort({createdAt:1})
      .skip(skip)
      .limit(limit)
      
     
      // console.log("admin order",orderData.map(order => order.createdAt));

    // console.log(orderData[0]);
    // console.log("order data::::",orderData);
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




const changeStatusReturn = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id }).populate("userId");
    if (!order) {
      throw new Error('Order not found');
    }

    const refundAmount = order.grandTotalCost - order.discountAmount;

    const user = await User.findById(order.userId._id);
    if (user) {
      if (user.wallet === undefined) {
        user.wallet = 0;
      }

      user.wallet += refundAmount;

      const transaction = new Wallet({
        userId: user._id, 
        amount: refundAmount,
        status: 'Returned',
        description: `Refund for order #${order.orderNumber}`
      });

      await transaction.save();

      user.walletHistory = user.walletHistory || []; 
      user.walletHistory.push(transaction._id);

      await user.save();
    }

    order.orderStatus = "Return";
    await order.save();

    console.log('Wallet History:', user.walletHistory);

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
      .populate("userId")
      .populate("cartData.productId");
     
    await User.findByIdAndUpdate(
      { _id: orderData.userId._id },
      // { wallet: orderData.grandTotalCost }
    );

    for (let item of orderData.cartData) {
      const product = await Product.findById(item.productId._id);

      if (product) {
        product.quantity += item.productQty;
        await product.save();  
        console.log(`Restored stock for product: ${product.name}, new stock: ${product.quantity}`);
      }
    }




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
  viewOrderStatus,
};
