const PDFDocument = require("pdfkit");
const Order = require('../models/orderSchema');
const Address = require('../models/addressSchema')




function generateHeader(doc) {
  doc
    .fillColor("#444444")
    .fontSize(20)
    .text("HarmmonyHub.", 110, 57)
    .fontSize(10)
    .text("HarmonyHub., JM Street, Ahmedabad, Gujarat, India ", 200, 65, {
      align: "right",
    })
    .text(" Ahmedabad,  6100025", 200, 80, { align: "right" })
    .moveDown();
}

function generateFooter(doc) {
  doc.fontSize(10).text("Thank You! Shop with us again :)", 50, 750, {
    align: "center",
    width: 500,
  });
}
 async function generateCustomerInformation(doc,orderData) {
   
    //  const order_Id = orderId._id;
    // console.log("orderId invoice",order_Id);
    

    //     // Fetch the order data and populate necessary fields
    //     const orderData = await Order.findById(order_Id)
    //         .populate('cartData.product._Id') // Populate product details
    //         .populate('addressChosen._Id'); // Populate address details

    
    
    const addressChosen = orderData.addressChosen;
    console.log("addressChosen....",addressChosen);
    
    const addressData = await Address.findOne({'address._id':addressChosen});    
    console.log("my orderdata:", addressData);


const selectedAddress = addressData.address.find(address => address._id.equals(orderData.addressChosen));
    console.log("selectedAddress",selectedAddress);
    console.log("orderData.orderNumber",orderData.orderNumber);

       
    doc
    .text(`Order Number: ${orderData.orderNumber}`, 50, 100)
    .text(
      `Order Date: ${new Date(orderData.orderDate).toLocaleDateString()}`,
      50,
      115
    )
    .text(`Total Price: ${orderData.grandTotalCost}`, 50, 130)
    .text(
      `${selectedAddress.addressType}`,
      300,
      100
    )
    .text(
      `Address: ${selectedAddress.name} ${selectedAddress.city} ${selectedAddress.state} ${selectedAddress.landMark} ${selectedAddress.pincode} `,
      300,
      115
    )
    .text(`Phone: ${selectedAddress.phone}`, 300, 150)
    .moveDown();       
 }
 

function generateBody(doc, orderData) {
  generateHr(doc, 90);

  doc.fontSize(15).text("Invoice", 210, 170);

  doc.font("Helvetica-Bold").fontSize(14).text("Product", 50, 240);
  doc.text("Quantity", 250, 240);
  doc.text("Price", 350, 240, { width: 100, align: "right" });

  doc.moveDown();
  generateHr(doc, 260);

  orderData.cartData.forEach((v, i) => {
    doc.fontSize(10).text(v.productId.productName, 50, 260 + (i + 1) * 20);
    doc.text(v.productQty.toString(), 250, 260 + (i + 1) * 20);
    doc.text('Rs.'+v.totalCostPerProduct, 350, 260 + (i + 1) * 20, {
      width: 100,
      align: "right",
    });

    if (i !== orderData.cartData.length - 1) {
      doc.moveDown();
    }
  });

  generateHr(doc, doc.y);
  doc.moveDown();

  doc
    .fontSize(14)
    .text(`Total Price: ${'Rs.'+orderData.grandTotalCost}`, 350, doc.y);
}

function generateHr(doc, y) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}



const generatevoice = async (dataCallback, endCallback, orderData) => {
    let doc = new PDFDocument({ size: "A4", margin: 50 });
console.log(doc);
    generateHeader(doc);
    await generateCustomerInformation(doc, orderData);
    generateBody(doc, orderData);
    generateFooter(doc);
    doc.on("data", dataCallback);
    doc.on("end", endCallback);

    doc.end();
  }



module.exports = {generatevoice}