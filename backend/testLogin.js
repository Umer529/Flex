const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api/auth';

// Test credentials
const TEST_CREDENTIALS = {
  domain_id: '23L-1010', 
  password: 'pass123'
};

// Simple test function
async function testLogin() {
  try {
    console.log('Attempting to login with:', TEST_CREDENTIALS);
    
    const response = await axios.post(`${API_BASE_URL}/login`, TEST_CREDENTIALS);
    console.log('Login successful!');
    console.log('Response data:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    throw error;
  }
}

// Run the test
testLogin()
  .then(data => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed');
    process.exit(1);
  });