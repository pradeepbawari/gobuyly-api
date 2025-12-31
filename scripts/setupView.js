require('dotenv').config();
const { sequelize } = require('../models');

async function setupDatabaseView() {
  console.log('🔄 Creating database view...');
  
  try {
    // First, let's check your actual table structure
    console.log('🔍 Checking table structure...');
    
    const [productsColumns] = await sequelize.query('DESCRIBE products');
    const [variantsColumns] = await sequelize.query('DESCRIBE product_variants');
    const [colorsColumns] = await sequelize.query('DESCRIBE colors');
    const [companiesColumns] = await sequelize.query('DESCRIBE companies_new');
    
    console.log('📊 Products columns:', productsColumns.map(c => c.Field).join(', '));
    console.log('📊 Variants columns:', variantsColumns.map(c => c.Field).join(', '));
    
    // Find the actual column names
    const productIdCol = productsColumns.find(c => c.Field.includes('id'))?.Field || 'id';
    const productNameCol = productsColumns.find(c => 
      c.Field.includes('name') || c.Field.includes('product_name')
    )?.Field || 'name';
    
    // Look for sort order column (might be named differently)
    const sortOrderCol = productsColumns.find(c => 
      c.Field.includes('sort') || c.Field.includes('order') || 
      c.Field.includes('position') || c.Field.includes('sequence')
    )?.Field || 'createdAt'; // fallback
    
    console.log(`Using sort column: ${sortOrderCol}`);
    
    // 1. Drop view if exists
    await sequelize.query('DROP VIEW IF EXISTS product_display_view');
    console.log('✅ Old view dropped');
    
    // 2. Create new view with correct column names
    const createViewSQL = `
      CREATE VIEW product_display_view AS
      SELECT 
        p.${productIdCol} as id,
        p.${productNameCol} as product_name,
        p.company,
        p.dealer_id,
        p.subcategory_id,
        p.createdAt,
        p.updatedAt,
        p.${sortOrderCol} as sort_order,
        
        -- Color info
        c.id as color_id,
        c.name as color_name,
        v.colour as raw_color,
        
        -- Company info
        cn.company_id,
        cn.name as company_name,
        
        -- Variant info
        v.id as variant_id,
        v.dimensions,
        v.materials,
        v.price,
        v.sale_price,
        v.stock,
        v.sku,
        v.deleted as variant_deleted,
        v.color_id as variant_color_id,
        v.company_id as variant_company_id,
        
        -- PRE-FORMATTED TITLE (MAIN FEATURE)
        CONCAT(
          p.${productNameCol}, ' - ',
          COALESCE(c.name, v.colour, 'N/A'), ' - ',
          COALESCE(v.dimensions, 'N/A'), ' - ',
          COALESCE(cn.name, 'N/A')
        ) as formatted_title
        
      FROM products p
      LEFT JOIN product_variants v ON p.${productIdCol} = v.product_id AND v.deleted = 0
      LEFT JOIN colors c ON v.color_id = c.id
      LEFT JOIN companies_new cn ON v.company_id = cn.company_id
      WHERE v.deleted = 0
    `;
    
    console.log('📝 Creating view with SQL:', createViewSQL.substring(0, 200) + '...');
    
    await sequelize.query(createViewSQL);
    console.log('✅ Database view created successfully!');
    
    // 3. Try to create indexes (skip if fails)
    try {
      await sequelize.query(`CREATE INDEX idx_products_created ON products(createdAt)`);
      console.log('✅ Index created on products.createdAt');
    } catch (indexError) {
      console.log('ℹ️ Index already exists or cannot be created');
    }
    
    // 4. Test the view
    const [result] = await sequelize.query('SELECT COUNT(*) as count FROM product_display_view');
    console.log(`✅ View contains ${result[0].count} records`);
    
    // 5. Show sample of formatted titles
    const [sample] = await sequelize.query(`
      SELECT 
        product_name,
        formatted_title,
        color_name,
        company_name
      FROM product_display_view 
      LIMIT 5
    `);
    
    console.log('\n🎯 Sample formatted titles:');
    sample.forEach((row, i) => {
      console.log(`${i + 1}. ${row.formatted_title}`);
    });
    
    console.log('\n🎉 Database view setup completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating view:', error.message);
    console.error('\n💡 Troubleshooting tips:');
    console.error('1. Check if all tables exist: products, product_variants, colors, companies_new');
    console.error('2. Verify column names match exactly');
    console.error('3. Check database permissions');
    process.exit(1);
  }
}

// Run only if called directly
if (require.main === module) {
  setupDatabaseView();
}

module.exports = setupDatabaseView;