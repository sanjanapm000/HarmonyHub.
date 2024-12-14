const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const User =require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");


const getUserOrders = async (req, res) => {
    try {
        console.log("inside getUserOrders");
        
        const userId = req.session.user._id; 
        const addressData = await Address.findOne({userId:userId});
        const orders = await Order.find({ userId }) 
            .populate('cartData.productId') 
            .sort({ createdAt: -1 }); 
        const user= await User.findById(userId).populate('walletHistory');
        res.render("user-profile", {
            orders, 
            user, 
            userAddress:addressData,
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("An error occurred while fetching your orders.");
    }
};



const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
  
        const order = await Order.findOneAndUpdate(
            { _id: orderId },
            { $set: { orderStatus: 'Cancelled' } },
            { new: true }
        );
  
        if (!order) {
            return res.status(404).send('Order not found');
        }
  
        const user = await User.findById(order.userId);
        const refundAmount = order.grandTotalCost; 
  
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
  
        console.log('Order cancelled and refund processed');
  
        res.redirect('/order');
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).send('Something went wrong');
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
        console.log("addressChosen....",addressChosen);
        
        const addressData = await Address.findOne({'address._id':addressChosen});    
        console.log("my orderdata:", addressData);
         
        

        const selectedAddress = addressData.address.find(address => address._id.equals(orderData.addressChosen));
        console.log("selectedAddress",selectedAddress);
        

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


module.exports={
    getUserOrders,
    cancelOrder,
    orderStatusPage,
    processOrderPayment,
    handleOrderCancellation,
}