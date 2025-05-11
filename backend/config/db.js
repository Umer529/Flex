/*const sql = require("mssql")
//const config = require("./config")

// SQL Server configuration
const sqlConfig = {
  server: "localhost\\SQLEXPRESS",
  database: "LMS2",
  driver: "msnodesqlv8",
  options: {
    trustedConnection: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
};
 

sql.connect(sqlConfig,function(err){
if(err) console.log(err)
    var request=new sql.Request();
    request.query("select * from users",function(err,records){
        if(err) console.log(err)
        else console.log(records)
    })
})
 }*/
const sql=require('mssql/msnodesqlv8')

var sqlConfig={
    server:"localhost\\SQLEXPRESS",
    database:"LMS2",
    driver:"msnodesqlv8",
    options:{
        trustedConnection:true
    }
}

sql.connect(sqlConfig,function(err){
if(err) console.log(err)
    var request=new sql.Request();
    request.query("select * from users",function(err,records){
        if(err) console.log(err)
        else console.log(records)
    })
})

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

module.exports = {
  getConnection,
  sql,
}
