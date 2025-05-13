const sql = require('mssql/msnodesqlv8')
const config = require('./config')

// SQL Server configuration
const sqlConfig = {
  server: config.DB_SERVER + "\\SQLEXPRESS",
  database: config.DB_NAME,
  driver: "msnodesqlv8",
  options: {
    trustedConnection: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
}

// Get connection pool
const getConnection = async () => {
  try {
    // Make sure that the connection is established
    return await sql.connect(sqlConfig)
  } catch (err) {
    console.error("Database connection failed:", err)
    throw err
  }
}

// Execute stored procedure
const executeStoredProcedure = async (procedureName, params = {}, existingRequest = null) => {
  try {
    const pool = await getConnection()
    const request = existingRequest || pool.request()
    
    // Add parameters to the request
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value)
    })
    
    // Log the procedure call for debugging
    console.log(`Executing stored procedure: ${procedureName} with params:`, params)
    
    try {
      return await request.execute(procedureName)
    } catch (execError) {
      console.error(`Error executing stored procedure ${procedureName}:`, execError)
      
      // Fallback to direct query for GetUserByDomainId
      if (procedureName === 'GetUserByDomainId' && params.domain_id) {
        console.log('Falling back to direct query for GetUserByDomainId')
        const directQuery = await pool.request()
          .input('domain_id', sql.VarChar, params.domain_id)
          .query('SELECT * FROM Users WHERE domain_id = @domain_id')
        return directQuery
      }
      throw execError
    }
  } catch (err) {
    console.error(`Error in executeStoredProcedure ${procedureName}:`, err)
    throw err
  }
}

module.exports = {
  getConnection,
  executeStoredProcedure,
  sql,
}