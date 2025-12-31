const ViewManager = require('../utiles/viewManager');

exports.testView = async (req, res) => {
  try {
    const viewInfo = await ViewManager.getViewInfo();
    
    if (!viewInfo.exists) {
      return res.json({
        success: false,
        message: 'Database view does not exist. Run setup script.',
        command: 'node scripts/setupView.js'
      });
    }
    
    // Test a simple query
    const [sample] = await sequelize.query(
      `SELECT 
        product_name, 
        formatted_title,
        color_name,
        company_name,
        price
       FROM product_display_view 
       ORDER BY sort_order 
       LIMIT 5`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    res.json({
      success: true,
      viewInfo,
      sampleData: sample,
      message: 'Database view is working correctly!'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error testing view'
    });
  }
};

exports.createView = async (req, res) => {
  try {
    // Run setup
    const { exec } = require('child_process');
    
    exec('node scripts/setupView.js', (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
          stderr
        });
      }
      
      res.json({
        success: true,
        message: 'View creation initiated',
        output: stdout
      });
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};