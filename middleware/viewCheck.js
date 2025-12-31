const ViewManager = require('../utiles/viewManager');

const checkViewMiddleware = async (req, res, next) => {
  try {
    const viewExists = await ViewManager.checkViewExists();
    
    if (!viewExists) {
      console.warn('⚠️ Product view does not exist. Using fallback method.');
      
      // Attach flag to request
      req.useView = false;
      return next();
    }
    
    req.useView = true;
    next();
    
  } catch (error) {
    console.error('View check error:', error);
    req.useView = false;
    next();
  }
};

module.exports = checkViewMiddleware;