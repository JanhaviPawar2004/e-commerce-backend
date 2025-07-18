require('dotenv').config(); // Load .env

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

const loginRoute = require('./routes/login');
const signupRoute = require('./routes/signup');
const overviewRoute = require('./routes/overview');
const forgotPasswordRoutes = require('./routes/forgotPassword');
const feedbackRoute = require('./routes/feedback');
const statRoute = require('./routes/statistics');
const storeRoute = require('./routes/stores');
const productsRoute = require('./routes/products');
const customerRoute = require('./routes/customers');
const ordersRoute = require('./routes/orders');
const customerORoute = require('./routes/customers_orders');
const customerAuthRoutes = require('./routes/cus_auth');
const todoRoutes =require('./routes/todos');
const shopRoutes = require('./routes/shopRoutes');
const customerOrderPlaced = require('./routes/orderplaced');
const storeDetailsRoute = require('./routes/storeDetails');
const cartRoutes = require('./routes/carts');
const paymentRoutes = require('./routes/payment');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/login', loginRoute);
app.use('/api/signup', signupRoute);
app.use('/api/forgot-password', forgotPasswordRoutes);
app.use('/api/stats/overview', overviewRoute);
app.use('/api/feedback', feedbackRoute);
app.use('/api/statistics', statRoute);
app.use('/api/adminstore', storeRoute);
app.use('/api/products', productsRoute);
app.use('/api/customers', customerRoute);
app.use('/api/orders', ordersRoute);
app.use('/api/customers_orders', customerORoute);
app.use('/api/store', storeDetailsRoute);
app.use('/api', customerOrderPlaced);
app.use('/api', shopRoutes);
app.use('/api', cartRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/todos',todoRoutes);
app.use('/api/customer/auth', customerAuthRoutes);


const adminOwnerRoutes = require('./routes/admin-owner');
app.use('/api/admin', adminOwnerRoutes);


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
