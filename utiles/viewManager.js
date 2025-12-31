const { sequelize } = require('../models');

class ViewManager {
  // Check if view exists (MySQL version)
  static async checkViewExists() {
    try {
      const [result] = await sequelize.query(`
        SHOW FULL TABLES WHERE TABLE_TYPE LIKE 'VIEW' AND Tables_in_${sequelize.config.database} = 'product_display_view'
      `);
      
      return result.length > 0;
    } catch (error) {
      console.error('Error checking view:', error.message);
      
      // Alternative method
      try {
        const [result2] = await sequelize.query(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = '${sequelize.config.database}' 
          AND TABLE_TYPE = 'VIEW'
          AND TABLE_NAME = 'product_display_view'
        `);
        return result2.length > 0;
      } catch (error2) {
        return false;
      }
    }
  }

  // Refresh view (MySQL)
  static async refreshView() {
    try {
      console.log('🔄 Refreshing product view...');
      
      // Get the view definition first
      const [viewDef] = await sequelize.query(`
        SHOW CREATE VIEW product_display_view
      `);
      
      if (!viewDef || !viewDef[0]) {
        throw new Error('View not found');
      }
      
      const createStatement = viewDef[0]['Create View'];
      
      // Drop and recreate
      await sequelize.query('DROP VIEW IF EXISTS product_display_view');
      await sequelize.query(createStatement);
      
      console.log('✅ View refreshed at:', new Date());
      return true;
    } catch (error) {
      console.error('Error refreshing view:', error.message);
      return false;
    }
  }

  // Get view info (MySQL)
  static async getViewInfo() {
    try {
      // Check if view exists
      const exists = await this.checkViewExists();
      if (!exists) {
        return { exists: false, error: 'View not found' };
      }
      
      // Get row count
      const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM product_display_view');
      
      // Get columns
      const [columnsResult] = await sequelize.query('DESCRIBE product_display_view');
      
      // Get view definition
      const [viewDef] = await sequelize.query('SHOW CREATE VIEW product_display_view');
      
      return {
        exists: true,
        rowCount: countResult[0].count,
        columns: columnsResult.map(col => col.Field),
        definition: viewDef[0] ? viewDef[0]['Create View'].substring(0, 300) + '...' : 'N/A',
        database: sequelize.config.database,
        lastChecked: new Date()
      };
    } catch (error) {
      return { 
        exists: false, 
        error: error.message,
        database: sequelize.config.database 
      };
    }
  }

  // Simple check that works with all MySQL versions
  static async simpleCheck() {
    try {
      // Just try to query the view
      await sequelize.query('SELECT 1 FROM product_display_view LIMIT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ViewManager;