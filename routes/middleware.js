const jwt = require('jsonwebtoken');

// Middleware to verify JWT and ensure admin access
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Make sure this env var exists

    if (decoded.user_type !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Not an admin' });
    }

    req.user = decoded; // store decoded info (like user_id) in request
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const authenticateShopOwner = (req, res, next) => {
    const authHeader = req.headers.authorization;
  
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
  
    const token = authHeader.split(' ')[1];
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
      if (decoded.user_type !== 'shop_owner') {
        return res.status(403).json({ error: 'Forbidden: Not a shop owner' });
      }
  
      req.user = decoded; // Add user info to request
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };


const verifyCustomerToken= (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.user_type !== 'customer') {
      return res.status(403).json({ message: 'Access denied: not a customer' });
    }

    req.customer = decoded; // ✅ Pass customer info to next middleware/route
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}


  module.exports = {
    authenticateAdmin,
    authenticateShopOwner,
    verifyCustomerToken
  };