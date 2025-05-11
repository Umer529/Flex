const config = {
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
    }
  };